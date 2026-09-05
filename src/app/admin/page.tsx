import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { mfaChallengePath, needsMfaChallenge } from "~/lib/mfa.server";
import { createClient } from "~/lib/supabase/server";
import { type RangeSelection, resolveRange } from "~/lib/time-range";
import { type AdminOverview, AdminView } from "./admin-view";

// Admin-only overview of every account and site-wide activity. Always live.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/admin");

  // 2FA, if the account has it: an aal1 session gets no further than here. The
  // gate lives on the routes rather than in the sign-in form so it covers
  // Google sign-in too — see ~/lib/mfa.server.
  if (await needsMfaChallenge(supabase)) {
    redirect(mfaChallengePath("/admin"));
  }

  // Gate on the profile flag. Non-admins get a 404 so the route is invisible.
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.is_admin) notFound();

  // The chosen time frame lives in the URL so it's shareable and survives a
  // refresh; the picker just navigates. Resolve it to absolute bounds here.
  const sp = await searchParams;
  const first = (v: string | string[] | undefined) =>
    Array.isArray(v) ? v[0] : v;
  const selection: RangeSelection = resolveRange({
    range: first(sp.range),
    from: first(sp.from),
    to: first(sp.to),
  });

  // Cross-user data comes through a SECURITY DEFINER function that re-checks the
  // caller is the admin, so this is safe even though the app uses the anon key.
  const { data, error } = await supabase.rpc("admin_overview", {
    range_start: selection.start,
    range_end: selection.end,
  });
  if (error) throw error;

  // Prior equal-length window, so the view can show period-over-period change.
  // Skipped for lifetime (open start) — there's no comparable prior period.
  let previous: AdminOverview | null = null;
  if (selection.start) {
    const startMs = Date.parse(selection.start);
    const endMs = selection.end ? Date.parse(selection.end) : Date.now();
    const prevStart = new Date(startMs - (endMs - startMs)).toISOString();
    const { data: prevData } = await supabase.rpc("admin_overview", {
      range_start: prevStart,
      range_end: selection.start,
    });
    previous = (prevData as AdminOverview | null) ?? null;
  }

  return (
    <AdminView
      overview={data as AdminOverview}
      previous={previous}
      range={selection.current}
    />
  );
}
