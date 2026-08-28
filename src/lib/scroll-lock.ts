/**
 * A ref-counted lock on page scrolling, shared by every overlay that covers the
 * page (the intro splash, the What's New dialog, the settings modals).
 *
 * The obvious per-component version — save `body.style.overflow`, set "hidden",
 * restore the saved value on cleanup — is wrong as soon as two overlays are up
 * at once: the second one captures the first one's "hidden" as its baseline and
 * writes it back when it closes, leaving the page permanently unscrollable with
 * nothing on screen to explain why. That happens on the owner's own page, where
 * an enabled intro splash and an auto-shown What's New dialog overlap.
 *
 * Counting fixes the ordering: the style is written once when the first lock is
 * taken and restored once when the last is released, whatever order the
 * overlays mount and unmount in.
 */

let locks = 0;
let previousOverflow = "";

/** Take a lock, freezing page scroll (idempotent per caller pairing). */
export function lockBodyScroll(): void {
  if (locks === 0) {
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  locks += 1;
}

/** Release a lock; scrolling resumes once every holder has released. */
export function unlockBodyScroll(): void {
  if (locks === 0) return;
  locks -= 1;
  if (locks === 0) document.body.style.overflow = previousOverflow;
}
