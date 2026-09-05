import { hexToRgb255, memoByKey, pngDataUri } from "~/lib/og-png";

/**
 * The grid background's edge fade, as an image.
 *
 * On the page (`PageBackground`, `bg.type === "grid"`) the lines are a tiled CSS
 * gradient masked by
 *
 *   radial-gradient(ellipse 80% 80% at 50% 50%, #000 25%, transparent 85%)
 *
 * so the grid dissolves toward the edges while the base colour stays solid.
 * Satori has no `mask-image`, and the obvious workaround — wash the base colour
 * back in over the lines using the *inverse* ellipse — does not work either:
 * Satori renders a radial gradient by painting a backing rect filled with the
 * gradient's LAST stop and then drawing the gradient shape over it. An inverse
 * fade ends on the opaque base colour, so that backing rect is opaque, and it
 * shows straight through the transparent middle of the ellipse. The result is a
 * card covered edge to edge in flat base colour with no grid at all.
 *
 * So the overlay is rasterized here instead: the base colour at
 * `1 - maskAlpha`, evaluated per pixel, which reproduces the page's fade
 * exactly rather than approximating it with something Satori will honour.
 *
 * Note the mask is radially symmetric in *normalized* box coordinates, which is
 * why this reads the same on the card's 1.9:1 frame as on a phone's tall one:
 * both ellipse radii are 80% of their own axis, so the normalized distance
 * below carries no aspect term. At the middle of an edge the lines still sit at
 * ~37% opacity (the 85% stop lies outside the box), and only the corners fade
 * out completely — which a four-sided linear vignette could not have matched.
 */

/**
 * Raster size. The fade is a single smooth radial ramp, so there is nothing for
 * more pixels to resolve; the crisp part of the grid is the line layer, which
 * stays a real CSS gradient and is not touched by this.
 */
const RASTER_W = 300;
const RASTER_H = 158;

/** Ellipse radii, as a fraction of each axis — the mask's `80% 80%`. */
const RADIUS = 0.8;
/** The mask's colour-stop positions, as fractions of that radius. */
const SOLID_UNTIL = 0.25;
const CLEAR_FROM = 0.85;

const memo = memoByKey<string>(64);

/**
 * A `data:image/png;base64,…` overlay that fades `baseColor` in toward the
 * frame's edges. Stretch it over the whole card with `backgroundSize: 100% 100%`
 * (it carries no aspect ratio of its own — see the note above).
 */
export function gridFadeDataUri(baseColor: string): string {
  return memo(baseColor, () => render(baseColor));
}

function render(baseColor: string): string {
  const [r, g, b] = hexToRgb255(baseColor);
  const px = new Uint8Array(RASTER_W * RASTER_H * 4);

  for (let y = 0; y < RASTER_H; y++) {
    const dy = (y + 0.5) / RASTER_H - 0.5;
    for (let x = 0; x < RASTER_W; x++) {
      const dx = (x + 0.5) / RASTER_W - 0.5;
      const d = Math.hypot(dx, dy) / RADIUS;

      // The mask's own alpha: solid to 25% of the radius, then a straight ramp
      // to nothing at 85%. (Straight, not smoothstepped — a CSS gradient
      // between an opaque and a transparent stop is linear in alpha.)
      const mask = Math.min(
        1,
        Math.max(0, 1 - (d - SOLID_UNTIL) / (CLEAR_FROM - SOLID_UNTIL)),
      );

      const o = (y * RASTER_W + x) * 4;
      px[o] = r;
      px[o + 1] = g;
      px[o + 2] = b;
      px[o + 3] = ((1 - mask) * 255 + 0.5) | 0;
    }
  }

  return pngDataUri(px, RASTER_W, RASTER_H, { alpha: true });
}
