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

/** Set the current user's username. Throws a friendly error if invalid/taken. */
export async function setUsername(username: string): Promise<void> {
  const trimmed = username.trim();
  const invalid = usernameError(trimmed);
  if (invalid) throw new Error(invalid);

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be signed in to set a username.");

  const { error } = await supabase
    .from("profiles")
    .upsert(
      { id: user.id, username: trimmed, updated_at: new Date().toISOString() },
      { onConflict: "id" },
    );
  if (error) {
    // 23505 = unique violation on the case-insensitive username index.
    if (error.code === "23505") {
      throw new Error("That username is already taken.");
    }
    throw error;
  }
}
