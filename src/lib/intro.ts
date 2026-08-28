/**
 * Data model for the page "click to enter" splash: a full-screen overlay that
 * greets a visitor and reveals the page (and starts any music) on their first
 * click — the guns.lol-style intro. Kept framework-agnostic (no React) so it can
 * be shared by the editor, the visitor overlay, and the server loaders.
 *
 * Where it lives: an optional `intro` field on {@link import("~/lib/pages").PageData},
 * serialized into the `styles` JSONB column — no DB migration needed.
 */

import type { TextStyle } from "~/lib/pages";

/** Backdrop behind the splash content. */
export type IntroBackdrop =
  /** Blur + dim the page peeking through — a frosted teaser of what's behind. */
  | "blur"
  /** A solid dim veil; the page underneath isn't visible until you enter. */
  | "solid";

export interface IntroConfig {
  /** Master on/off. When false, no splash — the page shows immediately. */
  enabled: boolean;
  /** The call-to-action, centered and gently pulsing. e.g. "click to enter". */
  text: string;
  /** Optional smaller line under the CTA (a greeting, a warning, the name…). */
  subtext?: string;
  /** How the page behind the splash is treated. */
  backdrop: IntroBackdrop;
  /** @deprecated Legacy CTA color — superseded by `textStyle.color`; still read
   *  as a fallback so existing pages keep their color. */
  color?: string;
  /** Full text styling for the CTA — the SAME controls (font/size/style/align/
   *  color) as the name & bio, so the intro text is edited identically. */
  textStyle?: TextStyle;
  /** Full text styling for the subtitle — the SAME controls as the CTA, so the
   *  line under the button is edited identically. Unset leaves the muted default. */
  subtextStyle?: TextStyle;
}

/** A sensible default splash for a fresh page. */
export const DEFAULT_INTRO_CONFIG: IntroConfig = {
  enabled: true,
  text: "click to enter",
  backdrop: "blur",
};

/** Default CTA text styling — mirrors DEFAULT_NAME_STYLE so the splash text
 *  reads as a heading out of the box; merged under any saved `textStyle`. */
export const DEFAULT_INTRO_TEXT_STYLE: TextStyle = {
  fontSize: 30,
  bold: true,
  align: "center",
};

/** Default subtitle styling — a small, centered line, left uncolored so it keeps
 *  the muted default look until the owner picks a color. Merged under any saved
 *  `subtextStyle`. */
export const DEFAULT_INTRO_SUBTEXT_STYLE: TextStyle = {
  fontSize: 14,
  align: "center",
};
