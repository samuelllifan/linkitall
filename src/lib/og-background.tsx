import type { ReactElement } from "react";
import { auroraStillDataUri } from "~/lib/og-aurora";
import { gridFadeDataUri } from "~/lib/og-grid-fade";
import type { Background } from "~/lib/pages";

/**
 * Translates a page's saved `background` into something Satori can rasterize,
 * so a share card shows the page the way its owner actually built it.
 *
 * Every branch here is a deliberate reconstruction of the corresponding branch
 * of `PageBackground` in `profile-view.tsx` — read them side by side, and move
 * them together. Where Satori genuinely cannot reach (a running shader, a CSS
 * filter, a video frame) the comment says so and says what stands in.
 *
 * Returns a layer stack rather than a style object because three of the cases
 * need more than one layer: the grid needs its edge fade, media needs a zoom
 * box, and both need an overlay on top of the fill.
 */

/** The app's own `--background`. A `default` page renders exactly this. */
const APP_BG = "#0a0a0a";

/** `.media-layer`'s own fill (globals.css) — visible only behind a zoom < 1. */
const MEDIA_BG = "#05060a";

export type OgBackground = {
  /** Absolutely-positioned layers, painted over `fill`. */
  layers: ReactElement[];
  /** Solid colour behind the layers. */
  fill: string;
  /** Legible foreground for the centre block (avatar, name, bio). */
  fg: string;
  /** Legible foreground for the top lockup, which can sit over a lighter band. */
  topFg: string;
};

/** Black or white text, whichever contrasts better with a hex background. */
export function readableText(hex: string): string {
  const rgb = parseHex(hex);
  if (!rgb) return "#ffffff";
  // Relative luminance (sRGB coefficients); dark text on light backgrounds.
  const luminance = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
  return luminance > 0.6 ? "#0b0b12" : "#ffffff";
}

/** `#rgb` / `#rrggbb` → [r, g, b] 0–255, or null if it isn't a hex colour. */
function parseHex(hex: string): [number, number, number] | null {
  const h = (typeof hex === "string" ? hex : "").trim().replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  if (!/^[\da-f]{6}$/i.test(full)) return null;
  const n = Number.parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// ---------------------------------------------------------------------------
// Gradients
// ---------------------------------------------------------------------------

/**
 * How many segments a hinted gradient is expanded into. The stops are placed by
 * even steps of *colour* rather than of position (see `gradientStops`), so this
 * is the resolution of the colour ramp, and 16 is well past the point where an
 * 8-bit channel can tell the difference.
 */
const HINT_SEGMENTS = 16;

/**
 * The colour of a page's gradient at `t` (0 = start, 1 = end), honouring the
 * `distribution` midpoint. Used both to build the card's stops and to pick text
 * colours that are legible against the band the text actually sits on.
 */
function gradientColorAt(
  from: string,
  to: string,
  distribution: number,
  t: number,
): string {
  const a = parseHex(from) ?? [0, 0, 0];
  const b = parseHex(to) ?? [0, 0, 0];
  const eased = easeHint(distribution / 100, t);
  const ch = (i: number) =>
    Math.round(a[i] + (b[i] - a[i]) * eased)
      .toString(16)
      .padStart(2, "0");
  return `#${ch(0)}${ch(1)}${ch(2)}`;
}

/**
 * The CSS colour-hint transfer function. A hint at `h` means "the two colours
 * meet halfway *here*", which the spec defines as remapping the progress by
 * `t ** (log(0.5) / log(h))`.
 */
function easeHint(h: number, t: number): number {
  if (!(h > 0)) return 1; // hint at 0% — the end colour starts immediately
  if (h >= 1) return t >= 1 ? 1 : 0; // hint at 100% — start colour holds
  if (Math.abs(h - 0.5) < 1e-6) return t; // plain linear
  return t ** (Math.log(0.5) / Math.log(h));
}

/**
 * Explicit stops for a hinted gradient.
 *
 * Satori's gradient parser reads the bare-percentage colour hint in
 * `linear-gradient(to bottom, #a, 40%, #b)` — and then nothing in Satori ever
 * looks at it again. So passing the page's own gradient string through, which
 * is what the card used to do, renders every gradient as an even 50/50 blend
 * and throws `distribution` away. These stops put it back.
 *
 * They are spaced by even steps of COLOUR, with the position solved backwards
 * out of the transfer function, not by even steps of position. That matters:
 * near a hint at 10% the true curve climbs almost vertically, and evenly spaced
 * positions would chord across it with errors well over 10% of the colour
 * range. Sampling the inverse puts the stops where the colour is moving, so the
 * straight segments Satori draws between them land on the curve.
 */
function gradientStops(from: string, to: string, distribution: number): string {
  const h = distribution / 100;
  // Degenerate hints are a hard edge, not a ramp.
  if (!(h > 0)) return `${to} 0%, ${to} 100%`;
  if (h >= 1) return `${from} 0%, ${from} 100%`;

  const inverse = Math.log(h) / Math.log(0.5); // 1 / exponent
  const stops: string[] = [];
  for (let k = 0; k <= HINT_SEGMENTS; k++) {
    const u = k / HINT_SEGMENTS; // progress through the COLOUR
    const pos = u ** inverse; // …and where that colour sits
    stops.push(
      `${gradientColorAt(from, to, distribution, pos)} ${(pos * 100).toFixed(2)}%`,
    );
  }
  return stops.join(", ");
}

// ---------------------------------------------------------------------------

let layerKey = 0;
/** Absolutely-positioned full-bleed layer. */
function layer(
  style: React.CSSProperties,
  size: { width: number; height: number },
): ReactElement {
  return (
    <div
      key={`bg-${layerKey++}`}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: size.width,
        height: size.height,
        display: "flex",
        ...style,
      }}
    />
  );
}

