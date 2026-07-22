"use client";

import {
  Bebas_Neue,
  Dancing_Script,
  Inter,
  Lora,
  Merriweather,
  Montserrat,
  Oswald,
  Pacifico,
  Playfair_Display,
  Poppins,
  Roboto_Mono,
  Space_Grotesk,
} from "next/font/google";
import { useTheme } from "next-themes";
import {
  type ComponentType,
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { recordClick, recordView } from "~/lib/analytics";
import type {
  AvatarEffect,
  AvatarOutline,
  Background,
  BoxStyle,
  LinkItem,
  PageData,
  PanelStyle,
  TextStyle,
} from "~/lib/pages";
import { cn } from "~/lib/utils";

// ---------------------------------------------------------------------------
// Fonts + text styling
// ---------------------------------------------------------------------------

const inter = Inter({ subsets: ["latin"], weight: ["400", "700"] });
const poppins = Poppins({ subsets: ["latin"], weight: ["400", "700"] });
const lora = Lora({ subsets: ["latin"], weight: ["400", "700"] });
const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "700"],
});
const robotoMono = Roboto_Mono({ subsets: ["latin"], weight: ["400", "700"] });
const montserrat = Montserrat({ subsets: ["latin"], weight: ["400", "700"] });
const oswald = Oswald({ subsets: ["latin"], weight: ["400", "700"] });
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "700"],
});
const merriweather = Merriweather({
  subsets: ["latin"],
  weight: ["400", "700"],
});
const dancingScript = Dancing_Script({
  subsets: ["latin"],
  weight: ["400", "700"],
});
// Bebas Neue and Pacifico ship a single weight; the browser synthesizes bold.
const bebasNeue = Bebas_Neue({ subsets: ["latin"], weight: "400" });
const pacifico = Pacifico({ subsets: ["latin"], weight: "400" });

/** Selectable fonts. Inter is the app default (used when none is set). */
export const FONTS: Record<string, { label: string; family: string }> = {
  inter: { label: "Inter", family: inter.style.fontFamily },
  poppins: { label: "Poppins", family: poppins.style.fontFamily },
  montserrat: { label: "Montserrat", family: montserrat.style.fontFamily },
  spaceGrotesk: {
    label: "Space Grotesk",
    family: spaceGrotesk.style.fontFamily,
  },
  oswald: { label: "Oswald", family: oswald.style.fontFamily },
  bebasNeue: { label: "Bebas Neue", family: bebasNeue.style.fontFamily },
  lora: { label: "Lora", family: lora.style.fontFamily },
  playfair: { label: "Playfair Display", family: playfair.style.fontFamily },
  merriweather: {
    label: "Merriweather",
    family: merriweather.style.fontFamily,
  },
  dancingScript: {
    label: "Dancing Script",
    family: dancingScript.style.fontFamily,
  },
  pacifico: { label: "Pacifico", family: pacifico.style.fontFamily },
  mono: { label: "Roboto Mono", family: robotoMono.style.fontFamily },
};

export const DEFAULT_NAME_STYLE: TextStyle = {
  fontSize: 24,
  bold: true,
  align: "center",
};
export const DEFAULT_BIO_STYLE: TextStyle = { fontSize: 14, align: "center" };

// ---------------------------------------------------------------------------
// Color adaptation — keep explicit text colors legible on both themes
// ---------------------------------------------------------------------------

/** Parse a hex (#rgb/#rrggbb) or rgb()/rgba() color into 0–255 channels. */
function parseColor(
  input?: string,
): { r: number; g: number; b: number } | null {
  if (!input) return null;
  const s = input.trim();
  const hex = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    let h = hex[1];
    if (h.length === 3)
      h = h
        .split("")
        .map((c) => c + c)
        .join("");
    return {
      r: Number.parseInt(h.slice(0, 2), 16),
      g: Number.parseInt(h.slice(2, 4), 16),
      b: Number.parseInt(h.slice(4, 6), 16),
    };
  }
  const rgb = s.match(/^rgba?\(([^)]+)\)$/i);
  if (rgb) {
    const [r, g, b] = rgb[1].split(",").map((p) => Number.parseFloat(p));
    if ([r, g, b].some((n) => Number.isNaN(n))) return null;
    return { r, g, b };
  }
  return null;
}

/** WCAG relative luminance of an RGB color (0 = black, 1 = white). */
function relLuminance({
  r,
  g,
  b,
}: {
  r: number;
  g: number;
  b: number;
}): number {
  const f = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrastRatio(a: number, b: number): number {
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Keep an explicit text color when it reads clearly against the current theme
 * background; invert it when it doesn't (e.g. black text that vanishes on the
 * dark background). Colors with no explicit value inherit the theme foreground
 * and already adapt on their own, so they're left untouched.
 */
export function adaptColor(
  color: string | undefined,
  isDark: boolean,
): string | undefined {
  const rgb = parseColor(color);
  if (!rgb) return color;
  const bgL = relLuminance(
    isDark ? { r: 10, g: 10, b: 10 } : { r: 255, g: 255, b: 255 },
  );
  if (contrastRatio(relLuminance(rgb), bgL) >= 3) return color;
  // Return hex — the legacy <font color> attribute doesn't accept rgb().
  const hex = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, "0");
  return `#${hex(255 - rgb.r)}${hex(255 - rgb.g)}${hex(255 - rgb.b)}`;
}

/**
 * Pick black or white text for legibility on top of a solid background color.
 * Returns undefined for colors we can't parse (caller keeps the inherited color).
 */
export function contrastText(bg: string | undefined): string | undefined {
  const rgb = parseColor(bg);
  if (!rgb) return undefined;
  return relLuminance(rgb) > 0.4 ? "#000000" : "#ffffff";
}

/**
 * The solid color a box surface actually appears as — its color composited over
 * the page background at its own opacity (or the page background itself when the
 * box is off). Used so controls layered on a box (e.g. the text toolbar) can
 * tint themselves to match what's visible above them instead of the raw color.
 */
export function effectiveBoxColor(box: BoxStyle, isDark: boolean): string {
  const base = isDark ? { r: 10, g: 10, b: 10 } : { r: 255, g: 255, b: 255 };
  const hex = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, "0");
  const toHex = (c: { r: number; g: number; b: number }) =>
    `#${hex(c.r)}${hex(c.g)}${hex(c.b)}`;
  if (box.enabled === false) return toHex(base);
  const rgb = parseColor(box.color);
  if (!rgb) return toHex(base);
  const a = Math.max(0, Math.min(100, box.opacity)) / 100;
  return toHex({
    r: rgb.r * a + base.r * (1 - a),
    g: rgb.g * a + base.g * (1 - a),
    b: rgb.b * a + base.b * (1 - a),
  });
}

