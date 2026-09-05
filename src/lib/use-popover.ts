"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * How long anything in this app takes to leave.
 *
 * It must stay in step with the exit animations in globals.css — `menu-out`,
 * `pop-out`, `fade-out`, `slide-down` all run at --dur-fast. Too short and the
 * element is yanked mid-animation; too long and the trigger sits dead under the
 * pointer after the panel has visually gone.
 *
 * One constant rather than a number typed at each call site: before this it was
 * 150 in this file, 200 at five dialogs in settings, 250 at the Studio's unsaved
 * bar and again as two hooks' default — four different answers to "how long does
 * a thing take to leave", none of which matched all of the CSS.
 */
export const EXIT_MS = 150;

/**
 * A popup that has to stay mounted long enough to animate itself out.
 *
 * `open` is "in the tree", `shown` is "on screen": closing flips `shown` first,
 * swaps the element to its exit animation, and only unmounts a frame-budget
 * later. Everything that reacts to the popup being open — outside-click,
 * Escape, aria-expanded — keys off `shown`, so a popup that is mid-dismissal is
 * already inert and a second click can't re-close it.
 *
 * Lives here rather than in a component because the navbar's account menu and
 * the public page's share panel both need it, and the `shownRef` mirror below
 * is exactly the kind of detail that goes subtly wrong when it is copied.
 */
export function usePopover() {
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Mirrors `shown` so hide() can check it without taking it as a dependency —
  // both callbacks have to stay referentially stable, since callers bind them
  // in effects (the navbar closes its menu on every route change) that would
  // otherwise re-run on each render.
  const shownRef = useRef(false);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const show = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    shownRef.current = true;
    setOpen(true);
    setShown(true);
  }, []);

  const hide = useCallback(() => {
    // No-op when already closed, so callers can hide() unconditionally (the
    // route-change handler does) without arming a pointless unmount timer.
    if (!shownRef.current) return;
    shownRef.current = false;
    setShown(false);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setOpen(false);
      timer.current = null;
    }, EXIT_MS);
  }, []);

  const toggle = useCallback(() => {
    if (shown) hide();
    else show();
  }, [shown, hide, show]);

  return { open, shown, show, hide, toggle };
}

/** Close on a click outside `ref`, or on Escape. Bind only while `active`. */
export function useDismissOnOutside(
  active: boolean,
  ref: React.RefObject<HTMLElement | null>,
  close: () => void,
) {
  useEffect(() => {
    if (!active) return;
    function onPointerDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [active, ref, close]);
}

/**
 * Keep a node mounted through its exit animation.
 *
 * `value` is "in the tree" and stays true for `duration` ms after `active` goes
 * false; `visible` flips immediately, so the call site can swap an entrance
 * class for an exit one and let it play before React takes the node away.
 *
 * This is {@link usePopover} without the imperative open/close API — for state
 * the caller already owns (a `confirming` flag, a toast, a dirty-form bar).
 * It lived twice, copied verbatim into settings-client and studio-client, with
 * the two copies having already drifted in their effect dependencies.
 */
export function usePresence(active: boolean, duration = EXIT_MS) {
  const [value, setValue] = useState(active);
  const [visible, setVisible] = useState(active);

  useEffect(() => {
    if (active) {
      setValue(true);
      setVisible(true);
      return;
    }
    setVisible(false);
    const t = setTimeout(() => setValue(false), duration);
    return () => clearTimeout(t);
  }, [active, duration]);

  return { value, visible };
}
