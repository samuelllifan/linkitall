"use client";

import { useState } from "react";
import { MusicEditor } from "~/components/music-editor";
import { MusicPlayer } from "~/components/music-player";
import { DEFAULT_MUSIC_CONFIG, type MusicConfig } from "~/lib/music";

export function TestMusicClient() {
  const [config, setConfig] = useState<MusicConfig>(DEFAULT_MUSIC_CONFIG);
  const volumePct = Math.round(config.initialVolume * 100);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      {/* ---- Editor ---- */}
      <div className="rounded-xl border border-border bg-card p-5">
        <MusicEditor value={config} onChange={setConfig} />
      </div>

      {/* ---- Live preview ---- */}
      <div className="flex flex-col gap-3">
        <div className="lg:sticky lg:top-6">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-semibold text-foreground text-sm">
              Visitor preview
            </h2>
            <span className="text-muted-foreground text-xs">
              {config.display}
            </span>
          </div>
          <div className="flex justify-center rounded-2xl border border-border bg-gradient-to-b from-slate-800 to-slate-950 p-6">
            <MusicPlayer config={config} editing onChange={setConfig} />
          </div>
          <p className="mt-3 text-muted-foreground text-xs leading-relaxed">
            Edit the song right on the card — click the title, artist, album, or
            cover, and drag the slider under it to trim. The volume starts at{" "}
            <span className="text-foreground">{volumePct}%</span> for visitors.
          </p>
        </div>
      </div>
    </div>
  );
}
