import { redirect } from "next/navigation";
import { createClient } from "~/lib/supabase/server";
import { SettingsClient } from "./settings-client";

// Always render with the current account's data on each request.
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  // Settings belong to an account — send anonymous visitors to sign in.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/settings");

  const { data } = await supabase
    .from("profiles")
    .select("username, search_indexable")
    .eq("id", user.id)
    .maybeSingle();
  const username = (data?.username as string | null) ?? null;
  const searchIndexable = (data?.search_indexable as boolean | null) ?? true;

  return (
    <SettingsClient
      userId={user.id}
      userEmail={user.email ?? ""}
      username={username}
      searchIndexable={searchIndexable}
    />
  );
}
