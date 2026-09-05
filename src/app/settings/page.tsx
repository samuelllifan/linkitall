import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { mfaChallengePath, needsMfaChallenge } from "~/lib/mfa.server";
import { createClient } from "~/lib/supabase/server";
import { SettingsClient } from "./settings-client";

// Always render with the current account's data on each request.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Settings" };

/**
 * Everything the settings page reads off the profile.
 *
 * Split into two lists because the second one arrives with
 * `20260830232145_add_page_and_account_settings`, and a `select` naming a column
 * that doesn't exist yet fails the WHOLE query — which would blank the settings
 * page on any deployment where the app is ahead of the database. So the full
 * read is attempted first and falls back to the columns that have always been
 * there, with {@link DEFAULTS} standing in for the rest. Delete the fallback
 * once the migration is deployed everywhere.
 */
const BASE_COLUMNS = "username, search_indexable";
const SETTINGS_COLUMNS = `${BASE_COLUMNS}, page_live, sensitive_content, count_own_visits, page_password_hash, timezone, email_product_updates, email_tips`;

/** What each new flag means on a database that doesn't have it yet. */
const DEFAULTS = {
  pageLive: true,
  sensitiveContent: false,
  countOwnVisits: false,
  pagePasswordSet: false,
  timezone: null as string | null,
  emailProductUpdates: true,
  emailTips: true,
};

export default async function SettingsPage() {
  // Settings belong to an account — send anonymous visitors to sign in.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/settings");

  // 2FA, if the account has it: an aal1 session gets no further than here. The
  // gate lives on the routes rather than in the sign-in form so it covers
  // Google sign-in too — see ~/lib/mfa.server.
  if (await needsMfaChallenge(supabase)) {
    redirect(mfaChallengePath("/settings"));
  }

  let row: Record<string, unknown> | null = null;
  /** False once we know the new columns aren't there — see SETTINGS_COLUMNS. */
  let migrated = true;

  const full = await supabase
    .from("profiles")
    .select(SETTINGS_COLUMNS)
    .eq("id", user.id)
    .maybeSingle();
  if (full.error) {
    // Only a MISSING COLUMN means "the migration hasn't landed". Postgres
    // reports that as 42703, PostgREST as PGRST204 when its schema cache is the
    // thing that's behind. Anything else — a network blip, an RLS/JWT hiccup, a
    // statement timeout — is a transient failure, and concluding "not migrated"
    // from one would silently hide settings that do exist and are set.
    const code = full.error.code;
    migrated = !(code === "42703" || code === "PGRST204");
    // Retry narrow either way: on the old schema this is the only read that can
    // work, and on a transient failure it is a second chance at the username.
    const base = await supabase
      .from("profiles")
      .select(BASE_COLUMNS)
      .eq("id", user.id)
      .maybeSingle();
    row = (base.data as Record<string, unknown> | null) ?? null;
  } else {
    row = (full.data as Record<string, unknown> | null) ?? null;
  }

  const bool = (key: string, fallback: boolean) =>
    (row?.[key] as boolean | null | undefined) ?? fallback;

  /**
   * Which providers this account can sign in with, from Supabase's identity
   * list. An account created with "Sign in with Google" has no `email` identity
   * and therefore no password — which changes what the Password panel offers
   * and, more importantly, how account deletion has to be confirmed.
   */
  const providers = (user.identities ?? []).map((i) => i.provider);

  return (
    <SettingsClient
      userId={user.id}
      userEmail={user.email ?? ""}
      username={(row?.username as string | null) ?? null}
      providers={providers}
      migrated={migrated}
      searchIndexable={bool("search_indexable", true)}
      pageLive={bool("page_live", DEFAULTS.pageLive)}
      sensitiveContent={bool("sensitive_content", DEFAULTS.sensitiveContent)}
      countOwnVisits={bool("count_own_visits", DEFAULTS.countOwnVisits)}
      // The hash itself never leaves the server: the page only needs to know
      // whether a password is set, and it is changed through an RPC that does
      // the hashing (`set_page_password`).
      pagePasswordSet={Boolean(row?.page_password_hash)}
      timezone={(row?.timezone as string | null) ?? DEFAULTS.timezone}
      emailProductUpdates={bool(
        "email_product_updates",
        DEFAULTS.emailProductUpdates,
      )}
      emailTips={bool("email_tips", DEFAULTS.emailTips)}
    />
  );
}
