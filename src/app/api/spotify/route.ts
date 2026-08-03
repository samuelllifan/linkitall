import { type NextRequest, NextResponse } from "next/server";
import { env } from "~/env";
import {
  parseSpotifyTrackId,
  type SpotifyTrackInfo,
  spotifyTrackUrl,
} from "~/lib/music";

// Resolves display metadata for a Spotify track from a pasted link. Runs on the
// server so the app credentials (and the fetched token) never reach the client.
//
// Two paths:
//   1. Web API (preferred) — needs SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET.
//      Client Credentials flow yields a token good for full track metadata:
//      title, artist(s), album, cover art, release date, duration, and a 30s
//      preview clip when Spotify exposes one.
//   2. Embed page (fallback) — no auth. Parses the track's inlined JSON for the
//      title, artist, cover, release date, and (usually) a real preview clip.
//      Used when credentials aren't configured, and good enough that the feature
//      works fully without them.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Cached app token (Client Credentials), reused until shortly before expiry. */
let tokenCache: { token: string; expiresAt: number } | null = null;

/** Fetch (or reuse) a Spotify app access token. Null if creds are missing. */
async function getAppToken(): Promise<string | null> {
  const id = env.SPOTIFY_CLIENT_ID;
  const secret = env.SPOTIFY_CLIENT_SECRET;
  if (!id || !secret) return null;

  if (tokenCache && tokenCache.expiresAt > Date.now() + 5_000) {
    return tokenCache.token;
  }

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`token request failed (${res.status})`);

  const json = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };
  tokenCache = {
    token: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
  return tokenCache.token;
}

/** Shape of the subset of Spotify's track object we read. */
interface SpotifyApiTrack {
  name: string;
  duration_ms: number;
  preview_url: string | null;
  artists: { name: string }[];
  album: {
    name: string;
    release_date: string;
    images: { url: string; width: number }[];
  };
}

/** Resolve full metadata via the Web API. */
async function fromApi(id: string, token: string): Promise<SpotifyTrackInfo> {
  const res = await fetch(`https://api.spotify.com/v1/tracks/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`track request failed (${res.status})`);
  const t = (await res.json()) as SpotifyApiTrack;

  // Largest image first in Spotify's response; take it for the crispest cover.
  const albumArt = t.album.images[0]?.url;

  return {
    title: t.name,
    artist: t.artists.map((a) => a.name).join(", "),
    album: t.album.name,
    albumArt,
    releaseDate: t.album.release_date,
    durationSec: Math.round(t.duration_ms / 1000),
    previewUrl: t.preview_url ?? undefined,
    spotifyUrl: spotifyTrackUrl(id),
    source: "api",
  };
}

// Browser-like UA so Spotify serves the full embed HTML (with __NEXT_DATA__).
const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

/** The slice of the embed page's `__NEXT_DATA__` entity we read. */
interface EmbedEntity {
  name?: string;
  title?: string;
  artists?: { name?: string }[];
  releaseDate?: { isoString?: string };
  duration?: number;
  audioPreview?: { url?: string };
  visualIdentity?: { image?: { url?: string; maxWidth?: number }[] };
}

/**
 * No-auth resolver via Spotify's public embed page. Its inlined `__NEXT_DATA__`
 * JSON carries the exact track's title, ARTIST, cover, release date, and — for
 * most tracks — a real 30-second preview URL. Getting the right artist here is
 * what stops a same-title cover from being matched later (the reason a wrong
 * song could play). Album name isn't in this payload; iTunes backfills it.
 */
async function fromEmbed(id: string): Promise<SpotifyTrackInfo> {
  const res = await fetch(`https://open.spotify.com/embed/track/${id}`, {
    headers: { "User-Agent": BROWSER_UA },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`embed request failed (${res.status})`);
  const html = await res.text();

  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error("embed page missing __NEXT_DATA__");
  const parsed = JSON.parse(m[1]) as {
    props?: { pageProps?: { state?: { data?: { entity?: EmbedEntity } } } };
  };
  const entity = parsed.props?.pageProps?.state?.data?.entity;
  if (!entity) throw new Error("embed page missing entity");

  const title = entity.name ?? entity.title ?? "";
  const artist = (entity.artists ?? [])
    .map((a) => a.name)
    .filter(Boolean)
    .join(", ");
  // Largest available cover.
  const albumArt = (entity.visualIdentity?.image ?? [])
    .slice()
    .sort((a, b) => (b.maxWidth ?? 0) - (a.maxWidth ?? 0))[0]?.url;

  return {
    title,
    artist,
    albumArt,
    releaseDate: entity.releaseDate?.isoString,
    durationSec: entity.duration
      ? Math.round(entity.duration / 1000)
      : undefined,
    previewUrl: entity.audioPreview?.url,
    spotifyUrl: spotifyTrackUrl(id),
    source: "embed",
  };
}

