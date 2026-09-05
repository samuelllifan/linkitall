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
/*
 * The focus half is `rounded-sm` + an offset ring: the elements themselves are
 * square-cornered inline text, so without a radius the ring is a hard rectangle
 * with corners sharper than anything else on the page, and without the offset it
 * sits right on the glyphs. Neither link nor button had any focus style, so
 * tabbing through the footer moved an invisible cursor across four stops.
 */
export const FOOTER_LINK_CLASS =
  "self-start rounded-sm border-transparent border-b pb-px text-left transition-colors hover:border-current hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background";
