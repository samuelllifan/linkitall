/**
 * Client-side preferences for the "What's New" pop-up. Stored in localStorage
 * (a per-device preference, no account round-trip). Shared by the pop-up itself
 * (WhatsNewDialog) and the Accessibility settings toggle so they stay in sync.
 */

/** Id of the newest changelog entry the visitor has already dismissed. */
const SEEN_KEY = "stacked:whatsnew:lastSeen";

/** "1" when the visitor chose "Don't show again" (auto pop-up fully off). */
const AUTO_OFF_KEY = "stacked:whatsnew:autoOff";

/**
 * "1" when the visitor wants the pop-up on *every* visit to their own page
 * (the Accessibility toggle), instead of just once per new release.
 */
const EVERY_OPEN_KEY = "stacked:whatsnew:everyOpen";

/** Safe localStorage read — returns null when storage is unavailable. */
function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Safe localStorage write. */
function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Best-effort — private mode / storage disabled.
  }
}

/** Safe localStorage remove. */
function remove(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Best-effort.
  }
}

/** Whether "show on every visit" is enabled. */
export function isEveryOpen(): boolean {
  return read(EVERY_OPEN_KEY) === "1";
}

/**
 * Toggle "show on every visit". Turning it on also clears the "don't show
 * again" suppression so the pop-up can actually appear; turning it off falls
 * back to the once-per-release default.
 */
export function setEveryOpen(on: boolean): void {
  if (on) {
    write(EVERY_OPEN_KEY, "1");
    remove(AUTO_OFF_KEY);
  } else {
    remove(EVERY_OPEN_KEY);
  }
}

/**
 * Decide whether the auto pop-up should show for `entryId` on the owner's own
 * page: every visit when opted in, otherwise once per unseen release, and never
 * once fully turned off.
 */
export function shouldAutoShow(entryId: string): boolean {
  if (isEveryOpen()) return true;
  if (read(AUTO_OFF_KEY) === "1") return false;
  return read(SEEN_KEY) !== entryId;
}

/** Mark `entryId` as seen so the once-per-release pop-up doesn't repeat. */
export function markSeen(entryId: string): void {
  write(SEEN_KEY, entryId);
}

/**
 * "Don't show again": suppress the auto pop-up entirely (both every-visit and
 * once-per-release) and record the current entry as seen.
 */
export function disableAutoShow(entryId: string): void {
  write(AUTO_OFF_KEY, "1");
  remove(EVERY_OPEN_KEY);
  markSeen(entryId);
}