// ---------------------------------------------------------------------------
// Playable audio — Apple iTunes Search preview (30-second AAC clip)
//
// Spotify licenses no anonymous full-track playback and its own `preview_url`
// is null for most tracks now. Apple's Search API needs no auth and returns a
// stable, non-expiring `.m4a` preview that plays in a plain <audio> element
// cross-origin. We resolve it from the track's title + primary artist. It is a
// 30-second clip — full-track playback is impossible without the visitor's own
// Premium session, so a preview is the ceiling for a public page.
// ---------------------------------------------------------------------------

// Version words that mark an alternate recording (live/remix/…). Used both to
// strip them from a title before matching and to penalize a result that carries
// one the query didn't ask for, so a studio track isn't handed a live clip.
const VERSION_WORDS =
  "feat|ft|featuring|with|remaster(?:ed)?|live|remix|mix|version|edit|mono|stereo|radio|acoustic|instrumental|karaoke|cover|tribute|deluxe|bonus|explicit|clean|demo|sped\\s?up|slowed|reverb|nightcore";
const VERSION_NOISE = new RegExp(`\\b(?:${VERSION_WORDS})\\b`, "i");

/**
 * Normalize a title for matching: drop only parenthetical/bracket groups that
 * are version noise (e.g. "(feat. X)", "(Remastered)", "[Explicit]") and any
 * trailing "- Live/Remaster/…" suffix. Legitimate title hooks that happen to be
 * parenthesized — "(I Can't Get No) Satisfaction" — are preserved.
 */
function cleanTitle(title: string): string {
  return title
    .replace(/\s*[([][^)\]]*[)\]]/g, (m) => (VERSION_NOISE.test(m) ? " " : m))
    .replace(new RegExp(`\\s*-\\s*(?:${VERSION_WORDS}).*$`, "i"), "")
    .replace(/\s+/g, " ")
    .trim();
}

