/**
 * The "What's New" changelog. To announce an update, add a new entry to the top
 * of {@link CHANGELOG} with a fresh `id`. The owner's page shows a pop-up for the
 * newest entry once, keyed by that `id` (see the WhatsNewDialog component), so
 * bumping the top `id` is what re-triggers the pop-up for everyone.
 *
 * Entries are authored here (versioned in git, shipped on deploy) — no database.
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
  /** The individual changes, each a bold feature + description. */
  items: ChangelogItem[];
}

/** Newest first. The first entry is the one the pop-up announces. */
export const CHANGELOG: ChangelogEntry[] = [
  {
    id: "2026-08-02",
    date: "August 2, 2026",
    title: "Beta 1.0",
    items: [
      {
        feature: "Music on your page",
        description:
          "Add a song by Spotify link or file upload, with autoplay, loop, and clip-to-a-section controls.",
      },
      {
        feature: "Search visibility",
        description:
          "Choose whether search engines can list your page, in Privacy settings.",
      },
      {
        feature: "Delete your account",
        description:
          "Remove your account yourself, confirmed with your password.",
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
          "Set any link to appear or hide on its own with a start and end time.",
      },
      {
        feature: "Richer share previews",
        description: "Sharing your page now generates a nicer preview card.",
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
        description: "Per-link colors and outlines.",
      },
      {
        feature: "New backgrounds",
        description: "Gradient, grid, and aurora background styles.",
      },
    ],
  },
];

/** The entry the pop-up should announce (the newest), or null if none exist. */
export function latestEntry(): ChangelogEntry | null {
  return CHANGELOG[0] ?? null;
}
