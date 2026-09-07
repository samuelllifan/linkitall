/**
 * The "What's New" changelog. To announce an update, add a new entry to the top
 * of {@link CHANGELOG} with a fresh `id`. The owner's page shows a pop-up for the
 * newest entry once, keyed by that `id` (see the WhatsNewDialog component), so
 * bumping the top `id` is what re-triggers the pop-up for everyone.
 *
 * Entries are authored here (versioned in git, shipped on deploy) — no database.
 *
 * ## How to write one
 *
 * This is read once, quickly, over the top of somebody's own page. It is a list
 * of what changed, not a piece of writing — so the name says WHAT it is and the
 * line under it says WHAT IT DOES, and neither of them is clever:
 *
 *   * THE NAME IS THE FEATURE. "Revamped navbar", "Page privacy controls",
 *     "Link scheduling". Two or three plain words. Not a slogan, not a pun, and
 *     not a sentence — a creator scanning six of these should be able to tell
 *     from the name alone whether the line below is worth reading.
 *   * THE DESCRIPTION EXPLAINS THE FEATURE. One sentence, two at the very most,
 *     in second person and present tense: "Set a password on your page, take it
 *     offline, or add a sensitive-content warning." Not why we built it, not
 *     what it replaces, not how it feels.
 *   * NO INTERFACE WORDS. "two-pane", "grouped into sections", "unfurls",
 *     "toggle", "modal" — a creator does not care what shape our UI is, and half
 *     of those words mean nothing outside this repo.
 *   * AMERICAN SPELLING, matching the rest of the product's copy ("color",
 *     "capitalize").
 *
 * The last item of a release is "Fixes and polish" — the small wins that don't
 * deserve their own line but are the ones people actually notice.
 */

/** A single change: a short bold feature name plus a one-line description. */
export interface ChangelogItem {
  /** The feature, shown in bold (keep it to a few words). */
  feature: string;
  /** A brief line describing what it does. */
  description: string;
}

export interface ChangelogEntry {
  /**
   * Stable, unique key for this entry. Once shown-and-dismissed it's never shown
   * again, so never reuse an old id for new content — always pick a new one
   * (a date works well: "2026-08-01").
   */
  id: string;
  /** Human-readable date shown in the pop-up, e.g. "August 1, 2026". */
  date: string;
  /** Release version shown as the heading, e.g. "Beta 1.0". */
  title: string;
  /**
   * The release's theme, shown after the version in the pop-up heading
   * ("Beta 1.2 — Everything around your page"). Optional, and deliberately
   * separate from {@link title}: Settings → Help renders `title` alone as the
   * Version chip, so the theme has to live in its own field or it overflows a
   * control that expects "Beta 1.2".
   */
  subtitle?: string;
  /** The individual changes, each a bold feature + description. */
  items: ChangelogItem[];
}