// ---------------------------------------------------------------------------
// Box surfaces (card behind name/bio, link buttons)
// ---------------------------------------------------------------------------

/** Default look of the card behind the name + bio (a subtle frosted panel). */
export const DEFAULT_NAME_BOX: BoxStyle = {
  color: "#ffffff",
  opacity: 8,
  outline: false,
  outlineColor: "#ffffff",
};

/** Default look of the box behind the bio (matches the name box). */
export const DEFAULT_BIO_BOX: BoxStyle = {
  color: "#ffffff",
  opacity: 8,
  outline: false,
  outlineColor: "#ffffff",
};

/** Default look of the link buttons (solid dark with a faint outline). */
export const DEFAULT_LINK_BOX: BoxStyle = {
  color: "#000000",
  opacity: 100,
  outline: true,
  outlineColor: "#2a2a2a",
};

/** A color at a given 0–100 opacity, as an `rgba()` string. */
function withOpacity(color: string, opacity: number): string {
  const rgb = parseColor(color);
  const a = Math.max(0, Math.min(100, opacity)) / 100;
  if (!rgb) return color;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a})`;
}

/** Inline CSS (background + outline) for a box surface. `fill` overrides color. */
export function boxCss(box: BoxStyle, fill?: string): CSSProperties {
  // `padding-box` keeps the fill from rendering under the antialiased rounded
  // border. Without it, Windows Chromium (notably at fractional display
  // scaling) leaves a bright hairline / square-looking artifact at the corners.
  if (box.enabled === false) {
    // Background turned off → a fully transparent surface (no fill, no outline).
    return {
      backgroundColor: "transparent",
      border: "1px solid transparent",
      backgroundClip: "padding-box",
    };
  }
  return {
    backgroundColor: withOpacity(fill ?? box.color, box.opacity),
    border: `1px solid ${box.outline ? box.outlineColor : "transparent"}`,
    backgroundClip: "padding-box",
  };
}

/**
 * Resolve a link's effective box style: its own `box`, else a fallback with the
 * deprecated `color` folded in, else the fallback as-is.
 */
export function resolveLinkBox(
  link: LinkItem,
  fallback: BoxStyle = DEFAULT_LINK_BOX,
): BoxStyle {
  if (link.box) return link.box;
  if (link.color) return { ...fallback, color: link.color };
  return fallback;
}

// ---------------------------------------------------------------------------
// Profile panel (background behind the whole block: avatar + name/bio + links)
// ---------------------------------------------------------------------------

/** Default panel: none, so the page background shows through unchanged. */
export const DEFAULT_PANEL: PanelStyle = { type: "transparent" };

/** Inline CSS for a panel surface. Returns `{}` for the transparent default. */
export function panelCss(panel: PanelStyle): CSSProperties {
  switch (panel.type) {
    case "color":
      return { backgroundColor: withOpacity(panel.color, panel.opacity) };
    case "gradient": {
      const dir = panel.direction === "horizontal" ? "to right" : "to bottom";
      return {
        backgroundImage: `linear-gradient(${dir}, ${withOpacity(
          panel.from,
          panel.opacity,
        )}, ${withOpacity(panel.to, panel.opacity)})`,
      };
    }
    case "glass":
      // Apple-style "liquid glass". The SVG displacement filter (see
      // <GlassFilter/>) warps the backdrop in real time so it genuinely
      // refracts what's behind it; the layered sheen + bright rim + specular
      // bottom glow give it the lens-like depth. `backdrop-filter` (Chromium)
      // gets the refraction; `-webkit-backdrop-filter` (Safari, no url()
      // filters) falls back to a heavier frosted blur.
      return {
        backgroundColor: withOpacity(panel.color, panel.opacity),
        backgroundImage:
          "linear-gradient(135deg, rgba(255,255,255,0.4), rgba(255,255,255,0.08) 40%, rgba(255,255,255,0) 56%), radial-gradient(120% 80% at 50% 0%, rgba(255,255,255,0.28), rgba(255,255,255,0) 60%)",
        backdropFilter:
          "url(#liquid-glass) blur(3px) saturate(180%) brightness(1.06)",
        WebkitBackdropFilter: "blur(22px) saturate(180%)",
        border: "1px solid rgba(255, 255, 255, 0.45)",
        boxShadow:
          "inset 0 1px 1px rgba(255,255,255,0.9), inset 0 -8px 24px rgba(255,255,255,0.12), inset 0 0 12px rgba(255,255,255,0.08), 0 12px 40px rgba(0,0,0,0.3)",
      };
    default:
      return {};
  }
}

/**
 * Hidden SVG filter that powers the "liquid glass" panel: gentle fractal-noise
 * turbulence drives a displacement map, so `backdrop-filter: url(#liquid-glass)`
 * warps (refracts) whatever is behind the panel. Rendered once per page;
 * browsers without url() backdrop filters (Safari) simply ignore it and use the
 * frosted-blur fallback.
 */
export function GlassFilter() {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute h-0 w-0"
      focusable="false"
    >
      <title>Liquid glass filter</title>
      <filter
        id="liquid-glass"
        x="-20%"
        y="-20%"
        width="140%"
        height="140%"
        colorInterpolationFilters="sRGB"
      >
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.009 0.013"
          numOctaves={2}
          seed={7}
          result="noise"
        />
        <feGaussianBlur in="noise" stdDeviation={2.5} result="softNoise" />
        <feDisplacementMap
          in="SourceGraphic"
          in2="softNoise"
          scale={28}
          xChannelSelector="R"
          yChannelSelector="G"
        />
      </filter>
    </svg>
  );
}

/** Apply {@link adaptColor} to every explicit color in a rich-text HTML string. */
function adaptHtmlColors(html: string, isDark: boolean): string {
  if (typeof document === "undefined" || !html) return html;
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  for (const el of tmp.querySelectorAll<HTMLElement>("[color]")) {
    const c = el.getAttribute("color") ?? undefined;
    const next = adaptColor(c, isDark);
    if (next && next !== c) el.setAttribute("color", next);
  }
  for (const el of tmp.querySelectorAll<HTMLElement>("[style]")) {
    const c = el.style.color;
    if (c) {
      const next = adaptColor(c, isDark);
      if (next) el.style.color = next;
    }
  }
  return tmp.innerHTML;
}

