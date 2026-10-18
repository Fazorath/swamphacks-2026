import { useState } from "react";

import type { CommunityWarning } from "./communityWarnings";
import { issuedUnix, type OfficialAlert } from "./officialAlerts";

export type TakeoverWarning =
  | { kind: "official"; key: string; alert: OfficialAlert }
  | { kind: "community"; key: string; warning: CommunityWarning };

const STORAGE_KEY = "storm-shield.acknowledged-warnings";

// The two kinds have separate id spaces, so the key names the kind.
export const officialKey = (alert: OfficialAlert) => `official:${alert.id}`;
export const communityKey = (warning: CommunityWarning) => `community:${warning.id}`;

function everyWarning(alerts: OfficialAlert[], warnings: CommunityWarning[]): TakeoverWarning[] {
  return [
    ...[...alerts]
      .sort((a, b) => issuedUnix(a) - issuedUnix(b))
      .map((alert): TakeoverWarning => ({ kind: "official", key: officialKey(alert), alert })),
    ...[...warnings]
      .sort((a, b) => a.t - b.t)
      .map((warning): TakeoverWarning => ({
        kind: "community",
        key: communityKey(warning),
        warning,
      })),
  ];
}

// Not yet acknowledged on this device. Official comes before Community, the older of each first,
// so the resident reads them in the order they arrived within their kind.
export function pendingWarnings(
  alerts: OfficialAlert[],
  warnings: CommunityWarning[],
  acknowledged: string[],
): TakeoverWarning[] {
  return everyWarning(alerts, warnings).filter((each) => !acknowledged.includes(each.key));
}

// The newest acknowledged warning of each kind: what the banners under the top bar show.
export function bannerWarnings(
  alerts: OfficialAlert[],
  warnings: CommunityWarning[],
  acknowledged: string[],
): TakeoverWarning[] {
  const done = everyWarning(alerts, warnings).filter((each) => acknowledged.includes(each.key));
  return (["official", "community"] as const).flatMap((kind) => {
    const newest = done.filter((each) => each.kind === kind).at(-1);
    return newest ? [newest] : [];
  });
}

function readAcknowledged(): string[] {
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(stored) ? stored.filter((each) => typeof each === "string") : [];
  } catch (error) {
    console.warn("Acknowledged warnings could not be read; showing every warning again.", error);
    return [];
  }
}

// Acknowledgement belongs to this browser only, never to the Node: another phone has to
// acknowledge for itself. If storage is blocked it still holds until the page closes.
export function useAcknowledgedWarnings(): [string[], (key: string) => void] {
  const [acknowledged, setAcknowledged] = useState(readAcknowledged);
  const acknowledge = (key: string) => {
    const next = acknowledged.includes(key) ? acknowledged : [...acknowledged, key];
    setAcknowledged(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (error) {
      console.warn("Acknowledgement could not be saved on this device.", error);
    }
  };
  return [acknowledged, acknowledge];
}
