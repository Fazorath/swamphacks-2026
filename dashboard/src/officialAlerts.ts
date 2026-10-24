import { regionClockTime, regionDate, regionZoneLabel } from "./regionTime";
import type { HouseholdProfile } from "./householdProfile";
import type { Region } from "./nodeState";

export type OfficialAlert = {
  id: string;
  // A tag from the Region's `official_alert_sources`.
  source: string;
  mode: "live" | "replay";
  // The source's own timestamp, ISO 8601 with its offset; shown as given.
  issued: string;
  headline: string;
  applies_to: ("mobile_home" | "rv" | "flood_prone_area")[];
  url: string;
};

// The Region's name for the alert's source; the tag itself if the Region does not list it.
export function sourceName(region: Region | null, alert: OfficialAlert): string {
  return region?.official_alert_sources.find((s) => s.tag === alert.source)?.name ?? alert.source;
}

export function officialTag(alert: OfficialAlert): string {
  return alert.mode === "replay" ? "OFFICIAL · REPLAY" : "OFFICIAL";
}

// "26 Aug 2026 · 09:15 NPT": when the alert was issued, in the Region's zone.
export function issuedInRegion(alert: OfficialAlert, timeZone: string | null): string {
  if (timeZone === null) return alert.issued;
  const at = issuedUnix(alert);
  return `${regionDate(at, timeZone)} · ${regionClockTime(at, timeZone)} ${regionZoneLabel(at, timeZone)}`;
}

export function issuedUnix(alert: OfficialAlert): number {
  return Date.parse(alert.issued) / 1000;
}

export function latestAlert(alerts: OfficialAlert[]): OfficialAlert | null {
  return alerts.reduce<OfficialAlert | null>(
    (latest, alert) => (latest === null || issuedUnix(alert) > issuedUnix(latest) ? alert : latest),
    null,
  );
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

// "Community Warning 08:37 · first Official Alert 09:05" in the Region's zone; null until both
// exist and the Region is known.
export function leadTimeLine(
  firstCommunityWarningAt: number | null,
  alerts: OfficialAlert[],
  timeZone: string | null,
): string | null {
  if (firstCommunityWarningAt === null || alerts.length === 0 || timeZone === null) return null;
  const firstAlertAt = Math.min(...alerts.map(issuedUnix));
  return `Community Warning ${regionClockTime(firstCommunityWarningAt, timeZone)} · first Official Alert ${regionClockTime(firstAlertAt, timeZone)} ${regionZoneLabel(firstAlertAt, timeZone)}`;
}
