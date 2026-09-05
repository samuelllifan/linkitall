import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Two-factor enforcement, in one place.
 *
 * Supabase issues a session as soon as the password (or Google) check passes,
 * at assurance level `aal1`, whether or not the account has a TOTP factor
 * enrolled. Elevating to `aal2` is a second, separate step. So "2FA is on"
 * means nothing until something REFUSES to run at aal1 — and that something is
 * this, called by every signed-in route before it renders.
 *
 * Putting the gate on the routes rather than in the sign-in form is what makes
 * it cover Google as well as password sign-in: however you arrive with an aal1
 * session, the first authenticated page you open sends you to /auth/mfa.
 *
 * No network call. `getAuthenticatorAssuranceLevel()` reads `aal` out of the
 * access token already in the cookie and compares it against the verified
 * factors that ship on the session's user object, so this is local arithmetic
 * on data the route has loaded anyway.
 *
 * NOTE, and it is the honest limit of this: the gate is on OUR routes. A
 * determined attacker holding the password could still reach the Supabase REST
 * API directly with an aal1 token. Closing that means `(select auth.jwt() ->>
 * 'aal') = 'aal2'` conditions on the RLS policies of every owner-scoped table,
 * which is the follow-up this is designed to accept later without moving.
 */
export async function needsMfaChallenge(
  // biome-ignore lint/suspicious/noExplicitAny: the SSR client's generic differs per call site
  supabase: SupabaseClient<any, any, any>,
): Promise<boolean> {
  try {
    const { data, error } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error || !data) return false;
    // `nextLevel` is aal2 only when the account has at least one VERIFIED
    // factor; for everyone else it equals currentLevel and this is false.
    return data.nextLevel === "aal2" && data.currentLevel !== "aal2";
  } catch {
    // Fail OPEN, deliberately. This runs before every authenticated page, and a
    // transient failure here failing CLOSED would lock every user — including
    // the ones with no 2FA at all — out of their own account until it cleared.
    // The cost of failing open is one un-elevated page view; the cost of
    // failing closed is an outage.
    return false;
  }
}

/** Where an un-elevated session is sent, with the way back attached. */
export function mfaChallengePath(returnTo: string): string {
  return `/auth/mfa?redirect=${encodeURIComponent(returnTo)}`;
}
