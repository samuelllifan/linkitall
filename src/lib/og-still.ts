import { hexToRgb255, memoByKey, pngDataUri } from "~/lib/og-png";
import { clamp, mix, noise } from "~/lib/og-shader-cpu";

/**
 * The share-card still for the Ripple background — a CPU port of `RIPPLE_FRAG`
 * evaluated at `t = 0`, handed to Satori as a PNG data URI. Aurora's equivalent
 * is `~/lib/og-aurora`; it stayed in its own file because it predates this one
 * and its raster is a different size.
 *
 * `t = 0` is not an arbitrary frame. Every time term in that shader is written
 * so it vanishes there, precisely so the paused frame is the tuned composition —
 * see the house rules at the top of `~/lib/background-shaders`.
 *
 * Keep this in lockstep with the shader. If its tuning constants move and this
 * doesn't, a creator's card stops matching their page — which is worse than no
 * card art at all, because it is wrong rather than merely absent.
 *
 * The float64-vs-float32 caveat is documented once, in `~/lib/og-shader-cpu`.
 */

/** The aspect these are evaluated at — the CARD's, not the raster's. */
const CARD_ASPECT = 1200 / 630;
const memo = memoByKey<string>(200);

/** Write one RGB pixel. */
function put(
  rgb: Uint8Array,
  o: number,
  r: number,
  g: number,
  b: number,
): void {
  rgb[o] = clamp(r, 0, 255) | 0;
  rgb[o + 1] = clamp(g, 0, 255) | 0;
  rgb[o + 2] = clamp(b, 0, 255) | 0;
}

// ---------------------------------------------------------------------------

const RIPPLE_W = 420;
const RIPPLE_H = 220;

function renderRipple(
  baseColor: string,
  glowColor: string,
  scale: number,
): string {
  const [dr, dg, db] = hexToRgb255(baseColor);
  const [lr, lg, lb] = hexToRgb255(glowColor);
  const rgb = new Uint8Array(RIPPLE_W * RIPPLE_H * 3);
  const sc = Math.max(scale, 0.5);

  // The shader's calmness factor on top of Detail; see RIPPLE_FRAG.
  const k = sc * 0.7;

  for (let x = 0; x < RIPPLE_W; x++) {
    const uvx = (x + 0.5) / RIPPLE_W;
    const px = uvx * CARD_ASPECT * k;
    for (let y = 0; y < RIPPLE_H; y++) {
      const uvy = (y + 0.5) / RIPPLE_H;
      const py = uvy * 1.45 * k;

      // One gently warped field, exactly as RIPPLE_FRAG does it. At t = 0 both
      // the warp's drift and the field's own drift vanish.
      // Single-octave warp, lightly applied — the shader's detail control.
      const wx = noise(px, py);
      const wy = noise(px + 4.7, py + 2.1);
      const n = noise(px + wx * 0.22, py + wy * 0.22);
      const d = Math.abs(n);

      // The same contour read twice: a narrow bright core and a wide dim glow.
      const core = clamp(1 - d * 9, 0, 1) ** 1.35;
      const glow = clamp(1 - d * 3, 0, 1) ** 2.2;
      let c = core * 0.6 + glow * 0.11;
      c *= 0.55 + 0.3 * (1 - uvy);
      c = clamp(c, 0, 0.56);

      const o = (y * RIPPLE_W + x) * 3;
      put(rgb, o, mix(dr, lr, c), mix(dg, lg, c), mix(db, lb, c));
    }
  }
  return pngDataUri(rgb, RIPPLE_W, RIPPLE_H);
}

// ---------------------------------------------------------------------------

export function rippleStillDataUri(
  baseColor: string,
  glowColor: string,
  scale: number,
): string {
  return memo(`ripple|${baseColor}|${glowColor}|${scale}`, () =>
    renderRipple(baseColor, glowColor, scale),
  );
}