/** Turn a TextStyle into inline CSS. Undefined props fall back to CSS/classes. */
export function styleToCss(s: TextStyle, isDark: boolean): CSSProperties {
  const animated = !!s.animation && s.animation !== "none";
  const color = adaptColor(s.color, isDark);
  return {
    fontFamily: s.fontFamily ? FONTS[s.fontFamily]?.family : undefined,
    fontSize: s.fontSize ? `${s.fontSize}px` : undefined,
    fontWeight: s.bold ? 700 : 400,
    fontStyle: s.italic ? "italic" : "normal",
    textDecoration: s.underline ? "underline" : undefined,
    textAlign: s.align,
    // When animated, the effect class paints the glyphs — leave `color` unset so
    // it doesn't override the clipped gradient. `--text-c` feeds the shine base;
    // `caretColor` keeps the text cursor visible while editing (the glyph fill
    // is transparent).
    color: animated ? undefined : color,
    caretColor: animated ? (color ?? "#ffffff") : undefined,
    ...(animated
      ? ({ "--text-c": color ?? "#ffffff" } as Record<string, string>)
      : {}),
  };
}

/** Tailwind/global class for a text style's animated effect (empty when none). */
export function textAnimClass(s?: TextStyle): string {
  switch (s?.animation) {
    case "gradient":
      return "text-anim-gradient";
    case "rainbow":
      return "text-anim-rainbow";
    case "shine":
      return "text-anim-shine";
    default:
      return "";
  }
}

// ---------------------------------------------------------------------------
// HTML sanitizer — name/bio are rendered as HTML on public pages, so a page
// owner's stored content is untrusted input to every visitor. Allow only the
// formatting tags our editor produces and strip everything else.
// ---------------------------------------------------------------------------

const ALLOWED_TAGS = new Set([
  "B",
  "STRONG",
  "I",
  "EM",
  "U",
  "BR",
  "FONT",
  "SPAN",
]);

/** Accept only simple, non-executable color values. */
function isSafeColor(value: string | null): boolean {
  if (!value) return false;
  const s = value.trim().toLowerCase();
  return (
    /^#[0-9a-f]{3}$/.test(s) ||
    /^#[0-9a-f]{6}$/.test(s) ||
    /^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/.test(s) ||
    /^[a-z]+$/.test(s)
  );
}

function sanitizeNode(node: Node): void {
  let changed = true;
  while (changed) {
    changed = false;
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) continue;
      if (child.nodeType !== Node.ELEMENT_NODE) {
        child.remove();
        changed = true;
        continue;
      }
      const el = child as HTMLElement;
      const tag = el.tagName;
      if (!ALLOWED_TAGS.has(tag)) {
        // Drop dangerous containers wholesale; unwrap everything else so plain
        // text survives even if it was wrapped in a disallowed element.
        if (tag === "SCRIPT" || tag === "STYLE") {
          el.remove();
        } else {
          while (el.firstChild) node.insertBefore(el.firstChild, el);
          el.remove();
        }
        changed = true;
        continue;
      }
      // Allowed element: strip every attribute except a safe color.
      const color =
        tag === "FONT"
          ? el.getAttribute("color")
          : tag === "SPAN"
            ? el.style.color
            : null;
      for (const attr of Array.from(el.attributes)) {
        el.removeAttribute(attr.name);
      }
      if (color && isSafeColor(color)) {
        if (tag === "FONT") el.setAttribute("color", color);
        else el.style.color = color;
      }
      sanitizeNode(el);
    }
  }
}

/** Sanitize a rich-text HTML string down to the editor's allowed subset. */
export function sanitizeRichHtml(html: string): string {
  if (typeof document === "undefined" || !html) return html;
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  sanitizeNode(tmp);
  return tmp.innerHTML;
}

// ---------------------------------------------------------------------------
// Platform icons + brand colors
// ---------------------------------------------------------------------------

type IconComponent = ComponentType<{ className?: string }>;

/** The TikTok musical-note glyph, shared by the three glitch layers. */
const TIKTOK_NOTE =
  "M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z";

/**
 * The real TikTok mark: a white/foreground note with a cyan copy offset one
 * way and a red/pink copy the other, giving the signature chromatic-aberration
 * glitch. The top layer uses `currentColor` so it stays legible in both themes.
 */
function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path fill="#25f4ee" transform="translate(-1 -0.5)" d={TIKTOK_NOTE} />
      <path fill="#fe2c55" transform="translate(1 0.5)" d={TIKTOK_NOTE} />
      <path fill="currentColor" d={TIKTOK_NOTE} />
    </svg>
  );
}

function YouTubeIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <defs>
        <linearGradient id="ig-gradient" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#feda75" />
          <stop offset="25%" stopColor="#fa7e1e" />
          <stop offset="50%" stopColor="#d62976" />
          <stop offset="75%" stopColor="#962fbf" />
          <stop offset="100%" stopColor="#4f5bd5" />
        </linearGradient>
      </defs>
      <path
        fill="url(#ig-gradient)"
        d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"
      />
    </svg>
  );
}

function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M20.317 4.3698a19.7913 19.7913 0 0 0-4.8851-1.5152.0741.0741 0 0 0-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 0 0-.0785-.037 19.7363 19.7363 0 0 0-4.8852 1.515.0699.0699 0 0 0-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 0 0 .0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 0 0 .0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 0 0-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 0 1-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 0 1 .0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 0 1 .0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 0 1-.0066.1276 12.2986 12.2986 0 0 1-1.873.8914.0766.0766 0 0 0-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 0 0 .0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 0 0 .0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 0 0-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function TwitchIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
    </svg>
  );
}

function PatreonIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M14.82 2.41c3.96 0 7.18 3.24 7.18 7.21 0 3.96-3.22 7.18-7.18 7.18-3.97 0-7.21-3.22-7.21-7.18 0-3.97 3.24-7.21 7.21-7.21M2 21.6h3.5V2.41H2z" />
    </svg>
  );
}

function PayPalIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106zm14.146-14.42a3.35 3.35 0 0 0-.607-.541c-.013.076-.026.175-.041.254-.93 4.778-4.005 7.201-9.138 7.201h-2.19a.563.563 0 0 0-.556.479l-1.187 7.527h-.506l-.24 1.516a.56.56 0 0 0 .554.647h3.882c.46 0 .85-.334.922-.788.06-.26.76-4.852.816-5.09a.932.932 0 0 1 .923-.788h.58c3.76 0 6.705-1.528 7.565-5.946.36-1.847.174-3.388-.777-4.471z" />
    </svg>
  );
}

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

function PayhipIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M3.695 0A3.696 3.696 0 0 0 0 3.695v12.92A7.384 7.384 0 0 0 7.385 24h12.92A3.696 3.696 0 0 0 24 20.305V0H3.695zm11.653 5.604a3.88 3.88 0 0 1 .166 0 3.88 3.88 0 0 1 2.677 1.132 3.88 3.88 0 0 1 0 5.48l-.36.356c-1.826-1.825-3.648-3.656-5.476-5.482l.358-.354a3.88 3.88 0 0 1 2.635-1.132zm-6.627.125a3.88 3.88 0 0 1 2.566 1c2.068 2.062 4.127 4.133 6.192 6.199l-5.481 5.482-6.19-6.203C3.549 9.7 5.346 5.702 8.722 5.729zm-1.744 1.71a.464.464 0 0 0-.465.465v1.817c0 .256.208.463.465.463h1.816a.464.464 0 0 0 .463-.463l.008-1.817A.464.464 0 0 0 8.8 7.44H6.977z" />
    </svg>
  );
}

function EmailIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M1.5 8.67v8.58a3 3 0 0 0 3 3h15a3 3 0 0 0 3-3V8.67l-8.928 5.493a3 3 0 0 1-3.144 0L1.5 8.67Z" />
      <path d="M22.5 6.908V6.75a3 3 0 0 0-3-3h-15a3 3 0 0 0-3 3v.158l9.714 5.978a1.5 1.5 0 0 0 1.572 0L22.5 6.908Z" />
    </svg>
  );
}

function SpotifyIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.18-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.42 1.56-.299.421-1.02.599-1.56.3z" />
    </svg>
  );
}

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.225 0z" />
    </svg>
  );
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function ThreadsIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.291 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.964-.065-1.19.408-2.285 1.33-3.082.88-.76 2.119-1.207 3.583-1.291a13.85 13.85 0 0 1 3.02.142c-.126-.742-.375-1.332-.75-1.757-.513-.586-1.308-.883-2.359-.89h-.029c-.844 0-1.992.232-2.721 1.32L7.734 7.847c.98-1.454 2.568-2.256 4.478-2.256h.044c3.194.02 5.097 1.975 5.287 5.388.108.046.216.094.321.142 1.49.7 2.58 1.761 3.154 3.07.797 1.82.871 4.79-1.548 7.158-1.85 1.81-4.094 2.628-7.277 2.65Zm1.003-11.69c-.242 0-.487.007-.739.021-1.836.103-2.98.946-2.916 2.143.067 1.256 1.452 1.839 2.784 1.767 1.224-.065 2.818-.543 3.086-3.71a10.5 10.5 0 0 0-2.215-.221z" />
    </svg>
  );
}

function BlueskyIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M5.769 2.762C8.164 4.548 10.746 8.17 11.694 10.114c.948-1.943 3.53-5.566 5.925-7.352C19.343 1.474 22 .414 22 3.44c0 .603-.346 5.068-.549 5.792-.705 2.516-3.27 3.158-5.55 2.77 3.985.678 4.997 2.923 2.808 5.168-4.157 4.263-5.975-1.07-6.442-2.437-.086-.25-.125-.367-.126-.267-.001-.1-.04.017-.126.267-.467 1.367-2.285 6.7-6.442 2.437-2.19-2.245-1.177-4.49 2.808-5.168-2.28.388-4.845-.254-5.55-2.77C1.076 8.508.73 4.043.73 3.44c0-3.026 2.657-1.966 4.381-.678z" />
    </svg>
  );
}

function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  );
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
    </svg>
  );
}

function RedditIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.11 3.11 0 0 1 .042.52c0 2.694-3.13 4.87-6.994 4.87-3.865 0-6.994-2.176-6.994-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12c-.688 0-1.25.562-1.25 1.25 0 .687.562 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z" />
    </svg>
  );
}

function PinterestIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.401.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.354-.629-2.758-1.379l-.749 2.848c-.269 1.045-1.004 2.352-1.498 3.146 1.123.345 2.306.535 3.55.535 6.607 0 11.985-5.365 11.985-11.987C23.97 5.39 18.592.026 11.985.026L12.017 0z" />
    </svg>
  );
}

function SnapchatIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M12.206.793c.99 0 4.347.276 5.93 3.821.529 1.193.403 3.219.299 4.847l-.003.06c-.012.18-.022.345-.03.51.075.045.203.09.401.09.3-.016.659-.12 1.033-.301.165-.088.344-.104.464-.104.182 0 .359.029.509.09.45.149.734.479.734.838.015.449-.39.839-1.213 1.168-.089.029-.209.075-.344.119-.45.135-1.139.36-1.333.81-.09.212-.061.494.09.808l.015.03c.06.136 1.526 3.475 4.791 4.014.255.044.435.27.42.509 0 .075-.015.149-.045.225-.24.569-1.273.988-3.146 1.271-.059.091-.12.375-.164.57-.029.135-.061.271-.105.42-.056.199-.194.3-.44.3h-.017c-.126 0-.28-.028-.462-.061-.257-.045-.575-.09-.978-.09-.226 0-.457.015-.69.061-.442.076-.815.375-1.243.734-.646.539-1.394 1.169-2.694 1.169-.06 0-.12-.005-.164-.008-.09.005-.15.008-.24.008-1.3 0-2.049-.63-2.694-1.169-.428-.359-.801-.658-1.243-.734-.233-.046-.464-.061-.69-.061-.403 0-.721.045-.978.09-.181.033-.335.061-.462.061h-.017c-.245 0-.384-.101-.44-.3-.044-.149-.076-.285-.105-.42-.044-.195-.105-.479-.164-.57-1.873-.283-2.906-.702-3.146-1.271-.03-.076-.045-.15-.045-.225-.015-.239.165-.465.42-.509 3.265-.539 4.731-3.878 4.791-4.014l.015-.03c.151-.314.18-.596.09-.808-.194-.45-.883-.675-1.333-.81-.135-.044-.255-.09-.344-.119-.823-.329-1.228-.719-1.213-1.168 0-.359.284-.689.734-.838.15-.061.327-.09.509-.09.12 0 .299.016.464.104.374.181.733.285 1.033.301.198 0 .326-.045.401-.09-.008-.165-.018-.33-.03-.51l-.003-.06c-.104-1.628-.23-3.654.299-4.847C7.859 1.069 11.216.793 12.206.793z" />
    </svg>
  );
}

