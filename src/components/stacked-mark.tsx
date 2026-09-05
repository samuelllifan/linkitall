/**
 * The "stacked" brand mark: an outlined layered stack whose sheets fade as they
 * recede. Sized via `className` (e.g. `size-5`).
 *
 * - `variant="mono"` (default): drawn in `currentColor`, so it inherits the
 *   surrounding text color — pair it with the wordmark or use it standalone.
 * - `variant="brand"`: the top sheet is filled with the brand purple gradient
 *   and given a soft glow, with the receding sheets stepping down the same ramp.
 *   Use for the navbar / hero / share cards where the brand shows.
 *
 * The stops are literal hex and cannot be `var(--brand-*)`: they land on SVG
 * `stopColor`, and a var() in an SVG presentation attribute is not resolved.
 * They mirror --brand-lilac/orchid/violet/indigo in globals.css — change one,
 * change the other, and `src/app/icon.svg` too.
 *
 * `gradientId` exists because two brand marks on one page share a `<defs>` id,
 * and `url(#id)` resolves to the FIRST match in document order — which is only
 * harmless while that first one is actually rendered. On a public profile page
 * it is not: `body:has([data-page-chrome="off"]) [data-site-nav]` takes the
 * navbar away with `display: none`, Chrome builds no layout for that subtree, so
 * its gradient is not a usable paint server and EVERY later instance sharing the
 * id paints with no fill and no stroke — the top sheet vanishes and the mark
 * renders as two bare chevrons. Any brand mark that can appear alongside the
 * navbar's must pass its own id. (A `useId()` would make this automatic, at the
 * cost of turning a static SVG into a client component — `not-found.tsx` renders
 * it from the server.)
 *
 * The same artwork drives the favicon in `src/app/icon.svg`.
 */
export function StackedMark({
  className,
  variant = "mono",
  gradientId = "stacked-brand-grad",
}: {
  className?: string;
  variant?: "mono" | "brand";
  /** Unique `<defs>` id for the brand gradient — see the note above. */
  gradientId?: string;
}) {
  if (variant === "brand") {
    return (
      <svg
        viewBox="0 0 100 100"
        className={className}
        fill="none"
        aria-hidden="true"
        style={{ filter: "drop-shadow(0 1px 6px rgba(139, 124, 248, 0.45))" }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#d8b4fe" />
            <stop offset="0.4" stopColor="#c084fc" />
            <stop offset="0.72" stopColor="#a78bfa" />
            <stop offset="1" stopColor="#818cf8" />
          </linearGradient>
        </defs>
        {/* Top sheet: gradient-filled outline. */}
        <polygon
          points="50,8 88,30 50,52 12,30"
          fill={`url(#${gradientId})`}
          stroke={`url(#${gradientId})`}
          strokeWidth={7}
          strokeLinejoin="round"
        />
        {/* Lower sheets step down the ramp as they recede. */}
        <polyline
          points="12,48 50,70 88,48"
          stroke="#a78bfa"
          strokeWidth={7}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.6}
        />
        <polyline
          points="12,64 50,86 88,64"
          stroke="#818cf8"
          strokeWidth={7}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.32}
        />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
    >
      {/* Top sheet: full-strength outline. */}
      <polygon
        points="50,8 88,30 50,52 12,30"
        strokeWidth={7}
        strokeLinejoin="round"
      />
      {/* Lower sheets fade as they recede. */}
      <polyline
        points="12,48 50,70 88,48"
        strokeWidth={7}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.58}
      />
      <polyline
        points="12,64 50,86 88,64"
        strokeWidth={7}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.3}
      />
    </svg>
  );
}
