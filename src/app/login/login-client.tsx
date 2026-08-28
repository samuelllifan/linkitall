"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { StackedMark } from "~/components/stacked-mark";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { PasswordToggle } from "~/components/ui/password-toggle";
import { Requirement } from "~/components/ui/requirement";
import {
  setUsername,
  usernameError,
  usernameUnavailableReason,
} from "~/lib/profiles";
import { createClient } from "~/lib/supabase/client";

/** Whether the chosen username is free. `idle` also covers "we couldn't tell". */
type Availability =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "available" }
  | { state: "unavailable"; reason: string };

type Mode = "signin" | "signup" | "reset";

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}

export function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Where to land after auth; defaults to the editor.
  const redirectTo = searchParams.get("redirect") || "/my-page";

  // Landing here with `?mode=signup&username=…` (e.g. from the home page's
  // "Claim Your Page" field) opens the sign-up tab with the name pre-filled.
  const [mode, setMode] = useState<Mode>(
    searchParams.get("mode") === "signup" ? "signup" : "signin",
  );
  const [email, setEmail] = useState("");
  const [username, setUsernameValue] = useState(
    searchParams.get("username") ?? "",
  );
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [staySignedIn, setStaySignedIn] = useState(true);
  const [loading, setLoading] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [error, setError] = useState<string | null>(
    searchParams.get("error") === "oauth"
      ? `Couldn't sign in with Google. Please try again.${
          searchParams.get("reason") ? ` (${searchParams.get("reason")})` : ""
        }`
      : null,
  );
  const [emailError, setEmailError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Whether the chosen username is actually free. One union rather than a few
  // booleans, so "checking and available" can't be represented.
  const [avail, setAvail] = useState<Availability>({ state: "idle" });
  // Monotonic counter identifying the newest availability check; see the effect.
  const seqRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  // Show email-related auth errors under the email field; everything else in
  // the shared error slot near the button.
  function reportAuthError(message: string) {
    if (/email|already registered/i.test(message)) setEmailError(message);
    else setError(message);
  }

  // Live requirement checks (shown as red/green checklists on sign-up).
  const usernameReqs = [
    {
      label: "Between 3 and 30 characters",
      met: username.length >= 3 && username.length <= 30,
    },
    {
      label: "Only letters, numbers, and underscores",
      met: /^[A-Za-z0-9_]+$/.test(username),
    },
  ];
  const passwordReqs = [
    { label: "At least 8 characters", met: password.length >= 8 },
    { label: "Contains a letter", met: /[A-Za-z]/.test(password) },
    { label: "Contains a number", met: /[0-9]/.test(password) },
  ];
  const usernameOk = usernameReqs.every((r) => r.met);
  const passwordOk = passwordReqs.every((r) => r.met);
  // Basic email shape check — enough to gate the button until it looks valid.
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  // Ask the server whether the username is free, debounced. Runs on sign-up
  // only, and only once the two local rules pass — the checklist above is
  // already the feedback for a malformed name, so there's nothing to ask about.
  //
  // `seqRef` is the load-bearing race guard, not the abort or the clearTimeout:
  // every pending resolution captures its own sequence number and discards
  // itself if a newer check has started, which makes "a slow old answer
  // overwrites a fresh one" structurally impossible whatever the network does.
  // A plain "does the response match the current text" comparison is NOT
  // equivalent — type "sam", then "same", then delete back to "sam", and the
  // first slow answer would match the current text and be wrongly accepted.
  useEffect(() => {
    // Retire any previous check FIRST, before any early return. Otherwise a
    // request already on the wire stays "current" and its answer lands on top of
    // whatever an early return just decided — type "aboutme", wait for the
    // request to go out, delete "me", and the reserved-word verdict for "about"
    // gets overwritten by a green "Available" from the in-flight "aboutme".
    const seq = ++seqRef.current;
    abortRef.current?.abort();
    abortRef.current = null;

    if (mode !== "signup") return;
    const trimmed = username.trim();

    if (!usernameOk) {
      setAvail({ state: "idle" });
      return;
    }

    // Reserved names are knowable locally and instantly. (The two visible rows
    // don't cover them, so without this the row would spin and then report
    // "reserved" after a round-trip.)
    const local = usernameError(trimmed);
    if (local) {
      setAvail({ state: "unavailable", reason: local });
      return;
    }

    // Enter "checking" synchronously, BEFORE the debounce, so a stale green tick
    // from the previous name can never sit beneath a name the user has since
    // edited. This line is the one that prevents that.
    setAvail({ state: "checking" });

    const timer = setTimeout(() => {
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      usernameUnavailableReason(trimmed, ctrl.signal)
        .then((reason) => {
          if (seq !== seqRef.current) return;
          setAvail(
            reason ? { state: "unavailable", reason } : { state: "available" },
          );
        })
        .catch(() => {
          if (seq !== seqRef.current) return;
          // Fail OPEN. If the check can't run (offline, or the migration isn't
          // deployed yet) the visitor must still be able to sign up — the server
          // is the real authority and still rejects a taken name with a clear
          // message. Failing closed would make a network blip an unpassable gate.
          setAvail({ state: "idle" });
        });
    }, 400);

    return () => clearTimeout(timer);
  }, [username, mode, usernameOk]);

  // Focus the first field on load and whenever the tab changes, so keyboard
  // users always land in the new form: the reset tab renders `#reset-email`,
  // sign in / sign up render `#email` (email comes before the username field).
  useEffect(() => {
    const id = mode === "reset" ? "reset-email" : "email";
    document.getElementById(id)?.focus();
  }, [mode]);

  function switchMode(next: Mode) {
    setMode(next);
    setAttempted(false);
    setError(null);
    setEmailError(null);
    setNotice(null);
  }

  // Record the "stay signed in" choice so SessionGuard can drop the session on
  // the next browser launch when the user opted out.
  function persistRemember() {
    try {
      localStorage.setItem(
        "stacked-remember",
        staySignedIn ? "persist" : "session",
      );
      sessionStorage.setItem("stacked-session-active", "1");
    } catch {
      // Storage unavailable (e.g. privacy mode) — fall back to Supabase's
      // default persistent behavior.
    }
  }

  async function handleGoogle() {
    setLoading(true);
    setError(null);
    setEmailError(null);
    setNotice(null);
    // Remember the "stay signed in" choice before we leave for Google, since
    // the callback lands on a fresh navigation.
    persistRemember();

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`,
      },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    }
    // On success the browser is redirected to Google, so no further work here.
  }

  // Send a password-reset email. The link routes through /auth/callback (which
  // exchanges the recovery code into a session) on to /auth/reset.
  async function handleResetRequest(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setEmailError(null);
    setNotice(null);

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/auth/reset")}`,
    });
    if (error) {
      reportAuthError(error.message);
      setLoading(false);
      return;
    }
    setNotice(
      "If an account exists for that email, a reset link is on its way. Check your inbox.",
    );
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setEmailError(null);
    setNotice(null);

    const supabase = createClient();

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        reportAuthError(error.message);
        setLoading(false);
        return;
      }
      persistRemember();
      router.push(redirectTo);
      router.refresh();
      return;
    }

    // Sign up. Surface the requirement checklists in red if anything's unmet.
    if (!usernameOk || !passwordOk) {
      setAttempted(true);
      setLoading(false);
      return;
    }

    // Validate the username locally before creating anything.
    const usernameProblem = usernameError(username.trim());
    if (usernameProblem) {
      setError(usernameProblem);
      setLoading(false);
      return;
    }

    // Availability is a real requirement, so it gates the submit. A known-taken
    // name stops here instead of creating an account first and discovering the
    // collision afterwards.
    // The availability row already shows this reason in red, and a copy in the
    // shared `error` slot is never cleared on the next keystroke — it would sit
    // there contradicting a later verdict. So just turn the row red.
    if (avail.state === "unavailable") {
      setAttempted(true);
      setLoading(false);
      return;
    }

    // Submitting while a check is still in flight (or after one failed): don't
    // block on the debounce, just ask once more, right now, and honour the
    // answer. If this lookup itself fails we carry on — the sign-up trigger and
    // set_username are still the real authority and will reject a taken name.
    if (avail.state !== "available") {
      try {
        // Same sequence discipline as the effect, so this write can't clobber a
        // newer verdict either.
        const seq = ++seqRef.current;
        const reason = await usernameUnavailableReason(username.trim());
        if (reason) {
          if (seq === seqRef.current) {
            setAvail({ state: "unavailable", reason });
          }
          setAttempted(true);
          setLoading(false);
          return;
        }
        if (seq === seqRef.current) setAvail({ state: "available" });
      } catch {
        // Unknown — fall through and let the server decide.
      }
    }

    // If a prior attempt already created the account (e.g. the username was
    // taken), we're already signed in — reuse that session and just retry the
    // username instead of signing up again.
    const { data: sessionData } = await supabase.auth.getSession();
    let hasSession = Boolean(sessionData.session);

    if (!hasSession) {
      // Pass the chosen username as user metadata so the sign-up trigger claims
      // it server-side immediately — even when email confirmation is on and no
      // session is returned yet. This way a confirmed account already has its
      // username and skips the "set a username" Settings step. The confirmation
      // link routes back through /auth/callback so the session is established
      // and the user lands on their page.
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { username: username.trim() },
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`,
        },
      });
      if (error) {
        reportAuthError(error.message);
        setLoading(false);
        return;
      }
      if (!data.session) {
        setNotice("Check your email to confirm your account, then sign in.");
        setMode("signin");
        setLoading(false);
        return;
      }
      hasSession = true;
    }

    // Claim the username now that we have a session.
    try {
      await setUsername(username);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't set username.");
      setLoading(false);
      return;
    }

    persistRemember();
    router.push(redirectTo);
    router.refresh();
  }

  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden px-6 py-16">
      {/* Soft brand aurora behind the card so auth feels "lit" like the landing
          hero, not a bare form on a black void. Low-opacity + heavily blurred. */}
      <div
        aria-hidden
        className="aurora-a pointer-events-none absolute left-1/2 top-1/2 h-[440px] w-[560px] max-w-[90vw] rounded-full opacity-[0.13] blur-[120px]"
        style={{ background: "var(--brand-grad)" }}
      />
      <div className="relative flex w-full max-w-sm flex-col items-center gap-6">
        {/* Wordmark ties the auth screen back to the brand and links home. */}
        <Link
          href="/"
          className="group flex items-center gap-2 text-lg font-semibold tracking-tight"
        >
          <StackedMark
            variant="brand"
            className="size-6 transition-transform duration-300 group-hover:scale-110"
          />
          <span>
            stacked<span className="brand-text">.</span>
          </span>
        </Link>
        <Card className="w-full">
          {/* Keyed on mode so the content re-plays a slide/fade on tab switch. */}
          <CardHeader>
            <div key={mode} className="animate-slide-up">
              <CardTitle>
                {mode === "signin"
                  ? "Sign in"
                  : mode === "signup"
                    ? "Create your account"
                    : "Reset your password"}
              </CardTitle>
              <CardDescription className="mt-1.5">
                {mode === "signin"
                  ? "Sign in to edit your page."
                  : mode === "signup"
                    ? "Sign up to start building your page."
                    : "Enter your email and we'll send you a reset link."}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div key={mode} className="animate-slide-up">
              {mode === "reset" ? (
                <form
                  onSubmit={handleResetRequest}
                  className="flex flex-col gap-4"
                >
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="reset-email">Email</Label>
                    <Input
                      id="reset-email"
                      type="email"
                      autoComplete="email"
                      required
                      aria-invalid={emailError ? true : undefined}
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setEmailError(null);
                      }}
                    />
                    {emailError ? (
                      <p className="animate-slide-up text-sm text-red-400">
                        {emailError}
                      </p>
                    ) : null}
                  </div>

                  {error ? (
                    <p className="animate-slide-up text-sm text-red-400">
                      {error}
                    </p>
                  ) : null}
                  {notice ? (
                    <p className="animate-slide-up text-sm text-muted-foreground">
                      {notice}
                    </p>
                  ) : null}

                  <Button type="submit" disabled={loading || !emailOk}>
                    {loading ? "Please wait…" : "Send reset link"}
                  </Button>

                  <p className="text-center text-sm text-muted-foreground">
                    <button
                      type="button"
                      className="font-medium text-foreground underline-offset-4 hover:underline"
                      onClick={() => switchMode("signin")}
                    >
                      Back to sign in
                    </button>
                  </p>
                </form>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    disabled={loading}
                    onClick={handleGoogle}
                  >
                    <GoogleIcon className="size-4" />
                    Continue with Google
                  </Button>

                  <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="h-px flex-1 bg-border" />
                    or
                    <span className="h-px flex-1 bg-border" />
                  </div>

                  <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        autoComplete="email"
                        required
                        aria-invalid={emailError ? true : undefined}
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          setEmailError(null);
                        }}
                      />
                      {emailError ? (
                        <p className="animate-slide-up text-sm text-red-400">
                          {emailError}
                        </p>
                      ) : null}
                    </div>

                    {mode === "signup" ? (
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="username">Username</Label>
                        {/* Fixed "stacked.page/" prefix sits to the left of the box
                      so the field previews the resulting page address. */}
                        <div className="flex items-center gap-1">
                          <span className="shrink-0 select-none font-mono text-sm text-muted-foreground">
                            stacked.page/
                          </span>
                          <Input
                            id="username"
                            autoComplete="off"
                            spellCheck={false}
                            // Mobile keyboards capitalize a field's first
                            // letter by default, and usernames are stored
                            // case-preserving -- so without these, typing "kaze"
                            // on a phone claims "Kaze". Matches the hero's claim
                            // field (home-hero.tsx); keep the three username
                            // inputs in step.
                            autoCapitalize="none"
                            autoCorrect="off"
                            maxLength={30}
                            value={username}
                            onChange={(e) => setUsernameValue(e.target.value)}
                            // Locked while submitting: the handler has already
                            // captured this value, so letting it change mid-flight
                            // would claim a different name than the one that was
                            // checked.
                            disabled={loading}
                            className="flex-1"
                          />
                        </div>
                        <ul className="mt-1 flex flex-col gap-1">
                          {usernameReqs.map((r) => (
                            <Requirement
                              key={r.label}
                              met={r.met}
                              attempted={attempted}
                            >
                              {r.label}
                            </Requirement>
                          ))}
                          {/* Availability. Shown once the local rules pass —
                              before that it would just be a second way of
                              saying the name is malformed. Hidden in the `idle`
                              state, which only happens when the check could not
                              run at all: an unanswerable requirement shouldn't
                              claim the name is unavailable. */}
                          {usernameOk && avail.state !== "idle" ? (
                            <Requirement
                              met={avail.state === "available"}
                              pending={avail.state === "checking"}
                              attempted={
                                attempted || avail.state === "unavailable"
                              }
                            >
                              {avail.state === "unavailable"
                                ? avail.reason
                                : avail.state === "checking"
                                  ? "Checking availability…"
                                  : "Available"}
                            </Requirement>
                          ) : null}
                        </ul>
                      </div>
                    ) : null}

                    <div className="flex flex-col gap-2">
                      <Label htmlFor="password">Password</Label>
                      <div className="relative">
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          autoComplete={
                            mode === "signin"
                              ? "current-password"
                              : "new-password"
                          }
                          // Sign-up validity is enforced by the checklist below, so
                          // native `required` would block our custom red state.
                          required={mode === "signin"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="pr-10"
                        />
                        <PasswordToggle
                          visible={showPassword}
                          onToggle={() => setShowPassword((v) => !v)}
                        />
                      </div>
                      {mode === "signup" ? (
                        <ul className="mt-1 flex flex-col gap-1">
                          {passwordReqs.map((r) => (
                            <Requirement
                              key={r.label}
                              met={r.met}
                              attempted={attempted}
                            >
                              {r.label}
                            </Requirement>
                          ))}
                        </ul>
                      ) : null}
                    </div>

                    {mode === "signin" ? (
                      <div className="flex items-center justify-between">
                        <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground select-none">
                          <input
                            type="checkbox"
                            checked={staySignedIn}
                            onChange={(e) => setStaySignedIn(e.target.checked)}
                            className="size-4 rounded border-input accent-foreground"
                          />
                          Stay signed in
                        </label>
                        <button
                          type="button"
                          onClick={() => switchMode("reset")}
                          className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                        >
                          Forgot password?
                        </button>
                      </div>
                    ) : null}

                    {error ? (
                      <p className="animate-slide-up text-sm text-red-400">
                        {error}
                      </p>
                    ) : null}
                    {notice ? (
                      <p className="animate-slide-up text-sm text-muted-foreground">
                        {notice}
                      </p>
                    ) : null}

                    <Button
                      type="submit"
                      disabled={loading || (mode === "signup" && !emailOk)}
                    >
                      {loading
                        ? "Please wait…"
                        : mode === "signin"
                          ? "Sign in"
                          : "Sign up"}
                    </Button>
                  </form>

                  <p className="mt-4 text-center text-sm text-muted-foreground">
                    {mode === "signin" ? (
                      <>
                        Don&apos;t have an account?{" "}
                        <button
                          type="button"
                          className="font-medium text-foreground underline-offset-4 hover:underline"
                          onClick={() => switchMode("signup")}
                        >
                          Sign up
                        </button>
                      </>
                    ) : (
                      <>
                        Already have an account?{" "}
                        <button
                          type="button"
                          className="font-medium text-foreground underline-offset-4 hover:underline"
                          onClick={() => switchMode("signin")}
                        >
                          Sign in
                        </button>
                      </>
                    )}
                  </p>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
