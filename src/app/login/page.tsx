import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "~/lib/supabase/server";
import { LoginClient } from "./login-client";

// Auth state is per-request; never cache the signed-in check.
export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Already signed in? Skip the form entirely. Honor an explicit internal
  // `?redirect` target (the auth-gated pages send one), otherwise drop them
  // into the app — `/my-page` resolves to their page or to settings.
  if (user) {
    const { redirect: target } = await searchParams;
    // Only follow internal, non-protocol-relative paths (guards against an
    // open redirect via `?redirect=//evil.com`).
    const safe =
      target?.startsWith("/") && !target.startsWith("//") ? target : "/my-page";
    redirect(safe);
  }

  // `LoginClient` reads the query string (mode / username / error) via
  // `useSearchParams`, so it lives under a Suspense boundary.
  return (
    <Suspense>
      <LoginClient />
    </Suspense>
  );
}
