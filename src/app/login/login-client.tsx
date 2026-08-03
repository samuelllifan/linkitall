"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
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
import { setUsername, usernameError } from "~/lib/profiles";
import { createClient } from "~/lib/supabase/client";
import { cn } from "~/lib/utils";

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

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

/** A single requirement row: green when met, red when not. */
function Requirement({
  met,
  attempted,
  children,
}: {
  met: boolean;
  // Only tint unmet requirements red once the user has tried to submit;
  // before that they stay neutral so the form doesn't look angry on load.
  attempted: boolean;
  children: React.ReactNode;
}) {
  return (
    <li
      className={cn(
        "flex items-center gap-2 text-xs transition-colors duration-200",
        met
          ? "text-green-500"
          : attempted
            ? "text-red-400"
            : "text-muted-foreground",
      )}
    >
      <span className="flex size-3.5 shrink-0 items-center justify-center">
        {met ? (
          <CheckIcon className="size-3.5 animate-pop" />
        ) : (
          <span className="size-1 rounded-full bg-current" />
        )}
      </span>
      {children}
    </li>
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

  // Focus the email field on load so you can start typing straight away. The
  // initial mode is only ever sign-in/sign-up (both render `#email`); the reset
  // tab is reached by a click, when focus is already where the user put it.
  useEffect(() => {
    document.getElementById("email")?.focus();
  }, []);

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
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <Card className="w-full max-w-sm">
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
                        <span className="shrink-0 text-sm text-muted-foreground select-none">
                          stacked.page/
                        </span>
                        <Input
                          id="username"
                          autoComplete="off"
                          spellCheck={false}
                          maxLength={30}
                          value={username}
                          onChange={(e) => setUsernameValue(e.target.value)}
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
    </main>
  );
}
