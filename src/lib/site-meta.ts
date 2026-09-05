/**
 * The site's own marketing copy, in one place.
 *
 * These strings are read by the root `metadata` (so they are what Google, and
 * every link unfurler, shows next to a stacked.page link), by the landing
 * page's title, and by the share card in `src/app/opengraph-image.tsx`. The
 * description used to be written out four separate times across those files,
 * which is how the old one went stale in all four.
 *
 * `SITE_TAGLINE` is the landing hero's slogan verbatim (`home-hero.tsx`) — the
 * card and the page have to say the same thing, or the unfurl promises
 * something the destination doesn't. `SITE_DESCRIPTION` is the longer,
 * search-facing line; keep it under ~160 characters, which is roughly where
 * Google truncates, and keep every feature it names shipped and user-facing.
 */

/**
 * Title for the landing page, and the og:/twitter: title everywhere.
 *
 * The hero's headline, not a feature summary. It is short enough that no
 * surface truncates it, and it stops a Discord unfurl from printing "stacked"
 * twice — the site name is already above the title there. The substance lives
 * in `SITE_DESCRIPTION`, which sits directly underneath it.
 *
 * Note this is NOT the root layout's `title`: that stays the bare wordmark,
 * because it is the default every route without its own inherits, and the
 * landing page's headline has no business in the tab of /dashboard or /edit.
 */
export const SITE_TITLE = "stacked — all of you, all here";

/** The hero slogan. Shown on the share card. */
export const SITE_TAGLINE =
  "Join other creators building, sharing, and earning from one link.";

/** Meta / OG / Twitter description. ~150 chars — see the note above. */
export const SITE_DESCRIPTION =
  "One link for everything you make, sell, and share. Custom backgrounds, music, an intro screen, and analytics that show what people actually click. Free.";
