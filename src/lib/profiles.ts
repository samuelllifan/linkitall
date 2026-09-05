import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "~/lib/supabase/client";

/** Allowed username: 1–30 characters, letters/numbers/underscore only. */
export const USERNAME_PATTERN = /^[A-Za-z0-9_]{1,30}$/;

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
  "contact",
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
  "edit",
]);

/** Returns a human-readable problem with the username, or null if it's valid. */
export function usernameError(username: string): string | null {
  if (username.length < 1) return "Username must be at least 1 character.";
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
/**
 * Ask the server whether `username` is usable: returns the reason it is not
 * (malformed / reserved / already taken), or null when it is free.
 *
 * Goes through the `username_unavailable_reason` SECURITY DEFINER RPC because
 * `profiles` is owner-only under RLS. A direct table read is not an option: as
 * anon it fails with "permission denied", and as a signed-in user it returns
 * zero rows for somebody else's username with NO error, which would report
 * every taken name in the database as available.
 *
 * THROWS on a transport/RPC failure rather than returning null, so the caller
 * has to decide explicitly what to do when the answer is unknown. A null return
 * means "free" and nothing else -- conflating that with "we could not tell" is
 * the most dangerous bug this feature could have.
 */
export async function usernameUnavailableReason(
  username: string,
  signal?: AbortSignal,
): Promise<string | null> {
  const supabase = createClient();
  let query = supabase.rpc("username_unavailable_reason", {
    candidate: username.trim(),
  });
  if (signal) query = query.abortSignal(signal);

  const { data, error } = await query;
  if (error) throw new Error(error.message || "Couldn't check that username.");
  return (data as string | null) ?? null;
}

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
