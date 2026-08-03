/**
 * Data model for the page "music player" feature: a track's display metadata,
 * where its audio comes from, and the editor-chosen playback defaults. Kept
 * framework-agnostic (no React) so it can be shared by the editor, the visitor
 * player, and the `/api/spotify` metadata route.
 */

// Type-only import (erased at compile time), so this stays React/DOM-free while
// reusing the app's shared TextStyle shape for per-field typography.
import type { TextStyle } from "~/lib/pages";

/** Where the actual audio the player plays comes from. */
export type AudioSource =
  /** No playable audio (e.g. a Spotify track we can only show metadata for). */
  | { kind: "none" }
  /** An uploaded/hosted audio file — full playback. `src` is a data or https URL. */
  | { kind: "file"; src: string; fileName?: string }
  /** A Spotify 30-second preview clip, when the Web API returns one. */
  | { kind: "spotify-preview"; src: string };

/** A track's displayable details, from Spotify or entered by hand for uploads. */
export interface TrackMeta {
  title: string;
  artist: string;
  album?: string;
  /** Album cover — an https URL (Spotify CDN) or an uploaded data URL. */
  albumArt?: string;
  /** Release date as returned by Spotify (YYYY, YYYY-MM, or YYYY-MM-DD). */
  releaseDate?: string;
  /**
   * Track length in seconds. Used to render the progress bar's total time when
   * there's no seekable audio element (metadata-only Spotify tracks); real
   * audio reports its own duration and overrides this.
   */
  durationSec?: number;
  /** The original Spotify track URL, when imported from Spotify. */
  spotifyUrl?: string;
}

/**
 * How the player is presented on the live page:
 * - `hidden` — no full player; the track plays with only a small floating
 *   play/mute control so visitors can still silence it.
 * - `panel` — the full player card sits on its own, below the profile block.
 * - `integrated` — the full player card sits inside the profile panel, in the
 *   same column as the name/bio/links.
 */
export type MusicDisplay = "hidden" | "panel" | "integrated";

export interface MusicConfig {
  /** Master on/off — when false the player isn't shown at all. */
  enabled: boolean;
  /** Where/how the player appears on the live page. */
  display: MusicDisplay;
  meta: TrackMeta;
  audio: AudioSource;
  /**
   * The volume the slider starts at for a visitor, 0–1. This is a real volume
   * value: the slider thumb sits here on load and a visitor can drag it the full
   * 0–100% range from there — the editor's choice is the starting point, not a
   * ceiling that rescales the track.
   */
  initialVolume: number;
  /** Attempt to play on load. Browsers may still block until a user gesture. */
  autoplay: boolean;
  /** Loop the track when it ends. */
  loop: boolean;
  /**
   * Optional playback segment, in seconds. When set, playback starts at
   * `clipStart` and stops (or, when `loop` is on, restarts) at `clipEnd` instead
   * of playing the whole track. Both undefined ⇒ play the entire song.
   */
  clipStart?: number;
  clipEnd?: number;
  /** Per-field typography (font/size/style/align/color), like a link's text. */
  titleStyle?: TextStyle;
  artistStyle?: TextStyle;
  albumStyle?: TextStyle;
}

/**
 * Default per-field typography, shared by the player (render) and the editor
 * (controls) so an untouched field looks identical in both. A field's own
 * TextStyle overrides these.
 */
export const DEFAULT_TITLE_STYLE: TextStyle = {
  fontSize: 16,
  bold: true,
  align: "left",
};
export const DEFAULT_ARTIST_STYLE: TextStyle = { fontSize: 14, align: "left" };
export const DEFAULT_ALBUM_STYLE: TextStyle = { fontSize: 12, align: "left" };

/** A sensible empty player config for a fresh editor session. */
export const DEFAULT_MUSIC_CONFIG: MusicConfig = {
  enabled: true,
  display: "panel",
  meta: { title: "", artist: "" },
  audio: { kind: "none" },
  initialVolume: 0.5,
  autoplay: false,
  loop: true,
};

/** Normalized track metadata returned by the `/api/spotify` route. */
export interface SpotifyTrackInfo {
  title: string;
  artist: string;
  album?: string;
  albumArt?: string;
  releaseDate?: string;
  durationSec?: number;
  /** 30-second preview clip (mp3), when Spotify provides one. */
  previewUrl?: string;
  spotifyUrl: string;
  /**
   * How the data was resolved: `api` = full metadata from the Spotify Web API
   * (needs server credentials); `embed` = the no-auth embed page, which yields
   * the title, artist, cover, date, and often a real preview clip; `oembed` =
   * the last-resort fallback, which only yields the title and cover art.
   */
  source: "api" | "embed" | "oembed";
}

/**
 * Extract the 22-character base-62 track id from any Spotify track reference:
 * an open.spotify.com URL (including localized `/intl-xx/` paths and `?si=`
 * tracking params) or a `spotify:track:...` URI. Returns null when there's no
 * track id, so callers can reject non-track links (albums, playlists, artists).
 */
export function parseSpotifyTrackId(input: string): string | null {
  if (!input) return null;
  const match = input.trim().match(/track[/:]([A-Za-z0-9]{22})/);
  return match ? match[1] : null;
}

/** The canonical public URL for a Spotify track id. */
export function spotifyTrackUrl(id: string): string {
  return `https://open.spotify.com/track/${id}`;
}

/** Format a number of seconds as `m:ss` (or `mm:ss`). Guards NaN/negatives. */
export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Like {@link formatTime} but with tenths of a second (`m:ss.d`), for the
 * precise clip endpoints in the editor.
 */
export function formatClipTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00.0";
  const tenths = Math.floor(seconds * 10) / 10;
  const m = Math.floor(tenths / 60);
  const s = Math.floor(tenths % 60);
  const d = Math.round((tenths - Math.floor(tenths)) * 10);
  return `${m}:${s.toString().padStart(2, "0")}.${d}`;
}

/**
 * Parse a `m:ss` / `mm:ss` time string (or a plain seconds count) into seconds.
 * Empty or unparseable input ⇒ undefined, so a half-typed field clears the clip
 * rather than snapping to a bogus time.
 */
export function parseTime(input: string): number | undefined {
  const s = input.trim();
  if (!s) return undefined;
  if (s.includes(":")) {
    const parts = s.split(":");
    if (parts.length !== 2) return undefined;
    const m = Number(parts[0]);
    const sec = Number(parts[1]);
    if (!Number.isFinite(m) || !Number.isFinite(sec)) return undefined;
    return Math.max(0, m * 60 + sec);
  }
  const n = Number(s);
  return Number.isFinite(n) ? Math.max(0, n) : undefined;
}

/** The year portion of a Spotify release date (YYYY-…), or undefined. */
export function releaseYear(releaseDate?: string): string | undefined {
  if (!releaseDate) return undefined;
  const m = releaseDate.match(/^(\d{4})/);
  return m ? m[1] : undefined;
}

/** Clamp a number into [min, max]. */
export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
