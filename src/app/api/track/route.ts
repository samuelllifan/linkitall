import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "~/lib/supabase/server";

// Records a public view/click through the server so we can attach the visitor's
// country (from the platform's geo headers) — the browser can't see its own IP
// geolocation. The event itself is still written by the SECURITY DEFINER RPC.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface TrackBody {
  username?: unknown;
  kind?: unknown;
  visitor?: unknown;
  device?: unknown;
  linkId?: unknown;
  linkLabel?: unknown;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

/**
 * The visitor's country as an ISO alpha-2 code, from whichever geo header the
 * host populates (Vercel sets x-vercel-ip-country). Null when unavailable, e.g.
 * local dev or a host without geo — those views are counted as "Unknown".
 */
function countryFromHeaders(req: NextRequest): string | null {
  const raw =
    req.headers.get("x-vercel-ip-country") ??
    req.headers.get("cf-ipcountry") ??
    req.headers.get("x-country-code");
  if (!raw) return null;
  const code = raw.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : null;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: TrackBody;
  try {
    body = (await req.json()) as TrackBody;
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const username = str(body.username);
  const kind = str(body.kind);
  const visitor = str(body.visitor);
  if (!username || (kind !== "view" && kind !== "click") || !visitor) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    await supabase.rpc("record_analytics_event", {
      page_username: username,
      event_kind: kind,
      visitor,
      device_type: str(body.device),
      link_id: str(body.linkId),
      link_label: str(body.linkLabel),
      visitor_country: countryFromHeaders(req),
    });
  } catch {
    // Analytics are non-critical — never surface an error to the visitor.
  }

  // 204: fire-and-forget from the client, nothing to read back.
  return new NextResponse(null, { status: 204 });
}
