/**
 * The GLSL for every shader-driven page background.
 *
 * All of these are fragment shaders over one full-screen triangle (see
 * `ShaderCanvas` in `~/components/shader-background`), and all of them follow
 * three house rules:
 *
 *  1. Open with `PRECISION`, never a bare `precision highp float`. Some Windows
 *     and Intel ANGLE configurations do not advertise fragment highp, and a
 *     hardcoded highp fails to COMPILE there — the background vanishes instead
 *     of degrading.
 *
 *  2. Every time term must vanish at `t = 0`: write phases as `+ t * k` inside a
 *     `sin`, scales as `1.0 + k * sin(t * f)`. Two things depend on it — the
 *     `speed: 0` frame has to be the deliberately tuned composition rather than
 *     whatever moment the clock happened to start on, and the share-card stills
 *     are CPU ports evaluated at exactly `t = 0`.
 *
 *  3. Keep the contrast low. These sit behind a creator's name, bio and links.
 *     A background that competes with the text is a worse background however
 *     good it looks in isolation, so the bright end of every one of these is
 *     reached through a control the creator has to turn up on purpose.
 *
 * Uniforms provided for free by the canvas: `u_resolution` (device px),
 * `u_time`, `u_dpr`.
 */

/** See rule 1 above. */
export const PRECISION = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
`;

/**
 * Value noise, fBm over it, and a cheap 1D hash for dithering. Shared source
 * rather than a copy per shader — the hash constants have to agree between the
 * shaders and their CPU ports in `~/lib/og-*`, and duplicated magic numbers
 * drift.
 */
export const NOISE_GLSL = `
const float TAU = 6.2831853;

vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}

