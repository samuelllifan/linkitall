/**
 * The chart series palette, in draw order.
 *
 * The brand is one purple, and this list is deliberately NOT that. A categorical
 * palette's entire job is that adjacent series can be told apart, and ten shades
 * of one hue cannot be — so the brand leads (slot 1 is --brand-violet, which is
 * what ties a chart to the app) and the rest of the wheel follows behind it.
 * This is the one place in the codebase where hues outside the purple and the
 * four status colours are allowed, because here colour is carrying data rather
 * than identity.
 *
 * (It used to be the other way round: the brand WAS six of these hues, and the
 * palette was described as the brand's own stops. When the brand collapsed to
 * purple, that claim stopped being true — but the list itself is still right,
 * for the reason above, so only the reasoning changed.)
 *
 * LITERAL HEX, deliberately — do NOT rewrite these as `var(--brand-…)`.
 * Two of the three consumers cannot resolve a custom property:
 *   * `charts.tsx` passes them to SVG **presentation attributes**
 *     (`stroke={s.color}`, `fill={a.color}`), and `var()` in a presentation
 *     attribute is not resolved — the series would render black;
 *   * `interactive-grid.tsx` paints into a <canvas>, whose 2D context takes
 *     colour strings, not computed styles.
 * (`src/app/icon.svg` has the same constraint for the same reason: it is served
 * as its own document.) Only slot 1 is shared with globals.css now — if
 * --brand-violet changes, change it here too. That duplication is the price of
 * those two constraints, and it is why this comment exists.
 *
 * The ORDER matters more than the individual colours: adjacent series have to be
 * told apart, so no two neighbours land within ~70° of hue. In particular rose
 * (#fb7185) and pink (#f472b6) are 23° and 0.006 lightness apart, so they are
 * parked at slots 4 and 6 and must never end up side by side. Extend only with
 * LIGHTER siblings — darker ones fail 4.5:1 on the near-black page (#7c3aed is
 * 3.3:1).
 *
 * This replaces ten Tailwind 500s picked by eye, three of which had come to mean
 * something else: two greens (green is now reserved for "success"), plus #f59e0b
 * and #f43f5e — which ARE --warning and --danger, so a pie slice and an error
 * message were rendering the same colour. Note #818cf8 and #c084fc are also
 * --brand-indigo and --brand-orchid: harmless at slots 8 and 10, where a chart
 * only reaches them once it already has seven other series on screen, but do not
 * promote either into the first few slots or the palette starts looking like
 * three attempts at the brand colour.
 *
 * Kept in a plain (non-"use client") module so it can be imported by both
 * Server Components (e.g. the admin view) and Client Components. Importing a
 * non-component value from a "use client" module hands the server a client
 * reference proxy instead of the real array, which is why the admin pie chart
 * rendered black — see the admin/dashboard chart usages.
 */
export const CHART_COLORS = [
  "#a78bfa", // violet — --brand-violet, the brand hue: series 1 is always ours
  "#22d3ee", // cyan
  "#fbbf24", // amber
  "#f472b6", // pink
  "#60a5fa", // blue
  "#fb7185", // rose
  "#2dd4bf", // teal
  "#818cf8", // indigo
  "#fb923c", // orange
  "#c084fc", // mauve
];