export interface Platform {
  key: string;
  label: string;
  icon: IconComponent;
  prefix: string;
  match: RegExp;
  /** Brand color applied to the icon; omit for icons that self-color (e.g.
   *  the Instagram gradient) or that should inherit the text color (e.g. X). */
  color?: string;
}

export const PLATFORMS: Platform[] = [
  {
    key: "tiktok",
    label: "TikTok",
    icon: TikTokIcon,
    prefix: "https://www.tiktok.com/@",
    match: /tiktok\.com/i,
  },
  {
    key: "youtube",
    label: "YouTube",
    icon: YouTubeIcon,
    prefix: "https://www.youtube.com/@",
    match: /youtube\.com|youtu\.be/i,
    color: "#ff0000",
  },
  {
    key: "instagram",
    label: "Instagram",
    icon: InstagramIcon,
    prefix: "https://www.instagram.com/",
    match: /instagram\.com/i,
  },
  {
    key: "facebook",
    label: "Facebook",
    icon: FacebookIcon,
    prefix: "https://www.facebook.com/",
    match: /facebook\.com|fb\.(com|me)/i,
    color: "#1877f2",
  },
  {
    key: "threads",
    label: "Threads",
    icon: ThreadsIcon,
    prefix: "https://www.threads.net/@",
    match: /threads\.net/i,
  },
  {
    key: "bluesky",
    label: "Bluesky",
    icon: BlueskyIcon,
    prefix: "https://bsky.app/profile/",
    match: /bsky\.app/i,
    color: "#0085ff",
  },
  {
    key: "pinterest",
    label: "Pinterest",
    icon: PinterestIcon,
    prefix: "https://www.pinterest.com/",
    match: /pinterest\.com/i,
    color: "#e60023",
  },
  {
    key: "snapchat",
    label: "Snapchat",
    icon: SnapchatIcon,
    prefix: "https://www.snapchat.com/add/",
    match: /snapchat\.com/i,
  },
  {
    key: "reddit",
    label: "Reddit",
    icon: RedditIcon,
    prefix: "https://www.reddit.com/user/",
    match: /reddit\.com/i,
    color: "#ff4500",
  },
  {
    key: "spotify",
    label: "Spotify",
    icon: SpotifyIcon,
    prefix: "https://open.spotify.com/artist/",
    match: /spotify\.com/i,
    color: "#1db954",
  },
  {
    key: "discord",
    label: "Discord",
    icon: DiscordIcon,
    // A Discord handle isn't a navigable URL, so it's stored under a `discord:`
    // scheme (see {@link discordUsername}) and clicking copies it instead of
    // opening a link. The legacy invite-URL forms still resolve to Discord.
    prefix: "discord:",
    match: /^discord:|discord\.(gg|com)/i,
    color: "#5865f2",
  },
  {
    key: "telegram",
    label: "Telegram",
    icon: TelegramIcon,
    prefix: "https://t.me/",
    match: /t\.me|telegram\.(me|org)/i,
    color: "#26a5e4",
  },
  {
    key: "whatsapp",
    label: "WhatsApp",
    icon: WhatsAppIcon,
    prefix: "https://wa.me/",
    match: /wa\.me|whatsapp\.com/i,
    color: "#25d366",
  },
  {
    key: "x",
    label: "X",
    icon: XIcon,
    prefix: "https://x.com/",
    match: /(?:x|twitter)\.com/i,
  },
  {
    key: "twitch",
    label: "Twitch",
    icon: TwitchIcon,
    prefix: "https://www.twitch.tv/",
    match: /twitch\.tv/i,
    color: "#9146ff",
  },
  {
    key: "patreon",
    label: "Patreon",
    icon: PatreonIcon,
    prefix: "https://www.patreon.com/",
    match: /patreon\.com/i,
    color: "#f96854",
  },
  {
    key: "linkedin",
    label: "LinkedIn",
    icon: LinkedInIcon,
    prefix: "https://www.linkedin.com/in/",
    match: /linkedin\.com/i,
    color: "#0a66c2",
  },
  {
    key: "github",
    label: "GitHub",
    icon: GitHubIcon,
    prefix: "https://github.com/",
    match: /github\.com/i,
  },
  {
    key: "paypal",
    label: "PayPal",
    icon: PayPalIcon,
    prefix: "https://www.paypal.me/",
    match: /paypal\.(com|me)/i,
    color: "#0070ba",
  },
  {
    key: "payhip",
    label: "Payhip",
    icon: PayhipIcon,
    prefix: "https://payhip.com/",
    match: /payhip\.com/i,
    color: "#5c6ac4",
  },
  {
    key: "email",
    label: "Email",
    icon: EmailIcon,
    prefix: "mailto:",
    match: /^mailto:/i,
  },
];

/** Resolve the platform (icon + brand color) from a link's URL. */
export function getPlatform(href: string): Platform | undefined {
  return PLATFORMS.find((p) => p.match.test(href));
}

/**
 * Discord links store a username under a `discord:` scheme instead of a URL,
 * because a Discord handle isn't something you can navigate to — clicking it
 * copies the username to the clipboard. Returns true for such links.
 */
export function isDiscordLink(href: string): boolean {
  return /^discord:/i.test(href.trim());
}

/** The username portion of a `discord:` link ("" when none is set yet). */
export function discordUsername(href: string): string {
  return href
    .trim()
    .replace(/^discord:/i, "")
    .trim();
}

/** Render a platform icon in its brand color (icons use `currentColor`). */
export function BrandIcon({
  icon: Icon,
  color,
  className,
}: {
  icon: IconComponent;
  color?: string;
  className?: string;
}) {
  return (
    <span style={color ? { color } : undefined} className="inline-flex">
      <Icon className={className} />
    </span>
  );
}

