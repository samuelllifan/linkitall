import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { needsMfaChallenge } from "~/lib/mfa.server";
import { createClient } from "~/lib/supabase/server";
import { MfaClient } from "./mfa-client";

// The challenge depends on the session's assurance level, which is per-request.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Two-factor authentication" };

export default async function MfaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Nothing to challenge — either the session is already elevated or the
  // account has no verified factor. Either way this screen has no question to
  // ask, so don't let it become a dead end somebody can navigate to.
  if (!(await needsMfaChallenge(supabase))) redirect("/edit");

  // MfaClient reads `?redirect=` via useSearchParams, so it needs a boundary.
  return (
    <Suspense>
      <MfaClient />
    </Suspense>
  );
}