export function resolveBackground(
  bg: Background | undefined,
  size: { width: number; height: number },
): OgBackground {
  const plain = (fill: string): OgBackground => ({
    layers: [],
    fill,
    fg: readableText(fill),
    topFg: readableText(fill),
  });

  // `PageBackground` renders nothing for `default`, letting the theme's own
  // background show. The app is dark-only, so that is a flat `--background` —
  // NOT the blue-black gradient this card used to invent for it.
  if (!bg || bg.type === "default") return plain(APP_BG);

  if (bg.type === "custom") return plain(bg.color);

  if (bg.type === "gradient") {
    const dir = bg.direction === "horizontal" ? "to right" : "to bottom";
    const mid = bg.distribution ?? 50;
    return {
      layers: [
        layer(
          {
            backgroundImage: `linear-gradient(${dir}, ${gradientStops(bg.from, bg.to, mid)})`,
          },
          size,
        ),
      ],
      fill: bg.from,
      // The lockup sits at the gradient's start (top for vertical, left for
      // horizontal) for both directions; the centre block sits on the
      // midpoint's colour. Basing the centre on `from`, as this used to, made
      // dark text on a light→dark gradient — legible against the corner the
      // text isn't in, and invisible against the band it is.
      fg: readableText(gradientColorAt(bg.from, bg.to, mid, 0.5)),
      topFg: readableText(bg.from),
    };
  }

  if (bg.type === "grid") {
    const t = Math.max(0, bg.thickness);
    return {
      layers: [
        layer(
          {
            backgroundImage: `linear-gradient(to right, ${bg.lineColor} ${t}px, transparent ${t}px), linear-gradient(to bottom, ${bg.lineColor} ${t}px, transparent ${t}px)`,
            backgroundSize: `${bg.size}px ${bg.size}px`,
          },
          size,
        ),
        // The page's edge fade, washing the base colour back in over the
        // lines. Rasterized rather than written as a CSS radial gradient —
        // Satori cannot express this one; see `~/lib/og-grid-fade`.
        layer(
          {
            backgroundImage: `url(${gridFadeDataUri(bg.baseColor)})`,
            backgroundSize: "100% 100%",
          },
          size,
        ),
      ],
      fill: bg.baseColor,
      fg: readableText(bg.baseColor),
      topFg: readableText(bg.baseColor),
    };
  }

  if (bg.type === "aurora") {
    const color = bg.color ?? "#e6e6e6";
    const baseColor = bg.baseColor ?? "#000000";
    return {
      layers: [
        layer(
          {
            // A real still of the shader at t = 0 — see `~/lib/og-aurora`. It
            // is rasterized at this card's aspect ratio, so it is stretched to
            // fill rather than `cover`-cropped.
            backgroundImage: `url(${auroraStillDataUri(color, baseColor)})`,
            backgroundSize: "100% 100%",
          },
          size,
        ),
      ],
      fill: baseColor,
      // The horizon sits a little under halfway down, so the centre block is on
      // the blend and the bottom is the base — key the body text off the base,
      // and the top lockup off the lit colour that fills the band it's in.
      fg: readableText(baseColor),
      topFg: readableText(color),
    };
  }

  if (bg.type === "media") {
    // Satori can rasterize an https or data: image, but not a video frame and
    // not the page's CSS `blur()`. A video background therefore falls through
    // to the app background below; blur is simply not applied, which leaves a
    // sharper card than the page. Both are noted rather than faked.
    if (bg.kind === "image" && /^(https?:|data:image)/.test(bg.src)) {
      const dim = Math.max(0, Math.min(100, bg.dim ?? 0)) / 100;
      const zoom = Math.max(0.1, Math.min(10, bg.zoom || 1));
      // An <img> with object-fit, NOT a div with `backgroundImage` + cover.
      //
      // Satori implements `background-position` by offsetting a *tiling*
      // pattern, so a percentage there wraps the image around instead of
      // aligning it: this card used to render a photo focused at 50% 50% as
      // its four quadrants swapped diagonally. `object-fit` / `object-position`
      // on an image go through Satori's real CSS cover maths instead, which is
      // also exactly what the page itself uses.
      //
      // The zoom box reproduces the page's `transform: scale(zoom)`: the page
      // cover-fits the image to the layer and then scales it about the centre,
      // and cover-fitting into a box `zoom`x larger that stays centred on the
      // card is the same picture — without depending on how Satori resolves a
      // transform origin.
      const layers = [
        <div
          key="bg-media"
          style={{
            position: "absolute",
            top: (size.height * (1 - zoom)) / 2,
            left: (size.width * (1 - zoom)) / 2,
            width: size.width * zoom,
            height: size.height * zoom,
            display: "flex",
          }}
        >
          {/* biome-ignore lint/performance/noImgElement: satori (next/og) renders a plain <img> */}
          <img
            src={bg.src}
            alt=""
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: `${bg.posX}% ${bg.posY}%`,
            }}
          />
        </div>,
      ];
      if (dim > 0) {
        layers.push(layer({ backgroundColor: `rgba(0, 0, 0, ${dim})` }, size));
      }
      return {
        layers,
        fill: MEDIA_BG,
        // A photo can be anything, so the card commits to white with the page's
        // own dimming behind it rather than guessing at an average colour.
        fg: "#ffffff",
        topFg: "#ffffff",
      };
    }
  }

  // Video, and any unknown/legacy type — `PageBackground` renders nothing for
  // those too, so the theme background is the honest answer.
  return plain(APP_BG);
}
