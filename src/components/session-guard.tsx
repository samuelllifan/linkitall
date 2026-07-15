"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { createClient } from "~/lib/supabase/client";

/**
 * Implements the "Stay signed in" choice made at sign-in. Supabase persists
 * sessions across browser restarts by default; when the user opts out we record
 * `linkitall-remember=session` and mark the current browser session in
 * sessionStorage (which is cleared when the browser fully closes). On the next
 * launch that marker is gone, so we sign the persisted session out. Purely
 * client-side, so it never interferes with the SSR auth-cookie handling.
 */
export function SessionGuard() {
  const router = useRouter();

  useEffect(() => {
    let remember: string | null = null;
    let active: string | null = null;
    try {
      remember = localStorage.getItem("linkitall-remember");
      active = sessionStorage.getItem("linkitall-session-active");
      sessionStorage.setItem("linkitall-session-active", "1");
    } catch {
      return;
    }

    // Opted out of staying signed in, and this is a fresh browser session
    // (the tab-scoped marker was cleared) → forget the persisted session.
    if (remember === "session" && !active) {
      const supabase = createClient();
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) {
          supabase.auth.signOut().then(() => router.refresh());
        }
      });
    }
  }, [router]);

  return null;
}
