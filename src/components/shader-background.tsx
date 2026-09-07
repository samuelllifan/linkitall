"use client";

import { useEffect, useMemo, useRef } from "react";

/**
 * Shared WebGL plumbing for the shader-driven page backgrounds (Aurora and
 * Ripple).
 *
 * This was lifted out of `profile-view.tsx`'s `AuroraCanvas`, which was the only
 * shader background when it was written. A copy of context creation,
 * compile-and-link, DPR resize handling and teardown per shader is not a thing
 * worth having, and the failure modes it protects against (see the notes on each
 * step below) are exactly the ones that get silently dropped on the next copy.
 *
 * The one behavioural change from that original: uniforms no longer live in the
 * setup effect's dependency list. The old canvas rebuilt the entire GL context —
 * new context, recompiled shaders, relinked program — on every change to
 * `color`, `baseColor` or `speed`. On a page that is just displaying a
 * background that is invisible, because those change once. In the Studio, where
 * a creator drags a Speed slider, it meant a context teardown and rebuild per
 * pointer-move event, and browsers cap live WebGL contexts (~16) and drop the
 * oldest when you exceed it. Here the program is built once per shader and
 * uniform values are pushed through a ref, so dragging a slider costs a
 * `uniform3fv` and a repaint.
 */

/** A uniform value: a number becomes a `float`, a hex string a `vec3` in 0–1. */
export type UniformValue = number | string;

/** One full-screen triangle in clip space; every background shades per-pixel. */
const SHADER_VERT = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

/**
 * Parse a `#rgb` / `#rrggbb` hex string into normalized [r, g, b] (0–1).
 * Tolerates missing/invalid input (returns black) so a malformed saved
 * background can never crash shader setup.
 */
