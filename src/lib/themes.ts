import type { PageData } from "~/lib/pages";

/**
 * One-click page looks for the Studio's Themes section.
 *
 * A theme is a bundle of the *styling* half of PageData — background, panel,
 * box surfaces, typography — and deliberately nothing else. Applying one never
 * touches the name, the bio, the avatar, the links themselves, the music or the
 * intro, because those are the creator's content and a theme picker that ate
 * them would be unusable: the whole value of the feature is that it is safe to
 * click through all of them to see what fits.
 *
 * This is stacked's answer to Linktree's Themes tab, and it is the difference
 * between "here are forty controls" and "here is a good-looking page in one
 * click, now tune it".
 */

/** The exact slice of a page a theme owns. Everything else is content. */
export type ThemeStyle = Pick<
  PageData,
  | "background"
  | "panel"
  | "nameBox"
  | "bioBox"
  | "linkBox"
  | "linkStyle"
  | "nameStyle"
  | "bioStyle"
  | "avatarOutline"
>;

export interface PageTheme {
  key: string;
  label: string;
  /** A word or two on the register — shown under the swatch. */
  hint: string;
  style: ThemeStyle;
}

/**
 * The per-link overrides a theme has to clear to actually take effect.
 *
 * A link that carries its own `box` / `textStyle` (or a legacy `color`) ignores
 * the page default entirely — see `resolveLinkBox` — so a theme applied over a
 * page with three hand-styled links would visibly change only the other four.
 * That reads as the theme being broken. Applying a theme therefore resets links
 * to following the page default, which is what "apply this look" means.
 */
export function clearLinkOverrides(
  links: PageData["links"],
): PageData["links"] {
  return links.map((l) =>
    l.box || l.color || l.textStyle
      ? { ...l, box: undefined, color: undefined, textStyle: undefined }
      : l,
  );
}

/**
 * Apply a theme to a draft.
 *
 * `bgMemory` is updated alongside the background so the Background section's
 * "switch type and come back" memory reflects the theme you just chose rather
 * than the colours from before it — otherwise picking Amethyst, nudging to
 * Color and back would drop you on the previous theme's gradient.
 */
export function applyTheme(prev: PageData, theme: PageTheme): PageData {
  const bg = theme.style.background;
  const next: PageData = {
    ...prev,
    ...theme.style,
    links: clearLinkOverrides(prev.links),
  };
  if (bg?.type === "gradient") {
    next.bgMemory = {
      ...prev.bgMemory,
      gradient: {
        from: bg.from,
        to: bg.to,
        direction: bg.direction,
        distribution: bg.distribution,
      },
    };
  } else if (bg?.type === "custom") {
    next.bgMemory = { ...prev.bgMemory, custom: bg.color };
  } else if (bg?.type === "grid") {
    next.bgMemory = {
      ...prev.bgMemory,
      grid: {
        baseColor: bg.baseColor,
        lineColor: bg.lineColor,
        size: bg.size,
        thickness: bg.thickness,
      },
    };
  } else if (bg?.type === "aurora") {
    next.bgMemory = {
      ...prev.bgMemory,
      aurora: { color: bg.color, baseColor: bg.baseColor, speed: bg.speed },
    };
  } else if (bg?.type === "ripple") {
    next.bgMemory = {
      ...prev.bgMemory,
      ripple: {
        baseColor: bg.baseColor,
        glowColor: bg.glowColor,
        scale: bg.scale,
        speed: bg.speed,
      },
    };
  }
  return next;
}

/**
 * Deep value equality, order-independent for object keys.
 *
 * Not `JSON.stringify(a) === JSON.stringify(b)`, which is the obvious way to
 * write this and is wrong here: a page's styles round-trip through a Postgres
 * `jsonb` column, and jsonb does not preserve key order — it stores keys sorted
 * by length then bytewise. So a theme applied, saved, and reloaded comes back
 * with the same values in a different order, and a stringify comparison would
 * report it as no longer applied the moment the page was reopened.
 */
function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  // `undefined` and an absent key mean the same thing throughout PageData.
  if (a == null || b == null) return a == null && b == null;
  if (typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => sameValue(v, b[i]));
  }
  const ao = a as Record<string, unknown>;
  const bo = b as Record<string, unknown>;
  // Union of keys, so a key present-but-undefined on one side still matches an
  // absent key on the other (which `sameValue`'s null check handles).
  const keys = new Set([...Object.keys(ao), ...Object.keys(bo)]);
  for (const k of keys) if (!sameValue(ao[k], bo[k])) return false;
  return true;
}

/**
 * True when the draft's styling already matches this theme exactly — i.e. it
 * was applied and nothing has been tuned since. Compared by value rather than
 * by storing a `theme` key on the page: the key would go stale the instant a
 * creator nudged one colour, and would then be lying about what they are
 * looking at. Deriving it means the highlight is always the truth.
 */
