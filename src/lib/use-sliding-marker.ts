"use client";

import { useEffect, useRef, useState } from "react";

/** Where the marker should be, in its container's coordinates. */
export type MarkerGeometry = {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Is there an active entry to point at at all? */
  on: boolean;
  /** This placement is an ARRIVAL, not a move — paint it, don't animate to it. */
  snap: boolean;
};

/**
 * The app's sliding active-marker: ONE object that moves between the entries of
 * a nav, rather than a chip per entry fading in and out.
 *
 * An active state that MOVES is something the eye can follow; several
 * independent chips crossfading is something it can only notice afterwards.
 * That is the whole argument, and it is why this is shared: the navbar's link
 * row, the settings section rail and the Studio's section rail are three
 * answers to "where am I", and they should be one gesture the eye learns once.
 *
 * ## How it finds its target
 *
 * By DOM query, not by index — pass a `selector` that the active entry marks
 * itself with (`[data-nav-target]`, `[data-rail-active]`). `activeKey` is
 * therefore the TRIGGER, not an input: it is what says "go measure again". This
 * is what lets the navbar's marker follow an optimistic route target without
 * this hook knowing anything about routing.
 *
 * Geometry is measured off the live DOM rather than derived, because entries are
 * text: their size depends on the font that actually loaded and on which layout
 * is in force.
 *
 * ## `snap` and `placed`
 *
 * `placed` is false until the first successful measurement, so the marker's
 * resting spot on load is PAINTED and not animated to — otherwise every visit
 * starts with it flying in from x=0.
 *
 * `snap` marks a placement that must not be transitioned to. Two cases:
 *
 *   * re-arming after a route with no marker of its own (`/`, /settings). The
 *     x/w being replaced are stale — they point at whatever entry was active
 *     before you left — so sliding from them is a slide from nowhere;
 *   * a RESIZE. The geometry changed because the container did, not because the
 *     user picked anything: the settings rail flipping from a row to a column at
 *     `sm`, a webfont swapping in, or the Studio's panel being dragged wider.
 *     Animating those means the marker chases the drag a third of a second
 *     behind the pointer, and slides diagonally across a breakpoint change.
 *
 * Nothing clears `snap` on a timer, deliberately. It stays set until the next
 * placement, which clears it in the SAME commit that moves the marker — and a
 * transition is created from the AFTER style, so that commit slides normally. A
 * rAF-based clear looked tidier and was wrong: rAF is throttled in a background
 * tab, so the flag could still be set when the next move landed, and that move
 * would jump.
 */
export function useSlidingMarker<T extends HTMLElement>(
  activeKey: string | null,
  selector: string,
) {
  const ref = useRef<T | null>(null);
  const [marker, setMarker] = useState<MarkerGeometry>({
    x: 0,
    y: 0,
    w: 0,
    h: 0,
    on: false,
    snap: true,
  });
  const [placed, setPlaced] = useState(false);

  // `activeKey` looks unused in the body — it isn't. The effect finds its target
  // through the DOM, so the key is what re-runs the measurement.
  // biome-ignore lint/correctness/useExhaustiveDependencies: activeKey is the trigger, not an input
  useEffect(() => {
    const root = ref.current;
    if (!root) return;

    const measure = (fromResize: boolean) => {
      const el = root.querySelector<HTMLElement>(selector);
      // Nothing active: fade out in place rather than jumping to x=0.
      if (!el) {
        setMarker((m) => (m.on ? { ...m, on: false } : m));
        return;
      }
      const x = el.offsetLeft;
      const y = el.offsetTop;
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      // Not rendered right now — `display: none` somewhere up the tree, which
      // every one of the three call sites does: the navbar's row is `hidden
      // sm:flex`, and the Studio's whole panel is swapped out for the preview on
      // phones. Everything measures 0 there, and committing that would collapse
      // the marker to nothing and make its recovery depend on a SECOND observer
      // callback landing after the container is shown again. Keeping the last
      // good geometry means it is already in the right place the moment it comes
      // back, whether or not that callback ever arrives.
      if (w === 0 && h === 0) return;
      setMarker((m) => {
        // Bail out when nothing moved, and mean it — return the same object so
        // React skips the render entirely. This is not an optimisation:
        // `observe()` fires once immediately, so every change measures TWICE,
        // and that second pass would otherwise overwrite the first's `snap`
        // before it had been painted.
        if (m.on && m.x === x && m.y === y && m.w === w && m.h === h) return m;
        return { x, y, w, h, on: true, snap: fromResize || !m.on };
      });
    };

    measure(false);
    // Watch the container rather than measuring once and trusting it: layout
    // flips, font swaps and drag-resizes all land after this effect has run.
    const observer = new ResizeObserver(() => measure(true));
    observer.observe(root);
    return () => observer.disconnect();
  }, [activeKey, selector]);

  useEffect(() => {
    if (marker.on) setPlaced(true);
  }, [marker.on]);

  return { ref, marker, placed };
}
