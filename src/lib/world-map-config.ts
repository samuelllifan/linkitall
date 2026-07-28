// Shared, client-safe map geometry. Kept free of server-only / d3 imports so
// both the server projector (~/lib/world-map) and the client <LocationMap> can
// import from it without pulling the heavy TopoJSON into the browser bundle.

/** The viewBox the projected country paths are drawn into (2:1, Natural Earth). */
export const MAP_WIDTH = 800;
export const MAP_HEIGHT = 400;

/** A single country rendered as an SVG path in the map's viewBox. */
export interface CountryPath {
  /** ISO 3166-1 numeric code (world-atlas feature id, no leading zeros). */
  numeric: string;
  /** SVG path `d` string in MAP_WIDTH × MAP_HEIGHT coordinates. */
  d: string;
}
