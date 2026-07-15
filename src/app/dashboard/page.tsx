import { redirect } from "next/navigation";
import { getPageServer } from "~/lib/pages.server";
import { createClient } from "~/lib/supabase/server";
import { DashboardClient } from "./dashboard-client";

// Analytics are per-account and always reflect the latest data.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  // The dashboard shows your own analytics — send anonymous visitors to sign in.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/dashboard");

  const { data } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .maybeSingle();
  const username = (data?.username as string | null) ?? null;

  // The page's current links so the dashboard can list every link (including
  // ones with zero clicks) with its icon.
  const page = await getPageServer();

  return <DashboardClient username={username} links={page?.links ?? []} />;
}
