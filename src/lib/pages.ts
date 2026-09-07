import type { SupabaseClient } from "@supabase/supabase-js";
import type { IntroConfig } from "~/lib/intro";
import type { MusicConfig } from "~/lib/music";
import type { StatusConfig } from "~/lib/status";
import { createClient } from "~/lib/supabase/client";

/**
 * What a row in `links` actually is. Undefined = "link", which is every row
 * saved before headers existed.
 *
 * - `link` — a button (or logo, in the Logos layout) that goes somewhere.
 * - `icon` — the same destination drawn as its bare logo. Consecutive icon rows
 *   render as ONE centered strip, in list order, so a creator can put a row of
 *   socials above their buttons, below them, or between two groups — without
 *   the all-or-nothing switch the Logos layout makes them take.
 * - `header` — a label that groups the links under it. No href, not clickable,
 *   and skipped entirely by the Logos layout, which is a row of icons.
 */
export type LinkKind = "link" | "icon" | "header";

/**
 * An attention animation played on a link button, for the one link a creator
 * wants read first ("Commissions open"). Undefined / "none" = still.
 */
export type LinkHighlight = "none" | "pulse" | "bounce" | "shake" | "glow";

export interface LinkItem {
  id: string;
  label: string;
  href: string;
  /** Row type. Undefined = "link" (every row saved before headers existed). */
  kind?: LinkKind;
  /** Attention animation on the button. Undefined = none. */
  highlight?: LinkHighlight;
  /** Optional custom logo (data URL) for links without a built-in platform icon. */
  logo?: string;
  /** Deprecated fill color (hex). Superseded by `box`; still read for old pages. */
  color?: string;
  /** Per-link box appearance (color, opacity, outline, on/off). */
  box?: BoxStyle;
  /** Per-link text styling (font, size, bold/italic/underline, align, color). */
  textStyle?: TextStyle;
  /**
   * Optional publish window. On public pages the link is hidden before `start`
   * and after `end` (see {@link isLinkLive}); the owner always sees it in their
   * editor. Absent = always visible.
   */
  schedule?: LinkSchedule;
}

/** A link's optional publish window, as ISO-8601 timestamps. */
export interface LinkSchedule {
  /** Show the link only from this instant onward (omit = no start bound). */
  start?: string;
  /** Hide the link once this instant passes (omit = no end bound). */
  end?: string;
}

/** Whether a scheduled link is currently live, waiting to start, or expired. */
export type LinkScheduleStatus = "live" | "scheduled" | "ended";

/**
 * Where a link sits relative to its schedule at time `now` (ms since epoch). A
 * link with no schedule — or with unparseable bounds — is always "live", so a
 * malformed value can never make a link vanish.
 */
export function linkScheduleStatus(
  link: LinkItem,
  now: number = Date.now(),
): LinkScheduleStatus {
  const schedule = link.schedule;
  // Headers carry no schedule UI, but a row converted from a scheduled link
  // would still hold one — and a header that silently disappeared would take
  // its whole group's meaning with it.
  if (link.kind === "header") return "live";
  if (!schedule) return "live";
  const start = schedule.start ? Date.parse(schedule.start) : Number.NaN;
  const end = schedule.end ? Date.parse(schedule.end) : Number.NaN;
  if (!Number.isNaN(start) && now < start) return "scheduled";
  if (!Number.isNaN(end) && now >= end) return "ended";
  return "live";
}

/** True when a link should be shown to public visitors right now. */
export function isLinkLive(link: LinkItem, now: number = Date.now()): boolean {
  return linkScheduleStatus(link, now) === "live";
}

