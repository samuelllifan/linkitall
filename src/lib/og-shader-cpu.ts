/**
 * CPU implementations of the GLSL builtins the background shaders use, so their
 * share-card stills can be rendered without a GPU.
 *
 * Satori cannot run a fragment shader, so every shader background needs a still
 * to hand it as a PNG. These are the pieces those stills are built from, and
 * they are shared rather than copied per background for one specific reason:
 * the hash constants (127.1 / 311.7 / 269.5 / 183.3 / 43758.5453123) and the
 * exact `fract(sin(x) * k)` form have to agree with `NOISE_GLSL` in
 * `~/lib/background-shaders` or the still is a different picture from the page.
 * Four copies of those numbers is four chances for one of them to drift.
 *
 * One departure applies to everything here, and it cannot be fixed: value noise
 * built on `fract(sin(x) * 43758.5453123)` is chaotic by construction, so
 * float64 in Node and float32 on a GPU diverge into entirely different values
 * within a couple of octaves. The stills therefore have the same STRUCTURE as
 * the page — same wave shapes, same filament character, same star statistics —
 * without being the bit-identical frame the visitor's own GPU would draw. That
 * is the correct trade: a card is a still of a moving background anyway.
 */

export const fract = (x: number) => x - Math.floor(x);

export const clamp = (x: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, x));

export const mix = (a: number, b: number, t: number) => a + (b - a) * t;

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/** `hash2` — two chaotic values in [-1, 1] from a 2D cell. */
export function hash2(px: number, py: number): [number, number] {
  const qx = px * 127.1 + py * 311.7;
  const qy = px * 269.5 + py * 183.3;
  return [
    -1 + 2 * fract(Math.sin(qx) * 43758.5453123),
    -1 + 2 * fract(Math.sin(qy) * 43758.5453123),
  ];
}

/** `noise` — smooth value noise in [-1, 1]. */
export function noise(px: number, py: number): number {
  const ix = Math.floor(px);
  const iy = Math.floor(py);
  const fx = px - ix;
  const fy = py - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);

  const dot = (cx: number, cy: number) => {
    const [hx, hy] = hash2(ix + cx, iy + cy);
    return hx * (fx - cx) + hy * (fy - cy);
  };

  const bottom = dot(0, 0) + (dot(1, 0) - dot(0, 0)) * ux;
  const top = dot(0, 1) + (dot(1, 1) - dot(0, 1)) * ux;
  return bottom + (top - bottom) * uy;
}

/** `fbm` over `octaves` octaves, matching the shaders' loop exactly. */
export function fbm(px: number, py: number, octaves: number): number {
  let v = 0;
  let a = 0.5;
  let x = px;
  let y = py;
  for (let i = 0; i < octaves; i++) {
    v += a * noise(x, y);
    x *= 2;
    y *= 2;
    a *= 0.5;
  }
  return v;
}

export const fbm2 = (px: number, py: number) => fbm(px, py, 2);