interface ItunesResult {
  trackName?: string;
  artistName?: string;
  collectionName?: string;
  releaseDate?: string;
  previewUrl?: string;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Score how well an iTunes result matches the wanted track. Title is compared
 * after stripping version noise from BOTH sides, so "Song (Live)" no longer
 * counts as the studio "Song". Returns -1 for a non-match (no usable title
 * overlap). `titleExact` + a matched (or unknown) artist ⇒ safe to trust for
 * metadata backfill; that threshold is `CONFIDENT`.
 */
const CONFIDENT = 100;
function scoreItunes(
  r: ItunesResult,
  wantTitle: string,
  wantArtist: string,
  queryHasVersion: boolean,
): number {
  const rTitle = norm(cleanTitle(r.trackName ?? ""));
  const rArtist = norm(r.artistName ?? "");
  if (!rTitle || !wantTitle) return -1;
  const titleExact = rTitle === wantTitle;
  const titleLoose = rTitle.includes(wantTitle) || wantTitle.includes(rTitle);
  if (!titleLoose) return -1;

  let score = titleExact ? CONFIDENT : 40;
  if (wantArtist) {
    if (rArtist === wantArtist) score += 100;
    else if (rArtist.includes(wantArtist) || wantArtist.includes(rArtist))
      score += 50;
    else score -= 80; // different artist — likely a cover
  }
  // A result that is a live/remix/etc. the query didn't ask for is demoted.
  if (!queryHasVersion && VERSION_NOISE.test(r.trackName ?? "")) score -= 50;
  return score;
}

/**
 * Find the best Apple Music result (with a 30-second preview) for a track by
 * title + artist. `confident` means the title matched exactly and the artist
 * matched (or was unknown), so the caller may trust it for metadata backfill.
 */
async function fetchItunesMatch(
  title: string,
  artist: string,
): Promise<{ result: ItunesResult; confident: boolean } | undefined> {
  const primaryArtist = artist.split(",")[0]?.trim() ?? "";
  const term = `${primaryArtist} ${cleanTitle(title)}`.trim();
  if (!term) return undefined;

  try {
    const res = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(
        term,
      )}&entity=song&limit=8&country=US`,
      { cache: "no-store" },
    );
    if (!res.ok) return undefined;
    const data = (await res.json()) as { results?: ItunesResult[] };
    const results = (data.results ?? []).filter((r) => r.previewUrl);
    if (results.length === 0) return undefined;

    const wantTitle = norm(cleanTitle(title));
    const wantArtist = norm(primaryArtist);
    const queryHasVersion = VERSION_NOISE.test(title);

    let best: ItunesResult | undefined;
    let bestScore = -1;
    for (const r of results) {
      const s = scoreItunes(r, wantTitle, wantArtist, queryHasVersion);
      if (s > bestScore) {
        bestScore = s;
        best = r;
      }
    }
    // Nothing matched even loosely: still hand back a playable clip (any preview
    // is better than none), but never trust it for metadata.
    if (!best) return { result: results[0], confident: false };
    return { result: best, confident: bestScore >= CONFIDENT };
  } catch {
    return undefined;
  }
}

/**
 * Add a playable preview to `info` when it lacks one, and backfill any missing
 * artist / album / release date — but ONLY from a confident match, so a
 * cover/karaoke hit can't be shown as the real track's metadata. A weak match
 * still supplies audio, never metadata. (The embed path already gives the right
 * artist, so this mostly just fills in the album.)
 */
async function enrichWithItunes(info: SpotifyTrackInfo): Promise<void> {
  if (info.previewUrl && info.artist && info.album) return;
  const match = await fetchItunesMatch(info.title, info.artist);
  if (!match) return;
  const { result, confident } = match;
  if (!info.previewUrl) info.previewUrl = result.previewUrl;
  if (!confident) return;
  if (!info.artist && result.artistName) info.artist = result.artistName;
  if (!info.album && result.collectionName) info.album = result.collectionName;
  if (!info.releaseDate && result.releaseDate) {
    info.releaseDate = result.releaseDate;
  }
}

async function resolve(
  rawUrl: string,
): Promise<
  | { ok: true; info: SpotifyTrackInfo }
  | { ok: false; status: number; error: string }
> {
  const id = parseSpotifyTrackId(rawUrl);
  if (!id) {
    return {
      ok: false,
      status: 400,
      error:
        "That doesn't look like a Spotify track link. Paste a link to a song (open.spotify.com/track/…).",
    };
  }

  try {
    const token = await getAppToken();
    const info = token ? await fromApi(id, token) : await fromEmbed(id);
    await enrichWithItunes(info);
    return { ok: true, info };
  } catch (err) {
    // If the Web API call fails (bad creds, rate limit), fall back to the no-auth
    // embed page so the editor still gets the title, artist, cover, and preview.
    try {
      const info = await fromEmbed(id);
      await enrichWithItunes(info);
      return { ok: true, info };
    } catch {
      return {
        ok: false,
        status: 502,
        error:
          err instanceof Error
            ? `Couldn't reach Spotify: ${err.message}`
            : "Couldn't reach Spotify.",
      };
    }
  }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const url = req.nextUrl.searchParams.get("url") ?? "";
  const result = await resolve(url);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status },
    );
  }
  return NextResponse.json(result.info);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: { url?: unknown };
  try {
    body = (await req.json()) as { url?: unknown };
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const url = typeof body.url === "string" ? body.url : "";
  const result = await resolve(url);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status },
    );
  }
  return NextResponse.json(result.info);
}