/** An ISO-8601 string → the `datetime-local` value for that local wall-clock. */
export function isoToLocalInput(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

/** A `datetime-local` value (local wall-clock) → an ISO-8601 UTC string. */
export function localInputToIso(value: string): string | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

/** Compact, human date+time for schedule status lines (e.g. "Aug 3, 2:30 PM"). */
export function formatScheduleDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Google-Docs-style text formatting applied to a single text field. */
export interface TextStyle {
  /** Key into the FONTS map in the page component; undefined = inherit default. */
  fontFamily?: string;
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  align?: "left" | "center" | "right";
  color?: string;
  /**
   * Animated text effect applied to the whole field. `gradient` and `rainbow`
   * cycle a colorful gradient through the glyphs; `shine` sweeps a highlight
   * across them. Undefined / "none" = plain text.
   */
  animation?: "none" | "gradient" | "rainbow" | "shine";
}

/** Uploaded image/video background with non-destructive framing. */
export interface MediaBackground {
  kind: "image" | "video";
  /** Data URL of the uploaded file. */
  src: string;
  /** Focal point, as object-position percentages (0–100). */
  posX: number;
  posY: number;
  /** Extra zoom applied on top of the cover fit (1 = fit). */
  zoom: number;
  /**
   * Darkening overlay, 0–100 (0 = none, 100 = black). Lets a busy photo/video
   * sit behind the profile without drowning the text. Optional — pages saved
   * before this existed read as 0.
   */
  dim?: number;
  /**
   * Gaussian blur applied to the media, in px (0 = sharp). Optional — pages
   * saved before this existed read as 0.
   */
  blur?: number;
}

/** Page background. `default` follows the light/dark theme. */
export type Background =
  | { type: "default" }
  | { type: "custom"; color: string }
  | {
      type: "gradient";
      from: string;
      to: string;
      /**
       * "vertical" = top→bottom, "horizontal" = left→right, "diagonal" =
       * top-left→bottom-right. Default vertical.
       */
      direction?: "vertical" | "horizontal" | "diagonal";
      /** Blend midpoint 0–100 (where the two colors meet). Default 50. */
      distribution?: number;
    }
  | {
      /** A tiled square grid of lines drawn over a solid base color. */
      type: "grid";
      /** Solid fill behind the grid (hex). */
      baseColor: string;
      /** Grid line color (hex). */
      lineColor: string;
      /** Cell size — spacing between lines, in px. */
      size: number;
      /** Line thickness, in px. */
      thickness: number;
    }
  | {
      /**
       * A soft luminous glow blooming from the top-center and fading to a solid
       * base color at the edges and bottom — like a large, diffuse overhead
       * light. Meant to be animated (the glow drifts / undulates); `speed`
       * controls that motion, 0 = static.
       */
      type: "aurora";
      /** Glow color (hex). */
      color: string;
      /** Solid base color the glow fades into (hex). */
      baseColor: string;
      /** Drift speed, 0 (static) – 10 (fast). */
      speed: number;
    }
  | {
      /**
       * A slow field of glowing contour loops that drift and re-form — the
       * pattern light makes over a rippled surface. Animated; `speed` 0 holds
       * the tuned still.
       */
      type: "ripple";
      /** Background color the lines sit on (hex). */
      baseColor: string;
      /** Line color (hex). */
      glowColor: string;
      /** Pattern size — larger is a finer, busier field. */
      scale: number;
      /** Drift speed, 0 (static) – 10 (fast). */
      speed: number;
    }
  | ({ type: "media" } & MediaBackground);

/**
 * Remembered background colors for the types that aren't currently active, so
 * switching between Custom / Gradient (or leaving and returning to the page)
 * restores the last colors instead of resetting to defaults.
 */
export interface BackgroundMemory {
  custom?: string;
  gradient?: {
    from: string;
    to: string;
    direction?: "vertical" | "horizontal" | "diagonal";
    distribution?: number;
  };
  grid?: {
    baseColor: string;
    lineColor: string;
    size: number;
    thickness: number;
  };
  aurora?: { color: string; baseColor: string; speed: number };
  ripple?: {
    baseColor: string;
    glowColor: string;
    scale: number;
    speed: number;
  };
  media?: MediaBackground;
}

/**
 * Appearance of a "box" surface (the card behind the name/bio, or the link
 * buttons): a background color at a chosen opacity, with an optional outline.
 */
export interface BoxStyle {
  /** Background color (hex). */
  color: string;
  /** Background opacity 0–100 (0 = fully transparent, 100 = solid). */
  opacity: number;
  /** Whether to draw an outline. */
  outline: boolean;
  /** Outline color (hex). */
  outlineColor: string;
  /**
   * Whether the box surface (fill + outline) is shown at all. Undefined counts
   * as `true` for pages saved before this existed. When `false`, the box is
   * fully transparent — no fill and no outline — leaving just its content.
   */
  enabled?: boolean;
  /**
   * Corner radius in px, 0 (square) – 32 (pill, for a button-height surface).
   * Undefined = 8px, the `rounded-lg` every page rendered before this existed.
   */
  radius?: number;
  /**
   * Drop shadow under the surface. Undefined / "none" = flat, which is what
   * every page saved before this existed renders as.
   *
   * - `soft` — a diffuse lift, the default "this is a card" shadow.
   * - `hard` — an offset solid block with no blur (the sticker/brutalist look
   *   Linktree calls "hard shadow").
   * - `glow` — a colored bloom picked up from the surface's own fill, for the
   *   neon look that reads as gaming/Discord.
   */
  shadow?: BoxShadow;
}

/** See {@link BoxStyle.shadow}. */
export type BoxShadow = "none" | "soft" | "hard" | "glow";

/**
 * The radius a box renders at when {@link BoxStyle.radius} is unset.
 *
 * Two values, not one, because the two surfaces were built with two different
 * Tailwind classes and `boxCss` now writes `border-radius` inline — which beats
 * the class. A single default would have silently restyled every page already
 * out there: the name/bio card wore `rounded-lg` (8px) and the link buttons
 * wore `rounded-md` (6px), so 8 everywhere would have rounded every live page's
 * buttons by two pixels for no reason anybody asked for.
 */
export const DEFAULT_BOX_RADIUS = 8;
/** See {@link DEFAULT_BOX_RADIUS} — link buttons were `rounded-md`. */
export const DEFAULT_LINK_RADIUS = 6;

/**
 * Background panel sitting behind the whole profile block (avatar, the name/bio
 * card, and the links). `transparent` is the default — no panel, so the page
 * background shows straight through, matching pages saved before this existed.
 */
export type PanelStyle =
  | { type: "transparent" }
  | { type: "color"; color: string; opacity: number }
  | {
      type: "gradient";
      from: string;
      to: string;
      /** "vertical" = top→bottom, "horizontal" = left→right. Default vertical. */
      direction?: "vertical" | "horizontal";
      opacity: number;
    }
  /** Frosted glass: a translucent tint plus a backdrop blur. */
  | { type: "glass"; color: string; opacity: number };

/** Optional ring drawn around the profile picture. */
export interface AvatarOutline {
  enabled: boolean;
  /** Outline color (hex). */
  color: string;
}

/**
 * Non-destructive framing of the profile picture — which part of the source
 * shows inside the circular avatar. The image is `object-fit: cover` fitted to
 * the avatar box, then transformed by `translate(x%, y%) scale(zoom)`:
 *
 * - `x` / `y` pan the image, as a percentage of the avatar size (0 = centered).
 *   Positive x moves the image right, positive y moves it down.
 * - `zoom` scales on top of the cover fit (1 = fit, no zoom).
 *
 * Percentages (not pixels) so the same crop renders identically at any avatar
 * size — the tiny 96px page avatar and a larger editor preview stay in sync.
 */
export interface AvatarCrop {
  x: number;
  y: number;
  zoom: number;
}

/** A centered, un-zoomed avatar — the framing every existing page reads as. */
export const DEFAULT_AVATAR_CROP: AvatarCrop = { x: 0, y: 0, zoom: 1 };

/**
 * An animated decoration on the profile picture. `none` is the default (no
 * animation). `particles` emits little dots outward from the avatar; `shine`
 * sweeps a glossy highlight across it.
 */
export type AvatarEffect =
  | { type: "none" }
  | {
      type: "particles";
      /** Particle color (hex). */
      color: string;
      /** Emission speed, 1 (slow) – 10 (fast). */
      speed: number;
      /** Particle size, 1 (small) – 10 (large). */
      size: number;
      /** How many particles, 1 (few) – 10 (many). */
      amount: number;
    }
  | {
      type: "shine";
      /** Sweep speed, 1 (slow) – 10 (fast). */
      speed: number;
    };

/**
 * Parts of the profile the owner has switched OFF.
 *
 * Separate from "empty": a hidden field keeps its text and all of its styling,
 * it just stops rendering. That is the difference between "I have not written a
 * bio yet" and "I want a page with no bio on it" — the second is a layout
 * choice, and losing the copy to make it is not a fair price.
 *
 * A missing key means shown, so every page written before this renders exactly
 * as it did. One object rather than three top-level booleans: it is one idea,
 * one key in the jsonb, and it has somewhere to grow if links or the status
 * ever want the same switch.
 */
export interface HiddenParts {
  avatar?: boolean;
  name?: boolean;
  bio?: boolean;
}

export interface PageData {
  name: string;
  bio: string;
  links: LinkItem[];
  /** Profile picture as a data URL. */
  avatar?: string;
  /** Ring around the profile picture. */
  avatarOutline?: AvatarOutline;
  /** Non-destructive framing (pan/zoom) of the profile picture. */
  avatarCrop?: AvatarCrop;
  /** Animated decoration on the profile picture. */
  avatarEffect?: AvatarEffect;
  nameStyle?: TextStyle;
  bioStyle?: TextStyle;
  background?: Background;
  bgMemory?: BackgroundMemory;
  /** Which of avatar / name / bio are switched off. Absent = all shown. */
  hidden?: HiddenParts;
  /** Box behind the name. */
  nameBox?: BoxStyle;
  /** Box behind the bio/description. */
  bioBox?: BoxStyle;
  /** Default box for the link buttons (per-link `box` overrides it). */
  linkBox?: BoxStyle;
  /** Default text style for the link buttons (per-link `textStyle` overrides it). */
  linkStyle?: TextStyle;
  /** Panel behind the whole profile block. */
  panel?: PanelStyle;
  /**
   * Profile layout. "vertical" (default) stacks avatar → name → bio → links in
   * a single column. "horizontal" lays the card out as a landscape rectangle:
   * avatar + name/bio on the left, links on the right.
   */
  panelOrientation?: "vertical" | "horizontal";
  /** Optional music player (a song that plays on the page). Absent = no music. */
  music?: MusicConfig;
  /**
   * Optional "click to enter" splash shown before the page. Absent = the page
   * shows immediately. When present with music set to autoplay, the enter-click
   * also starts the track.
   */
  intro?: IntroConfig;
  /**
   * Optional Discord-style status line under the name (presence dot, custom
   * message, activity). Absent = no status pill.
   */
  status?: StatusConfig;
}

/** Shape of the `styles` jsonb column. */
interface StoredStyles {
  name?: TextStyle;
  bio?: TextStyle;
  background?: Background;
  bgMemory?: BackgroundMemory;
  hidden?: HiddenParts;
  nameBox?: BoxStyle;
  bioBox?: BoxStyle;
  linkBox?: BoxStyle;
  linkStyle?: TextStyle;
  panel?: PanelStyle;
  panelOrientation?: "vertical" | "horizontal";
  avatarOutline?: AvatarOutline;
  avatarCrop?: AvatarCrop;
  avatarEffect?: AvatarEffect;
  music?: MusicConfig;
  intro?: IntroConfig;
  status?: StatusConfig;
}

/**
 * Load the current user's page using the given Supabase client. Works with both
 * the browser client (client components) and the server client (SSR), so the
 * page renders with data already present — no post-mount fetch/flash. Returns
 * null when the visitor isn't signed in or hasn't created a page yet.
 */
export async function queryPage(
  // biome-ignore lint/suspicious/noExplicitAny: browser & server clients share this shape
  supabase: SupabaseClient<any>,
): Promise<PageData | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("pages")
    .select("name, bio, links, styles, avatar")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const styles = (data.styles ?? {}) as StoredStyles;

  return {
    name: data.name ?? "",
    bio: data.bio ?? "",
    links: (data.links ?? []) as LinkItem[],
    avatar: (data.avatar as string | null) ?? undefined,
    nameStyle: styles.name,
    bioStyle: styles.bio,
    background: styles.background,
    bgMemory: styles.bgMemory,
    hidden: styles.hidden,
    nameBox: styles.nameBox,
    bioBox: styles.bioBox,
    linkBox: styles.linkBox,
    linkStyle: styles.linkStyle,
    panel: styles.panel,
    panelOrientation: styles.panelOrientation,
    avatarOutline: styles.avatarOutline,
    avatarCrop: styles.avatarCrop,
    avatarEffect: styles.avatarEffect,
    music: styles.music,
    intro: styles.intro,
    status: styles.status,
  };
}

