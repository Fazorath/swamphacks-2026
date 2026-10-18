import { fireEvent, render, screen, within } from "@testing-library/react";

import { App } from "./App";
import { fakeNodeState } from "./fakeNodeState";

const STORAGE_KEY = "storm-shield.weather-layer";

function stubNode() {
  const answers: Record<string, unknown> = {
    "/api/state": fakeNodeState({ nodes: [] }),
    "/api/cache-pack": { available: true, manifest: null },
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      url in answers ? Response.json(answers[url]) : new Response(null, { status: 404 }),
    ),
  );
}

const rail = () => within(screen.getByRole("navigation", { name: "Layers" }));
const weatherButton = () => rail().getByRole("button", { name: "Weather" });
const legend = () => screen.queryByRole("complementary", { name: "Weather legend" });

function pick(choice: string) {
  fireEvent.click(weatherButton());
  fireEvent.click(screen.getByRole("radio", { name: choice }));
}

beforeEach(() => {
  localStorage.clear();
  stubNode();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => vi.restoreAllMocks());

describe("the Weather picker", () => {
  it("offers Temperature, Cloud cover, Rain and Off, and nothing else", () => {
    render(<App />);
    fireEvent.click(weatherButton());

    const names = screen.getAllByRole("radio").map((choice) => choice.textContent);
    expect(names).toEqual(["Temperature", "Cloud cover", "Rain", "Off"]);
  });

  it("starts Off: a dim button and no legend", () => {
    render(<App />);

    expect(weatherButton()).toHaveAttribute("aria-pressed", "false");
    expect(legend()).toBeNull();
  });

  it("shows one layer at a time, and a new pick replaces the old one", () => {
    render(<App />);

    pick("Rain");
    expect(weatherButton()).toHaveAttribute("aria-pressed", "true");
    expect(legend()).toHaveTextContent("Rain");

    pick("Temperature");
    expect(legend()).toHaveTextContent("Temperature");
    expect(screen.getAllByRole("complementary", { name: "Weather legend" })).toHaveLength(1);
    fireEvent.click(weatherButton());
    expect(screen.getByRole("radio", { name: "Temperature" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("radio", { name: "Rain" })).toHaveAttribute("aria-checked", "false");
  });

  it("turns the button dim and clears the legend on Off", () => {
    render(<App />);
    pick("Cloud cover");

    pick("Off");

    expect(weatherButton()).toHaveAttribute("aria-pressed", "false");
    expect(legend()).toBeNull();
  });

  it("closes on Escape without changing the layer", () => {
    render(<App />);
    pick("Rain");
    fireEvent.click(weatherButton());

    fireEvent.keyDown(screen.getByRole("radiogroup"), { key: "Escape" });

    expect(screen.queryByRole("radiogroup")).toBeNull();
    expect(legend()).toHaveTextContent("Rain");
  });
});

describe("the remembered Weather layer", () => {
  it("is restored after a reload", () => {
    const first = render(<App />);
    pick("Cloud cover");
    first.unmount();

    render(<App />);

    expect(weatherButton()).toHaveAttribute("aria-pressed", "true");
    expect(legend()).toHaveTextContent("Cloud cover");
  });

  it("falls back to Off for a stored layer that no longer exists", () => {
    localStorage.setItem(STORAGE_KEY, "wind");

    render(<App />);

    expect(weatherButton()).toHaveAttribute("aria-pressed", "false");
    expect(legend()).toBeNull();
  });

  it("falls back to Off, without crashing, when storage cannot be read or written", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });

    render(<App />);
    expect(weatherButton()).toHaveAttribute("aria-pressed", "false");

    pick("Rain");
    expect(legend()).toHaveTextContent("Rain");
  });
});