export function isThemeActive(data: PageData, theme: PageTheme): boolean {
  const keys = Object.keys(theme.style) as (keyof ThemeStyle)[];
  return keys.every((k) => sameValue(data[k], theme.style[k]));
}

/** A translucent white name/bio card — the shared "frosted text plate" look. */
function plate(opacity: number) {
  return {
    color: "#ffffff",
    opacity,
    outline: false,
    outlineColor: "#ffffff",
    radius: 12,
    shadow: "none",
  } as const;
}

/** A name/bio card that isn't there at all — text straight on the page. */
const NO_PLATE = {
  color: "#ffffff",
  opacity: 0,
  outline: false,
  outlineColor: "#ffffff",
  enabled: false,
  radius: 12,
  shadow: "none",
} as const;

/**
 * Every theme has a DARK page background, and that is a hard constraint rather
 * than a taste: `ProfileView` renders with `isDark = true` hardcoded, so
 * `adaptColor` measures every text colour against near-black and inverts
 * anything that would be invisible there. On a light page that logic runs
 * backwards — a theme specifying near-black body text gets it flipped to
 * near-white and lands invisible on its own light background.
 *
 * A light theme therefore needs `isDark` to be derived from the actual
 * background first (which would also fix any creator who has set a light custom
 * colour by hand). Until then: dark backgrounds only. This is also the
 * on-brief answer — the product's register is minimal/gaming/Discord, not
 * editorial.
 */