// Smooth value noise in [-1, 1].
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(dot(hash2(i + vec2(0.0, 0.0)), f - vec2(0.0, 0.0)),
                 dot(hash2(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
             mix(dot(hash2(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)),
                 dot(hash2(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x), u.y);
}

float fbm2(vec2 p) {
  float v = 0.0; float a = 0.5;
  for (int i = 0; i < 2; i++) { v += a * noise(p); p *= 2.0; a *= 0.5; }
  return v;
}

float hash1(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

// Per-pixel dither, ±0.5/255. Every one of these backgrounds is a wide, very
// smooth falloff across a full viewport, which is precisely the case 8-bit
// output bands on; this breaks the bands up below the threshold of visibility.
vec3 dither(vec3 col, vec2 frag, float t) {
  return col + (hash1(frag + fract(t)) - 0.5) / 255.0;
}
`;

// ---------------------------------------------------------------------------
// Aurora
// ---------------------------------------------------------------------------

/**
 * A broad light-top → dark-bottom gradient — NOT a radial glow; the light fills
 * the whole top — whose transition line is pushed up and down by sine waves and
 * low-frequency noise, so the horizon undulates in smooth organic waves.
 *
 * `u_light` glow colour, `u_dark` base colour.
 *
 * Kept in lockstep with the CPU port in `~/lib/og-aurora`. Retuning the waves,
 * horizon or falloff here without moving that means a page's share card stops
 * matching the page.
 */
export const AURORA_FRAG = `${PRECISION}
uniform vec2 u_resolution;
uniform float u_time;
uniform vec3 u_light;
uniform vec3 u_dark;
${NOISE_GLSL}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  uv.y = 1.0 - uv.y;                          // y = 0 at the top
  float aspect = u_resolution.x / u_resolution.y;
  vec2 p = vec2(uv.x * aspect, uv.y);         // isotropic noise coords
  float t = u_time;

  // Two sines of different frequency give clean, pronounced undulation; the
  // noise term nudges the crests so they read as organic rather than
  // mechanical. 'stretch' slowly breathes the waves' horizontal length, and the
  // two sine phases drift at incommensurate rates, so the pattern cycles
  // continuously without ever exactly repeating.
  float stretch = 1.0 + 0.16 * sin(t * 0.40);
  float nx = fbm2(vec2(p.x * 0.9 * stretch + t * 0.28, 0.7 + t * 0.20));
  float wave =
      sin(uv.x * TAU * 1.1 * stretch + 0.6 + t * 0.80) * 0.085
    + sin(uv.x * TAU * 2.3 * stretch - 1.2 - t * 0.62) * 0.042
    + nx * 0.09;
  float horizon = 0.45 + wave;

  // Light above, dark below, over a very wide fade — a long smooth vertical
  // ramp, no radial falloff anywhere.
  float v = 1.0 - smoothstep(horizon - 0.5, horizon + 0.5, uv.y);
  // Gentle, wide horizontal easing so the far corners settle a touch darker.
  v *= 0.9 + 0.1 * (1.0 - pow(min(abs(uv.x - 0.5) * 2.0, 1.0), 2.6));
  v = clamp(v, 0.0, 1.0);

  gl_FragColor = vec4(dither(mix(u_dark, u_light, v), gl_FragCoord.xy, t), 1.0);
}
`;

// ---------------------------------------------------------------------------
// Ripple
// ---------------------------------------------------------------------------

/**
 * A slow field of glowing contour loops that drift and re-form — the pattern
 * light makes playing over a rippled surface.
 *
 * `u_base` background colour, `u_glow` line colour, `u_scale` pattern size;
 * `speed` is folded into `u_time` by the canvas.
 *
 * Named for the MOTION, not for water, and the distinction is load-bearing.
 * Nothing here is water-specific: the shader draws a contour field, and calling
 * it "Water" forced a blue-green default that made the effect shout when its
 * best look is a near-monochrome one. The name has to survive a creator setting
 * it to any two colours they like.
 *
 * The lines come from a ridge transform, not from thresholding a brightness.
 * `fbm` is smooth and blobby, so `pow(fbm)` gives soft clouds; `1 - |n|` instead
 * peaks sharply along the curve where the noise crosses zero, and raising that
 * to a power tightens the peak into a line.
 */
export const RIPPLE_FRAG = `${PRECISION}
uniform vec2 u_resolution;
uniform float u_time;
uniform vec3 u_base;
uniform vec3 u_glow;
uniform float u_scale;
${NOISE_GLSL}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  uv.y = 1.0 - uv.y;
  float aspect = u_resolution.x / u_resolution.y;
  // Isotropic in x, so cells stay round instead of stretching with the
  // viewport. The vertical squash is what makes this read as light ON a surface
  // rather than as a tiled texture: light bouncing off a rippled surface spreads
  // along that surface, so the lines want to run wide and flat.
  // 0.70 is a calmness factor on top of Detail: at Detail 3 a wide viewport was
  // showing six or seven closed loops at once, which the eye reads as a pattern
  // rather than as a surface. This thins that out without emptying the frame.
  //
  // It cannot go much below this, and the reason is the aspect term above.
  // Horizontal cell count scales with the viewport's aspect ratio, so a phone at
  // roughly 0.5 sees half the cells a desktop does. Tuning this on a wide
  // preview until it looks calm takes the phone — which is where most of these
  // pages are actually opened — down to about one cell across, and one cell is
  // not a pattern, it is a soft smear. Check any change to this number on a
  // narrow viewport before a wide one.
  vec2 p = vec2(uv.x * aspect, uv.y * 1.45) * (max(u_scale, 0.5) * 0.70);
  float t = u_time;

  // ONE noise field, gently warped, and that is the whole pattern.
  //
  // This used to be two caustic nets at different frequencies plus their
  // product plus a sine swell underneath — four overlapping patterns, which is
  // why it read as drifting cloud rather than as a lit surface. Nothing was
  // individually wrong; there was just no single structure for the eye to lock
  // onto, and the mid-tones where they overlapped filled in all the dark ground
  // that makes a line like this legible.
  //
  // Single-octave noise for the warp, not fBm, and only a little of it.
  //
  // The warp is where DETAIL lives. The contour's overall size is set by the
  // frequency above; the warp is what puts wiggle into each individual loop, and
  // a two-octave warp puts wiggle at two scales at once. That is what made the
  // loops read as intricate rather than as calm. One octave at 0.22 keeps the
  // curves smooth and simple.
  //
  // It is not dropped altogether, and that is deliberate: with no warp at all
  // the contours of value noise sit on their own lattice and the field starts to
  // look regularly spaced, which reads as a texture. A little warp is what buys
  // the irregularity that makes it look natural.
  vec2 w = vec2(
    noise(p + vec2(0.0, t * 0.20)),
    noise(p + vec2(4.7, 2.1) - vec2(t * 0.16, 0.0))
  );
  float n = noise(p + w * 0.22 + vec2(t * 0.09, t * 0.04));
  float d = abs(n);

  // Two readings of that ONE contour, which is what replaces the second net.
  //
  // The lit set is the band around the noise's zero crossing, so the filaments
  // ARE that contour: single-octave noise crosses zero along smooth closed
  // curves, and adding octaves would fray them into smoke at every scale.
  //
  //   core — a narrow, bright line. The contour itself.
  //   glow — the same line read much wider and kept dim. Light through a medium
  //          scatters, so a line like this is never a bare stroke on black; the
  //          halo is what makes it look lit rather than drawn.
  //
  // Both come from the same 'd', so they are perfectly concentric and can never
  // disagree about where the line is. That is the entire reason this is clean
  // where two independent nets were not.
  float core = pow(clamp(1.0 - d * 9.0, 0.0, 1.0), 1.35);
  float glow = pow(clamp(1.0 - d * 3.0, 0.0, 1.0), 2.2);
  float c = core * 0.60 + glow * 0.11;

  // Lit from above: the top of the frame carries more light and the bottom
  // falls away into the deep colour.
  c *= 0.55 + 0.30 * (1.0 - uv.y);
  // Capped well below 1. The brightest filament lands a little over half way to
  // the light colour and never reaches it — this is the ceiling that keeps a
  // creator's name legible over the busiest part of the pattern: a background
  // that reaches its glow colour is a background competing with the text.
  c = clamp(c, 0.0, 0.56);

  vec3 col = mix(u_base, u_glow, c);
  gl_FragColor = vec4(dither(col, gl_FragCoord.xy, t), 1.0);
}
`;