/** Map a text alignment onto a flex `justify-content` value. */
function alignToJustify(
  align?: TextStyle["align"],
): CSSProperties["justifyContent"] {
  if (align === "left") return "flex-start";
  if (align === "right") return "flex-end";
  return "center";
}

/**
 * A single link button. Its surface comes from the link's own `box` style
 * (color, opacity, outline, on/off), falling back to `box` (the page default)
 * then the built-in default. Text styling comes from the link's own `textStyle`
 * falling back to `textStyle` (the page default). The label color is the
 * explicit text color if set, otherwise black/white chosen for legibility on
 * the fill (or the inherited theme color when the box background is off). When
 * `trackUsername` is set (public views only), clicks are recorded for analytics.
 */
/** Best-effort hostname for a link URL (falls back to the raw href). */
function linkHostname(href: string): string {
  try {
    return new URL(href).hostname.replace(/^www\./, "");
  } catch {
    return href;
  }
}

/**
 * Copy-to-clipboard state with a short-lived "copied" flag, used to flash the
 * "Link copied!" confirmation after a Discord username is copied.
 */
function useCopied(timeout = 1600) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const copy = useCallback(
    (text: string) => {
      // Confirm immediately for responsive feedback; the clipboard write may be
      // blocked (e.g. an insecure context) but the interaction still registers.
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), timeout);
      void navigator.clipboard?.writeText(text).catch(() => {});
    },
    [timeout],
  );
  return { copied, copy };
}

/**
 * Bottom-of-screen "Link copied!" toast, styled and animated like the editor's
 * unsaved-changes bar: it slides up on `show`, then slides back down before
 * unmounting so the exit is animated too.
 */
function CopiedToast({ show }: { show: boolean }) {
  const [mounted, setMounted] = useState(show);
  const [visible, setVisible] = useState(show);
  useEffect(() => {
    if (show) {
      setMounted(true);
      setVisible(true);
      return;
    }
    setVisible(false);
    const t = setTimeout(() => setMounted(false), 200);
    return () => clearTimeout(t);
  }, [show]);

  if (!mounted) return null;
  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4",
        visible ? "animate-slide-up" : "animate-slide-down",
      )}
    >
      <div
        role="status"
        className="flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-foreground text-sm font-medium shadow-lg"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="size-4 text-green-500"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
        Link copied!
      </div>
    </div>
  );
}