/** The Storage bucket holding uploaded avatars, background media, and logos. */
const ASSET_BUCKET = "page-assets";

/** Decode a base64 `data:` URL into bytes + its MIME type. */
function decodeDataUrl(dataUrl: string): { bytes: Uint8Array; mime: string } {
  const match = /^data:([^;]+);base64,([\s\S]*)$/.exec(dataUrl);
  if (!match) throw new Error("Unsupported data URL");
  const mime = match[1];
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return { bytes, mime };
}

/**
 * Upload a base64 `data:` URL to Storage under the user's folder and return its
 * public URL. Values that aren't data URLs (already-hosted URLs, or empty) are
 * returned unchanged, so re-saving an unchanged page re-uploads nothing.
 */
async function persistAsset(
  // biome-ignore lint/suspicious/noExplicitAny: browser & server clients share this shape
  supabase: SupabaseClient<any>,
  userId: string,
  value: string | undefined,
  cache: Map<string, string>,
): Promise<string | undefined> {
  if (!value || !value.startsWith("data:")) return value;
  const cached = cache.get(value);
  if (cached) return cached;

  try {
    const { bytes, mime } = decodeDataUrl(value);
    const ext = (mime.split("/")[1] ?? "bin").split("+")[0];
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from(ASSET_BUCKET)
      .upload(path, bytes, { contentType: mime, upsert: false });
    if (error) throw error;

    const { data } = supabase.storage.from(ASSET_BUCKET).getPublicUrl(path);
    cache.set(value, data.publicUrl);
    return data.publicUrl;
  } catch (err) {
    // Non-fatal: if the bucket isn't set up yet (or the upload is rejected),
    // keep the inline data URL so saving still succeeds. Once the
    // `page-assets` bucket exists, the next save migrates it automatically.
    console.error("Asset upload failed; keeping inline image:", err);
    return value;
  }
}