/** Newest first. The first entry is the one the pop-up announces. */
export const CHANGELOG: ChangelogEntry[] = [
  {
    id: "2026-09-06",
    date: "September 6, 2026",
    title: "Beta 1.3",
    subtitle: "Themes and button design",
    items: [
      {
        feature: "Themes",
        description:
          "Eight ready-made looks for your whole page. One click sets the background, the buttons and the type; your name, photo, links and music stay exactly as they are.",
      },
      {
        feature: "Status",
        description:
          "Show what you're up to under your name \u2014 an online, idle or do-not-disturb dot and a line like \u201cback in an hour\u201d. Set it to clear itself after 30 minutes, an hour, or at the end of the day.",
      },
      {
        feature: "Button shapes and shadows",
        description:
          "Make your links square, rounded or pill-shaped, and give them a soft, hard or glowing shadow.",
      },
      {
        feature: "Attention animations",
        description:
          "Make one link pulse, bounce, shake or glow so people look at it first.",
      },
      {
        feature: "Sections and icon rows",
        description:
          "Add a title above a group of links, or show a link as just its logo \u2014 logos next to each other share one row.",
      },
      {
        feature: "Text and photo effects",
        description:
          "Give your name, bio or links a gradient, rainbow or shine, and add drifting particles or a moving shine to your profile picture.",
      },
      {
        feature: "Ripple background",
        description:
          "Slow glowing lines that drift across your page. Pick the base and glow colors, how fine the pattern is, and how fast it moves.",
      },
      {
        feature: "Undo and redo",
        description:
          "Take back any change while you're building your page, and put it back again. Ctrl+Z and \u2318Z work too.",
      },
      {
        feature: "Fixes and polish",
        description:
          "Copy your page link straight from the Studio, search when adding a link, duplicate a link, schedule when a link appears, and gradients that run corner to corner.",
      },
    ],
  },
  {
    id: "2026-09-04",
    date: "September 4, 2026",
    title: "Beta 1.2",
    subtitle: "Everything around your page",
    items: [
      {
        feature: "Revamped navbar",
        description:
          "My Page, Studio and Dashboard sit in one row. On a phone they fold into a menu.",
      },
      {
        feature: "New settings page",
        description:
          "Your account, password, page and privacy settings, all in one place.",
      },
      {
        feature: "Two-factor authentication",
        description:
          "Ask for a code from your phone as well as your password when you sign in.",
      },
      {
        feature: "Page privacy controls",
        description:
          "Set a password on your page, take it offline, or add a sensitive-content warning.",
      },
      {
        feature: "Better link previews",
        description:
          "Your page gets a proper preview card when you share it, and hidden pages stay hidden.",
      },
      {
        feature: "Fixes and polish",
        description:
          "Short usernames, a downloadable QR code, and a full export of your data.",
      },
    ],
  },
  {
    id: "2026-08-28",
    date: "August 28, 2026",
    title: "Beta 1.1",
    items: [
      {
        feature: "Rebuilt editor",
        description:
          "Your controls on one side, your live page on the other. On a phone you switch between them.",
      },
      {
        feature: "Click to enter",
        description:
          "Add a splash screen in front of your page that visitors click through.",
      },
      {
        feature: "Image and video backgrounds",
        description:
          "Upload one, drag to frame it, and dim it so your text stays readable.",
      },
      {
        feature: "Profile picture cropping",
        description: "Drag and pinch to choose exactly what the circle keeps.",
      },
      {
        feature: "Expanded dashboard",
        description:
          "Pick any time range and compare it with the one before. See where your visitors are, what they use, and when they visit.",
      },
      {
        feature: "Fixes and polish",
        description:
          "Phone keyboards no longer capitalize usernames, faint text is easier to read, and the home page was rebuilt.",
      },
    ],
  },
  {
    id: "2026-08-02",
    date: "August 2, 2026",
    title: "Beta 1.0",
    items: [
      {
        feature: "Music on your page",
        description:
          "Add a song from Spotify or upload your own. Loop it, autoplay it, or clip it to one section.",
      },
      {
        feature: "Search visibility",
        description: "Choose whether search engines can list your page.",
      },
      {
        feature: "Account deletion",
        description: "Delete your own account, confirmed with your password.",
      },
    ],
  },
  {
    id: "2026-08-01",
    date: "August 1, 2026",
    title: "Beta 0.9",
    items: [
      {
        feature: "Link scheduling",
        description:
          "Give a link a start and end time and it appears and hides on its own.",
      },
      {
        feature: "Richer share previews",
        description: "Sharing your page generates a preview card.",
      },
    ],
  },
  {
    id: "2026-07-26",
    date: "July 26, 2026",
    title: "Beta 0.8",
    items: [
      {
        feature: "Redesigned editor",
        description: "Plus per-link colors and outlines.",
      },
      {
        feature: "New backgrounds",
        description: "Gradient, grid and aurora styles.",
      },
    ],
  },
];

/** The entry the pop-up should announce (the newest), or null if none exist. */
export function latestEntry(): ChangelogEntry | null {
  return CHANGELOG[0] ?? null;
}
