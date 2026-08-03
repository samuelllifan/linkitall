"use client";

import {
  type CSSProperties,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  MusicClipEditor,
  readImageDownscaled,
} from "~/components/music-edit-controls";
import { styleToCss, textAnimClass } from "~/components/profile-view";
import { TextStyleEditor } from "~/components/text-style-editor";
import {
  clamp,
  DEFAULT_ALBUM_STYLE,
  DEFAULT_ARTIST_STYLE,
  DEFAULT_TITLE_STYLE,
  formatTime,
  type MusicConfig,
  releaseYear,
  type TrackMeta,
} from "~/lib/music";
import type { TextStyle } from "~/lib/pages";
import { cn } from "~/lib/utils";

// The player card is always dark, so text-color adaptation runs in dark mode.
const IS_DARK = true;

// The player's controls (progress fill, volume fill, play button) use a fixed
// neutral tint — accent-color customization was removed for now.
const ACCENT = "#ffffff";
const PLAY_ICON_COLOR = "#000000";

// Fade timings: a short ramp on play / pause / loop-in, a longer one for the
// music easing in when a visitor first arrives, and the window before a loop or
// segment end over which we fade out.
const FADE_MS = 220;
const ENTER_FADE_MS = 1100;
const LOOP_FADE_S = 0.4;

// ---------------------------------------------------------------------------
// Icons — small inline glyphs so the player has no icon-library dependency.
// ---------------------------------------------------------------------------

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M8 6a1 1 0 0 1 1.5-.87l10 6a1 1 0 0 1 0 1.74l-10 6A1 1 0 0 1 8 18z" />
    </svg>
  );
}

function PauseIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  );
}

function NoteIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M9 17.5a2.5 2.5 0 1 1-2.5-2.5c.55 0 1.06.18 1.5.47V6l10-2v9.5a2.5 2.5 0 1 1-1-2V5.28l-8 1.6V17.5z" />
    </svg>
  );
}