/**
 * Replace any inline base64 `data:` URLs in a page (avatar, media background,
 * remembered media, custom link logos) with uploaded Storage URLs. Identical
 * data URLs upload once. Returns a new page with the swapped values.
 */
async function uploadPageAssets(
  // biome-ignore lint/suspicious/noExplicitAny: browser & server clients share this shape
  supabase: SupabaseClient<any>,
  userId: string,
  page: PageData,
): Promise<PageData> {
  const cache = new Map<string, string>();
  const next: PageData = { ...page };

  next.avatar = await persistAsset(supabase, userId, page.avatar, cache);

  if (page.background?.type === "media") {
    const src = await persistAsset(
      supabase,
      userId,
      page.background.src,
      cache,
    );
    if (src) next.background = { ...page.background, src };
  }

  if (page.bgMemory?.media) {
    const src = await persistAsset(
      supabase,
      userId,
      page.bgMemory.media.src,
      cache,
    );
    if (src) {
      next.bgMemory = {
        ...page.bgMemory,
        media: { ...page.bgMemory.media, src },
      };
    }
  }

  // Custom link logos, uploaded sequentially so identical logos share one file.
  const links: LinkItem[] = [];
  for (const link of page.links) {
    const logo = await persistAsset(supabase, userId, link.logo, cache);
    links.push(logo === link.logo ? link : { ...link, logo });
  }
  next.links = links;

  // Music assets: an uploaded audio file and/or a custom album cover. Moving
  // them to Storage keeps large audio out of the page's JSON. Spotify covers are
  // already hosted URLs, so persistAsset returns them unchanged.
  if (page.music) {
    const music = { ...page.music };
    const albumArt = await persistAsset(
      supabase,
      userId,
      page.music.meta.albumArt,
      cache,
    );
    if (albumArt !== page.music.meta.albumArt) {
      music.meta = { ...page.music.meta, albumArt };
    }
    if (page.music.audio.kind === "file") {
      const src = await persistAsset(
        supabase,
        userId,
        page.music.audio.src,
        cache,
      );
      if (src && src !== page.music.audio.src) {
        music.audio = { ...page.music.audio, src };
      }
    }
    next.music = music;
  }

  return next;
}

