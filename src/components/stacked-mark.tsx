/**
 * The "stacked" brand mark: an outlined layered stack whose sheets fade as they
 * recede. Uses `currentColor`, so it inherits the surrounding text color — pair
 * it with the wordmark or use it standalone. Sized via `className` (e.g.
 * `size-5`). The same artwork drives the favicon in `src/app/icon.svg`.
 */
export function StackedMark({ className }: { className?: string }) {
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
