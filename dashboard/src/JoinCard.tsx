import { qrModules, useHotspot, wifiPayload } from "./joinHotspot";

const QUIET_ZONE = 4;

function QrCode({ payload, label }: { payload: string; label: string }) {
  const rows = qrModules(payload);
  const size = rows.length + QUIET_ZONE * 2;
  const dark = rows.flatMap((row, y) =>
    row.flatMap((isDark, x) => (isDark ? [`M${x + QUIET_ZONE} ${y + QUIET_ZONE}h1v1h-1z`] : [])),
  );
  return (
    <svg
      role="img"
      aria-label={label}
      className="join-qr"
      viewBox={`0 0 ${size} ${size}`}
      shapeRendering="crispEdges"
    >
      <rect width={size} height={size} className="join-qr-paper" />
      <path d={dark.join("")} className="join-qr-ink" />
    </svg>
  );
}

// Two codes a phone scans: the hotspot, then the dashboard on it.
export function JoinCard() {
  const hotspot = useHotspot();
  return (
    <section aria-label="Your plan lives on your phone" className="join-card">
      <h3>Your plan lives on your phone</h3>
      {hotspot === null && <p>Looking for this Node's hotspot…</p>}
      {hotspot === "unavailable" && (
        <p>This Node has no hotspot set (HOTSPOT_SSID), so there is nothing to scan.</p>
      )}
      {hotspot !== null && hotspot !== "unavailable" && (
        <>
          <div className="join-codes">
            <figure>
              <QrCode payload={wifiPayload(hotspot)} label={`Join the Wi-Fi ${hotspot.ssid}`} />
              <figcaption>1 · Join the Wi-Fi {hotspot.ssid}</figcaption>
            </figure>
            <figure>
              <QrCode payload={hotspot.url} label={`Open the dashboard ${hotspot.url}`} />
              <figcaption>2 · Open the dashboard {hotspot.url}</figcaption>
            </figure>
          </div>
          <p>No internet, no app, no account.</p>
        </>
      )}
    </section>
  );
}
