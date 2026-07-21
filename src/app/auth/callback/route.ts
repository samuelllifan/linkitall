import { NextResponse } from "next/server";
import { createClient } from "~/lib/supabase/server";

// Exchanges the OAuth `code` for a session, then forwards the user on. Google
// (and any other OAuth provider) redirects back here after the user approves.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Where to land once signed in; `/my-page` sorts out username-or-settings.
  const next = searchParams.get("next") ?? "/my-page";

  // Google can also redirect back with its own error (e.g. access_denied).
  const providerError =
    searchParams.get("error_description") ?? searchParams.get("error");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    console.error("[auth/callback] exchange failed:", error.message);
    return NextResponse.redirect(
      `${origin}/login?error=oauth&reason=${encodeURIComponent(error.message)}`,
    );
  }

  // No code came back — surface whatever the provider reported instead.
  console.error("[auth/callback] no code; provider error:", providerError);
  return NextResponse.redirect(
    `${origin}/login?error=oauth${
      providerError
        ? `&reason=${encodeURIComponent(providerError)}`
        : "&reason=no_code"
    }`,
  );
}
