"use client";

import { useEffect, useRef, useState } from "react";
import { type AvatarCrop, DEFAULT_AVATAR_CROP } from "~/lib/pages";
import { cn } from "~/lib/utils";

/**
 * A direct-manipulation circular crop for the profile picture — no sliders.
 *
 * The whole source image is shown in a square viewport; a circle marks what will
 * be kept. Drag to reposition, and zoom with a trackpad pinch, ctrl+wheel, or a
 * two-finger pinch on touch. While you're adjusting, the area outside the circle
 * is only lightly dimmed so you can see the parts being cropped away; a beat
 * after you stop, it solidifies into an opaque veil so you preview the final
 * circular avatar.
 *
 * The crop is stored as {@link AvatarCrop} — `x`/`y` pan percentages of the
 * avatar size plus a `zoom` — so it renders identically at the page's small
 * avatar and here. The image is `object-fit: cover` fitted, then transformed by
 * `translate(x%, y%) scale(zoom)`, exactly as {@link ProfileView} renders it.
 */

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
/** Milliseconds of stillness after which the crop "solidifies". */
const SETTLE_MS = 450;

const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, n));

export function AvatarCropper({
  src,
  value,
  onChange,
}: {
  src: string;
  value?: AvatarCrop;
  onChange: (next: AvatarCrop) => void;
}) {
  const crop = { ...DEFAULT_AVATAR_CROP, ...value };

  const boxRef = useRef<HTMLDivElement | null>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  // `adjusting` keeps the veil light during (and just after) interaction.
  const [adjusting, setAdjusting] = useState(false);

  // Latest values, read by the imperative gesture handlers (which are attached
  // once and must not close over stale props/state).
  const cropRef = useRef(crop);
  cropRef.current = crop;
  const naturalRef = useRef(natural);
  naturalRef.current = natural;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function markAdjusting() {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    setAdjusting(true);
  }
  function settleSoon() {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => setAdjusting(false), SETTLE_MS);
  }
  useEffect(
    () => () => {
      if (settleTimer.current) clearTimeout(settleTimer.current);
    },
    [],
  );

  // The cover-fit overflow ratio on each axis (>= 1). The limiting axis is 1;
  // the other overflows by the image's aspect. Falls back to square until the
  // natural size is known.
  function aspect(): { ax: number; ay: number } {
    const n = naturalRef.current;
    if (!n) return { ax: 1, ay: 1 };
    const min = Math.min(n.w, n.h);
    return { ax: n.w / min, ay: n.h / min };
  }

  // Max pan on each axis (as a % of the avatar box) that still keeps the circle
  // fully covered: half the total overflow once cover-fit and zoom are applied.
  function panLimit(zoom: number): { x: number; y: number } {
    const { ax, ay } = aspect();
    return {
      x: Math.max(0, 50 * (ax * zoom - 1)),
      y: Math.max(0, 50 * (ay * zoom - 1)),
    };
  }

  function commit(next: Partial<AvatarCrop>) {
    const merged = { ...cropRef.current, ...next };
    const lim = panLimit(merged.zoom);
    merged.x = clamp(merged.x, -lim.x, lim.x);
    merged.y = clamp(merged.y, -lim.y, lim.y);
    onChangeRef.current(merged);
  }

  function zoomBy(factor: number) {
    const z = clamp(cropRef.current.zoom * factor, MIN_ZOOM, MAX_ZOOM);
    commit({ zoom: z });
  }

  // --- Mouse drag (pointer events; touch is handled separately below). --------
  function onPointerDown(e: React.PointerEvent) {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    const box = boxRef.current;
    if (!box) return;
    const B = box.clientWidth || 1;
    const startX = e.clientX;
    const startY = e.clientY;
    const start = { ...cropRef.current };
    markAdjusting();
    const move = (ev: PointerEvent) => {
      commit({
        x: start.x + ((ev.clientX - startX) / B) * 100,
        y: start.y + ((ev.clientY - startY) / B) * 100,
      });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      settleSoon();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  // --- Wheel + touch: attached natively so they can be non-passive and call
  //     preventDefault (stops browser zoom / pinch-zoom while cropping). -------
  // biome-ignore lint/correctness/useExhaustiveDependencies: attach once on mount; the handlers read live values through refs
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;

    const onWheel = (e: WheelEvent) => {
      // Only a deliberate zoom is taken: a trackpad pinch arrives as ctrl+wheel,
      // and ctrl/⌘+wheel is its mouse equivalent. A plain wheel is left alone
      // and scrolls the panel this cropper sits in — claiming every wheel event
      // (this listener is non-passive, so preventDefault sticks) would dead-stop
      // the panel's scroll whenever the pointer happened to be over the circle.
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      markAdjusting();
      // exp keeps the zoom smooth and even across delta sizes.
      zoomBy(Math.exp(-e.deltaY * 0.0015));
      settleSoon();
    };

    // Touch: one finger pans, two fingers pinch-zoom.
    let mode: "none" | "pan" | "pinch" = "none";
    let panStartX = 0;
    let panStartY = 0;
    let startCrop = cropRef.current;
    let pinchDist = 0;
    let pinchStartZoom = 1;

    const dist = (a: Touch, b: Touch) =>
      Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

    const onTouchStart = (e: TouchEvent) => {
      markAdjusting();
      if (e.touches.length >= 2) {
        mode = "pinch";
        pinchDist = dist(e.touches[0], e.touches[1]);
        pinchStartZoom = cropRef.current.zoom;
      } else if (e.touches.length === 1) {
        mode = "pan";
        panStartX = e.touches[0].clientX;
        panStartY = e.touches[0].clientY;
        startCrop = { ...cropRef.current };
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (mode === "none") return;
      e.preventDefault();
      const B = box.clientWidth || 1;
      if (mode === "pinch" && e.touches.length >= 2) {
        const d = dist(e.touches[0], e.touches[1]);
        if (pinchDist > 0) {
          commit({
            zoom: clamp(pinchStartZoom * (d / pinchDist), MIN_ZOOM, MAX_ZOOM),
          });
        }
      } else if (mode === "pan" && e.touches.length === 1) {
        commit({
          x: startCrop.x + ((e.touches[0].clientX - panStartX) / B) * 100,
          y: startCrop.y + ((e.touches[0].clientY - panStartY) / B) * 100,
        });
      }
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length === 0) {
        mode = "none";
        settleSoon();
      } else {
        // A finger lifted mid-pinch: re-baseline the remaining gesture.
        onTouchStart(e);
      }
    };

    box.addEventListener("wheel", onWheel, { passive: false });
    box.addEventListener("touchstart", onTouchStart, { passive: false });
    box.addEventListener("touchmove", onTouchMove, { passive: false });
    box.addEventListener("touchend", onTouchEnd);
    box.addEventListener("touchcancel", onTouchEnd);
    return () => {
      box.removeEventListener("wheel", onWheel);
      box.removeEventListener("touchstart", onTouchStart);
      box.removeEventListener("touchmove", onTouchMove);
      box.removeEventListener("touchend", onTouchEnd);
      box.removeEventListener("touchcancel", onTouchEnd);
    };
  }, []);

  const isDefault = crop.x === 0 && crop.y === 0 && crop.zoom === 1;

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        ref={boxRef}
        onPointerDown={onPointerDown}
        className={cn(
          "relative aspect-square w-full max-w-[240px] touch-none select-none overflow-hidden rounded-xl bg-black/50",
          "cursor-grab active:cursor-grabbing",
        )}
      >
        {/* biome-ignore lint/performance/noImgElement: user-provided data-URL avatar */}
        <img
          src={src}
          alt=""
          draggable={false}
          onLoad={(e) =>
            setNatural({
              w: e.currentTarget.naturalWidth,
              h: e.currentTarget.naturalHeight,
            })
          }
          className="pointer-events-none absolute inset-0 size-full object-cover"
          style={{
            transform: `translate(${crop.x}%, ${crop.y}%) scale(${crop.zoom})`,
          }}
        />

        {/* Circle guide: the ring marks the crop, and the box-shadow paints the
            veil over everything outside it — light while adjusting, opaque once
            the crop settles. */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div
            className="aspect-square h-full rounded-full border border-white/70 transition-[box-shadow] duration-300 ease-out"
            style={{
              boxShadow: `0 0 0 9999px rgba(0,0,0,${adjusting ? 0.25 : 0.88})`,
            }}
          />
        </div>
      </div>

      <div className="flex items-center gap-2 text-muted-foreground text-xs">
        <span>Drag to reposition · pinch or ctrl-scroll to zoom</span>
        {!isDefault ? (
          <button
            type="button"
            onClick={() => onChange({ ...DEFAULT_AVATAR_CROP })}
            className="rounded px-1.5 py-0.5 text-foreground/80 transition-colors hover:bg-muted hover:text-foreground"
          >
            Reset
          </button>
        ) : null}
      </div>
    </div>
  );
}
