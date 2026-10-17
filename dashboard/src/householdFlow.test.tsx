import { act, fireEvent, render, screen } from "@testing-library/react";

import { App } from "./App";
import { fakeNodeState } from "./fakeNodeState";
import { STATE_POLL_MS } from "./useNodeState";

const KEY = "storm-shield.household-profile";

let fetchSpy: ReturnType<typeof vi.fn>;
// While set, /api/state fails, so the page keeps retrying an unreachable Node.
let nodeDown: boolean;

beforeEach(() => {
  localStorage.clear();
  nodeDown = false;
  fetchSpy = vi.fn(async (path: string) => {
    if (nodeDown && path === "/api/state") throw new TypeError("Failed to fetch");
    if (path === "/api/cache-pack") {
      return Response.json({
        available: true,
        manifest: { route_grid: { south: 27.9, west: 85.1, lat_step: 0.01, lon_step: 0.01 } },
      });
    }
    if (path.endsWith("shelters.json")) return Response.json([]);
    if (path.endsWith("flood_prone.geojson")) return Response.json({ features: [] });
    if (path.includes("/routes/") || path.endsWith("roads.json")) {
      return new Response(null, { status: 404 });
    }
    return Response.json(path === "/api/state" ? fakeNodeState() : []);
  });
  vi.stubGlobal("fetch", fetchSpy);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function tapHomeOnMap() {
  fireEvent.click(screen.getByRole("button", { name: "Set home on map" }));
  fireEvent.click(document.querySelector(".node-map")!, { clientX: 10, clientY: 10 });
  fireEvent.click(screen.getByRole("button", { name: "Done" }));
}

function fillInProfile() {
  fireEvent.click(screen.getByRole("button", { name: "My household" }));
  tapHomeOnMap();
  fireEvent.click(screen.getByRole("radio", { name: "Mobile home / RV" }));
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
}

test("a missing profile prompts the resident to fill one in", () => {
  render(<App />);
  expect(screen.getByText("Fill in your household profile")).toBeInTheDocument();
  expect(document.querySelector(".home-marker")).toBeNull();
});

test("save stays disabled until home and housing type are set", () => {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "My household" }));
  expect(screen.getByText("Stays on this device")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  fireEvent.click(screen.getByRole("radio", { name: "Site-built home" }));
  expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  tapHomeOnMap();
  expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
});

test("a saved profile survives a reload and shows the Home marker", () => {
  const first = render(<App />);
  fillInProfile();
  expect(document.querySelector(".home-marker")).not.toBeNull();
  first.unmount();

  render(<App />);
  expect(screen.getByText("Household profile saved")).toBeInTheDocument();
  expect(document.querySelector(".home-marker")).not.toBeNull();
  expect(JSON.parse(localStorage.getItem(KEY)!).profile.housing).toBe("mobile-home-rv");
});

test("deleting needs a second confirming click and returns to the prompt", () => {
  render(<App />);
  fillInProfile();
  fireEvent.click(screen.getByRole("button", { name: "My household" }));
  fireEvent.click(screen.getByRole("button", { name: "Delete my profile" }));
  expect(localStorage.getItem(KEY)).not.toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Yes, delete" }));
  expect(localStorage.getItem(KEY)).toBeNull();
  expect(screen.getByText("Fill in your household profile")).toBeInTheDocument();
});

test("a storage failure shows a message and the profile still works for the session", () => {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new DOMException("quota", "QuotaExceededError");
  });
  vi.spyOn(console, "error").mockImplementation(() => {});
  render(<App />);
  fillInProfile();
  expect(screen.getByRole("alert")).toHaveTextContent(/will not be remembered/);
  expect(screen.getByText("Household profile saved")).toBeInTheDocument();
  expect(document.querySelector(".home-marker")).not.toBeNull();
});

test("an unreadable stored value shows a message, counts as missing and is not deleted", () => {
  localStorage.setItem(KEY, "{not json");
  render(<App />);
  expect(screen.getByRole("alert")).toHaveTextContent(/could not be read/);
  expect(screen.getByText("Fill in your household profile")).toBeInTheDocument();
  expect(localStorage.getItem(KEY)).toBe("{not json");
});

test("an unsaved home shows only as a preview, not as the Home marker", () => {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "My household" }));
  tapHomeOnMap();
  expect(document.querySelector(".home-draft-marker")).not.toBeNull();
  expect(document.querySelector(".home-marker")).toBeNull();
});

test("pick mode hides the form until Done is pressed", () => {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "My household" }));
  fireEvent.click(screen.getByRole("button", { name: "Set home on map" }));
  expect(screen.getByText(/Tap the map to place your home/)).toBeInTheDocument();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Done" }));
  expect(screen.queryByText(/Tap the map to place your home/)).not.toBeInTheDocument();
  expect(screen.getByRole("dialog", { name: "My household" })).toBeInTheDocument();
});

test("a failed delete still clears the profile for the session and says so", () => {
  render(<App />);
  fillInProfile();
  vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
    throw new DOMException("blocked", "SecurityError");
  });
  vi.spyOn(console, "error").mockImplementation(() => {});
  fireEvent.click(screen.getByRole("button", { name: "My household" }));
  fireEvent.click(screen.getByRole("button", { name: "Delete my profile" }));
  fireEvent.click(screen.getByRole("button", { name: "Yes, delete" }));
  expect(screen.getByRole("alert")).toHaveTextContent(/will not be remembered/);
  expect(screen.getByText("Fill in your household profile")).toBeInTheDocument();
});

test("no request carries the profile, across several poll cycles and an unreachable stretch", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  render(<App />);
  fillInProfile();
  const { home } = JSON.parse(localStorage.getItem(KEY)!).profile;
  await act(() => vi.advanceTimersByTimeAsync(5 * STATE_POLL_MS));
  nodeDown = true;
  await act(() => vi.advanceTimersByTimeAsync(7 * STATE_POLL_MS));
  expect(screen.getByText(/Node unreachable/)).toBeInTheDocument();
  nodeDown = false;
  await act(() => vi.advanceTimersByTimeAsync(2 * STATE_POLL_MS));
  // The one allowed exception (docs/adr/0003): asking for the file of the Grid point nearest home.
  const requests = fetchSpy.mock.calls.map(([path]) => String(path));
  const routeFileRequests = requests.filter((path) => path.includes("/routes/"));
  expect(routeFileRequests.length).toBeGreaterThan(0);
  for (const path of routeFileRequests) {
    expect(path).toMatch(/^\/api\/cache-pack\/files\/routes\/\d+_\d+\.json$/);
  }
  expect(requests.filter((path) => path === "/api/state").length).toBeGreaterThanOrEqual(5);
  const sent = JSON.stringify(requests.filter((path) => !path.includes("/routes/")));
  expect(sent).not.toMatch(/mobile-home-rv|housing|"lat"|"lon"/);
  expect(sent).not.toContain(String(home.lat));
  expect(sent).not.toContain(String(home.lon));
});