export function LinkAnchor({
  link,
  box = DEFAULT_LINK_BOX,
  textStyle,
  isDark = false,
  trackUsername,
  enablePreview = false,
}: {
  link: LinkItem;
  box?: BoxStyle;
  textStyle?: TextStyle;
  isDark?: boolean;
  trackUsername?: string;
  // When set, clicking the box opens a preview card first (instead of
  // navigating); clicking the card opens the site in a new tab.
  enablePreview?: boolean;
}) {
  const platform = getPlatform(link.href);
  const Icon = platform?.icon;
  const resolved = resolveLinkBox(link, box);
  const ts = link.textStyle ?? textStyle;
  const bgOff = resolved.enabled === false;
  // With a fill, pick black/white for contrast; with the background off, let the
  // text inherit the theme foreground. An explicit text color always wins (and
  // is theme-adapted when it would otherwise vanish on the page background).
  const textColor = ts?.color
    ? bgOff
      ? adaptColor(ts.color, isDark)
      : ts.color
    : bgOff
      ? undefined
      : contrastText(resolved.color);

  const [previewOpen, setPreviewOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const { copied, copy } = useCopied();

  // Close the preview on outside click or Escape.
  useEffect(() => {
    if (!previewOpen) return;
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setPreviewOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setPreviewOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [previewOpen]);

  const boxStyle: CSSProperties = {
    ...boxCss(resolved),
    color: textColor,
    fontFamily: ts?.fontFamily ? FONTS[ts.fontFamily]?.family : undefined,
    fontSize: ts?.fontSize ? `${ts.fontSize}px` : undefined,
    fontWeight: ts ? (ts.bold ? 700 : 400) : undefined,
    fontStyle: ts?.italic ? "italic" : undefined,
    textDecoration: ts?.underline ? "underline" : undefined,
    justifyContent: alignToJustify(ts?.align),
  };
  const boxClassName =
    "flex w-full items-center gap-2 rounded-md px-4 py-3 text-center text-sm font-medium transition-all hover:opacity-90 hover:shadow-sm";
  const iconEl = link.logo ? (
    // biome-ignore lint/performance/noImgElement: small inline data-URL logo; next/image adds no value
    <img src={link.logo} alt="" className="size-4 object-contain" />
  ) : Icon ? (
    <BrandIcon icon={Icon} color={platform?.color} className="size-4" />
  ) : null;
  const labelEl =
    ts?.animation && ts.animation !== "none" ? (
      <span
        className={textAnimClass(ts)}
        style={{ "--text-c": textColor ?? "#ffffff" } as CSSProperties}
      >
        {link.label}
      </span>
    ) : (
      link.label
    );

  // Discord: the href holds a username, not a URL. Clicking copies it and
  // flashes a "Link copied!" confirmation instead of navigating.
  if (isDiscordLink(link.href)) {
    const username = discordUsername(link.href);
    return (
      <>
        <button
          type="button"
          aria-label={`Copy Discord username ${username}`}
          onClick={() => {
            copy(username);
            if (trackUsername) recordClick(trackUsername, link.id, link.label);
          }}
          style={boxStyle}
          className={cn(boxClassName, "cursor-pointer")}
        >
          {iconEl}
          {labelEl}
        </button>
        <CopiedToast show={copied} />
      </>
    );
  }

  // Default behavior: the box is a plain link that opens in a new tab.
  if (!enablePreview) {
    return (
      <a
        href={link.href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={
          trackUsername
            ? () => recordClick(trackUsername, link.id, link.label)
            : undefined
        }
        style={boxStyle}
        className={boxClassName}
      >
        {iconEl}
        {labelEl}
      </a>
    );
  }

  // Preview mode: the box toggles a preview card; the card is the real link.
  return (
    <div ref={wrapRef} className="relative w-full">
      <button
        type="button"
        aria-expanded={previewOpen}
        onClick={() => setPreviewOpen((v) => !v)}
        style={boxStyle}
        className={cn(boxClassName, "cursor-pointer")}
      >
        {iconEl}
        {labelEl}
      </button>

      {previewOpen ? (
        <a
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => {
            if (trackUsername) recordClick(trackUsername, link.id, link.label);
            setPreviewOpen(false);
          }}
          className="absolute top-full left-0 z-30 mt-2 flex w-full animate-pop items-center gap-3 rounded-xl border border-border bg-popover p-3 text-left text-popover-foreground shadow-xl transition-all hover:shadow-2xl"
        >
          {/* Favicon of the destination site. */}
          {/* biome-ignore lint/performance/noImgElement: tiny remote favicon; next/image adds no value */}
          <img
            src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(linkHostname(link.href))}&sz=64`}
            alt=""
            className="size-9 shrink-0 rounded-md bg-muted object-contain p-1"
          />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-semibold">{link.label}</span>
            <span className="truncate text-xs text-muted-foreground">
              {linkHostname(link.href)}
            </span>
          </span>
          <span className="shrink-0 text-xs font-medium text-muted-foreground">
            Open ↗
          </span>
        </a>
      ) : null}
    </div>
  );
}

/**
 * A link rendered as its logo/icon only (no box, no label) — used by the
 * "horizontal" layout, where the links sit in a centered row of icons.
 */
export function LinkIconAnchor({
  link,
  isDark = false,
  trackUsername,
}: {
  link: LinkItem;
  isDark?: boolean;
  trackUsername?: string;
}) {
  const platform = getPlatform(link.href);
  const Icon = platform?.icon;
  const fallbackColor = link.textStyle?.color
    ? adaptColor(link.textStyle.color, isDark)
    : undefined;
  const { copied, copy } = useCopied();
  const inner = link.logo ? (
    // biome-ignore lint/performance/noImgElement: small inline data-URL logo; next/image adds no value
    <img src={link.logo} alt="" className="size-8 object-contain" />
  ) : Icon ? (
    <BrandIcon icon={Icon} color={platform?.color} className="size-8" />
  ) : (
    <span
      style={fallbackColor ? { color: fallbackColor } : undefined}
      className="text-lg font-semibold"
    >
      {link.label.charAt(0).toUpperCase() || "?"}
    </span>
  );
  const iconClassName =
    "flex size-11 items-center justify-center rounded-md transition-transform hover:scale-110";

  // Discord: copy the username instead of navigating, with a confirmation.
  if (isDiscordLink(link.href)) {
    const username = discordUsername(link.href);
    return (
      <>
        <button
          type="button"
          aria-label={`Copy Discord username ${username}`}
          title={link.label}
          onClick={() => {
            copy(username);
            if (trackUsername) recordClick(trackUsername, link.id, link.label);
          }}
          className={cn(iconClassName, "cursor-pointer")}
        >
          {inner}
        </button>
        <CopiedToast show={copied} />
      </>
    );
  }

  return (
    <a
      href={link.href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={link.label}
      title={link.label}
      onClick={
        trackUsername
          ? () => recordClick(trackUsername, link.id, link.label)
          : undefined
      }
      className={iconClassName}
    >
      {inner}
    </a>
  );
}

// ---------------------------------------------------------------------------
// Page background
// ---------------------------------------------------------------------------

/**
 * Map a 0–10 speed onto a base animation duration in seconds (higher = faster).
 * Speed 0 returns 0, which callers treat as "stopped" (no animation).
 */
function speedToSeconds(speed: number): number {
  const s = Math.max(0, Math.min(10, speed));
  if (s === 0) return 0;
  return (11 - s) * 3;
}

/** Map a 1–10 speed onto a CSS animation duration string. */
function speedToDuration(speed: number): string {
  return `${speedToSeconds(speed)}s`;
}

/**
 * Full-viewport background layer behind the page content. Renders nothing for
 * the default (so the theme's own background shows through). Static fills and
 * gradients are a single styled div; starfield/media get their own markup.
 */
export function PageBackground({ bg }: { bg?: Background }) {
  if (!bg || bg.type === "default") return null;

  if (bg.type === "custom") {
    return (
      <div
        aria-hidden
        className="fixed inset-0 -z-10"
        style={{ backgroundColor: bg.color }}
      />
    );
  }

  if (bg.type === "gradient") {
    const dir = bg.direction === "horizontal" ? "to right" : "to bottom";
    const mid = bg.distribution ?? 50;
    return (
      <div
        aria-hidden
        className="fixed inset-0 -z-10"
        style={{
          backgroundImage: `linear-gradient(${dir}, ${bg.from}, ${mid}%, ${bg.to})`,
        }}
      />
    );
  }

  if (bg.type === "starfield") {
    return (
      <div
        aria-hidden
        className="stars-layer"
        style={{ "--stars-dur": speedToDuration(bg.speed) } as CSSProperties}
      />
    );
  }

  if (bg.type === "media") {
    const frame: CSSProperties = {
      objectPosition: `${bg.posX}% ${bg.posY}%`,
      transform: `scale(${bg.zoom})`,
    };
    return (
      <div aria-hidden className="media-layer">
        {bg.kind === "video" ? (
          <video src={bg.src} autoPlay muted loop playsInline style={frame} />
        ) : (
          // biome-ignore lint/performance/noImgElement: user-provided data-URL background
          <img src={bg.src} alt="" style={frame} />
        )}
      </div>
    );
  }

  // Unknown/legacy type (e.g. a since-removed background) → fall back to the
  // theme's own background.
  return null;
}

// ---------------------------------------------------------------------------
// Read-only rich text + full profile view
// ---------------------------------------------------------------------------

/**
 * Read-only render of a rich-text value. Sanitizes the (possibly untrusted)
 * HTML, adapts explicit colors to the theme, then sets it via a ref rather than
 * React's `dangerouslySetInnerHTML` prop.
 */
export function RichText({
  as,
  html,
  isDark,
  className,
  style,
}: {
  as: "h1" | "p";
  html: string;
  isDark: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLHeadingElement & HTMLParagraphElement>(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.innerHTML = adaptHtmlColors(sanitizeRichHtml(html), isDark);
    }
  }, [html, isDark]);
  const Tag = as;
  return <Tag ref={ref} className={className} style={style} />;
}

/**
 * Inline style for the ring around the profile picture. Returns `undefined`
 * when there's no outline (so the avatar renders exactly as before). A 3px
 * box-shadow ring hugs the circular avatar without changing its size.
 */
export function avatarRingStyle(
  outline?: AvatarOutline,
): CSSProperties | undefined {
  if (!outline?.enabled) return undefined;
  return { boxShadow: `0 0 0 3px ${outline.color}` };
}

/** Emits little dots outward from the avatar center, on a continuous loop. */
function AvatarParticles({
  effect,
}: {
  effect: Extract<AvatarEffect, { type: "particles" }>;
}) {
  const clamp = (n: number) => Math.max(1, Math.min(10, n));
  const count = clamp(effect.amount) * 3; // 3–30 particles
  const px = 2 + clamp(effect.size); // 3–12 px
  const dur = (11 - clamp(effect.speed)) * 0.4 + 1; // ~1.4s (fast) – 5s (slow)
  return (
    <div className="avatar-fx-particles" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * Math.PI * 2;
        const dist = 52 + (i % 4) * 10; // travel past the avatar's edge
        return (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed, order-stable particle list
            key={i}
            className="avatar-particle"
            style={
              {
                width: `${px}px`,
                height: `${px}px`,
                "--p-color": effect.color,
                "--p-tx": `${Math.cos(angle) * dist}px`,
                "--p-ty": `${Math.sin(angle) * dist}px`,
                "--p-dur": `${dur}s`,
                "--p-delay": `${(i / count) * dur}s`,
              } as CSSProperties
            }
          />
        );
      })}
    </div>
  );
}

/**
 * Wraps the profile picture and layers on its outline + animated effect. The
 * ring sits on an un-clipped frame so it isn't cut off; particles emit from
 * behind the avatar; the shine sweep is clipped to the circle.
 */
export function AvatarFx({
  effect,
  outline,
  children,
}: {
  effect?: AvatarEffect;
  outline?: AvatarOutline;
  children: ReactNode;
}) {
  return (
    <div className="relative inline-flex">
      {effect?.type === "particles" ? (
        <AvatarParticles effect={effect} />
      ) : null}
      {/* `flex` so the ring wrapper hugs the avatar exactly (no inline-baseline
          gap that would push the box-shadow ring out past the circle). */}
      <div
        className="relative flex rounded-full"
        style={avatarRingStyle(outline)}
      >
        {children}
        {effect?.type === "shine" ? (
          <span
            aria-hidden="true"
            className="avatar-shine overflow-hidden rounded-full"
            style={
              {
                "--s-dur": `${(11 - Math.max(1, Math.min(10, effect.speed))) * 0.5 + 0.8}s`,
              } as CSSProperties
            }
          />
        ) : null}
      </div>
    </div>
  );
}

/**
 * The public, read-only rendering of a page (avatar, name, bio, links). When
 * `username` is provided (i.e. a real public visit), the view is recorded once
 * and link clicks are tracked for the owner's analytics.
 */
export function ProfileView({
  data,
  username,
}: {
  data: PageData;
  username?: string;
}) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = mounted && resolvedTheme === "dark";

  // Record a single view per mount. The ref guards against React's double
  // effect invocation in development strict mode.
  const viewRecorded = useRef(false);
  useEffect(() => {
    if (!username || viewRecorded.current) return;
    viewRecorded.current = true;
    recordView(username);
  }, [username]);

  const nameStyle = { ...DEFAULT_NAME_STYLE, ...data.nameStyle };
  const bioStyle = { ...DEFAULT_BIO_STYLE, ...data.bioStyle };
  const nameBox = data.nameBox ?? DEFAULT_NAME_BOX;
  // Old pages had a single box behind both name and bio; fall back to it so
  // their look is preserved until the bio box is customized on its own.
  const bioBox = data.bioBox ?? data.nameBox ?? DEFAULT_BIO_BOX;
  const linkBox = data.linkBox ?? DEFAULT_LINK_BOX;
  const panel = data.panel ?? DEFAULT_PANEL;
  // "horizontal" keeps everything centered and stacked, but lays the links out
  // as a row of logo-only icons instead of full-width buttons.
  const horizontal = data.panelOrientation === "horizontal";

  return (
    <div
      style={panelCss(panel)}
      className={cn(
        "relative mx-auto flex w-full max-w-lg flex-col items-center gap-6",
        panel.type !== "transparent" && "rounded-2xl p-6",
      )}
    >
      <PageBackground bg={data.background} />
      <GlassFilter />

      <AvatarFx effect={data.avatarEffect} outline={data.avatarOutline}>
        {data.avatar ? (
          // biome-ignore lint/performance/noImgElement: small inline data-URL avatar; next/image adds no value
          <img
            src={data.avatar}
            alt=""
            className="size-24 rounded-full object-cover"
          />
        ) : (
          <div className="flex size-24 items-center justify-center rounded-full bg-muted text-3xl font-semibold text-muted-foreground">
            {data.name.charAt(0).toUpperCase() || "?"}
          </div>
        )}
      </AvatarFx>

      {/* Name and bio, kept close together in their own group. */}
      <div className="flex w-full flex-col items-center gap-2">
        <div
          style={boxCss(nameBox)}
          className="flex w-full flex-col items-center rounded-lg px-4 py-3"
        >
          <RichText
            as="h1"
            html={data.name}
            isDark={isDark}
            className={cn("w-full tracking-tight", textAnimClass(nameStyle))}
            style={styleToCss(nameStyle, isDark)}
          />
        </div>
        <div
          style={boxCss(bioBox)}
          className="flex w-full flex-col items-center rounded-lg px-4 py-3"
        >
          <RichText
            as="p"
            html={data.bio}
            isDark={isDark}
            className={cn(
              "w-full",
              !bioStyle.color && !bioStyle.animation && "text-muted-foreground",
              textAnimClass(bioStyle),
            )}
            style={styleToCss(bioStyle, isDark)}
          />
        </div>
      </div>

      {data.links.length > 0 ? (
        horizontal ? (
          <div className="flex w-full flex-wrap items-center justify-center gap-5">
            {data.links.map((link) => (
              <LinkIconAnchor
                key={link.id}
                link={link}
                isDark={isDark}
                trackUsername={username}
              />
            ))}
          </div>
        ) : (
          <div className="flex w-full flex-col gap-3">
            {data.links.map((link) => (
              <LinkAnchor
                key={link.id}
                link={link}
                box={linkBox}
                textStyle={data.linkStyle}
                isDark={isDark}
                trackUsername={username}
                enablePreview
              />
            ))}
          </div>
        )
      ) : null}
    </div>
  );
}
