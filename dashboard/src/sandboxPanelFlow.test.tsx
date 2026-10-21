import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { App } from "./App";
import type { CommunityWarning } from "./communityWarnings";
import { fakeNodeState } from "./fakeNodeState";
import { sourceData } from "./fakeMaplibre";
import type { SandboxNode, SandboxNodes } from "./useSandboxNodes";

const HUB_AT: [number, number] = [27.97, 85.18];
const NEAR_AT: [number, number] = [27.92, 85.14];
const FAR_AT: [number, number] = [28.25, 85.37];
const WIDE_RANGE_M = 40_000;
const NARROW_RANGE_M = 10_000;

function node(
  id: string,
  position: [number, number],
  overrides: Partial<SandboxNode> = {},
): SandboxNode {
  return {
    id,
    name: id,
    role: "sensor",
    position,
    links: [],
    hops: 1,
    heard_warning: false,
    ...overrides,
  };
}

// Everyone in range of the Hub.
const WIDE: SandboxNodes = {
  radio_range_m: WIDE_RANGE_M,
  nodes: [
    node("hub", HUB_AT, { role: "hub", hops: 0, links: ["near", "far"] }),
    node("near", NEAR_AT, { links: ["hub"] }),
    node("far", FAR_AT, { links: ["hub"] }),
  ],
};

// The range cut to the Hub's one near neighbour: "far" has no path left.
const NARROW: SandboxNodes = {
  radio_range_m: NARROW_RANGE_M,
  nodes: [
    node("hub", HUB_AT, { role: "hub", hops: 0, links: ["near"] }),
    node("near", NEAR_AT, { links: ["hub"] }),
    node("far", FAR_AT, { hops: null }),
  ],
};

let posted: { path: string; body: unknown }[];
let listed: string[];

function stubTheHub(options: {
  sandbox: boolean;
  answer?: SandboxNodes;
  afterSetting?: SandboxNodes;
  warnings?: CommunityWarning[];
}) {
  posted = [];
  listed = [];
  let current = options.answer ?? WIDE;
  vi.stubGlobal("fetch", async (path: string, init?: RequestInit) => {
    if (path === "/api/sandbox/nodes") {
      listed.push(path);
      return Response.json(current);
    }
    if (path === "/api/sandbox/radio-range" && init?.method === "POST") {
      posted.push({ path, body: JSON.parse(init.body as string) });
      current = options.afterSetting ?? current;
      return Response.json(current);
    }
    if (path === "/api/state") {
      return Response.json(
        fakeNodeState({
          id: "hub",
          name: "hub",
          sandbox: options.sandbox ? { label: "SIMULATED" } : null,
          community_warnings: options.warnings ?? [],
        }),
      );
    }
    return new Response(null, { status: 404 });
  });
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function sandboxPanel() {
  render(<App />);
  return await screen.findByRole("region", { name: "Sandbox" });
}

// How far north of its centre a circle reaches, in metres.
function radiusOf(circle: GeoJSON.Feature): number {
  const [[...ring]] = (circle.geometry as GeoJSON.Polygon).coordinates;
  const latitudes = ring.map(([, lat]) => lat);
  return ((Math.max(...latitudes) - Math.min(...latitudes)) / 2) * 111_320;
}

test("outside the Sandbox there is no Sandbox Panel and the Node never gets asked about one", async () => {
  stubTheHub({ sandbox: false });
  render(<App />);
  await screen.findByRole("button", { name: "Hub" });
  expect(screen.queryByRole("region", { name: "Sandbox" })).not.toBeInTheDocument();
  expect(listed).toEqual([]);
});

test("the Panel lists each Node's hops to the Hub, and a Sensor with none is marked on the list and the map", async () => {
  stubTheHub({ sandbox: true, answer: NARROW });
  const panel = await sandboxPanel();
  const rows = await within(panel).findAllByRole("listitem");
  expect(rows.map((row) => row.textContent)).toEqual([
    "hubHubno warning yet",
    "near1 hop to Hubno warning yet",
    "farno path to Hubno warning yet",
  ]);
  // The list says it, and so does the marker pinned to the Sensor on the map.
  expect(await screen.findAllByText("no path to Hub")).toHaveLength(2);
});

test("a Node that heard the latest warning is ticked, and one that did not is not", async () => {
  const warned: SandboxNodes = {
    ...NARROW,
    nodes: NARROW.nodes.map((each) => ({ ...each, heard_warning: each.id !== "far" })),
  };
  const warning: CommunityWarning = {
    id: 1,
    t: 0,
    nodes: ["near"],
    reasons: ["water_surge"],
    origin: "near",
    origin_km: 3,
    surge_t: 0,
  };
  stubTheHub({ sandbox: true, answer: warned, warnings: [warning] });
  const panel = await sandboxPanel();
  expect(await within(panel).findByText("has not heard the warning")).toBeInTheDocument();
  expect(within(panel).getAllByText("heard the warning")).toHaveLength(2);
});

test("the map draws a circle for every Node at the radio range, and a line between Nodes in range", async () => {
  stubTheHub({ sandbox: true });
  await sandboxPanel();
  await waitFor(() => expect(sourceData("radio-range").features).toHaveLength(3));
  for (const circle of sourceData("radio-range").features) {
    expect(radiusOf(circle)).toBeCloseTo(WIDE_RANGE_M, -2);
  }
  expect(sourceData("radio-links").features).toHaveLength(2);
});

test("moving the slider sends the range to the Sandbox, and the circles, links and hops follow", async () => {
  stubTheHub({ sandbox: true, afterSetting: NARROW });
  const panel = await sandboxPanel();
  const slider = await within(panel).findByRole("slider", { name: "Radio range" });
  expect(slider).toHaveValue("40");

  fireEvent.change(slider, { target: { value: "10" } });

  expect(posted).toEqual([{ path: "/api/sandbox/radio-range", body: { radio_range_m: 10000 } }]);
  await waitFor(() => expect(sourceData("radio-links").features).toHaveLength(1));
  for (const circle of sourceData("radio-range").features) {
    expect(radiusOf(circle)).toBeCloseTo(NARROW_RANGE_M, -2);
  }
  expect(await within(panel).findByText("no path to Hub")).toBeInTheDocument();
  expect(within(panel).getByText("10.0 km")).toBeInTheDocument();
});

test("a range the Hub refuses is reported, not swallowed", async () => {
  stubTheHub({ sandbox: true });
  const panel = await sandboxPanel();
  const slider = await within(panel).findByRole("slider", { name: "Radio range" });
  vi.stubGlobal("fetch", async (path: string) =>
    path === "/api/sandbox/radio-range"
      ? Response.json({ detail: "range must be above zero" }, { status: 422 })
      : Response.json(WIDE),
  );

  fireEvent.change(slider, { target: { value: "0.1" } });

  expect(await within(panel).findByRole("alert")).toHaveTextContent(
    "Could not set the radio range: range must be above zero",
  );
});
