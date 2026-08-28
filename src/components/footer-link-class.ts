/**
 * The footer's link look, shared by the three `<Link>`s in footer.tsx and by the
 * What's New `<button>` in whats-new-link.tsx — one of which is not a link at
 * all, which is exactly why this is a constant rather than a copied string. They
 * sit side by side in a single row, so any drift between them is visible.
 *
 * `transition-colors` and a transparent bottom border rather than
 * `hover:underline`: text-decoration is a discrete property and can never
 * animate, while border-color is already on the shared clock from the base layer
 * (globals.css), so the rule fades in instead of snapping. `self-start` /
 * `text-left` keep the border under the label only — the nav is a flex column
 * below sm, where a stretched item would draw the hover rule clear across the
 * footer.
 *
 * Its own module, not footer.tsx: footer.tsx imports WhatsNewLink, so exporting
 * it from there would make the two files circular.
 */
export const FOOTER_LINK_CLASS =
  "self-start border-transparent border-b pb-px text-left transition-colors hover:border-current hover:text-foreground";
