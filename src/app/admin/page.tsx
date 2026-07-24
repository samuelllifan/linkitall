import { notFound, redirect } from "next/navigation";
import { createClient } from "~/lib/supabase/server";
import { type AdminOverview, AdminView } from "./admin-view";

// Admin-only overview of every account and site-wide activity. Always live.
export const dynamic = "force-dynamic";

export default async function AdminPage() {
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

  // Cross-user data comes through a SECURITY DEFINER function that re-checks the
  // caller is the admin, so this is safe even though the app uses the anon key.
  const { data, error } = await supabase.rpc("admin_overview");
  if (error) throw error;

  return <AdminView overview={data as AdminOverview} />;
}
