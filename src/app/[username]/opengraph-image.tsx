import { createClient } from "@supabase/supabase-js";
import { ImageResponse } from "next/og";
import { env } from "~/env";
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

// The card's default fill when a page has no custom background (or one Satori
// can't render, like a video). A page on the default background just shows the
// app's near-black dark theme, so mirror that (a whisper of gradient keeps it
// from reading as dead-flat) rather than a decorative tint.
const DEFAULT_BG = "linear-gradient(180deg, #0e0e13 0%, #08080b 100%)";

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
      // The "stacked" label sits at the gradient's start (top or left),
      // which is `from` for both directions — base legibility on it.
      fg: readableText(bg.from),
    };
  }
  if (bg?.type === "grid") {
    const t = Math.max(0, bg.thickness);
    // Solid base color with two tiled line layers (vertical + horizontal),
    // mirroring PageBackground's grid. Satori tiles gradients via
    // background-size, but doesn't support the page's radial fade mask, so the
    // lines stay uniform across the card.
    return {
      style: {
        backgroundColor: bg.baseColor,
        backgroundImage: `linear-gradient(to right, ${bg.lineColor} ${t}px, transparent ${t}px), linear-gradient(to bottom, ${bg.lineColor} ${t}px, transparent ${t}px)`,
        backgroundSize: `${bg.size}px ${bg.size}px, ${bg.size}px ${bg.size}px`,
      },
      fg: readableText(bg.baseColor),
    };
  }
  if (bg?.type === "aurora") {
    // The real aurora (a WebGL shader) is a broad light-top → dark-bottom
    // vertical gradient whose horizon sits a little under halfway down — NOT a
    // radial glow. Satori can't run the shader, so approximate the static look
    // with a linear gradient: the light color fills the top and fades into the
    // base color by ~88% down, mirroring the shader's wide, smooth falloff.
    return {
      style: {
        backgroundColor: bg.baseColor,
        backgroundImage: `linear-gradient(to bottom, ${bg.color} 0%, ${bg.baseColor} 88%)`,
      },
      fg: readableText(bg.baseColor),
    };
  }
  if (
    bg?.type === "media" &&
    bg.kind === "image" &&
    bg.src.startsWith("http")
  ) {
    // Mirror the page's darkening overlay so a dimmed photo reads the same on
    // the card. (Blur is skipped — Satori doesn't rasterize CSS filters.)
    const dim = Math.max(0, Math.min(100, bg.dim ?? 0)) / 100;
    const overlay =
      dim > 0
        ? `linear-gradient(rgba(0,0,0,${dim}), rgba(0,0,0,${dim})), `
        : "";
    return {
      style: {
        backgroundImage: `${overlay}url(${bg.src})`,
        backgroundSize: "cover",
        backgroundPosition: `${bg.posX}% ${bg.posY}%`,
      },
      fg: "#ffffff",
    };
  }
  // default and video (which Satori can't rasterize) fall back.
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
  // The top "stacked" label sits at the very top of the card. For aurora that
  // area is the light glow color (not the base), so contrast the label against
  // that instead of the base-derived `fg`; every other background is uniform
  // enough at the top that `fg` is already correct.
  const topFg =
    background?.type === "aurora" ? readableText(background.color) : fg;

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
      <div
        style={{ display: "flex", fontSize: 34, fontWeight: 700, color: topFg }}
      >
        stacked
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
        stacked.page/{username}
      </div>
    </div>,
    { ...size },
  );
}
