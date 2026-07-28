import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "~/lib/supabase/client";

/** Allowed username: 3–30 characters, letters/numbers/underscore only. */
export const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,30}$/;

/**
 * Usernames that would collide with an app route (a page lives at /<username>,
 * so these must stay reachable as pages, not profiles). Compared lowercase.
 */
const RESERVED_USERNAMES = new Set([
  "my-page",
  "settings",
  "login",
  "signup",
  "logout",
  "api",
  "admin",
  "about",
  "help",
  "support",
  "terms",
  "privacy",
  "pricing",
  "explore",
  "dashboard",
  "account",
  "auth",
  "new",
]);

/** Returns a human-readable problem with the username, or null if it's valid. */
export function usernameError(username: string): string | null {
  if (username.length < 3) return "Username must be at least 3 characters.";
  if (username.length > 30) return "Username must be at most 30 characters.";
  if (!USERNAME_PATTERN.test(username)) {
    return "Use only letters, numbers, and underscores.";
  }
  if (RESERVED_USERNAMES.has(username.toLowerCase())) {
    return "That username is reserved.";
  }
  return null;
}

/** Read the current user's username (null if signed out or not set yet). */
export async function queryUsername(
  // biome-ignore lint/suspicious/noExplicitAny: browser & server clients share this shape
  supabase: SupabaseClient<any>,
): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw error;
  return (data?.username as string | null) ?? null;
}

/**
 * Set the current user's username. Throws a friendly Error if invalid/taken/not
 * signed in.
 *
 * Goes through the `set_username` SECURITY DEFINER RPC rather than a direct
 * table upsert: the write then isn't subject to client-side RLS write quirks,
 * and the function raises clear messages we can show verbatim (a direct upsert
 * returned an opaque PostgrestError that surfaced only as "Couldn't save
 * changes.", soft-locking account creation).
 */
export async function setUsername(username: string): Promise<void> {
  const trimmed = username.trim();
  // Fast local feedback; the RPC re-validates authoritatively server-side.
  const invalid = usernameError(trimmed);
  if (invalid) throw new Error(invalid);

  const supabase = createClient();
  const { error } = await supabase.rpc("set_username", {
    new_username: trimmed,
  });
  if (error) {
    // The RPC raises friendly, user-facing messages (taken / invalid / signed
    // out); surface them directly, with a generic fallback just in case.
    throw new Error(error.message || "Couldn't set username.");
  }
}
