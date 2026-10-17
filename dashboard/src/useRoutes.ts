import { useEffect, useState } from "react";

import type { Home } from "./householdProfile";
import { routeFilePath, type RouteGrid, type Routes } from "./routeGrid";

// Asking for the file of the Grid point nearest home tells the connected Node where home is to
// about 100 m (docs/adr/0003). The Node holds the file, so this works with no internet.
// Null until the file arrives, and for a home whose Grid point has no Routes.
export function useRoutes(home: Home | null, grid: RouteGrid | null): Routes | null {
  const file = home && grid ? routeFilePath(grid, home) : null;
  // Remembering which file the Routes came from keeps a moved home from showing the old Routes.
  const [loaded, setLoaded] = useState<{ file: string; routes: Routes | null } | null>(null);
  useEffect(() => {
    if (file === null) return;
    let cancelled = false;
    fetch(`/api/cache-pack/files/${file}`)
      .then((response) => {
        // A missing file means no road within reach of this Grid point, not a fault.
        if (response.status === 404) return null;
        if (!response.ok) throw new Error(`Node API returned ${response.status} for ${file}`);
        return response.json();
      })
      .then((routes) => {
        if (!cancelled) setLoaded({ file, routes });
      })
      .catch((error) => console.error(error));
    return () => {
      cancelled = true;
    };
  }, [file]);
  return loaded?.file === file ? loaded.routes : null;
}
