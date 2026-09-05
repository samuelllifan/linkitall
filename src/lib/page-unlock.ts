/**
 * Page passwords — the cookie half.
 *
 * The cookie holds the password the visitor typed, and the server re-verifies
 * it against the bcrypt hash on EVERY render (see `get_public_page_unlocked`).
 * Three properties fall out of that, and they are why it is built this way
 * rather than as a signed token:
 *
 *   * nothing signs anything, so there is no new secret to provision, lose, or
 *     rotate — the hash in the database is the only authority;
 *   * changing the page password locks every existing visitor out in the same
 *     instant, with no token table to sweep; and
 *   * the cookie is `httpOnly`, so the creator's own page scripts — and anything
 *     they embed — cannot read it.
 *
 * The trade-off is that a SHARED page password sits in the visitor's cookie jar
 * in the clear. That is the right shape for what this is: the password an owner
 * posts in a Discord announcement, not an account credential. Account access is
 * Supabase Auth's, and TOTP's.
 */

/** A month. Long enough that a returning visitor isn't re-challenged weekly. */
export const PAGE_UNLOCK_MAX_AGE = 60 * 60 * 24 * 30;

/**
 * The cookie for one page. Lower-cased because usernames are case-preserving
 * but resolve case-insensitively — `/Kaze` and `/kaze` are one page and must
 * not need two unlocks. Usernames are `[A-Za-z0-9_]`, so the result is always a
 * valid cookie name.
 */
export function pageUnlockCookie(username: string): string {
  return `stacked_pw_${username.toLowerCase()}`;
}
