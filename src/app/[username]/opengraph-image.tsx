import { createClient } from "@supabase/supabase-js";
import { ImageResponse } from "next/og";
import { env } from "~/env";
import { resolveBackground } from "~/lib/og-background";
import { ogFonts } from "~/lib/og-fonts";
import type { Background } from "~/lib/pages";
import { plainText } from "~/lib/text";

export const runtime = "nodejs";
// Regenerate on every request so the card reflects the page's current
// background, avatar, name, and bio the moment an owner saves a change —
// without this, Next.js caches the first render and the preview goes stale.
export const dynamic = "force-dynamic";
export const alt = "Profile on stacked";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The brand purple's steps — mirrors --brand-* in globals.css and the gradient
// stops in StackedMark / icon.svg. Change one, change all three.
const LILAC = "#d8b4fe";
const ORCHID = "#c084fc";
const VIOLET = "#a78bfa";
const INDIGO = "#818cf8";

// A shared card shown when a page URL is posted to social/chat. Rendered from a
// cookieless anon client (the public-page RPC is anon-accessible), so it works
// in the image runtime without request cookies.
export default async function OpengraphImage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;

  let name = `@${username}`;
  let tagline = "";
  let avatar: string | null = null;
  let background: Background | undefined;

  try {
    const sb = createClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    );
    const { data } = await sb.rpc("get_public_page", {
      page_username: username,
    });
    const row = Array.isArray(data) ? data[0] : data;
    // This route is publicly fetchable and its output gets embedded by Discord,
    // iMessage and every link unfurler, so it must respect the page's own gates.
    // `get_public_page` already nulls the content of an offline or protected
    // page; `sensitive` it does NOT (the page itself is viewable behind a
    // click-through), and auto-unfurling that into a chat is exactly what the
    // warning exists to prevent — so it is checked here.
    //
    // Compared against explicit `false`/`true` rather than truthiness: before the
    // page-settings migration these columns are absent (undefined) and every
    // page must keep its card.
    const gated =
      row?.live === false ||
      row?.sensitive === true ||
      row?.password_protected === true;
    if (row && !gated) {
      const styles = row.styles as {
        background?: Background;
        hidden?: { avatar?: boolean; name?: boolean; bio?: boolean };
      } | null;
      // The card is a picture of the page, so a part switched off on the page is
      // off here too — otherwise hiding your name still unfurls it into every
      // Discord channel someone drops the link in, which is the one place the
      // setting most needs to hold. Each falls back down the path this route
      // already used for an EMPTY field, so a fully switched-off page still
      // produces a card rather than a blank rectangle.
      const hidden = styles?.hidden;
      name = hidden?.name
        ? `@${row.username ?? username}`
        : plainText(row.name as string) || `@${row.username ?? username}`;
      tagline = hidden?.bio ? "" : plainText(row.bio as string);
      const a = hidden?.avatar ? null : ((row.avatar as string | null) ?? null);
      // Satori can embed https and data:image sources; skip anything else.
      if (a && (a.startsWith("http") || a.startsWith("data:image"))) avatar = a;
      background = styles?.background;
    }
  } catch {
    // Fall back to the username-only card below.
  }

  const fonts = await ogFonts();
  const initial = name.replace(/^@/, "").charAt(0).toUpperCase() || "?";
  // The page's own background, reconstructed for Satori. `topFg` can differ
  // from `fg` because several backgrounds are not one flat colour — the top of
  // an aurora is its lit band while the body sits on the base, and a gradient's
  // start can be the opposite end of the ramp from its middle.
  const { layers, fill, fg, topFg } = resolveBackground(background, size);
  // Muted variants of the foreground for the secondary lines.
  const mutedRgb = fg === "#ffffff" ? "255,255,255" : "11,11,18";

  return new ImageResponse(
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        display: "flex",
        backgroundColor: fill,
        color: fg,
        fontFamily: "Inter",
      }}
    >
      {layers}
      {/* The lockup pins to the top and the profile block centres itself in
          what is left. It used to be the middle row of a `space-between` trio
          with the page URL beneath it; with that row gone, `space-between`
          would have driven the block down to the bottom edge. Centring it in
          the remaining space — rather than on the card — is what keeps the air
          above and below it equal now that nothing balances the lockup. */}
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: "72px",
        }}
      >
        {/* Brand lockup: the mark in the brand purple (StackedMark's
            `variant="brand"`, same artwork and same stops as icon.svg), beside
            the wordmark in `topFg`.

            The mark carries its own colour while the wordmark keeps flipping
            black-or-white against the page's background. That split is the
            point: the purple is the recognisable half and has to look the same
            on every card, and the text is the half that has to stay readable.
            The mark is 40px of decoration next to it, so it can sit on a light
            page at logo contrast without costing legibility.
            StackedMark's soft glow is left off — Satori rasterizes no CSS
            drop-shadow, and at this size it would be invisible regardless. */}
        <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
          <svg
            width={40}
            height={40}
            viewBox="0 0 100 100"
            fill="none"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="og-mark-brand" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor={LILAC} />
                <stop offset="0.4" stopColor={ORCHID} />
                <stop offset="0.72" stopColor={VIOLET} />
                <stop offset="1" stopColor={INDIGO} />
              </linearGradient>
            </defs>
            {/* Top sheet: gradient-filled outline. */}
            <polygon
              points="50,8 88,30 50,52 12,30"
              fill="url(#og-mark-brand)"
              stroke="url(#og-mark-brand)"
              strokeWidth={7}
              strokeLinejoin="round"
            />
            {/* Lower sheets step down the ramp as they recede. */}
            <polyline
              points="12,48 50,70 88,48"
              stroke={VIOLET}
              strokeWidth={7}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.6}
            />
            <polyline
              points="12,64 50,86 88,64"
              stroke={INDIGO}
              strokeWidth={7}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.32}
            />
          </svg>
          <div
            style={{
              display: "flex",
              fontSize: 34,
              fontWeight: 700,
              letterSpacing: "-0.03em",
              color: topFg,
            }}
          >
            stacked
            {/* The wordmark is "stacked." — the period is part of it, and it is
                brand purple everywhere it appears (`.brand-text`, navbar.tsx /
                auth-card.tsx). Flat ORCHID rather than the gradient those use:
                Satori has no `background-clip: text`, and at this size the
                gradient is squeezed into a ~10px dot anyway, over which the
                visible slice averages out to about this colour.

                This is the one piece of brand chroma on a lockup that is
                otherwise deliberately neutral — see the mark above for why the
                rest stays mono. A dot is small enough to read as a signature
                rather than as stacked's palette imposed on someone's page. */}
            <div style={{ display: "flex", color: ORCHID }}>.</div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flex: 1,
            alignItems: "center",
            gap: "48px",
          }}
        >
          {avatar ? (
            // biome-ignore lint/performance/noImgElement: satori (next/og) renders a plain <img>
            <img
              src={avatar}
              width={220}
              height={220}
              style={{ borderRadius: "9999px", objectFit: "cover" }}
              alt=""
            />
          ) : (
            <div
              style={{
                width: 220,
                height: 220,
                borderRadius: "9999px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 110,
                fontWeight: 700,
                background: `rgba(${mutedRgb},0.12)`,
              }}
            >
              {initial}
            </div>
          )}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              maxWidth: 760,
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: 76,
                fontWeight: 700,
                lineHeight: 1.05,
              }}
            >
              {name}
            </div>
            {tagline ? (
              <div
                style={{
                  display: "flex",
                  marginTop: 20,
                  fontSize: 38,
                  color: `rgba(${mutedRgb},0.75)`,
                  lineHeight: 1.25,
                }}
              >
                {tagline.slice(0, 120)}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>,
    // No `fonts` key at all when they couldn't be read, rather than an empty
    // array — Satori needs at least one face and falls back to its own.
    { ...size, ...(fonts.length > 0 ? { fonts } : {}) },
  );
}