export function hexToRgb(hex: string): [number, number, number] {
  const h = (typeof hex === "string" ? hex : "").replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h.padEnd(6, "0").slice(0, 6);
  const n = Number.parseInt(full, 16);
  if (Number.isNaN(n)) return [0, 0, 0];
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  src: string,
): WebGLShader | null {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.warn("background shader compile failed:", gl.getShaderInfoLog(sh));
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

/**
 * Renders a fragment shader across its positioned parent, animating while
 * `speed > 0`.
 *
 * Every shader here gets `u_resolution`, `u_time` and `u_dpr`; anything in `uniforms` is
 * looked up by name and pushed as a `float` (number) or `vec3` (hex string).
 * `baseColor` is also painted as the canvas's CSS background, so a browser with
 * no WebGL at all degrades to the flat fill the design is built on rather than
 * to a transparent hole.
 *
 * Time is scaled by `speed * 0.08` — the rate Aurora was tuned at, kept as the
 * shared unit so a Speed of 5 means the same pace in every background. Each
 * shader is written so that every one of its time terms vanishes at `t = 0`
 * (`sin(0) = 0`, phases `+ t * k`, `stretch = 1`), which is what makes the
 * `speed: 0` frame the deliberately tuned static composition rather than an
 * arbitrary moment — and what lets the share-card stills be exact CPU ports at
 * `t = 0`.
 */
export function ShaderCanvas({
  frag,
  uniforms,
  speed,
  baseColor,
}: {
  frag: string;
  uniforms: Record<string, UniformValue>;
  speed: number;
  baseColor: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Latest values for the draw loop and for the push-on-change effect below,
  // deliberately OUTSIDE the setup effect's deps so neither rebuilds the context.
  const uniformsRef = useRef(uniforms);
  uniformsRef.current = uniforms;
  const speedRef = useRef(speed);
  speedRef.current = speed;
  // Assigned by the setup effect; lets the uniform effect repaint a static
  // (speed 0) canvas, which has no animation loop to pick the change up.
  const applyRef = useRef<(() => void) | null>(null);

  // A stable key for the uniform values, so the push effect fires on a changed
  // VALUE rather than on the new object identity every render produces.
  const uniformKey = useMemo(
    () =>
      Object.keys(uniforms)
        .sort()
        .map((k) => `${k}:${uniforms[k]}`)
        .join("|"),
    [uniforms],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { alpha: false, antialias: false });
    if (!gl) return;

    const vs = compileShader(gl, gl.VERTEX_SHADER, SHADER_VERT);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, frag);
    if (!vs || !fs) return;
    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.warn(
        "background program link failed:",
        gl.getProgramInfoLog(program),
      );
      return;
    }
    // Activate via a bound reference rather than calling `gl.useProgram(...)`
    // directly: Biome's useHookAtTopLevel rule reads that call as a misplaced
    // React hook (the `use*` name) and will not accept an inline suppression.
    const activateProgram = gl.useProgram.bind(gl);
    activateProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    // One oversized triangle covering the whole of clip space.
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    );
    const aPos = gl.getAttribLocation(program, "a_pos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(program, "u_resolution");
    const uTime = gl.getUniformLocation(program, "u_time");
    // Device pixels per CSS pixel. No current shader reads it — it is part of
    // the canvas's uniform contract rather than any one shader's — but any
    // shader wanting a real-world line weight needs it: `u_resolution` is in
    // device pixels, so a "2px" line written against that alone renders at 1 CSS
    // px on a retina screen and 2 on a laptop. Setting an absent uniform is a
    // no-op (the location comes back null), so it costs nothing to keep.
    const uDpr = gl.getUniformLocation(program, "u_dpr");
    // Locations are per-program, so they're resolved once here and reused by
    // every later value push.
    const custom = new Map<string, WebGLUniformLocation | null>();
    for (const name of Object.keys(uniformsRef.current)) {
      custom.set(name, gl.getUniformLocation(program, name));
    }

    const pushUniforms = () => {
      for (const [name, value] of Object.entries(uniformsRef.current)) {
        const loc = custom.get(name);
        if (loc == null) continue;
        if (typeof value === "number") gl.uniform1f(loc, value);
        else gl.uniform3fv(loc, hexToRgb(value));
      }
    };

    let raf = 0;
    let startTime = 0;
    // Accumulated shader time. Tracked rather than derived from elapsed
    // wall-clock so that changing Speed mid-animation changes the RATE from
    // here on instead of instantly jumping the phase to a new position.
    let shaderTime = 0;
    let lastNow = 0;

    const draw = (t: number) => {
      gl.uniform1f(uTime, t);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.floor(canvas.clientWidth * dpr));
      const h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      gl.viewport(0, 0, w, h);
      gl.uniform2f(uRes, w, h);
      gl.uniform1f(uDpr, dpr);
      // Always paint at least one frame, so the surface shows even when the
      // animation loop is throttled (a background/hidden tab) or absent (speed 0).
      pushUniforms();
      draw(shaderTime);
    };

    const frame = (now: number) => {
      if (!startTime) {
        startTime = now;
        lastNow = now;
      }
      shaderTime += ((now - lastNow) / 1000) * speedRef.current * 0.08;
      lastNow = now;
      pushUniforms();
      draw(shaderTime);
      raf = requestAnimationFrame(frame);
    };

    // Repaint on demand for a static canvas whose colours just changed.
    applyRef.current = () => {
      pushUniforms();
      draw(shaderTime);
    };

    resize();

    // Observe the ELEMENT, not just the window.
    //
    // A window listener alone is not enough, and the failure is silent: a canvas
    // that mounts at zero size (the Studio's preview pane, which is laid out
    // after mount) gets `Math.max(1, ...)` = a 1x1 backing store, and nothing
    // ever re-measures it because the window never resized. The result is one
    // pixel of shader stretched across the whole pane — a flat wash of colour
    // that looks like a broken background rather than an unsized one.
    //
    // The old AuroraCanvas hid this by rebuilding the entire GL context whenever
    // a colour or speed prop changed, which re-ran `resize()` as a side effect.
    // Now that uniforms no longer tear the context down, the canvas has to watch
    // its own box. This also covers the cases a window listener never did: the
    // device toggle animating the preview column's width, and a panel collapsing
    // beside it.
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(resize);
    observer?.observe(canvas);
    // Kept alongside the observer: a ResizeObserver does NOT fire when only the
    // devicePixelRatio changes (dragging the window to a different-density
    // display, or a browser zoom), and the backing store is scaled by DPR.
    window.addEventListener("resize", resize);
    // Speed is read live from a ref, so the loop runs whenever the shader might
    // animate at all. Starting it only for the CURRENT speed would leave a
    // canvas frozen when a creator drags Speed up from 0.
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      observer?.disconnect();
      window.removeEventListener("resize", resize);
      applyRef.current = null;
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.deleteBuffer(buffer);
      // Deliberately NOT `WEBGL_lose_context.loseContext()` here.
      //
      // That extension kills the context for the CANVAS ELEMENT, not just for
      // this closure's handle on it, and there is no matching restore on the
      // next mount — `canvas.getContext("webgl")` returns the same, still-lost
      // context, so everything after it silently no-ops and the canvas
      // composites as a blank rectangle. React re-runs this effect on the same
      // element in two ordinary situations: StrictMode's development
      // double-invoke, and a `frag` change when a creator switches background
      // type. Both left a permanently dead canvas.
      //
      // Nothing leaks without it. A canvas owns exactly one context for its
      // lifetime, so re-running this effect REUSES that context rather than
      // allocating another — the deletes above are what actually need doing —
      // and when the component unmounts the element and its context are
      // collected together.
    };
  }, [frag]);

  // Push changed colours/settings without rebuilding anything. The animation
  // loop pushes them itself each frame; this is what covers a static canvas.
  //
  // `uniformKey` is the TRIGGER, not an input — the body reads the live values
  // off `uniformsRef` instead, precisely so that changing a colour repaints
  // rather than rebuilding the GL context. Biome sees a dependency the body
  // never mentions and offers to remove it, which would stop a static canvas
  // updating at all.
  // biome-ignore lint/correctness/useExhaustiveDependencies: uniformKey is the repaint trigger; values are read from a ref
  useEffect(() => {
    applyRef.current?.();
  }, [uniformKey]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="absolute inset-0 h-full w-full"
      style={{ backgroundColor: baseColor }}
    />
  );
}

/**
 * A shader surface filling its positioned parent, over a solid `baseColor` so
 * there is never a transparent gap before the canvas paints its first frame.
 */
export function ShaderSurface({
  frag,
  uniforms,
  speed,
  baseColor,
}: {
  frag: string;
  uniforms: Record<string, UniformValue>;
  speed: number;
  baseColor: string;
}) {
  return (
    <div
      aria-hidden
      className="absolute inset-0 overflow-hidden"
      style={{ backgroundColor: baseColor }}
    >
      <ShaderCanvas
        frag={frag}
        uniforms={uniforms}
        speed={speed}
        baseColor={baseColor}
      />
    </div>
  );
}
