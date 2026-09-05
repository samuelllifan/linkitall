import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { mfaChallengePath, needsMfaChallenge } from "~/lib/mfa.server";
import { getPageServer } from "~/lib/pages.server";
import { createClient } from "~/lib/supabase/server";
import { getCountryPaths } from "~/lib/world-map";
import { DashboardClient } from "./dashboard-client";

// Analytics are per-account and always reflect the latest data.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  // The dashboard shows your own analytics — send anonymous visitors to sign in.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/dashboard");

  // 2FA, if the account has it: an aal1 session gets no further than here. The
  // gate lives on the routes rather than in the sign-in form so it covers
  // Google sign-in too — see ~/lib/mfa.server.
  if (await needsMfaChallenge(supabase)) {
    redirect(mfaChallengePath("/dashboard"));
  }

  const { data } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .maybeSingle();
  const username = (data?.username as string | null) ?? null;

  // The page's current links so the dashboard can list every link (including
  // ones with zero clicks) with its icon.
  const page = await getPageServer();

  // World-map outlines are projected on the server (same as the admin view) and
  // handed to the client, which colors them by the owner's view counts.
  return (
    <DashboardClient
      username={username}
      links={page?.links ?? []}
      countryPaths={getCountryPaths()}
    />
  );
}
