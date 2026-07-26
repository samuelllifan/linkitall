import { ImageResponse } from "next/og";

// Static share card for the site root (stacked.page). Unlike the per-page card
// in `[username]/opengraph-image.tsx`, this one never changes, so let Next.js
// cache it.
export const runtime = "nodejs";
export const alt =
  "stacked — the fastest, easiest, and most customizable way to create your link-in-bio page";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Matches the app's dark theme (mirrors DEFAULT_BG in the per-page card).
const BG = "linear-gradient(135deg, #140b2e 0%, #0b0b12 55%, #1a0f2e 100%)";

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "72px",
        color: "#ffffff",
        backgroundColor: "#0b0b12",
        backgroundImage: BG,
      }}
    >
      {/* Faint grid backdrop, echoing the landing page's grid sections. */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: "flex",
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      />

      {/* Brand lockup: the layered "stacked" mark above the wordmark. */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <svg
          width={168}
          height={168}
          viewBox="0 0 100 100"
          fill="none"
          stroke="#ffffff"
          aria-hidden="true"
        >
          <polygon
            points="50,8 88,30 50,52 12,30"
            strokeWidth={7}
            strokeLinejoin="round"
          />
          <polyline
            points="12,48 50,70 88,48"
            strokeWidth={7}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.58}
          />
          <polyline
            points="12,64 50,86 88,64"
            strokeWidth={7}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.3}
          />
        </svg>
        <div
          style={{
            display: "flex",
            marginTop: 28,
            fontSize: 108,
            fontWeight: 700,
            letterSpacing: "-0.03em",
          }}
        >
          stacked
        </div>
      </div>

      {/* Tagline. */}
      <div
        style={{
          display: "flex",
          marginTop: 32,
          maxWidth: 900,
          textAlign: "center",
          fontSize: 38,
          lineHeight: 1.3,
          color: "rgba(255,255,255,0.72)",
        }}
      >
        The fastest, easiest, and most customizable way to create your
        link-in-bio page.
      </div>
    </div>,
    { ...size },
  );
}
