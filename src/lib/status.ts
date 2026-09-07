/**
 * Data model for the page "status" — a Discord-style line under the creator's
 * name: a colored presence dot and a short "👋 back in an hour" message.
 *
 * Kept framework-agnostic (no React) so the editor, the public page renderer
 * and the server loaders can all share it — same shape as {@link
 * import("~/lib/intro").IntroConfig} and {@link import("~/lib/music").MusicConfig}.
 *
 * Where it lives: an optional `status` field on {@link import("~/lib/pages").PageData},
 * serialized into the `styles` JSONB column — no DB migration needed.
 */

import type { BoxStyle, TextStyle } from "~/lib/pages";

/**
 * The four presence states Discord exposes. "invisible" is deliberately absent:
 * it is a *privacy* setting on Discord (you appear offline to others), and the
 * only thing it could mean on a public page is what "offline" already means.
 */
export type PresenceState = "online" | "idle" | "dnd" | "offline";

export interface StatusConfig {
  /** Master on/off. When false the pill isn't rendered at all. */
  enabled: boolean;
  /**
   * The dot. Undefined = no dot at all, for a creator who wants the message
   * ("back in an hour") without claiming to be at their desk. This is one
   * field rather than a state plus a `showDot` boolean because two knobs for
   * one mark is two ways to describe the same pixel.
   */
  presence?: PresenceState;
  /**
   * Emoji shown before the message, kept out of {@link text} rather than typed
   * into it so the message's own typography can't reach it: a `gradient` or
   * `shine` effect paints glyphs by clipping a background to them, which turns
   * an emoji into a colored blob.
   */
  emoji?: string;
  /** The message itself — Discord's "custom status". */
  text?: string;
  /**
   * When the status stops showing, as an ISO-8601 instant.
   *
   * Stored as an absolute instant, not a duration, precisely because it is
   * *chosen* in the creator's timezone and *evaluated* in each visitor's: "for
   * the rest of today" has to mean the same moment in Sydney as it does in the
   * creator's kitchen. Absent = never clears.
   */
  expiresAt?: string;
  /** The pill surface (fill, opacity, outline, radius, shadow). */
  box?: BoxStyle;
  /** Typography for the message. */
  textStyle?: TextStyle;
}

/** The dot colors, lifted from Discord's own presence palette. */
export const PRESENCE_COLORS: Record<PresenceState, string> = {
  online: "#23a55a",
  idle: "#f0b232",
  dnd: "#f23f43",
  offline: "#80848e",
};

/** Human labels for the presence picker, in Discord's own order. */
export const PRESENCE_LABELS: Record<PresenceState, string> = {
  online: "Online",
  idle: "Idle",
  dnd: "Do not disturb",
  offline: "Offline",
};

/** A fresh status: online, no message yet. */
export const DEFAULT_STATUS_CONFIG: StatusConfig = {
  enabled: true,
  presence: "online",
  text: "",
};

/** Default look of the status pill — the same frosted surface as the name card. */
export const DEFAULT_STATUS_BOX: BoxStyle = {
  color: "#ffffff",
  opacity: 8,
  outline: false,
  outlineColor: "#ffffff",
  radius: 999,
};

/**
 * What an unset radius renders as for the pill. Unlike the name card (8px) a
 * status is one line tall and reads as a chip, so it defaults fully rounded.
 * Passed to `BoxControls` so the slider tells the truth about what's on screen.
 */
export const DEFAULT_STATUS_RADIUS = 999;

/** Default typography for the message — small and centered, like the bio. */
export const DEFAULT_STATUS_TEXT_STYLE: TextStyle = {
  fontSize: 14,
  align: "center",
};

// ---------------------------------------------------------------------------
// Expiry ("clear after")
// ---------------------------------------------------------------------------

/** The "clear after" choices, mirroring Discord's own menu. */
export type ClearAfter = "never" | "30m" | "1h" | "4h" | "today";

/**
 * The picker's options, in menu order. Labels are abbreviated because all five
 * sit in one five-column strip in a ~360px panel: spelled out, "30 minutes"
 * wrapped to two lines and dragged the other four chips up with it. The panel
 * prints the unabbreviated answer underneath anyway (see
 * {@link statusExpiryLabel}).
 */
export const CLEAR_AFTER_OPTIONS: { value: ClearAfter; label: string }[] = [
  { value: "never", label: "Never" },
  { value: "30m", label: "30m" },
  { value: "1h", label: "1h" },
  { value: "4h", label: "4h" },
  { value: "today", label: "Today" },
];

/**
 * Turn a "clear after" choice into the absolute instant it means, resolved
 * against `now` in the *caller's* timezone — which is the creator's browser at
 * the moment they pick it. "Today" is the end of their local day, so a status
 * set at 11pm clears in an hour, not in twenty-five.
 */
export function clearAfterToIso(
  choice: ClearAfter,
  now: number = Date.now(),
): string | undefined {
  if (choice === "never") return undefined;
  if (choice === "today") {
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return end.toISOString();
  }
  const minutes = choice === "30m" ? 30 : choice === "1h" ? 60 : 240;
  return new Date(now + minutes * 60_000).toISOString();
}

/**
 * True while the status hasn't timed out. Internal: callers want
 * {@link shouldRenderStatus}, which also checks there is something to draw.
 *
 * An unparseable `expiresAt` counts as live on purpose: the failure mode of
 * being wrong here is a creator's page silently losing a line it looks like it
 * still has, which is worse than a status that outstays its welcome.
 */
function isStatusLive(
  status: StatusConfig | undefined,
  now: number = Date.now(),
): boolean {
  if (!status?.enabled) return false;
  if (!status.expiresAt) return true;
  const at = Date.parse(status.expiresAt);
  if (Number.isNaN(at)) return true;
  return now < at;
}

/**
 * Whether there is anything to draw. A dot on its own counts — "I'm around" is
 * a real message — but an enabled status with no dot and no words would render
 * as an empty pill, so it renders as nothing instead.
 */
export function statusHasContent(status: StatusConfig | undefined): boolean {
  if (!status) return false;
  return Boolean(
    status.presence || status.emoji?.trim() || status.text?.trim(),
  );
}

/** True when the status is enabled and has something to say right now. */
export function shouldRenderStatus(
  status: StatusConfig | undefined,
  now: number = Date.now(),
): boolean {
  return isStatusLive(status, now) && statusHasContent(status);
}

/**
 * A short human read-out of the expiry for the editor: "Clears in 42 minutes",
 * "Expired", or "" when nothing is set. Coarse by design — a live countdown in
 * a settings panel is motion for its own sake. It never needs a "days" case:
 * the longest choice is the end of the current day.
 */
export function statusExpiryLabel(
  status: StatusConfig | undefined,
  now: number = Date.now(),
): string {
  if (!status?.expiresAt) return "";
  const at = Date.parse(status.expiresAt);
  if (Number.isNaN(at)) return "";
  const ms = at - now;
  if (ms <= 0) return "Expired — visitors don't see it";
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return "Clears in under a minute";
  if (minutes < 60)
    return `Clears in ${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.round(minutes / 60);
  return `Clears in ${hours} hour${hours === 1 ? "" : "s"}`;
}
