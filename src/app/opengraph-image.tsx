import { ImageResponse } from "next/og";
import { ogFonts } from "~/lib/og-fonts";
import { SITE_TAGLINE, SITE_TITLE } from "~/lib/site-meta";

// Static share card for the site root (stacked.page). Unlike the per-page card
// in `[username]/opengraph-image.tsx` this one never changes, so it is left to
// prerender at build time and Next.js caches it. (Next fingerprints the URL of
// a statically generated metadata image with a content hash, so editing this
// file is enough to break Discord's / iMessage's cache of the old one — there
// is nothing to purge by hand.)
//
// The card is a deliberate restatement of the landing hero rather than a
// generic logo plate: near-black ground, the 72px grid, one violet bloom, the
// hero's own headline and slogan, and the claim field's `stacked.page/yourname`
// URL. Anyone who taps through from an unfurl should land on a page they have
// already seen.
export const runtime = "nodejs";
// Describes what the card actually says, in reading order.
export const alt = `${SITE_TITLE}. ${SITE_TAGLINE}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The app's dark palette, resolved from the oklch tokens in globals.css so the
// card sits on exactly the same values as the site (Satori has no var()).
// --background / --foreground / --muted-foreground / --card / --border.
const BG = "#0a0a0a";
const FG = "#fafafa";
const MUTED = "#a1a1a1";
const CARD = "#131313";
const BORDER = "#282828";

// The brand purple's steps — mirrors --brand-* in globals.css and the gradient
// stops in StackedMark / icon.svg. Change one, change all three.
const LILAC = "#d8b4fe";
const ORCHID = "#c084fc";
const VIOLET = "#a78bfa";
const INDIGO = "#818cf8";

export default async function OpengraphImage() {
  const fonts = await ogFonts();

  return new ImageResponse(
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        display: "flex",
        backgroundColor: BG,
        color: FG,
        fontFamily: "Inter",
      }}
    >
      {/* The interactive grid's resting state: 72px cells in the same dim gray
          it strokes (interactive-grid.tsx), a touch stronger than the live one
          because every unfurler re-encodes this PNG and a 0.09 hairline is the
          first thing that survives compression as nothing at all. */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: 1200,
          height: 630,
          display: "flex",
          backgroundImage:
            "linear-gradient(to right, rgba(148,150,158,0.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,150,158,0.12) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
        }}
      />

      {/* The hero's violet wash, sitting behind the mark on the right. Same
          idiom as home-hero.tsx — a wash, never a visible shape — but carried
          at a higher alpha for the same compression reason as the grid. */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: 1200,
          height: 630,
          display: "flex",
          backgroundImage:
            "radial-gradient(46% 62% at 78% 50%, rgba(167,139,250,0.16), transparent 70%)",
        }}
      />

      {/* The hero's bottom fade to true black, which is what the next landing
          section is. Purely depth here, but it keeps the card and the page
          reading as the same surface. */}
      <div
        style={{
          position: "absolute",
          left: 0,
          bottom: 0,
          width: 1200,
          height: 220,
          display: "flex",
          backgroundImage:
            "linear-gradient(to top, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.32) 48%, rgba(0,0,0,0) 100%)",
        }}
      />

      <div
        style={{
          position: "relative",
          display: "flex",
          width: "100%",
          alignItems: "center",
          gap: 40,
          padding: "64px 68px",
        }}
      >
        {/* Copy column, mirroring the hero's left rail. */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            minWidth: 0,
          }}
        >
          {/* Wordmark only — the mark itself is the big object to the right, and
              drawing it twice would read as a repeat rather than a lockup.

              The period is part of the wordmark and carries the brand purple
              wherever it appears (`.brand-text`, navbar.tsx / auth-card.tsx).
              Flat ORCHID rather than that gradient: Satori has no
              `background-clip: text`, and at this size the four-stop ramp is
              squeezed into a ~10px dot, over which the visible slice averages
              out to roughly this colour anyway. */}
          <div
            style={{
              display: "flex",
              fontSize: 40,
              fontWeight: 700,
              letterSpacing: "-0.03em",
            }}
          >
            stacked
            <div style={{ display: "flex", color: ORCHID }}>.</div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              marginTop: 26,
              fontSize: 88,
              fontWeight: 700,
              lineHeight: 0.94,
              letterSpacing: "-0.035em",
            }}
          >
            {/* Two lines, broken exactly where the hero's <br /> breaks it. */}
            <div style={{ display: "flex" }}>All of you,</div>
            <div style={{ display: "flex" }}>all here</div>
          </div>

          <div
            style={{
              display: "flex",
              marginTop: 24,
              maxWidth: 520,
              fontSize: 29,
              lineHeight: 1.4,
              color: MUTED,
            }}
          >
            {SITE_TAGLINE}
          </div>

          {/* The claim field, at rest. It is the landing page's one primary
              action and the fastest way to say what stacked actually is, so it
              earns the bottom of the card. Mono, like the real prefix. */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              marginTop: 40,
              height: 62,
              paddingLeft: 22,
              paddingRight: 22,
              borderRadius: 12,
              border: `1px solid ${BORDER}`,
              backgroundColor: CARD,
              fontFamily: "JetBrains Mono",
              fontSize: 27,
            }}
          >
            <div style={{ display: "flex", color: MUTED }}>stacked.page/</div>
            <div style={{ display: "flex", color: FG }}>yourname</div>
          </div>
        </div>

        {/* The mark, large and in the brand gradient — the same artwork as
            icon.svg and StackedMark's `brand` variant. Satori cannot rasterize
            the CSS drop-shadow that gives the mark its glow on the site, so the
            glow is a radial wash layered underneath instead. */}
        <div
          style={{
            position: "relative",
            display: "flex",
            width: 318,
            height: 318,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: -60,
              left: -60,
              width: 438,
              height: 438,
              display: "flex",
              backgroundImage:
                "radial-gradient(50% 50% at 50% 50%, rgba(167,139,250,0.26), transparent 68%)",
            }}
          />
          <svg
            width={318}
            height={318}
            viewBox="0 0 100 100"
            fill="none"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="og-brand" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor={LILAC} />
                <stop offset="0.4" stopColor={ORCHID} />
                <stop offset="0.72" stopColor={VIOLET} />
                <stop offset="1" stopColor={INDIGO} />
              </linearGradient>
            </defs>
            {/* Top sheet: gradient-filled outline. */}
            <polygon
              points="50,8 88,30 50,52 12,30"
              fill="url(#og-brand)"
              stroke="url(#og-brand)"
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
        </div>
      </div>
    </div>,
    // No `fonts` key at all when they couldn't be read, rather than an empty
    // array — Satori needs at least one face and falls back to its own.
    { ...size, ...(fonts.length > 0 ? { fonts } : {}) },
  );
}