/** Save the current user's page, creating the row on first save. */
export async function savePage(pageInput: PageData): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("You must be signed in to save your page.");
  }

  // Move any inline base64 images to Storage before persisting the row.
  const page = await uploadPageAssets(supabase, user.id, pageInput);

  const styles: StoredStyles = {
    name: page.nameStyle,
    bio: page.bioStyle,
    background: page.background,
    bgMemory: page.bgMemory,
    hidden: page.hidden,
    nameBox: page.nameBox,
    bioBox: page.bioBox,
    linkBox: page.linkBox,
    linkStyle: page.linkStyle,
    panel: page.panel,
    panelOrientation: page.panelOrientation,
    avatarOutline: page.avatarOutline,
    avatarCrop: page.avatarCrop,
    avatarEffect: page.avatarEffect,
    music: page.music,
    intro: page.intro,
    status: page.status,
  };

  const { error } = await supabase.from("pages").upsert(
    {
      user_id: user.id,
      // `slug` is still NOT NULL UNIQUE; use the user id until usernames land.
      slug: user.id,
      name: page.name,
      bio: page.bio,
      links: page.links,
      styles,
      avatar: page.avatar ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) throw error;
}

/**
 * The CSS gradient direction for a page background. Shared, because this
 * mapping is needed in four places (the live page, the Studio's swatch, the
 * share card, and the landing wall's stand-in) and a fifth direction added to
 * three of them is a background that renders differently depending on where you
 * look at it.
 */
export function gradientDirectionCss(
  direction: "vertical" | "horizontal" | "diagonal" | undefined,
): string {
  if (direction === "horizontal") return "to right";
  if (direction === "diagonal") return "to bottom right";
  return "to bottom";
}
