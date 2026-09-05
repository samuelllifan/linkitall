"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { StackedMark } from "~/components/stacked-mark";
import { Button } from "~/components/ui/button";
import { CodeInput } from "~/components/ui/code-input";
import { createClient } from "~/lib/supabase/client";

/**
 * The second step of signing in, for accounts with an authenticator app.
 *
 * Reached by redirect, never by link: every signed-in route asks
 * `needsMfaChallenge()` first and sends an un-elevated session here (see
 * ~/lib/mfa.server). That is what makes this cover Google sign-in as well as
 * the password form — it is a property of the SESSION, not of how it was made.
 */
export function MfaClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  // Only follow internal paths. `//evil.com` is the obvious attack, but a
  // leading `/\` is the same attack: the WHATWG URL parser treats a backslash
  // as a slash for http(s), so `new URL("/\\evil.com", origin).href` is
  // "https://evil.com/". Checking the SECOND character for either slash is what
  // closes both.
  const raw = searchParams.get("redirect");
  const isInternal =
    !!raw && raw.startsWith("/") && raw[1] !== "/" && raw[1] !== "\\";
  const redirectTo = isInternal ? raw : "/edit";

  // One in-flight verification at a time, and never the same code twice: a
  // TOTP code is single-use, so a double submit turns a correct code into a
  // wrong one.
  const busyRef = useRef(false);

  async function verify(value: string) {
    if (busyRef.current || value.length !== 6) return;
    busyRef.current = true;
    setVerifying(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: factors, error: listError } =
        await supabase.auth.mfa.listFactors();
      if (listError) throw new Error(listError.message);
      const factor = (factors?.totp ?? []).find((f) => f.status === "verified");
      if (!factor) {
        // Nothing to challenge — the factor was removed elsewhere.
        //
        // `refreshSession()` FIRST, and it is what stops an infinite bounce.
        // The two sides of this gate read different sources: the server's
        // `getAuthenticatorAssuranceLevel()` computes `nextLevel` from
        // `session.user.factors` in the stored cookie, while `listFactors()`
        // above asks the API live. After an un-enrol the stored copy still
        // lists the factor, so the server keeps redirecting here while this
        // screen keeps finding nothing to challenge — navigating away without
        // refreshing just runs that loop. Refreshing rewrites the session (and
        // its factor list), so the next server render agrees with this one.
        await supabase.auth.refreshSession();
        router.replace(redirectTo);
        router.refresh();
        return;
      }
      const { data: challenge, error: challengeError } =
        await supabase.auth.mfa.challenge({ factorId: factor.id });
      if (challengeError) throw new Error(challengeError.message);
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: factor.id,
        challengeId: challenge.id,
        code: value,
      });
      if (verifyError) {
        setError("That code isn't right. Try the current one.");
        setCode("");
        return;
      }
      // The session is now aal2. `refresh()` so the server components that
      // bounced us here re-read it before we navigate back into them.
      router.replace(redirectTo);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Couldn't check that code.",
      );
    } finally {
      busyRef.current = false;
      setVerifying(false);
    }
  }

  // Submit as soon as six digits are in — a 6-digit code has exactly one
  // length, so making the user reach for a button after the last digit is a
  // step that carries no information.
  //
  // Through a ref, so the effect's only real dependency is the code itself.
  // Listing `verify` instead would re-run this on every render that changes any
  // state it closes over — including the `setVerifying(true)` it does itself.
  const verifyRef = useRef(verify);
  verifyRef.current = verify;
  useEffect(() => {
    if (code.length === 6) verifyRef.current(code);
  }, [code]);

  async function signOut() {
    setSigningOut(true);
    try {
      await createClient().auth.signOut();
      router.replace("/login");
      router.refresh();
    } catch {
      setSigningOut(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-var(--nav-space))] w-full max-w-sm flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <div className="animate-rise flex w-full flex-col items-center gap-5">
        <StackedMark variant="brand" className="size-9" />
        <div className="flex flex-col gap-1.5">
          <h1 className="font-semibold text-xl tracking-tight">
            Two-factor authentication
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Enter the 6-digit code from your authenticator app.
          </p>
        </div>

        <CodeInput
          value={code}
          onChange={(v) => {
            setCode(v);
            if (error) setError(null);
          }}
          disabled={verifying}
          invalid={!!error}
          label="Authentication code"
          autoFocus
        />

        {error ? (
          <p
            aria-live="polite"
            className="animate-slide-up text-danger text-sm"
          >
            {error}
          </p>
        ) : null}

        <div className="flex flex-col items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={signOut}
            disabled={signingOut}
          >
            {signingOut ? "Signing out…" : "Sign in as someone else"}
          </Button>
          {/* The only route back for someone who has lost their authenticator.
              Supabase issues no recovery codes, so support IS the recovery
              path — saying so here beats leaving a locked-out user on a screen
              whose only other option signs them further out. */}
          <Button variant="link" size="sm" asChild>
            <Link href="/contact">Lost your authenticator?</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
