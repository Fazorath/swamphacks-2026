import { useState } from "react";

import type { FloodRisk } from "./nodeState";

export type PanelName = "readings" | "alerts" | "plan";

const PANEL_NAMES: PanelName[] = ["readings", "alerts", "plan"];
const SIDE_OF: Record<PanelName, "left" | "right"> = {
  readings: "left",
  alerts: "right",
  plan: "right",
};
const MOST_OPEN_PER_SIDE = 2;
const MOST_OPEN_PER_SIDE_ON_A_TABLET = 1;
const STORAGE_KEY = "storm-shield.open-panels";

// Oldest first, so the oldest of a side is the one a third Panel pushes out.
export function withPanelToggled(
  open: PanelName[],
  name: PanelName,
  mostPerSide = MOST_OPEN_PER_SIDE,
): PanelName[] {
  if (open.includes(name)) return open.filter((each) => each !== name);
  const next = [...open, name];
  const sameSide = next.filter((each) => SIDE_OF[each] === SIDE_OF[name]);
  const oldest = sameSide.length > mostPerSide ? sameSide[0] : null;
  return next.filter((each) => each !== oldest);
}

export function withPanelOpened(
  open: PanelName[],
  name: PanelName,
  mostPerSide = MOST_OPEN_PER_SIDE,
): PanelName[] {
  return open.includes(name) ? open : withPanelToggled(open, name, mostPerSide);
}

// A calm day shows the Readings and nothing else (D-50); a warning, or a Flood Risk of Elevated or
// High, brings up the Evacuation Plan, with the Alerts when there are any. The Readings stay: they
// are on the other side from the rest.
export function defaultPanels(level: FloodRisk["level"], warning: boolean): PanelName[] {
  if (warning) return ["readings", "alerts", "plan"];
  return level === "elevated" || level === "high" ? ["readings", "plan"] : ["readings"];
}

function readStored(): PanelName[] | null {
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null");
    if (!Array.isArray(stored)) return null;
    const known = stored.filter((each): each is PanelName => PANEL_NAMES.includes(each));
    return known.length === stored.length ? known : null;
  } catch (error) {
    // Unreadable storage is not an error to the resident: they get the defaults.
    console.error(error);
    return null;
  }
}

function writeStored(open: PanelName[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(open));
  } catch (error) {
    console.error(error);
  }
}

// Which Panels are open. Until the resident or a warning chooses, the defaults for the Flood Risk
// apply; after that the choice is remembered on this device.
export function useOpenPanels(defaults: PanelName[], tablet: boolean) {
  const mostPerSide = tablet ? MOST_OPEN_PER_SIDE_ON_A_TABLET : MOST_OPEN_PER_SIDE;
  const [chosen, setChosen] = useState<PanelName[] | null>(readStored);
  const open = chosen ?? defaults;
  const choose = (next: PanelName[]) => {
    setChosen(next);
    writeStored(next);
  };
  return {
    open,
    toggle: (name: PanelName) => choose(withPanelToggled(open, name, mostPerSide)),
    show: (...names: PanelName[]) =>
      choose(names.reduce((now, each) => withPanelOpened(now, each, mostPerSide), open)),
  };
}
