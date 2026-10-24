// Intl spells some zones as an offset ("GMT+5:45") where residents read an abbreviation.
const ABBREVIATIONS: Record<string, string> = { "Asia/Kathmandu": "NPT" };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const at = (unixSeconds: number) => new Date(unixSeconds * 1000);

// "14:06" for an Event time in Unix seconds, in the Region's zone whatever the viewer's zone is.
export function regionClockTime(unixSeconds: number, timeZone: string): string {
  return at(unixSeconds).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone,
  });
}

// "28 Sep 2022". Month names are ours: en-GB spells September "Sept".
export function regionDate(unixSeconds: number, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    timeZone,
  }).formatToParts(at(unixSeconds));
  const part = (type: string) => parts.find((each) => each.type === type)?.value ?? "";
  return `${part("day")} ${MONTHS[Number(part("month")) - 1]} ${part("year")}`;
}

// "EDT" or "EST" as the date says, "NPT" for Nepal.
export function regionZoneLabel(unixSeconds: number, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "short" }).formatToParts(
    at(unixSeconds),
  );
  const label = parts.find((part) => part.type === "timeZoneName")?.value ?? timeZone;
  return label.startsWith("GMT") ? (ABBREVIATIONS[timeZone] ?? label) : label;
}
