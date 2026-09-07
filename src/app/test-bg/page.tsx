"use client";

/**
 * Scratch harness for tuning the shader backgrounds. Not linked from anywhere —
 * same role as /test-music and /test-enter. Renders every shader at a readable
 * size with live controls, plus sample page text over one of them so the
 * contrast can be judged against the thing these actually sit behind.
 */

import { useState } from "react";
import { ShaderSurface } from "~/components/shader-background";
import { AURORA_FRAG, RIPPLE_FRAG } from "~/lib/background-shaders";

type Preset = {
  name: string;
  frag: string;
  uniforms: Record<string, number | string>;
  base: string;
  speed: number;
};

const PRESETS: Preset[] = [
  {
    name: "Aurora",
    frag: AURORA_FRAG,
    uniforms: { u_light: "#e6e6e6", u_dark: "#000000" },
    base: "#000000",
    speed: 5,
  },
  {
    name: "Ripple",
    frag: RIPPLE_FRAG,
    uniforms: { u_base: "#0a0a0a", u_glow: "#e6e6e6", u_scale: 3 },
    base: "#0a0a0a",
    speed: 5,
  },
];

function Tile({ preset }: { preset: Preset }) {
  const [speed, setSpeed] = useState(preset.speed);
  const [uniforms, setUniforms] = useState(preset.uniforms);
  const numbers = Object.entries(uniforms).filter(
    ([, v]) => typeof v === "number",
  ) as [string, number][];
  const colors = Object.entries(uniforms).filter(
    ([, v]) => typeof v === "string",
  ) as [string, string][];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-sm">{preset.name}</h2>
        <div className="flex items-center gap-2">
          {colors.map(([k, v]) => (
            <input
              key={k}
              type="color"
              value={v}
              title={k}
              onChange={(e) =>
                setUniforms((u) => ({ ...u, [k]: e.target.value }))
              }
              className="size-6 rounded border border-border bg-transparent"
            />
          ))}
        </div>
      </div>
      <div className="relative h-[480px] w-full overflow-hidden rounded-xl border border-border">
        <ShaderSurface
          frag={preset.frag}
          uniforms={uniforms}
          speed={speed}
          baseColor={
            (uniforms.u_base as string) ??
            (uniforms.u_dark as string) ??
            preset.base
          }
        />
        {/* Sample content, so contrast is judged against real page text. */}
        <div className="relative z-10 flex h-full flex-col items-center justify-center gap-2 text-white">
          <div className="size-16 rounded-full bg-white/20" />
          <p className="font-semibold text-xl drop-shadow">creator</p>
          <p className="text-sm text-white/80 drop-shadow">
            Editor and streamer. Clips daily.
          </p>
          <div className="mt-2 w-52 rounded-lg border border-white/15 bg-black/30 py-2 text-center text-sm backdrop-blur-sm">
            Portfolio
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-1 font-mono text-xs">
        <label className="flex items-center gap-2">
          <span className="w-24 shrink-0 text-muted-foreground">speed</span>
          <input
            type="range"
            min={0}
            max={10}
            step={1}
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            className="flex-1"
          />
          <span className="w-10 text-right">{speed}</span>
        </label>
        {numbers.map(([k, v]) => (
          <label key={k} className="flex items-center gap-2">
            <span className="w-24 shrink-0 text-muted-foreground">
              {k.replace("u_", "")}
            </span>
            <input
              type="range"
              min={1}
              max={12}
              step={1}
              value={v}
              onChange={(e) =>
                setUniforms((u) => ({ ...u, [k]: Number(e.target.value) }))
              }
              className="flex-1"
            />
            <span className="w-10 text-right">{v}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

export default function TestBackgrounds() {
  return (
    <main className="mx-auto max-w-[100rem] px-6 py-10">
      <h1 className="mb-6 font-bold text-2xl">Background shaders</h1>
      <div className="grid grid-cols-1 gap-8">
        {PRESETS.map((p) => (
          <Tile key={p.name} preset={p} />
        ))}
      </div>
    </main>
  );
}
