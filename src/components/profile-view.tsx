"use client";

import {
  Inter,
  Lora,
  Playfair_Display,
  Poppins,
  Roboto_Mono,
} from "next/font/google";
import { useTheme } from "next-themes";
import {
  type ComponentType,
  type CSSProperties,
  type ReactNode,
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

/** Selectable fonts. Inter is the app default (used when none is set). */
export const FONTS: Record<string, { label: string; family: string }> = {
  inter: { label: "Inter", family: inter.style.fontFamily },
  poppins: { label: "Poppins", family: poppins.style.fontFamily },
  lora: { label: "Lora", family: lora.style.fontFamily },
  playfair: { label: "Playfair Display", family: playfair.style.fontFamily },
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
  // Background turned off → a fully transparent surface (no fill, no outline).
  if (box.enabled === false) {
    return { backgroundColor: "transparent", border: "1px solid transparent" };
  }
  return {
    backgroundColor: withOpacity(fill ?? box.color, box.opacity),
    border: `1px solid ${box.outline ? box.outlineColor : "transparent"}`,
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
      <path d="M5.25 2.25a3 3 0 0 0-3 3v4.318a3 3 0 0 0 .879 2.121l9.58 9.581c.92.92 2.39.92 3.31 0l4.66-4.66c.92-.92.92-2.39 0-3.31l-9.58-9.581a3 3 0 0 0-2.12-.879H5.25ZM6.375 7.5a1.125 1.125 0 1 0 0-2.25 1.125 1.125 0 0 0 0 2.25Z" />
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
    key: "discord",
    label: "Discord",
    icon: DiscordIcon,
    prefix: "https://discord.gg/",
    match: /discord\.(gg|com)/i,
    color: "#5865f2",
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
export function LinkAnchor({
  link,
  box = DEFAULT_LINK_BOX,
  textStyle,
  isDark = false,
  trackUsername,
}: {
  link: LinkItem;
  box?: BoxStyle;
  textStyle?: TextStyle;
  isDark?: boolean;
  trackUsername?: string;
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
      style={{
        ...boxCss(resolved),
        color: textColor,
        fontFamily: ts?.fontFamily ? FONTS[ts.fontFamily]?.family : undefined,
        fontSize: ts?.fontSize ? `${ts.fontSize}px` : undefined,
        fontWeight: ts ? (ts.bold ? 700 : 400) : undefined,
        fontStyle: ts?.italic ? "italic" : undefined,
        textDecoration: ts?.underline ? "underline" : undefined,
        justifyContent: alignToJustify(ts?.align),
      }}
      className="flex w-full items-center gap-2 rounded-md px-4 py-3 text-center text-sm font-medium transition-all hover:opacity-90 hover:shadow-sm"
    >
      {link.logo ? (
        // biome-ignore lint/performance/noImgElement: small inline data-URL logo; next/image adds no value
        <img src={link.logo} alt="" className="size-4 object-contain" />
      ) : Icon ? (
        <BrandIcon icon={Icon} color={platform?.color} className="size-4" />
      ) : null}
      {ts?.animation && ts.animation !== "none" ? (
        <span
          className={textAnimClass(ts)}
          style={{ "--text-c": textColor ?? "#ffffff" } as CSSProperties}
        >
          {link.label}
        </span>
      ) : (
        link.label
      )}
    </a>
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
      className="flex size-11 items-center justify-center rounded-md transition-transform hover:scale-110"
    >
      {link.logo ? (
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
      )}
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
 * gradients are a single styled div; aurora/chroma/media get their own markup.
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

  if (bg.type === "aurora") {
    const base = speedToSeconds(bg.speed);
    const cols = bg.colors.length ? bg.colors : ["#4ade80"];
    // Curtain footprint on a 1–10 scale → 32.5%–100% of the viewport.
    const sizePct = 25 + Math.max(1, Math.min(10, bg.size)) * 7.5;
    // Five overlapping curtains cycle through the chosen colors; slightly
    // different durations per curtain keep the sway organic rather than synced.
    return (
      <div aria-hidden className="aurora-layer">
        {[0, 1, 2, 3, 4].map((i) => {
          const c = cols[i % cols.length];
          return (
            <div
              key={i}
              className={`aurora-curtain aurora-curtain-${i}`}
              style={{
                width: `${sizePct * 0.85}%`,
                height: `${sizePct + 25}%`,
                background: `linear-gradient(to bottom, ${c}00 0%, ${c} 42%, ${c}00 88%)`,
                animationDuration: base === 0 ? "0s" : `${base + i}s`,
              }}
            />
          );
        })}
      </div>
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

  // media
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
              />
            ))}
          </div>
        )
      ) : null}
    </div>
  );
}
