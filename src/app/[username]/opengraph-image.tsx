import { createClient } from "@supabase/supabase-js";
import { ImageResponse } from "next/og";
import { env } from "~/env";
import type { Background } from "~/lib/pages";
import { plainText } from "~/lib/text";

export const runtime = "nodejs";
export const alt = "Profile on linkitall";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The card's default fill when a page has no custom background (or one Satori
// can't render, like starfield/video) — matches the app's dark theme.
const DEFAULT_BG =
  "linear-gradient(135deg, #140b2e 0%, #0b0b12 55%, #1a0f2e 100%)";

/**
 * Translate a page's saved `background` into inline styles Satori can render,
 * so the share card matches what visitors actually see on the page. Returns the
 * background style plus a foreground color legible on top of it.
 */
function resolveBackground(bg?: Background): {
  style: Record<string, string>;
  fg: string;
} {
  if (bg?.type === "custom") {
    return { style: { backgroundColor: bg.color }, fg: readableText(bg.color) };
  }
  if (bg?.type === "gradient") {
    const dir = bg.direction === "horizontal" ? "to right" : "to bottom";
    const mid = bg.distribution ?? 50;
    return {
      style: {
        backgroundImage: `linear-gradient(${dir}, ${bg.from}, ${mid}%, ${bg.to})`,
      },
      // The "linkitall" label sits at the gradient's start (top or left),
      // which is `from` for both directions — base legibility on it.
      fg: readableText(bg.from),
    };
  }
  if (
    bg?.type === "media" &&
    bg.kind === "image" &&
    bg.src.startsWith("http")
  ) {
    return {
      style: {
        backgroundImage: `url(${bg.src})`,
        backgroundSize: "cover",
        backgroundPosition: `${bg.posX}% ${bg.posY}%`,
      },
      fg: "#ffffff",
    };
  }
  // default, starfield, and video (which Satori can't rasterize) fall back.
  return { style: { backgroundImage: DEFAULT_BG }, fg: "#ffffff" };
}

/** Black or white text, whichever contrasts better with a hex background. */
function readableText(hex: string): string {
  const m = /^#?([\da-f]{6})$/i.exec(hex.trim());
  if (!m) return "#ffffff";
  const n = Number.parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  // Relative luminance (sRGB coefficients); dark text on light backgrounds.
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#0b0b12" : "#ffffff";
}

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
    if (row) {
      name = plainText(row.name as string) || `@${row.username ?? username}`;
      tagline = plainText(row.bio as string);
      const a = (row.avatar as string | null) ?? null;
      // Satori can embed https and data:image sources; skip anything else.
      if (a && (a.startsWith("http") || a.startsWith("data:image"))) avatar = a;
      background = (row.styles as { background?: Background } | null)
        ?.background;
    }
  } catch {
    // Fall back to the username-only card below.
  }

  const initial = name.replace(/^@/, "").charAt(0).toUpperCase() || "?";
  const { style: bgStyle, fg } = resolveBackground(background);
  // Muted variants of the foreground for the secondary lines.
  const mutedRgb = fg === "#ffffff" ? "255,255,255" : "11,11,18";

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "72px",
        color: fg,
        ...bgStyle,
      }}
    >
      <div style={{ display: "flex", fontSize: 34, fontWeight: 700 }}>
        linkitall
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "48px" }}>
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

      <div
        style={{
          display: "flex",
          fontSize: 30,
          color: `rgba(${mutedRgb},0.6)`,
        }}
      >
        linkitall.vercel.app/{username}
      </div>
    </div>,
    { ...size },
  );
}