/** Volume glyph whose wave count reflects the level (muted / low / high). */
function VolumeIcon({
  level,
  className,
}: {
  level: "muted" | "low" | "high";
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M11 5 6 9H2v6h4l5 4V5z" fill="currentColor" />
      {level === "muted" ? (
        <>
          <path d="M22 9l-6 6" />
          <path d="M16 9l6 6" />
        </>
      ) : level === "low" ? (
        <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      ) : (
        <>
          <path d="M15.5 8.5a5 5 0 0 1 0 7" />
          <path d="M18.5 5.5a9 9 0 0 1 0 13" />
        </>
      )}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Slider helper
// ---------------------------------------------------------------------------

/** Inline `background` for a slider: filled with `accent` up to `pct`%. */
function sliderFill(pct: number, accent: string): string {
  const p = clamp(pct, 0, 100);
  const track = "rgba(255,255,255,0.16)";
  return `linear-gradient(to right, ${accent} 0%, ${accent} ${p}%, ${track} ${p}%, ${track} 100%)`;
}

// The player card's own classes (shared by view + edit; in edit mode the outer
// wrapper takes the caller's `className` instead).
const CARD_CLASS =
  "animate-music-in relative w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-black/40 p-3 text-white shadow-2xl backdrop-blur-xl";

/**
 * An inline, editable card text field styled with the track's own typography —
 * a little rounded box on the dark card that you click to edit (title / artist /
 * album). Module scope so it isn't a fresh component type each render (which
 * would blur the input on every keystroke).
 */
function EditField({
  value,
  onChange,
  onFocus,
  style,
  placeholder,
  ariaLabel,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  onFocus: () => void;
  style: TextStyle;
  placeholder?: string;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onFocus={onFocus}
      placeholder={placeholder}
      aria-label={ariaLabel}
      style={styleToCss(style, IS_DARK)}
      className={cn(
        "w-full min-w-0 rounded-md border border-white/20 bg-white/10 px-1.5 py-0.5 leading-tight outline-none transition-colors placeholder:font-normal placeholder:text-white/30 focus:border-white/60 focus:bg-white/15",
        textAnimClass(style),
        className,
      )}
    />
  );
}

// ---------------------------------------------------------------------------
// Player
// ---------------------------------------------------------------------------

/**
 * The visitor-facing music widget: album art, track details, a seekable
 * progress bar, play/pause, and a volume control.
 *
 * Volume model (per the feature spec): the slider is initialized to the
 * editor's {@link MusicConfig.initialVolume} — a real 0–1 volume value, not a
 * ceiling. A visitor drags it across the full range from there and can mute;
 * their changes are local and never rescale the track. When `initialVolume`
 * changes (e.g. the editor drags its own slider while previewing), the visitor
 * volume resets to the new starting point.
 */
export function MusicPlayer({
  config,
  className,
  variant = "full",
  editing = false,
  onChange,
}: {
  config: MusicConfig;
  className?: string;
  /**
   * `full` (default) is the album-art card. `mini` is a small floating pill
   * with just play/pause + mute — used for the "hidden" display mode so the
   * track still plays but there's no large player, only a way to silence it.
   */
  variant?: "full" | "mini";
  /** Edit mode: the card's title/artist/album/cover and clip become editable. */
  editing?: boolean;
  /** Called with the updated config when an inline edit changes something. */
  onChange?: (next: MusicConfig) => void;
}) {
  const { meta } = config;
  const audioSrc = config.audio.kind === "none" ? undefined : config.audio.src;
  const hasAudio = !!audioSrc;

  const audioRef = useRef<HTMLAudioElement>(null);

  const [volume, setVolume] = useState(() => clamp(config.initialVolume, 0, 1));
  const [muted, setMuted] = useState(false);
  const [loopOn, setLoopOn] = useState(config.loop);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [needsGesture, setNeedsGesture] = useState(false);

  // Inline editing (edit mode only): which metadata field's font toolbar is
  // open, plus the hidden cover file input.
  const edit = editing && !!onChange && variant === "full";
  const [fieldOpen, setFieldOpen] = useState<
    "title" | "artist" | "album" | null
  >(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  // Live refs so the (stable) autoplay handler applies the current volume
  // without being re-created — and thus re-triggering — on every drag.
  const volumeRef = useRef(volume);
  volumeRef.current = volume;
  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  // Refs for loop + clip so the media event handlers (attached once) read the
  // current values without being re-created on every change.
  const loopOnRef = useRef(loopOn);
  loopOnRef.current = loopOn;
  const clipStartRef = useRef(config.clipStart);
  clipStartRef.current = config.clipStart;
  const clipEndRef = useRef(config.clipEnd);
  clipEndRef.current = config.clipEnd;

  // Fade state: the element's volume = (muted ? 0 : volume) * fadeGain. Ramping
  // the gain gives smooth play/pause and loop transitions. (A plain <audio> can't
  // route through a Web Audio gain node — a cross-origin preview would taint it —
  // so we animate `audio.volume` directly via rAF.)
  const fadeGainRef = useRef(1);
  const fadeRafRef = useRef<number | null>(null);
  // True while a loop-edge fade-out is running, so it kicks off only once.
  const loopFadeRef = useRef(false);

  const applyVolume = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    const base = mutedRef.current ? 0 : clamp(volumeRef.current, 0, 1);
    a.volume = clamp(base * fadeGainRef.current, 0, 1);
  }, []);

  const fadeTo = useCallback(
    (target: number, ms: number, onDone?: () => void) => {
      if (fadeRafRef.current != null) {
        cancelAnimationFrame(fadeRafRef.current);
        fadeRafRef.current = null;
      }
      const from = fadeGainRef.current;
      if (ms <= 0 || Math.abs(target - from) < 0.001) {
        fadeGainRef.current = target;
        applyVolume();
        onDone?.();
        return;
      }
      let startTs: number | null = null;
      const tick = (now: number) => {
        if (startTs == null) startTs = now;
        const t = clamp((now - startTs) / ms, 0, 1);
        // ease-in-out for a natural ramp
        const eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
        fadeGainRef.current = from + (target - from) * eased;
        applyVolume();
        if (t < 1) {
          fadeRafRef.current = requestAnimationFrame(tick);
        } else {
          fadeGainRef.current = target;
          applyVolume();
          fadeRafRef.current = null;
          onDone?.();
        }
      };
      fadeRafRef.current = requestAnimationFrame(tick);
    },
    [applyVolume],
  );

  // Cancel any in-flight fade on unmount.
  useEffect(() => {
    return () => {
      if (fadeRafRef.current != null) cancelAnimationFrame(fadeRafRef.current);
    };
  }, []);

  // Reset the visitor's volume when the editor changes the starting point.
  const lastInitial = useRef(config.initialVolume);
  useEffect(() => {
    if (lastInitial.current !== config.initialVolume) {
      lastInitial.current = config.initialVolume;
      setVolume(clamp(config.initialVolume, 0, 1));
      setMuted(false);
    }
  }, [config.initialVolume]);

  // Reset loop to the editor's default when that default changes.
  const lastLoop = useRef(config.loop);
  useEffect(() => {
    if (lastLoop.current !== config.loop) {
      lastLoop.current = config.loop;
      setLoopOn(config.loop);
    }
  }, [config.loop]);

  // Push volume/mute onto the media element whenever they change (respecting the
  // current fade gain). A freshly mounted element gets its volume in
  // `onLoadedMetadata`. Native looping stays off — we loop manually so the volume
  // can fade across the seam. volume/muted drive the re-run (read via refs).
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-apply on volume/mute change
  useEffect(() => {
    applyVolume();
  }, [volume, muted, applyVolume]);

  // Reset the transport when the audio source changes (or clears), so a new or
  // metadata-only track doesn't show the previous track's elapsed/total time.
  // audioSrc is the change trigger, not read in the body.
  // biome-ignore lint/correctness/useExhaustiveDependencies: trigger-only dep
  useEffect(() => {
    setCurrentTime(0);
    setDuration(0);
    setPlaying(false);
  }, [audioSrc]);

  // Follow the clip start as the editor drags it: seek preview playback to the
  // new start so you hear the part you're landing on — Instagram-style
  // scrubbing. Fires only when clipStart changes (and only if a clip is set).
  useEffect(() => {
    const a = audioRef.current;
    if (!a || config.clipStart == null) return;
    if (Number.isFinite(a.duration)) {
      a.currentTime = clamp(config.clipStart, 0, a.duration);
    }
  }, [config.clipStart]);

  const attemptPlay = useCallback(
    async (fadeMs = FADE_MS) => {
      const a = audioRef.current;
      if (!a) return;
      // Keep playback inside the configured segment: if the head sits outside
      // it, snap to the segment start before playing.
      const cs = clipStartRef.current ?? 0;
      const ce = clipEndRef.current;
      if (
        Number.isFinite(a.duration) &&
        (a.currentTime < cs || (ce != null && a.currentTime >= ce))
      ) {
        a.currentTime = cs;
      }
      // Start from silence and fade in (over `fadeMs`).
      loopFadeRef.current = false;
      fadeGainRef.current = 0;
      applyVolume();
      try {
        await a.play();
        setNeedsGesture(false);
        // Re-assert silence in case a later `loadedmetadata` bumped the gain
        // while play() was pending, then ramp up — so the entrance always
        // fades from zero rather than snapping to full.
        fadeGainRef.current = 0;
        applyVolume();
        fadeTo(1, fadeMs);
      } catch {
        // Autoplay policies reject an un-gestured play(); surface the tap prompt.
        fadeGainRef.current = 1;
        applyVolume();
        setNeedsGesture(true);
      }
    },
    [applyVolume, fadeTo],
  );

  // Autoplay on load and whenever the audio source changes — the music eases in
  // over the longer entrance fade. Volume/mute are read via refs on purpose so
  // dragging them doesn't restart playback.
  useEffect(() => {
    if (!config.autoplay || !audioSrc) return;
    void attemptPlay(ENTER_FADE_MS);
  }, [audioSrc, config.autoplay, attemptPlay]);

  // If autoplay was blocked, start on the visitor's first interaction anywhere —
  // still eased in, since this is effectively the page's entrance.
  useEffect(() => {
    if (!needsGesture) return;
    const handler = () => void attemptPlay(ENTER_FADE_MS);
    window.addEventListener("pointerdown", handler);
    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("pointerdown", handler);
      window.removeEventListener("keydown", handler);
    };
  }, [needsGesture, attemptPlay]);

  const togglePlay = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      void attemptPlay();
    } else {
      // Fade out, then pause at silence.
      fadeTo(0, FADE_MS, () => {
        audioRef.current?.pause();
      });
    }
  }, [attemptPlay, fadeTo]);

  const onSeek = useCallback((value: number) => {
    const a = audioRef.current;
    if (a && Number.isFinite(a.duration)) {
      a.currentTime = value;
      setCurrentTime(value);
    }
  }, []);

  const onVolume = useCallback((value: number) => {
    setVolume(value);
    setMuted(false);
  }, []);

  const toggleMute = useCallback(() => setMuted((m) => !m), []);

  // Effective figures for display: real audio reports its own duration; a
  // metadata-only track falls back to the length Spotify reported.
  const effDuration = duration || meta.durationSec || 0;
  const volPct = (muted ? 0 : volume) * 100;
  const volLevel: "muted" | "low" | "high" =
    muted || volume === 0 ? "muted" : volume < 0.5 ? "low" : "high";

  // The progress bar spans the playable window: the whole track, or the clip
  // segment when one is set. Times read relative to that window.
  const dispStart =
    config.clipStart != null
      ? clamp(config.clipStart, 0, effDuration || config.clipStart)
      : 0;
  const dispEnd =
    config.clipEnd != null && config.clipEnd > dispStart
      ? config.clipEnd
      : effDuration;
  const dispLen = Math.max(0, dispEnd - dispStart);
  const dispCurrent = clamp(currentTime - dispStart, 0, dispLen);
  const progressPct = dispLen ? (dispCurrent / dispLen) * 100 : 0;

  const titleStyle = { ...DEFAULT_TITLE_STYLE, ...config.titleStyle };
  const artistStyle = { ...DEFAULT_ARTIST_STYLE, ...config.artistStyle };
  const albumStyle = { ...DEFAULT_ALBUM_STYLE, ...config.albumStyle };
  const year = releaseYear(meta.releaseDate);

  // Inline-edit helpers (no-ops unless an onChange was passed).
  const update = (patch: Partial<MusicConfig>) =>
    onChange?.({ ...config, ...patch });
  const updateMeta = (patch: Partial<TrackMeta>) =>
    onChange?.({ ...config, meta: { ...config.meta, ...patch } });
  const updateFieldStyle = (
    key: "titleStyle" | "artistStyle" | "albumStyle",
    patch: Partial<TextStyle>,
  ) => onChange?.({ ...config, [key]: { ...(config[key] ?? {}), ...patch } });
  const onCoverFile = async (file: File | undefined) => {
    if (!file) return;
    updateMeta({ albumArt: await readImageDownscaled(file) });
  };
  const isEmpty = !meta.title && !meta.albumArt && !hasAudio;

  // The media element is shared by both variants (its ref/state logic is the
  // same); only the surrounding controls differ.
  const audioEl = audioSrc ? (
    // biome-ignore lint/a11y/useMediaCaption: music track, no captions track
    <audio
      ref={audioRef}
      src={audioSrc}
      preload="auto"
      onPlay={() => setPlaying(true)}
      onPause={() => setPlaying(false)}
      onTimeUpdate={(e) => {
        const a = e.currentTarget;
        const cs = clipStartRef.current ?? 0;
        const ce = clipEndRef.current;
        const dur = Number.isFinite(a.duration)
          ? a.duration
          : Number.POSITIVE_INFINITY;
        // The playback window end: the clip end, or the whole track.
        const segEnd = ce != null ? ce : dur;
        if (Number.isFinite(segEnd)) {
          const remaining = segEnd - a.currentTime;
          if (remaining > LOOP_FADE_S) loopFadeRef.current = false;
          if (a.currentTime >= segEnd - 0.05) {
            // Reached the end: loop back with a fade-in, or stop.
            if (loopOnRef.current) {
              a.currentTime = cs;
              loopFadeRef.current = false;
              fadeGainRef.current = 0;
              applyVolume();
              fadeTo(1, FADE_MS);
            } else {
              a.pause();
              a.currentTime = cs;
            }
          } else if (remaining <= LOOP_FADE_S && !loopFadeRef.current) {
            // Fade out into the loop seam / stop.
            loopFadeRef.current = true;
            fadeTo(0, Math.max(60, remaining * 1000));
          }
        }
        setCurrentTime(a.currentTime);
      }}
      onLoadedMetadata={(e) => {
        const a = e.currentTarget;
        setDuration(Number.isFinite(a.duration) ? a.duration : 0);
        a.loop = false; // we loop manually so we can fade across the seam
        loopFadeRef.current = false;
        // Apply the current fade gain (don't force it to 1 — that would cut
        // short an entrance fade that started while metadata was still loading).
        applyVolume();
        // Start inside the segment when one is configured.
        const cs = clipStartRef.current;
        if (cs && Number.isFinite(a.duration)) {
          a.currentTime = Math.min(cs, a.duration);
        }
      }}
      onEnded={() => {
        const a = audioRef.current;
        if (!a) return;
        // Fallback if `timeupdate` didn't catch the end: manual loop with a fade.
        if (loopOnRef.current) {
          a.currentTime = clipStartRef.current ?? 0;
          fadeGainRef.current = 0;
          applyVolume();
          void a.play();
          fadeTo(1, FADE_MS);
        } else {
          setPlaying(false);
        }
      }}
    />
  ) : null;

  // Hidden display mode: a small floating pill so the track can still be
  // paused/muted, with no large player taking over the page.
  if (variant === "mini") {
    return (
      <div
        className={cn(
          "animate-music-in fixed bottom-4 left-4 z-40 flex items-center gap-2 rounded-full border border-white/10 bg-black/60 py-1.5 pr-3 pl-1.5 text-white shadow-2xl backdrop-blur-xl",
          className,
        )}
      >
        {audioEl}
        {meta.albumArt ? (
          // biome-ignore lint/performance/noImgElement: arbitrary remote/data URL
          <img
            src={meta.albumArt}
            alt=""
            className="size-8 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/50">
            <NoteIcon className="size-4" />
          </div>
        )}
        <button
          type="button"
          onClick={togglePlay}
          disabled={!hasAudio}
          aria-label={playing ? "Pause" : "Play"}
          className="flex size-8 shrink-0 items-center justify-center rounded-full transition-transform hover:scale-105 active:scale-95 disabled:opacity-40"
          style={{ backgroundColor: ACCENT, color: PLAY_ICON_COLOR }}
        >
          {playing ? (
            <PauseIcon className="size-4" />
          ) : (
            <PlayIcon className="size-4" />
          )}
        </button>
        <button
          type="button"
          onClick={toggleMute}
          disabled={!hasAudio}
          aria-label={muted ? "Unmute" : "Mute"}
          className="flex size-7 shrink-0 items-center justify-center text-white/70 transition-colors hover:text-white disabled:opacity-40"
        >
          <VolumeIcon level={volLevel} className="size-4" />
        </button>
        {needsGesture && !playing && (
          <span className="pr-1 text-[11px] text-white/70">Tap to play</span>
        )}
      </div>
    );
  }

  const card = (
    <div className={cn(CARD_CLASS, !edit && className)}>
      {/* Ambient glow: a large, blurred copy of the cover bleeding behind the
          card for a "now playing" feel. Purely decorative. */}
      {meta.albumArt && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 opacity-40"
          style={{
            backgroundImage: `url(${meta.albumArt})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: "blur(48px) saturate(1.4)",
            transform: "scale(1.4)",
          }}
        />
      )}

      {audioEl}

      {/* One compact horizontal strip: art · details+progress · play button */}
      <div className="flex items-center gap-3">
        {edit ? (
          <button
            type="button"
            onClick={() => coverInputRef.current?.click()}
            aria-label="Change cover"
            className="group relative aspect-square w-16 shrink-0 overflow-hidden rounded-lg bg-white/5 sm:w-20"
          >
            {meta.albumArt ? (
              // biome-ignore lint/performance/noImgElement: arbitrary remote/data URL
              <img
                src={meta.albumArt}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-white/25">
                <NoteIcon className="size-7" />
              </div>
            )}
            <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100">
              Change
            </span>
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => void onCoverFile(e.target.files?.[0])}
            />
          </button>
        ) : (
          <div className="relative aspect-square w-16 shrink-0 overflow-hidden rounded-lg bg-white/5 sm:w-20">
            {meta.albumArt ? (
              // biome-ignore lint/performance/noImgElement: arbitrary remote/data URL
              <img
                src={meta.albumArt}
                alt={meta.album ? `${meta.album} cover` : "Album cover"}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-white/25">
                <NoteIcon className="size-7" />
              </div>
            )}
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
          {edit ? (
            <>
              <EditField
                value={meta.title}
                onChange={(v) => updateMeta({ title: v })}
                onFocus={() => setFieldOpen("title")}
                style={titleStyle}
                placeholder="Song title"
                ariaLabel="Song title"
              />
              <EditField
                value={meta.artist}
                onChange={(v) => updateMeta({ artist: v })}
                onFocus={() => setFieldOpen("artist")}
                style={artistStyle}
                placeholder="Artist"
                ariaLabel="Artist"
              />
              <div className="flex gap-1">
                <EditField
                  value={meta.album ?? ""}
                  onChange={(v) => updateMeta({ album: v })}
                  onFocus={() => setFieldOpen("album")}
                  style={albumStyle}
                  placeholder="Album"
                  ariaLabel="Album"
                  className="flex-1"
                />
                <input
                  value={meta.releaseDate ?? ""}
                  onChange={(e) => updateMeta({ releaseDate: e.target.value })}
                  onFocus={() => setFieldOpen(null)}
                  placeholder="Year"
                  aria-label="Year"
                  inputMode="numeric"
                  className="w-14 shrink-0 rounded-md border border-white/20 bg-white/10 px-1.5 py-0.5 text-[11px] text-white/70 outline-none placeholder:text-white/30 focus:border-white/60 focus:bg-white/15"
                />
              </div>
            </>
          ) : (
            <>
              <p
                className={cn(
                  "truncate leading-tight",
                  textAnimClass(titleStyle),
                )}
                style={styleToCss(titleStyle, IS_DARK)}
              >
                {meta.title ||
                  (isEmpty ? "No song selected" : "Untitled track")}
              </p>
              <p
                className={cn(
                  "mt-0.5 truncate",
                  !artistStyle.color && "text-white/70",
                  textAnimClass(artistStyle),
                )}
                style={styleToCss(artistStyle, IS_DARK)}
              >
                {meta.artist || " "}
              </p>
              {(meta.album || year) && (
                <p
                  className={cn(
                    "mt-0.5 truncate",
                    !albumStyle.color && "text-white/45",
                    textAnimClass(albumStyle),
                  )}
                  style={styleToCss(albumStyle, IS_DARK)}
                >
                  {[meta.album, year].filter(Boolean).join(" · ")}
                </p>
              )}
            </>
          )}

          {/* Progress */}
          <div className="mt-2">
            <input
              type="range"
              min={dispStart}
              max={dispEnd || 1}
              step={0.1}
              value={clamp(currentTime, dispStart, dispEnd || 1)}
              disabled={!hasAudio}
              onChange={(e) => onSeek(Number(e.target.value))}
              aria-label="Seek"
              className="player-slider disabled:cursor-default disabled:opacity-70"
              style={
                {
                  background: sliderFill(progressPct, ACCENT),
                  "--accent": ACCENT,
                } as CSSProperties
              }
            />
            <div className="mt-1 flex justify-between text-[10px] text-white/55 tabular-nums">
              <span>{formatTime(dispCurrent)}</span>
              <span>{dispLen ? formatTime(dispLen) : "--:--"}</span>
            </div>
          </div>
        </div>

        {/* Play / pause — round, in the strip */}
        <button
          type="button"
          onClick={togglePlay}
          disabled={!hasAudio}
          aria-label={playing ? "Pause" : "Play"}
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-105 active:scale-95 disabled:cursor-default disabled:bg-white/20 disabled:text-white/50",
            needsGesture && !playing && "animate-pulse",
          )}
          style={
            hasAudio
              ? { backgroundColor: ACCENT, color: PLAY_ICON_COLOR }
              : undefined
          }
        >
          {playing ? (
            <PauseIcon className="size-5" />
          ) : (
            <PlayIcon className="size-5" />
          )}
        </button>
      </div>

      {/* Volume */}
      <div className="mt-2.5 flex items-center gap-3">
        <button
          type="button"
          onClick={toggleMute}
          disabled={!hasAudio}
          aria-label={muted ? "Unmute" : "Mute"}
          className="shrink-0 text-white/70 transition-colors hover:text-white disabled:opacity-40"
        >
          <VolumeIcon level={volLevel} className="size-5" />
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={muted ? 0 : volume}
          disabled={!hasAudio}
          onChange={(e) => onVolume(Number(e.target.value))}
          aria-label="Volume"
          className="player-slider disabled:cursor-default disabled:opacity-40"
          style={
            {
              background: sliderFill(volPct, ACCENT),
              "--accent": ACCENT,
            } as CSSProperties
          }
        />
      </div>
    </div>
  );

  if (!edit) return card;

  // Edit-mode extras below the card: the clip trim, and the active field's
  // typography toolbar (opens under the card, like editing a link's text).
  const openStyle =
    fieldOpen === "title"
      ? titleStyle
      : fieldOpen === "artist"
        ? artistStyle
        : fieldOpen === "album"
          ? albumStyle
          : null;
  const openKey =
    fieldOpen === "title"
      ? "titleStyle"
      : fieldOpen === "artist"
        ? "artistStyle"
        : fieldOpen === "album"
          ? "albumStyle"
          : null;
  const openDefaultSize =
    fieldOpen === "title"
      ? (DEFAULT_TITLE_STYLE.fontSize ?? 16)
      : fieldOpen === "artist"
        ? (DEFAULT_ARTIST_STYLE.fontSize ?? 14)
        : (DEFAULT_ALBUM_STYLE.fontSize ?? 12);

  return (
    <div className={cn("flex w-full max-w-lg flex-col gap-2", className)}>
      {card}
      {openStyle && openKey ? (
        <div className="animate-slide-up rounded-xl border border-border bg-popover p-3 text-popover-foreground">
          <TextStyleEditor
            style={openStyle}
            onChange={(patch) => updateFieldStyle(openKey, patch)}
            defaultSize={openDefaultSize}
          />
        </div>
      ) : null}
      {hasAudio ? (
        <div className="rounded-xl border border-border bg-card p-3 text-card-foreground">
          <p className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wider">
            Part to play
          </p>
          <MusicClipEditor
            duration={effDuration}
            albumArt={meta.albumArt}
            clipStart={config.clipStart}
            clipEnd={config.clipEnd}
            onChange={(cs, ce) => update({ clipStart: cs, clipEnd: ce })}
          />
        </div>
      ) : null}
    </div>
  );
}
