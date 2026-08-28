"use client";

import { useEffect, useRef } from "react";

// A simple grid that comes alive around the cursor: cells within a radius of the
// pointer light up (constant size, no enlarge). Nothing animates on its own —
// the grid only reacts to the cursor. Canvas 2D (no WebGL) so it's safe on every
// platform; the base grid is drawn as a few full-width/height lines and only the
// ~cells near the cursor get the expensive per-cell treatment, so it stays cheap.
// Deliberately not gated on prefers-reduced-motion (see globals.css).
export function InteractiveGrid({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const CELL = 72; // grid cell size (CSS px)
    const RADIUS = 240; // cursor influence radius

    let w = 0;
    let h = 0;
    // Easing time constants, in ms, matching the --dur-fast / --dur-slow tiers in
    // globals.css. Used as `1 - exp(-dt / TAU)` so the follow is TIME-based: the
    // old per-frame `* 0.1` settled twice as fast on a 120Hz display as on a
    // 60Hz one, which made the hero's most tactile element feel different per
    // machine while every CSS transition on the page is identical everywhere.
    const FOLLOW_TAU = 150; // cursor chase
    const GLOW_TAU = 300; // the glow blooming in and back out

    let px = -9999;
    let py = -9999; // pointer target (canvas-local)
    let ex = -9999;
    let ey = -9999; // eased pointer
    let hasPointer = false;
    // 0 = no glow, 1 = full glow. Eased in BOTH directions so the light retreats
    // on the same curve it arrived on; it used to vanish in a single frame.
    let intensity = 0;
    let raf = 0;
    let last = 0;

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      w = r.width;
      h = r.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    // Resizing wipes the canvas, so wake the loop to repaint the base grid --
    // otherwise an idle grid would come back blank after a window resize.
    const ro = new ResizeObserver(() => {
      resize();
      kick();
    });
    ro.observe(canvas);

    const draw = (now: number) => {
      // Clamp dt: a backgrounded tab can hand us a gap of many seconds, and an
      // un-clamped exponential would snap straight to the target on return.
      const dt = Math.min(now - (last || now), 50);
      last = now;

      const followK = 1 - Math.exp(-dt / FOLLOW_TAU);
      ex += (px - ex) * followK;
      ey += (py - ey) * followK;

      const glowK = 1 - Math.exp(-dt / GLOW_TAU);
      intensity += ((hasPointer ? 1 : 0) - intensity) * glowK;

      ctx.clearRect(0, 0, w, h);

      // Base grid — a handful of lines, cheap. Kept a dim gray so the backdrop
      // stays near-black rather than glowing.
      ctx.strokeStyle = "rgba(148,150,158,0.09)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = CELL; x < w; x += CELL) {
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, h);
      }
      for (let y = CELL; y < h; y += CELL) {
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(w, y + 0.5);
      }
      ctx.stroke();

      // Cells near the cursor. Skipped outright once the glow is fully out, so
      // an idle grid costs nothing beyond the base lines above.
      if (intensity > 0.002) {
        const i0 = Math.max(0, Math.floor((ex - RADIUS) / CELL));
        const i1 = Math.ceil((ex + RADIUS) / CELL);
        const j0 = Math.max(0, Math.floor((ey - RADIUS) / CELL));
        const j1 = Math.ceil((ey + RADIUS) / CELL);
        for (let i = i0; i <= i1; i++) {
          for (let j = j0; j <= j1; j++) {
            const cx = i * CELL + CELL / 2;
            const cy = j * CELL + CELL / 2;
            const dx = cx - ex;
            const dy = cy - ey;
            const dist = Math.hypot(dx, dy);
            const t = 1 - dist / RADIUS;
            if (t <= 0) continue;
            // Scaled by `intensity` so the whole glow fades in and out together.
            const e = t * t * intensity; // ease
            // Constant-size cell that only brightens near the cursor (no enlarge).
            const size = CELL * 0.82;
            const half = size / 2;
            ctx.fillStyle = `rgba(255,255,255,${0.2 * e})`;
            ctx.beginPath();
            ctx.roundRect(cx - half, cy - half, size, size, 6);
            ctx.fill();
            if (e > 0.55) {
              // faint brand tint only on the cells right under the cursor
              ctx.fillStyle = `rgba(167,139,250,${(e - 0.55) * 0.32})`;
              ctx.fill();
            }
          }
        }
      }

      // Stop once BOTH eased values have converged on their targets, leaving this
      // steady frame on the canvas; a pointer event restarts the loop (`kick`).
      // Note the target is `hasPointer ? 1 : 0`, not 0 — testing only for "faded
      // out" meant that a cursor merely resting inside the window held intensity
      // at 1 forever, so the loop never idled and kept clearing and re-stroking
      // the whole DPR-scaled canvas ~60x a second. That permanent main-thread
      // cost, on a page already running four marquee rows and 48 page previews,
      // is the thing this bail-out exists to remove.
      // The check has to come AFTER the glow is drawn, or the frame left behind
      // when the cursor settles would be the base grid with no glow on it.
      const target = hasPointer ? 1 : 0;
      if (
        Math.abs(intensity - target) < 0.002 &&
        Math.hypot(px - ex, py - ey) < 0.5
      ) {
        intensity = target;
        ex = px;
        ey = py;
        raf = 0;
        return;
      }
      raf = requestAnimationFrame(draw);
    };

    // Restart the loop if it has idled out. `last = 0` so the next frame measures
    // its own dt instead of inheriting a stale timestamp.
    const kick = () => {
      if (raf === 0) {
        last = 0;
        raf = requestAnimationFrame(draw);
      }
    };

    const onMove = (ev: PointerEvent) => {
      // Mouse (and pen) only. Touch has no counterpart to `mouseleave`, so a
      // single tap anywhere — including scrolling the page — would latch
      // `hasPointer` on for good, and the loop below would then never reach its
      // idle condition: a full canvas repaint every frame for the life of the
      // page, on exactly the devices that can least afford it. A cursor glow has
      // nothing to track on a touchscreen anyway.
      if (ev.pointerType !== "mouse" && ev.pointerType !== "pen") return;

      const r = canvas.getBoundingClientRect();
      px = ev.clientX - r.left;
      py = ev.clientY - r.top;
      // First sighting: drop the eased position onto the pointer instead of
      // letting it fly in from the -9999 sentinel.
      if (!hasPointer) {
        ex = px;
        ey = py;
      }
      hasPointer = true;
      kick();
    };
    const onLeave = () => {
      hasPointer = false;
      kick(); // run the fade-out rather than cutting the glow
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onMove, { passive: true });
    document.addEventListener("mouseleave", onLeave);

    // Paint the base grid SYNCHRONOUSLY rather than waiting for a frame. With
    // no pointer yet this draws once and idles immediately (see the bail-out in
    // `draw`), so it costs exactly one paint -- and it means the grid is never
    // blank, including in a background tab where requestAnimationFrame is
    // suspended and the first frame might otherwise never arrive.
    draw(performance.now());

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onMove);
      document.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden className={className} />;
}
