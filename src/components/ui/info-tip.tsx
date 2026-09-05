"use client";

/**
 * A small ⓘ button that reveals its explanation on hover / focus / tap instead
 * of keeping helper text permanently under a control. Editor panels are narrow
 * and scroll, so the bubble is portaled to `<body>` and positioned from the
 * button's rect — otherwise the panel's `overflow-y-auto` would clip it.
 */

import {
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { usePresence } from "~/lib/use-popover";
import { cn } from "~/lib/utils";

/** Half the bubble's max width — used to keep it inside the viewport. */
const HALF_W = 130;

export function InfoTip({
  label,
  className,
}: {
  /** The explanation shown in the bubble (also the button's accessible name). */
  label: ReactNode;
  className?: string;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{
    top: number;
    left: number;
    above: boolean;
  } | null>(null);
  const id = useId();

  // `pos` is both the geometry and the open flag, so closing throws away the
  // one thing an exit animation needs: somewhere to draw the bubble while it
  // fades. Latch the last real position and paint from that on the way out.
  const lastPos = useRef<typeof pos>(null);
  if (pos) lastPos.current = pos;
  const tip = usePresence(pos !== null);
  const paint = pos ?? lastPos.current;

  const open = useCallback(() => {
    const r = buttonRef.current?.getBoundingClientRect();
    if (!r) return;
    // Prefer below; flip above when the bottom of the window is close.
    const above = r.bottom + 96 > window.innerHeight;
    setPos({
      top: above ? r.top - 8 : r.bottom + 8,
      left: Math.min(
        Math.max(r.left + r.width / 2, HALF_W + 8),
        Math.max(window.innerWidth - HALF_W - 8, HALF_W + 8),
      ),
      above,
    });
  }, []);
  const close = useCallback(() => setPos(null), []);

  // Any scroll or resize invalidates the measured position, so just dismiss.
  useEffect(() => {
    if (!pos) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [pos, close]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={typeof label === "string" ? label : "More info"}
        aria-describedby={pos ? id : undefined}
        onMouseEnter={open}
        onMouseLeave={close}
        onFocus={open}
        onBlur={close}
        onClick={(e) => {
          // Tap on touch (no hover) — and don't let this reach a parent
          // control, e.g. the label side of a toggle row.
          e.preventDefault();
          e.stopPropagation();
          if (pos) close();
          else open();
        }}
        className={cn(
          "inline-flex size-4 shrink-0 items-center justify-center rounded-full border border-muted-foreground/50 align-middle font-semibold text-[10px] text-muted-foreground leading-none transition-colors hover:border-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          className,
        )}
      >
        i
      </button>
      {tip.value && paint
        ? createPortal(
            <div
              id={id}
              role="tooltip"
              style={{
                top: paint.top,
                left: paint.left,
                transform: `translate(-50%, ${paint.above ? "-100%" : "0"})`,
                maxWidth: HALF_W * 2,
              }}
              className={cn(
                "pointer-events-none fixed z-[100] rounded-md border border-border bg-popover px-2.5 py-1.5 text-popover-foreground text-xs leading-snug shadow-lg",
                tip.visible ? "animate-fade" : "animate-fade-out",
              )}
            >
              {label}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
