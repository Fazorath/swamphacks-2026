import { nepalClockTime } from "./EventClockTag";
import type { HouseholdProfile } from "./householdProfile";

export type OfficialAlert = {
  id: string;
  source: "dhm" | "ndrrma" | "district";
  mode: "live" | "replay";
  // The source's own timestamp, ISO 8601 with its offset; shown as given.
  issued: string;
  headline: string;
  applies_to: ("mobile_home" | "rv" | "flood_prone_area")[];
  url: string;
};

export const SOURCE_LABELS: Record<OfficialAlert["source"], string> = {
  dhm: "DHM",
  ndrrma: "NDRRMA",
  district: "District authorities",
};

export function officialTag(alert: OfficialAlert): string {
  return alert.mode === "replay" ? "OFFICIAL · REPLAY" : "OFFICIAL";
}

export function issuedUnix(alert: OfficialAlert): number {
  return Date.parse(alert.issued) / 1000;
}

// Tags only, never the headline's prose: an alert with no tags covers everyone in its zone.
export function appliesToHousehold(
  alert: OfficialAlert,
  profile: HouseholdProfile,
  homeInFloodProneArea: boolean,
): boolean {
  if (alert.applies_to.length === 0) return true;
  return alert.applies_to.some((tag) =>
    tag === "flood_prone_area" ? homeInFloodProneArea : profile.housing === "mobile-home-rv",
  );
}

// "Community Warning 08:37 · first Official Alert 09:05"; null until both exist.
export function leadTimeLine(
  firstCommunityWarningAt: number | null,
  alerts: OfficialAlert[],
): string | null {
  if (firstCommunityWarningAt === null || alerts.length === 0) return null;
  const firstAlertAt = Math.min(...alerts.map(issuedUnix));
  return `Community Warning ${nepalClockTime(firstCommunityWarningAt)} · first Official Alert ${nepalClockTime(firstAlertAt)}`;
}
