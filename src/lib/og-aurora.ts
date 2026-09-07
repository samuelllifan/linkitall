import { hexToRgb255, memoByKey, pngDataUri } from "~/lib/og-png";
import { fbm2, smoothstep } from "~/lib/og-shader-cpu";

/**
 * A still frame of the aurora background, for the share cards.
 *
 * The real aurora is a WebGL fragment shader (`AURORA_FRAG` in
 * `profile-view.tsx`), and Satori cannot run one — so the card used to stand in
 * a plain two-stop vertical gradient. That got the palette roughly right and
 * everything else wrong: the aurora's signature is a *wavy* horizon between the
 * lit top and the dark base, swinging about ±14% of the frame's height, and a
 * straight gradient has none of it.
 *
 * So this is a direct CPU port of that shader, evaluated at `t = 0`, rasterized
 * small and handed to Satori as a PNG data URI to stretch over the card. `t = 0`
 * is not an arbitrary frame: every time term in the shader is written to vanish
 * there (`sin(0) = 0`, `stretch = 1`), precisely so the paused frame is the
 * tuned static look. A still is all a share card can show, and this is the right
 * still.
 *
 * Keep this in lockstep with `AURORA_FRAG`. If the shader's waves, horizon or
 * falloff are retuned, the maths below has to move with it or a page's card
 * stops matching the page.
 *
 * Two deliberate departures, neither visible at card size:
 *
 * - The `hash2` value noise is `fract(sin(x) * 43758.5453123)`, which is chaotic
 *   by construction: float64 here and float32 on a GPU diverge into completely
 *   different values. The noise only nudges the wave crests (it is scaled by
 *   0.09, against 0.127 of pure sine), so the frame reads as the same aurora
 *   with the same wave shape — it just isn't the bit-identical crest the
 *   viewer's GPU would draw. Nothing can fix that short of shipping a float32
 *   sine, and there is no reason to: the live background is in motion anyway.
 * - The shader's ±0.5/255 dither is dropped. It exists to break up 8-bit banding
 *   across a full-viewport falloff; here the raster is upscaled ~4x and
 *   resampled smoothly, which does the same job, and per-pixel noise would cost
 *   most of the PNG's compression.
 */

/** Raster size. See RASTER_ASPECT for why this is so small. */
const RASTER_W = 300;
const RASTER_H = 158;

/**
 * The aspect ratio the shader is evaluated at — the CARD's, 1200/630, not the
 * raster's. The shader feeds `uv.x * aspect` into the noise so its wave crests
 * stay isotropic instead of stretching with the viewport, so the aspect has to
 * be the one the image is finally seen at.
 *
 * The raster itself can be tiny because the field is entirely low-frequency:
 * two sine waves under 2.3 cycles across the frame, and a falloff whose
 * smoothstep window is a full frame-height wide. There is nothing here for more
 * pixels to resolve, and 300x158 keeps the data URI small.
 */
const RASTER_ASPECT = 1200 / 630;

/**
 * A `data:image/png;base64,…` still of the aurora at `t = 0`, ready to hand to
 * Satori as a `backgroundImage`. Stretch it over the whole card — it is
 * generated at the card's own aspect ratio, so use `100% 100%` and not `cover`.
 */
export function auroraStillDataUri(color: string, baseColor: string): string {
  return memo(`${color}|${baseColor}`, () => render(color, baseColor));
}

const memo = memoByKey<string>(200);

function render(color: string, baseColor: string): string {
  const [lr, lg, lb] = hexToRgb255(color);
  const [dr, dg, db] = hexToRgb255(baseColor);
  const rgb = new Uint8Array(RASTER_W * RASTER_H * 3);

  for (let x = 0; x < RASTER_W; x++) {
    const uvx = (x + 0.5) / RASTER_W;

    // The horizon is a function of x alone, so it is hoisted out of the row
    // loop. At t = 0: stretch = 1 and every drift term is zero.
    const nx = fbm2(uvx * RASTER_ASPECT * 0.9, 0.7);
    const wave =
      Math.sin(uvx * 6.2831 * 1.1 + 0.6) * 0.085 +
      Math.sin(uvx * 6.2831 * 2.3 - 1.2) * 0.042 +
      nx * 0.09;
    const horizon = 0.45 + wave;

    // The wide horizontal easing that settles the far corners a touch darker.
    const edge = 0.9 + 0.1 * (1 - Math.min(Math.abs(uvx - 0.5) * 2, 1) ** 2.6);

    for (let y = 0; y < RASTER_H; y++) {
      const uvy = (y + 0.5) / RASTER_H;
      // Light above the horizon, dark below, over a fade a full frame-height
      // wide — which is what makes the aurora a long smooth wash rather than a
      // hard edge.
      let v = 1 - smoothstep(horizon - 0.5, horizon + 0.5, uvy);
      v = Math.min(1, Math.max(0, v * edge));

      const o = (y * RASTER_W + x) * 3;
      rgb[o] = (dr + (lr - dr) * v + 0.5) | 0;
      rgb[o + 1] = (dg + (lg - dg) * v + 0.5) | 0;
      rgb[o + 2] = (db + (lb - db) * v + 0.5) | 0;
    }
  }

  return pngDataUri(rgb, RASTER_W, RASTER_H);
}
