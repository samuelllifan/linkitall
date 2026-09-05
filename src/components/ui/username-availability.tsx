"use client";

import { useState } from "react";
import { Collapse } from "~/components/ui/collapse";
import type { Availability } from "~/lib/use-username-availability";
import { cn } from "~/lib/utils";

/**
 * The app's one "is this name free?" read-out: a coloured dot and a sentence.
 *
 * Grey means we haven't asked or couldn't tell, a pulsing grey means the answer
 * is in flight, green means free, red means taken / reserved / malformed. It is
 * used by all three places that claim a username — the landing promo card,
 * sign-up, and settings — so the same verdict never looks like two different
 * things depending on where you happen to be standing.
 *
 * The dot sits in a 14px box, matching {@link Requirement}'s icon slot, so when
 * this row follows a checklist of format rules the bullets line up in one
 * column instead of nearly.
 *
 * `aria-live` because the dot is the fast signal for sighted users and cannot
 * be the only one.
 *
 * ## It owns its own entrance and exit
 *
 * The row appears the moment a typed name becomes well-formed enough to ask the
 * server about, which is mid-keystroke. Rendered by a bare `cond ? <row/> :
 * null` at the call site it arrived at full height in one frame and shoved
 * everything below it down — the checklist above it animates, so the one thing
 * that shows up unannounced was the one thing that jumped.
 *
 * So the collapse lives HERE rather than at each call site: it is a property of
 * this row, and three call sites would otherwise have to remember to wrap it.
 * `show` is what a caller uses instead of a conditional — keep it mounted and
 * let it animate.
 *
 * The held verdict is what makes the EXIT work. On the way out the state has
 * already gone back to `idle`, so a row rendering live state would empty itself
 * first and collapse from zero height — i.e. vanish. Holding the last real
 * message means there is still something to animate away from.
 */
export function UsernameAvailability({
  avail,
  id,
  /** Shown while there is nothing to report. Omit to render nothing at all. */
  idleLabel,
  /** What "free" reads as — sign-up says "Available", the promo card names it. */
  availableLabel = "Available",
  /**
   * Whether the caller wants this row at all. Sign-up and settings pass their
   * format-checklist result: those two rules are the feedback for a malformed
   * name, so there is nothing for a verdict to add until they pass.
   *
   * A prop and not a conditional at the call site, because an unmounted row
   * cannot animate itself away.
   */
  show = true,
  className,
}: {
  avail: Availability;
  id?: string;
  idleLabel?: string;
  availableLabel?: string;
  show?: boolean;
  className?: string;
}) {
  const message =
    avail.state === "available"
      ? availableLabel
      : avail.state === "unavailable"
        ? avail.reason
        : avail.state === "checking"
          ? "Checking availability…"
          : idleLabel;

  const open = show && Boolean(message);

  // The last verdict actually shown, kept so the row has something to render
  // while it collapses. Adjusted during render (React's own "derive state from
  // props" escape hatch) rather than in an effect: an effect would paint one
  // frame of the stale verdict first, which on the way IN is a visible flash of
  // the previous name's answer under the new name.
  const [held, setHeld] = useState({ message, state: avail.state });
  if (open && message && held.message !== message) {
    setHeld({ message, state: avail.state });
  }
  const shown = open && message ? { message, state: avail.state } : held;

  return (
    <Collapse open={open}>
      <p
        id={id}
        aria-live="polite"
        className={cn(
          "flex items-center gap-2 pt-1 text-xs transition-colors duration-300",
          shown.state === "available"
            ? "text-success"
            : shown.state === "unavailable"
              ? "text-danger"
              : "text-muted-foreground",
          className,
        )}
      >
        <span
          aria-hidden
          className="flex size-3.5 shrink-0 items-center justify-center"
        >
          <span
            className={cn(
              "size-2 rounded-full transition-all duration-300 ease-out",
              shown.state === "available" &&
                "bg-success shadow-[0_0_0_3px_color-mix(in_oklab,var(--success)_22%,transparent)]",
              shown.state === "unavailable" &&
                "bg-danger shadow-[0_0_0_3px_color-mix(in_oklab,var(--danger)_22%,transparent)]",
              shown.state === "checking" && "animate-pulse bg-muted-foreground",
              shown.state === "idle" && "bg-muted-foreground/40",
            )}
          />
        </span>
        <span className="truncate">{shown.message}</span>
      </p>
    </Collapse>
  );
}
