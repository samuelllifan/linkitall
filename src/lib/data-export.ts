"use client";

import { createClient } from "~/lib/supabase/client";

/**
 * "Download my data".
 *
 * Every read here goes through the ordinary signed-in client, so RLS is what
 * scopes the export — there is no privileged path and no way for this to return
 * somebody else's rows even if the user id were wrong. Failures are per-section
 * rather than fatal: an account whose analytics read times out should still get
 * its page and profile, not an error.
 */

/** Rows of analytics to include. High enough to be a real archive, bounded so
 *  a busy page can't try to serialise a million rows into the tab's memory. */
const EVENT_LIMIT = 50_000;

export interface AccountExport {
  exportedAt: string;
  account: Record<string, unknown>;
  profile: Record<string, unknown> | null;
  page: Record<string, unknown> | null;
  analytics: {
    events: Record<string, unknown>[];
    truncatedAt: number | null;
  };
}

export async function buildAccountExport(): Promise<AccountExport> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You're signed out.");

  const [profileRes, pageRes, eventsRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("pages").select("*").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("analytics_events")
      .select(
        "kind, visitor_id, device, link_id, link_label, country, created_at",
      )
      .eq("page_user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(EVENT_LIMIT),
  ]);

  const profile = (profileRes.data as Record<string, unknown> | null) ?? null;
  // The bcrypt hash of the page password is the user's own row, but a hash in a
  // file that gets emailed around is a liability and no use to anybody. Report
  // whether one is set instead.
  if (profile && "page_password_hash" in profile) {
    profile.page_password_hash = undefined;
    profile.pagePasswordSet = Boolean(profileRes.data?.page_password_hash);
    delete profile.page_password_hash;
  }

  const events = (eventsRes.data as Record<string, unknown>[] | null) ?? [];

  return {
    exportedAt: new Date().toISOString(),
    account: {
      id: user.id,
      email: user.email,
      createdAt: user.created_at,
      lastSignInAt: user.last_sign_in_at,
      providers: (user.identities ?? []).map((i) => i.provider),
    },
    profile,
    page: (pageRes.data as Record<string, unknown> | null) ?? null,
    analytics: {
      events,
      // Say so when the cap bit, rather than handing over a silently partial
      // archive that looks complete.
      truncatedAt: events.length >= EVENT_LIMIT ? EVENT_LIMIT : null,
    },
  };
}

/** Hand the browser a JSON file. Revokes the object URL once the click lands. */
export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // A tick, so the download has taken the URL before it stops resolving.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
