import "server-only";

import { geoNaturalEarth1, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import worldData from "world-atlas/countries-110m.json";
import {
  type CountryPath,
  MAP_HEIGHT,
  MAP_WIDTH,
} from "~/lib/world-map-config";

// Project every country once at module load. The projection and the ~100KB
// TopoJSON stay entirely on the server — only the resulting path strings are
// sent to the client. Natural Earth 1 is an equal-ish, good-looking world view.
const COUNTRY_PATHS: CountryPath[] = (() => {
  // world-atlas ships a TopoJSON topology; `feature` expands it to GeoJSON.
  // biome-ignore lint/suspicious/noExplicitAny: TopoJSON JSON import isn't typed
  const topo = worldData as any;
  const fc = feature(topo, topo.objects.countries) as unknown as {
    features: { id?: string | number; geometry: unknown }[];
  };
  const projection = geoNaturalEarth1().fitSize(
    [MAP_WIDTH, MAP_HEIGHT],
    fc as never,
  );
  const path = geoPath(projection);
  const out: CountryPath[] = [];
  for (const f of fc.features) {
    if (f.id == null) continue;
    const d = path(f as never);
    if (d) out.push({ numeric: String(f.id), d });
  }
  return out;
})();

/** All country outlines, projected into MAP_WIDTH × MAP_HEIGHT. */
export function getCountryPaths(): CountryPath[] {
  return COUNTRY_PATHS;
}
