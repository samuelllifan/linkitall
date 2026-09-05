"use client";

import { cn } from "~/lib/utils";

/**
 * The app's switch.
 *
 * There used to be three of these — one in the Studio's control primitives, one
 * in settings, one inside the music editor — with three geometries (h-6 w-10 vs
 * h-6 w-11, thumb at left-0 vs left-0.5, travel of 18px vs 16px vs 20px), three
 * on-track colours (`bg-foreground`, `bg-primary`, `.sec-on`) and two off-track
 * colours (`bg-muted`, `bg-input`). Two of them were reachable in the SAME panel
 * of the editor, so the same control had two looks a scroll apart.
 *
 * Two details are load-bearing:
 *
 *   * The THUMB COLOUR FLIPS with state. On this monochrome dark ramp a fixed
 *     thumb disappears against one of the two tracks — the Studio's copy pinned
 *     the thumb to `bg-background`, which is 1.3:1 on the off track, i.e. every
 *     switched-off toggle in the editor read as an empty grey pill. Dark thumb
 *     on the bright on-track, bright thumb on the dark off-track.
 *   * The on-track is `.sec-on` (globals.css), which resolves to the current
 *     editor section's hue inside `.studio-shell` and falls back to
 *     `var(--foreground)` — plain white — everywhere else. So this is one
 *     component that is section-coloured in the Studio and monochrome in
 *     settings, without either call site knowing about it.
 */
export function Toggle({
  id,
  checked,
  onChange,
  label,
}: {
  id?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  /** Accessible name — these render as a bare switch with no visible text. */
  label: string;
}) {
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-border transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
        checked ? "sec-on" : "bg-muted",
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block size-5 rounded-full shadow transition-transform",
          checked
            ? "translate-x-5 bg-background"
            : "translate-x-0.5 bg-foreground",
        )}
      />
    </button>
  );
}
