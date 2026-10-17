const SECONDS_BEFORE_MINUTES = 90;

// "12 s ago" up to a minute and a half, then "2 min ago".
export function agoWords(ageSeconds: number): string {
  return ageSeconds < SECONDS_BEFORE_MINUTES
    ? `${Math.round(ageSeconds)} s ago`
    : `${Math.round(ageSeconds / 60)} min ago`;
}