export const THEMES: PageTheme[] = [
  {
    key: "midnight",
    label: "Midnight",
    hint: "Clean dark",
    style: {
      background: { type: "custom", color: "#0a0a0c" },
      panel: { type: "transparent" },
      nameBox: plate(8),
      bioBox: plate(8),
      linkBox: {
        color: "#000000",
        opacity: 100,
        outline: true,
        outlineColor: "#2a2a2a",
        radius: 10,
        shadow: "none",
      },
      linkStyle: { fontFamily: "inter", fontSize: 14, align: "center" },
      nameStyle: {
        fontFamily: "inter",
        fontSize: 24,
        bold: true,
        align: "center",
      },
      bioStyle: { fontFamily: "inter", fontSize: 14, align: "center" },
      avatarOutline: { enabled: false, color: "#ffffff" },
    },
  },
  {
    key: "amethyst",
    label: "Amethyst",
    hint: "Brand purple",
    style: {
      background: {
        type: "gradient",
        from: "#2a1152",
        to: "#08060f",
        direction: "vertical",
        distribution: 55,
      },
      panel: { type: "glass", color: "#ffffff", opacity: 8 },
      nameBox: NO_PLATE,
      bioBox: NO_PLATE,
      linkBox: {
        color: "#a78bfa",
        opacity: 100,
        outline: false,
        outlineColor: "#a78bfa",
        radius: 28,
        shadow: "soft",
      },
      // An explicit dark label rather than leaving it to `contrastText`, whose
      // white/black crossover sits at 0.4 luminance — #a78bfa lands at 0.34, so
      // the automatic answer is white text at 2.7:1 on the brand's own purple.
      // Near-black on it reads at 7.8:1.
      linkStyle: {
        fontFamily: "inter",
        fontSize: 14,
        bold: true,
        align: "center",
        color: "#1c0f33",
      },
      nameStyle: {
        fontFamily: "inter",
        fontSize: 26,
        bold: true,
        align: "center",
      },
      bioStyle: { fontFamily: "inter", fontSize: 14, align: "center" },
      avatarOutline: { enabled: true, color: "#a78bfa" },
    },
  },
  {
    key: "neon",
    label: "Neon",
    hint: "Outlined + glow",
    style: {
      background: { type: "custom", color: "#050507" },
      panel: { type: "transparent" },
      nameBox: NO_PLATE,
      bioBox: NO_PLATE,
      linkBox: {
        color: "#c084fc",
        opacity: 0,
        outline: true,
        outlineColor: "#c084fc",
        enabled: false,
        radius: 6,
        shadow: "glow",
      },
      linkStyle: {
        fontFamily: "mono",
        fontSize: 13,
        bold: true,
        align: "center",
        color: "#e9d5ff",
      },
      nameStyle: {
        fontFamily: "mono",
        fontSize: 24,
        bold: true,
        align: "center",
        color: "#ffffff",
      },
      bioStyle: {
        fontFamily: "mono",
        fontSize: 13,
        align: "center",
        color: "#c4b5fd",
      },
      avatarOutline: { enabled: true, color: "#c084fc" },
    },
  },
  {
    key: "blurple",
    label: "Blurple",
    hint: "Discord",
    style: {
      background: { type: "custom", color: "#1e1f22" },
      panel: { type: "color", color: "#2b2d31", opacity: 100 },
      nameBox: NO_PLATE,
      bioBox: NO_PLATE,
      linkBox: {
        color: "#5865f2",
        opacity: 100,
        outline: false,
        outlineColor: "#5865f2",
        radius: 8,
        shadow: "none",
      },
      linkStyle: {
        fontFamily: "inter",
        fontSize: 14,
        bold: true,
        align: "center",
      },
      nameStyle: {
        fontFamily: "inter",
        fontSize: 24,
        bold: true,
        align: "center",
      },
      bioStyle: { fontFamily: "inter", fontSize: 14, align: "center" },
      avatarOutline: { enabled: true, color: "#5865f2" },
    },
  },
  {
    key: "terminal",
    label: "Terminal",
    hint: "Mono + hard edges",
    style: {
      background: {
        type: "grid",
        baseColor: "#07090a",
        lineColor: "#16241c",
        size: 28,
        thickness: 1,
      },
      panel: { type: "transparent" },
      nameBox: NO_PLATE,
      bioBox: NO_PLATE,
      linkBox: {
        color: "#0d1512",
        opacity: 100,
        outline: true,
        outlineColor: "#34d399",
        radius: 0,
        shadow: "hard",
      },
      linkStyle: {
        fontFamily: "mono",
        fontSize: 13,
        align: "center",
        color: "#6ee7b7",
      },
      nameStyle: {
        fontFamily: "mono",
        fontSize: 24,
        bold: true,
        align: "center",
        color: "#6ee7b7",
      },
      bioStyle: {
        fontFamily: "mono",
        fontSize: 13,
        align: "center",
        color: "#4ade80",
      },
      avatarOutline: { enabled: true, color: "#34d399" },
    },
  },
  {
    key: "aurora",
    label: "Aurora",
    hint: "Soft drifting light",
    style: {
      background: {
        type: "aurora",
        color: "#c4b5fd",
        baseColor: "#04040a",
        speed: 4,
      },
      panel: { type: "glass", color: "none", opacity: 0 },
      nameBox: NO_PLATE,
      bioBox: NO_PLATE,
      linkBox: {
        color: "#ffffff",
        opacity: 10,
        outline: true,
        outlineColor: "#ffffff33",
        radius: 28,
        shadow: "none",
      },
      linkStyle: {
        fontFamily: "spaceGrotesk",
        fontSize: 14,
        align: "center",
        color: "#ffffff",
      },
      nameStyle: {
        fontFamily: "spaceGrotesk",
        fontSize: 26,
        bold: true,
        align: "center",
      },
      bioStyle: { fontFamily: "spaceGrotesk", fontSize: 14, align: "center" },
      avatarOutline: { enabled: true, color: "#ffffff" },
    },
  },
  {
    key: "sunset",
    label: "Sunset",
    hint: "Warm gradient",
    style: {
      background: {
        type: "gradient",
        from: "#f97316",
        to: "#4c1d95",
        direction: "diagonal",
        distribution: 40,
      },
      panel: { type: "glass", color: "#ffffff", opacity: 10 },
      nameBox: NO_PLATE,
      bioBox: NO_PLATE,
      linkBox: {
        color: "#1c1120",
        opacity: 92,
        outline: false,
        outlineColor: "#ffffff",
        radius: 16,
        shadow: "soft",
      },
      linkStyle: {
        fontFamily: "poppins",
        fontSize: 14,
        bold: true,
        align: "center",
      },
      nameStyle: {
        fontFamily: "poppins",
        fontSize: 26,
        bold: true,
        align: "center",
      },
      bioStyle: { fontFamily: "poppins", fontSize: 14, align: "center" },
      avatarOutline: { enabled: true, color: "#ffffff" },
    },
  },
  {
    key: "void",
    label: "Void",
    hint: "Inverted, high contrast",
    style: {
      background: { type: "custom", color: "#000000" },
      panel: { type: "transparent" },
      nameBox: NO_PLATE,
      bioBox: NO_PLATE,
      // The inverse of every other theme: the buttons are the light thing on
      // the page. `contrastText` picks black labels for a white fill on its
      // own, so this needs no explicit link colour.
      linkBox: {
        color: "#ffffff",
        opacity: 100,
        outline: false,
        outlineColor: "#ffffff",
        radius: 28,
        shadow: "none",
      },
      linkStyle: {
        fontFamily: "spaceGrotesk",
        fontSize: 14,
        bold: true,
        align: "center",
      },
      nameStyle: {
        fontFamily: "spaceGrotesk",
        fontSize: 30,
        bold: true,
        align: "center",
      },
      bioStyle: { fontFamily: "spaceGrotesk", fontSize: 14, align: "center" },
      avatarOutline: { enabled: true, color: "#ffffff" },
    },
  },
];
