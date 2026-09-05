import { type NextRequest, NextResponse } from "next/server";
import { env } from "~/env";
import { PAGE_UNLOCK_MAX_AGE, pageUnlockCookie } from "~/lib/page-unlock";
import { getPublicPageUnlockedServer } from "~/lib/pages.server";

// Checks a page password and, on success, drops the httpOnly cookie the public
// route reads. The check itself is `get_public_page_unlocked` — a SECURITY
// DEFINER function that compares against the bcrypt hash inside Postgres, so
// the hash never leaves the database and this route never sees it.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: { username?: unknown; password?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const username = typeof body.username === "string" ? body.username : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!username || !password) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const page = await getPublicPageUnlockedServer(username, password);
  if (!page) {
    // One answer for a wrong password, an unprotected page, and a username that
    // doesn't exist — the RPC doesn't distinguish them and neither does this.
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(pageUnlockCookie(page.username), password, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    path: "/",
    maxAge: PAGE_UNLOCK_MAX_AGE,
  });
  return res;
}
