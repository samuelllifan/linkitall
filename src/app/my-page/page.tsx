import { redirect } from "next/navigation";
import { createClient } from "~/lib/supabase/server";

// Always resolve against the current account on each request.
export const dynamic = "force-dynamic";

// `/my-page` is a convenience entry point: a page now lives at `/<username>`,
// so send the signed-in user there (or to settings to pick a username first).
export default async function MyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/my-page");

  const { data } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .maybeSingle();
  const username = (data?.username as string | null) ?? null;

  redirect(username ? `/${username}` : "/settings");
}
