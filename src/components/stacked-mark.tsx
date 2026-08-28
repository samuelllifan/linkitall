/**
 * The "stacked" brand mark: an outlined layered stack whose sheets fade as they
 * recede. Sized via `className` (e.g. `size-5`).
 *
 * - `variant="mono"` (default): drawn in `currentColor`, so it inherits the
 *   surrounding text color — pair it with the wordmark or use it standalone.
 * - `variant="brand"`: the top sheet is filled with the brand chroma gradient
 *   and given a soft glow, with the receding sheets stepping through the
 *   spectrum. Use for the navbar / hero / share cards where the brand shows.
 *
 * The same artwork drives the favicon in `src/app/icon.svg`.
 */
export function StackedMark({
  className,
  variant = "mono",
}: {
  className?: string;
  variant?: "mono" | "brand";
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
          {/* Shared id: duplicate instances resolve to the first (identical) def. */}
          <linearGradient id="stacked-brand-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#f472b6" />
            <stop offset="0.4" stopColor="#a78bfa" />
            <stop offset="0.72" stopColor="#60a5fa" />
            <stop offset="1" stopColor="#22d3ee" />
          </linearGradient>
        </defs>
        {/* Top sheet: gradient-filled outline. */}
        <polygon
          points="50,8 88,30 50,52 12,30"
          fill="url(#stacked-brand-grad)"
          stroke="url(#stacked-brand-grad)"
          strokeWidth={7}
          strokeLinejoin="round"
        />
        {/* Lower sheets step through the spectrum as they recede. */}
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
          stroke="#60a5fa"
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
