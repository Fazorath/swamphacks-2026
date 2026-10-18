import { render, screen, within } from "@testing-library/react";

import { App } from "./App";
import { expandPanel } from "./expandPanel";
import { fakeNodeState } from "./fakeNodeState";
import { setViewport } from "./fakeViewport";
import { qrModules, wifiPayload } from "./joinHotspot";

const HOTSPOT = {
  ssid: "stormshield-mesh",
  password: "correct-horse",
  url: "http://10.88.0.1:8000",
};

function stubNode(join: Response) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url === "/api/state") return Response.json(fakeNodeState());
      if (url === "/api/join") return join;
      return new Response(null, { status: 404 });
    }),
  );
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => vi.restoreAllMocks());

describe("the codes' contents", () => {
  it("writes the hotspot in the WIFI: form phones read", () => {
    expect(wifiPayload(HOTSPOT)).toBe("WIFI:T:WPA;S:stormshield-mesh;P:correct-horse;;");
  });

  it("escapes the characters that would end a field early", () => {
    expect(wifiPayload({ ...HOTSPOT, ssid: "a;b", password: 'p:w,"\\' })).toBe(
      'WIFI:T:WPA;S:a\\;b;P:p\\:w\\,\\"\\\\;;',
    );
  });

  it("draws a square code that differs with its payload", () => {
    const wifi = qrModules(wifiPayload(HOTSPOT));
    const url = qrModules(HOTSPOT.url);
    expect(wifi.length).toBe(wifi[0].length);
    expect(wifi).not.toEqual(url);
  });
});

describe("the Join card", () => {
  it("shows both codes in the hand-off card on a desktop with no Household Profile", async () => {
    stubNode(Response.json(HOTSPOT));
    render(<App />);
    expandPanel("Evacuation Plan");

    const card = await screen.findByRole("region", { name: "Your plan lives on your phone" });
    expect(
      await within(card).findByRole("img", { name: "Join the Wi-Fi stormshield-mesh" }),
    ).toBeVisible();
    expect(
      within(card).getByRole("img", { name: "Open the dashboard http://10.88.0.1:8000" }),
    ).toBeVisible();
    expect(within(card).getAllByRole("img")).toHaveLength(2);
  });

  it("says why there is nothing to scan when this machine is not told the hotspot", async () => {
    stubNode(new Response(null, { status: 403 }));
    render(<App />);
    expandPanel("Evacuation Plan");

    const card = await screen.findByRole("region", { name: "Your plan lives on your phone" });
    expect(await within(card).findByText(/nothing to scan/)).toBeVisible();
    expect(within(card).queryAllByRole("img")).toHaveLength(0);
  });

  it("is not on a phone", async () => {
    setViewport(390);
    stubNode(Response.json(HOTSPOT));
    render(<App />);
    await screen.findByRole("tablist");
    expect(screen.queryByRole("region", { name: "Your plan lives on your phone" })).toBeNull();
  });
});
