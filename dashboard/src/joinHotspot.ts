import qrcode from "qrcode-generator";
import { useEffect, useState } from "react";

export type Hotspot = { ssid: string; password: string; url: string };

// Phone cameras read the WIFI: form; these characters would end a field early.
function escapeWifiField(text: string): string {
  return text.replace(/[\\;,:"]/g, (character) => `\\${character}`);
}

export function wifiPayload({ ssid, password }: Hotspot): string {
  return `WIFI:T:WPA;S:${escapeWifiField(ssid)};P:${escapeWifiField(password)};;`;
}

// Rows of dark and light modules, drawn in the browser so no request is needed.
export function qrModules(payload: string): boolean[][] {
  const code = qrcode(0, "M");
  code.addData(payload);
  code.make();
  const size = code.getModuleCount();
  return Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, column) => code.isDark(row, column)),
  );
}

// What the hotspot is called and where the dashboard is. Only the Node's own machine is told; any
// other answer leaves the card showing why there is nothing to scan.
export function useHotspot(): Hotspot | "unavailable" | null {
  const [hotspot, setHotspot] = useState<Hotspot | "unavailable" | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/join")
      .then((response): Promise<Hotspot | "unavailable"> => {
        if (response.status === 403 || response.status === 404) {
          return Promise.resolve("unavailable");
        }
        if (!response.ok) throw new Error(`Node API returned ${response.status} for /api/join`);
        return response.json();
      })
      .then((answer) => {
        if (!cancelled) setHotspot(answer);
      })
      .catch((error) => console.error(error));
    return () => {
      cancelled = true;
    };
  }, []);
  return hotspot;
}
