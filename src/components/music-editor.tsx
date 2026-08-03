"use client";

import { useCallback, useState } from "react";
import { baseName, readFileAsDataUrl } from "~/components/music-edit-controls";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  clamp,
  type MusicConfig,
  type MusicDisplay,
  releaseYear,
  type SpotifyTrackInfo,
} from "~/lib/music";
import { cn } from "~/lib/utils";

const FILE_INPUT_CLASS =
  "text-foreground text-sm file:mr-3 file:rounded-md file:border file:border-border file:bg-background file:px-3 file:py-1.5 file:font-medium file:text-foreground file:text-sm hover:file:bg-accent";

// ---------------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------------

/** A quiet section header, in the app's settings idiom. */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
      {children}
    </h3>
  );
}

/** A label + on/off switch row (autoplay / loop / enable). */
function ToggleRow({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 text-left"
    >
      <span className="flex flex-col">
        <span className="text-foreground text-sm">{label}</span>
        {hint ? (
          <span className="text-muted-foreground text-xs">{hint}</span>
        ) : null}
      </span>
      <span
        className={cn(
          "relative h-6 w-10 shrink-0 rounded-full transition-colors",
          checked ? "bg-primary" : "bg-input",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 size-5 rounded-full bg-background transition-transform",
            checked && "translate-x-4",
          )}
        />
      </span>
    </button>
  );
}

const DISPLAY_OPTIONS: { value: MusicDisplay; label: string }[] = [
  { value: "panel", label: "Own panel" },
  { value: "integrated", label: "In panel" },
  { value: "hidden", label: "Hidden" },
];

// ---------------------------------------------------------------------------
// MusicEditor — the settings dropdown: choose the audio source and tune where /
// how it plays. The song's title/artist/album/cover and the clip trim are
// edited directly on the player card (see MusicPlayer's editing mode).
// ---------------------------------------------------------------------------

export function MusicEditor({
  value,
  onChange,
}: {
  value: MusicConfig;
  onChange: (next: MusicConfig) => void;
}) {
  const [mode, setMode] = useState<"spotify" | "upload">(
    value.audio.kind === "file" ? "upload" : "spotify",
  );
  const [spotifyUrl, setSpotifyUrl] = useState(value.meta.spotifyUrl ?? "");
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [fetchNote, setFetchNote] = useState<string | null>(null);
  const [audioName, setAudioName] = useState<string | null>(
    value.audio.kind === "file" ? (value.audio.fileName ?? "Audio file") : null,
  );

  const update = useCallback(
    (patch: Partial<MusicConfig>) => onChange({ ...value, ...patch }),
    [onChange, value],
  );

  const importSpotify = useCallback(async () => {
    if (!spotifyUrl.trim()) return;
    setFetching(true);
    setFetchError(null);
    setFetchNote(null);
    try {
      const res = await fetch(
        `/api/spotify?url=${encodeURIComponent(spotifyUrl)}`,
        { cache: "no-store" },
      );
      const data = (await res.json()) as SpotifyTrackInfo | { error: string };
      if (!res.ok || "error" in data) {
        setFetchError(
          "error" in data ? data.error : "Couldn't import that track.",
        );
        return;
      }
      onChange({
        ...value,
        meta: {
          title: data.title,
          artist: data.artist,
          album: data.album,
          albumArt: data.albumArt,
          // Store just the year so the field reads cleanly ("1987", not
          // "1987-07-27T…"); the player only ever shows the year anyway.
          releaseDate: releaseYear(data.releaseDate) ?? data.releaseDate,
          // When a preview will play, its own 30s duration drives the progress
          // bar — keep the full-track length out so it doesn't flash 3:20 → 0:30.
          durationSec: data.previewUrl ? undefined : data.durationSec,
          spotifyUrl: data.spotifyUrl,
        },
        audio: data.previewUrl
          ? { kind: "spotify-preview", src: data.previewUrl }
          : { kind: "none" },
      });
      setAudioName(null);
      if (!data.previewUrl) {
        setFetchNote(
          "Got the song's details, but couldn't find a playable clip. Upload an audio file to play it, or leave it as a display-only card.",
        );
      } else {
        setFetchNote("Added the song — edit its details on the card.");
      }
    } catch {
      setFetchError("Network error reaching Spotify. Try again.");
    } finally {
      setFetching(false);
    }
  }, [spotifyUrl, onChange, value]);

  const onAudioFile = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      const src = await readFileAsDataUrl(file);
      setAudioName(file.name);
      onChange({
        ...value,
        audio: { kind: "file", src, fileName: file.name },
        meta: {
          ...value.meta,
          title: value.meta.title || baseName(file.name),
          durationSec: undefined,
        },
      });
    },
    [onChange, value],
  );

  const volumePct = Math.round(value.initialVolume * 100);

  return (
    <div className="flex flex-col gap-6">
      {/* Enable */}
      <ToggleRow
        label="Play music on my page"
        checked={value.enabled}
        onChange={(v) => update({ enabled: v })}
      />

      {/* Song source */}
      <div className="flex flex-col gap-3">
        <SectionLabel>Song</SectionLabel>
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          {(["spotify", "upload"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                "flex-1 rounded-md px-3 py-1.5 font-medium text-sm transition-colors",
                mode === m
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {m === "spotify" ? "Spotify link" : "Upload file"}
            </button>
          ))}
        </div>

        {mode === "spotify" ? (
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <Input
                value={spotifyUrl}
                onChange={(e) => setSpotifyUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void importSpotify();
                }}
                placeholder="Paste a Spotify song link…"
              />
              <Button
                onClick={() => void importSpotify()}
                disabled={fetching || !spotifyUrl.trim()}
              >
                {fetching ? "Adding…" : "Add"}
              </Button>
            </div>
            {fetchError ? (
              <p className="text-destructive text-xs">{fetchError}</p>
            ) : fetchNote ? (
              <p className="text-muted-foreground text-xs">{fetchNote}</p>
            ) : (
              <p className="text-muted-foreground text-xs">
                Spotify links play a short preview only. Upload a file for the
                full track.
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <span className="text-muted-foreground text-xs">
              Audio file (mp3, wav, ogg…)
            </span>
            <input
              type="file"
              accept="audio/*"
              onChange={(e) => void onAudioFile(e.target.files?.[0])}
              className={FILE_INPUT_CLASS}
            />
            {audioName ? (
              <span className="text-muted-foreground text-xs">
                Loaded: {audioName}
              </span>
            ) : null}
          </div>
        )}
      </div>

      {/* Display */}
      <div className="flex flex-col gap-2">
        <SectionLabel>Where it shows</SectionLabel>
        <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
          {DISPLAY_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => update({ display: o.value })}
              className={cn(
                "rounded-md px-2 py-1.5 font-medium text-sm transition-colors",
                value.display === o.value
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Playback */}
      <div className="flex flex-col gap-4">
        <SectionLabel>Playback</SectionLabel>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Starting volume</span>
            <span className="text-muted-foreground tabular-nums">
              {volumePct}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={volumePct}
            onChange={(e) =>
              update({
                initialVolume: clamp(Number(e.target.value) / 100, 0, 1),
              })
            }
            className="w-full"
            aria-label="Starting volume"
          />
        </div>
        <ToggleRow
          label="Autoplay on visit"
          hint="Browsers may require a tap before sound starts."
          checked={value.autoplay}
          onChange={(v) => update({ autoplay: v })}
        />
        <ToggleRow
          label="Loop"
          checked={value.loop}
          onChange={(v) => update({ loop: v })}
        />
      </div>
    </div>
  );
}
