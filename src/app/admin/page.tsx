import { notFound, redirect } from "next/navigation";
import { createClient } from "~/lib/supabase/server";
import { type AdminOverview, AdminView } from "./admin-view";
import { type RangeSelection, resolveRange } from "./time-range";

// Admin-only overview of every account and site-wide activity. Always live.
export const dynamic = "force-dynamic";

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

  return (
    <AdminView overview={data as AdminOverview} range={selection.current} />
  );
}
