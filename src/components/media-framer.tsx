"use client";

import { useEffect, useRef } from "react";

/**
 * A direct-manipulation framer for an imported image/video background — the
 * rectangular sibling of {@link AvatarCropper}.
 *
 * The media is `object-fit: cover` fitted into a page-shaped frame and
 * transformed exactly as `PageBackground` renders it, so what you frame here is
 * what fills the page. Drag to move the focal point, and zoom with a trackpad
 * pinch, ctrl+wheel, a two-finger pinch, or the slider.
 *
 * Note the framing is stored the way the page consumes it — `posX`/`posY` are
 * `object-position` percentages (0–100), not the translate percentages the
 * avatar crop uses. Because `object-position` moves the *window* over the media,
 * dragging the media one way reveals the opposite edge: the drag delta is
 * inverted.
 */

/** Framing of a media background: focal point plus zoom on top of cover-fit. */
export interface MediaFrame {
  posX: number;
  posY: number;
  zoom: number;
}

/** Centered and unzoomed — where a freshly imported file starts. */
export const DEFAULT_MEDIA_FRAME: MediaFrame = { posX: 50, posY: 50, zoom: 1 };

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, n));

export function MediaFramer({
  src,
  kind,
  value,
  onChange,
}: {
  src: string;
  kind: "image" | "video";
  value: MediaFrame;
  onChange: (next: MediaFrame) => void;
}) {
  const boxRef = useRef<HTMLDivElement | null>(null);

  // Latest values, read by the imperative gesture handlers (which are attached
  // once and must not close over stale props).
  const frameRef = useRef(value);
  frameRef.current = value;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Store at the precision the page renders at: whole percent for the focal
  // point, two decimals for the zoom.
  function commit(next: Partial<MediaFrame>) {
    const merged = { ...frameRef.current, ...next };
    onChangeRef.current({
      posX: Math.round(clamp(merged.posX, 0, 100)),
      posY: Math.round(clamp(merged.posY, 0, 100)),
      zoom: Math.round(clamp(merged.zoom, MIN_ZOOM, MAX_ZOOM) * 100) / 100,
    });
  }

  function zoomBy(factor: number) {
    commit({ zoom: frameRef.current.zoom * factor });
  }

  // --- Mouse drag (pointer events; touch is handled natively below). ----------
  function onPointerDown(e: React.PointerEvent) {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    const box = boxRef.current;
    if (!box) return;
    const w = box.clientWidth || 1;
    const h = box.clientHeight || 1;
    const startX = e.clientX;
    const startY = e.clientY;
    const start = { ...frameRef.current };
    const move = (ev: PointerEvent) => {
      commit({
        posX: start.posX - ((ev.clientX - startX) / w) * 100,
        posY: start.posY - ((ev.clientY - startY) / h) * 100,
      });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  // --- Wheel + touch: attached natively so they can be non-passive and call
  //     preventDefault (stops browser zoom / pinch-zoom while framing). --------
  // biome-ignore lint/correctness/useExhaustiveDependencies: attach once on mount; the handlers read live values through refs
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;

    const onWheel = (e: WheelEvent) => {
      // Only a deliberate zoom is taken: a trackpad pinch arrives as ctrl+wheel,
      // and ctrl/⌘+wheel is its mouse equivalent. A plain wheel is left alone
      // and scrolls the panel this frame sits in — claiming every wheel event
      // (this listener is non-passive, so preventDefault sticks) would dead-stop
      // the panel's scroll whenever the pointer happened to be over the frame.
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      // exp keeps the zoom smooth and even across delta sizes.
      zoomBy(Math.exp(-e.deltaY * 0.0015));
    };

    // Touch: one finger pans, two fingers pinch-zoom.
    let mode: "none" | "pan" | "pinch" = "none";
    let panStartX = 0;
    let panStartY = 0;
    let startFrame = frameRef.current;
    let pinchDist = 0;
    let pinchStartZoom = 1;

    const dist = (a: Touch, b: Touch) =>
      Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length >= 2) {
        mode = "pinch";
        pinchDist = dist(e.touches[0], e.touches[1]);
        pinchStartZoom = frameRef.current.zoom;
      } else if (e.touches.length === 1) {
        mode = "pan";
        panStartX = e.touches[0].clientX;
        panStartY = e.touches[0].clientY;
        startFrame = { ...frameRef.current };
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (mode === "none") return;
      e.preventDefault();
      if (mode === "pinch" && e.touches.length >= 2) {
        const d = dist(e.touches[0], e.touches[1]);
        if (pinchDist > 0) commit({ zoom: pinchStartZoom * (d / pinchDist) });
      } else if (mode === "pan" && e.touches.length === 1) {
        const w = box.clientWidth || 1;
        const h = box.clientHeight || 1;
        commit({
          posX:
            startFrame.posX - ((e.touches[0].clientX - panStartX) / w) * 100,
          posY:
            startFrame.posY - ((e.touches[0].clientY - panStartY) / h) * 100,
        });
      }
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length === 0) mode = "none";
      // A finger lifted mid-pinch: re-baseline the remaining gesture.
      else onTouchStart(e);
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

  const media: React.CSSProperties = {
    objectPosition: `${value.posX}% ${value.posY}%`,
    transform: `scale(${value.zoom})`,
  };
  const isDefault =
    value.posX === DEFAULT_MEDIA_FRAME.posX &&
    value.posY === DEFAULT_MEDIA_FRAME.posY &&
    value.zoom === DEFAULT_MEDIA_FRAME.zoom;

  return (
    <div className="flex flex-col gap-2">
      {/* A fixed 10:16 portrait, deliberately, and not the editor's live layout.
          `object-position` only crops relative to the container it lands in, so
          there is no aspect that is "correct" for every visitor — the frame's job
          is to pick a focal point, and the shape it should be picked in is the
          one most visitors will see the page in, a phone held upright. Tracking
          the preview pane instead would reshape this box (and re-crop what the
          owner is looking at) every time they dragged the divider or switched
          the device toggle, i.e. it would make the framing depend on how the
          *owner's* window happens to be sized — the old my-page editor measured
          `innerHeight / innerWidth` and had exactly that problem. The live
          preview beside this control is where per-device truth is checked; the
          frame's pixel size never matters, since the math is all percentages. */}
      <div
        ref={boxRef}
        onPointerDown={onPointerDown}
        className="relative mx-auto aspect-[10/16] w-full max-w-[200px] cursor-grab touch-none select-none overflow-hidden rounded-lg border border-border bg-black active:cursor-grabbing"
      >
        {kind === "video" ? (
          <video
            src={src}
            autoPlay
            muted
            loop
            playsInline
            className="pointer-events-none absolute inset-0 size-full object-cover"
            style={media}
          />
        ) : (
          // biome-ignore lint/performance/noImgElement: user-provided data-URL background
          <img
            src={src}
            alt=""
            draggable={false}
            className="pointer-events-none absolute inset-0 size-full object-cover"
            style={media}
          />
        )}
      </div>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="flex justify-between text-muted-foreground">
          <span>Zoom</span>
          <span className="tabular-nums">{value.zoom.toFixed(2)}×</span>
        </span>
        <input
          type="range"
          min={MIN_ZOOM}
          max={MAX_ZOOM}
          step={0.01}
          value={value.zoom}
          onChange={(e) => commit({ zoom: Number(e.target.value) })}
          aria-label="Zoom"
          className="w-full"
        />
      </label>

      <div className="flex items-center gap-2 text-muted-foreground text-xs">
        <span>Drag to reposition · pinch or ctrl-scroll to zoom</span>
        {!isDefault ? (
          <button
            type="button"
            onClick={() => onChange({ ...DEFAULT_MEDIA_FRAME })}
            className="rounded px-1.5 py-0.5 text-foreground/80 transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            Reset
          </button>
        ) : null}
      </div>
    </div>
  );
}
