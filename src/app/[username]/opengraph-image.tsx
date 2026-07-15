import { createClient } from "@supabase/supabase-js";
import { ImageResponse } from "next/og";
import { env } from "~/env";
import { plainText } from "~/lib/text";

export const runtime = "nodejs";
export const alt = "Profile on linkitall";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

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
    }
  } catch {
    // Fall back to the username-only card below.
  }

  const initial = name.replace(/^@/, "").charAt(0).toUpperCase() || "?";

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "72px",
        color: "#ffffff",
        backgroundImage:
          "linear-gradient(135deg, #140b2e 0%, #0b0b12 55%, #1a0f2e 100%)",
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
              background: "rgba(255,255,255,0.12)",
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
                color: "rgba(255,255,255,0.75)",
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
          color: "rgba(255,255,255,0.6)",
        }}
      >
        linkitall.net/{username}
      </div>
    </div>,
    { ...size },
  );
}
