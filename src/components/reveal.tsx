"use client";

import { type ElementType, useEffect, useRef, useState } from "react";
import { cn } from "~/lib/utils";

/**
 * Scroll reveal: fades a block up into place the first time it is scrolled into
 * view, then leaves it alone forever.
 *
 * Why this exists as a primitive rather than a one-off effect: the landing page
 * has three sections and every one of them wanted an arrival. Written three
 * times they drifted -- different thresholds, different distances, one of them
 * re-hiding on scroll-up. The look lives in `.reveal` / `.reveal-in`
 * (globals.css) so the timing is the same everywhere by construction.
 *
 * `as` renders the reveal ON the element instead of wrapping it in a div. That
 * matters more than it sounds: how-it-works.tsx orders its heading and step list
 * with `order-*` utilities on the elements themselves, under a parent that is
 * `display: contents` on mobile. An extra wrapper div there would become the
 * flex item and take the ordering with it, breaking the mobile reading order.
 * With `as` the DOM is byte-identical to what it was before -- two extra
 * classes, no new nodes.
 *
 * Latching is deliberate. A reveal that reverses when the block leaves the
 * viewport means a visitor scrolling back up watches the page dismantle itself,
 * and the observer keeps firing for the life of the page; disconnecting on the
 * first hit costs nothing and can never flicker.
 */
export function Reveal({
  as: Tag = "div",
  className,
  delay = 0,
  rise,
  children,
  ...rest
}: {
  /** Element to render. Defaults to a wrapping div. */
  as?: ElementType;
  className?: string;
  /** Stagger, in ms. Keep these small (<=200ms); a long ladder reads as a queue
   *  of separate arrivals rather than one block settling. */
  delay?: number;
  /** Travel distance. Defaults to the 1rem in `.reveal` — override only for
   *  something much smaller or larger than a section block. */
  rise?: string;
  children?: React.ReactNode;
} & Omit<React.HTMLAttributes<HTMLElement>, "className" | "children">) {
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Belt and braces: if the browser has no IntersectionObserver, show the
    // content rather than leaving a marketing section permanently invisible.
    if (typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setShown(true);
        io.disconnect();
      },
      // A low threshold with a negative bottom inset, rather than a high
      // threshold: a block taller than the viewport can never reach 30%
      // visibility, so a threshold alone would never fire on a tall section.
      // The inset just holds the trigger until the block is properly on screen
      // instead of firing off its first pixel.
      { threshold: 0.01, rootMargin: "0px 0px -12% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      className={cn("reveal", shown && "reveal-in", className)}
      style={delay || rise ? revealVars(delay, rise) : undefined}
      {...rest}
    >
      {children}
    </Tag>
  );
}

function revealVars(delay: number, rise: string | undefined) {
  return {
    ...(delay ? { "--reveal-delay": `${delay}ms` } : {}),
    ...(rise ? { "--reveal-rise": rise } : {}),
  } as React.CSSProperties;
}
