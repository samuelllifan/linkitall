import { cn } from "~/lib/utils";

/**
 * The dismiss X, once.
 *
 * There were six of these — the navbar drawer, the Studio's panel/preview/rail
 * closers, the What's New dialog and the promo card — each with its own local
 * `CloseIcon` wrapping the same path string. Five were drawn at `strokeWidth`
 * 2 (one of them as the string `"2"`) and the promo card's at 2.5, so the one X
 * that lands on a stranger's page was visibly heavier than every other X in the
 * app. That is the drift `ui/glyph.tsx` warns about, arrived at the same way:
 * by copying a path.
 *
 * It is NOT a `GLYPH` entry, and that is deliberate. Those are drawn at 1.8 for
 * panel headers and rail icons — marks you read. This is a CONTROL, at the
 * control weight of 2, next to the app's other 2-weight chevrons and carets;
 * folding it in there would have traded six inconsistent X's for one X that is
 * inconsistent with every button around it.
 *
 * `size-4` by default, which is what five of the six were using. Pass a
 * `className` to resize.
 */
export function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn("size-4", className)}
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
