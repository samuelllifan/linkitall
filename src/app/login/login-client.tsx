"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthCard } from "~/components/auth-card";
import { Button } from "~/components/ui/button";
import { Collapse } from "~/components/ui/collapse";
import { FormNote } from "~/components/ui/form-note";
import { GoogleMark } from "~/components/ui/google-mark";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { PasswordToggle } from "~/components/ui/password-toggle";
import { Requirement } from "~/components/ui/requirement";
import { Toggle } from "~/components/ui/toggle";
import { UsernameAvailability } from "~/components/ui/username-availability";
import { setUsername, usernameError } from "~/lib/profiles";
import { createClient } from "~/lib/supabase/client";
import { useUsernameAvailability } from "~/lib/use-username-availability";

type Mode = "signin" | "signup" | "reset";

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
  // Drives the height-animated checklists below the two fields that have one.
  const [usernameFocused, setUsernameFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
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
      label: "Between 1 and 30 characters",
      met: username.length >= 1 && username.length <= 30,
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

  // Is the chosen name free? The app's shared check (~/lib/use-username-
  // availability) — the same one the promo card and settings ask. Gated on the
  // local rules passing: the checklist above is already the feedback for a
  // malformed name, so there is nothing to ask the server about yet.
  const { avail, verify: verifyUsername } = useUsernameAvailability(
    username,
    mode === "signup" && usernameOk,
  );

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
      // `verify` writes the verdict back under the same sequence discipline as
      // the debounced check, so this answer can't clobber a newer one either,
      // and it returns null when the lookup itself failed — unknown, so carry
      // on and let the server decide.
      const reason = await verifyUsername();
      if (reason) {
        setAttempted(true);
        setLoading(false);
        return;
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

  /* ---- Render ------------------------------------------------------------ */

  // The card's header, keyed by mode.
  const head = {
    signin: {
      title: "Sign in",
      description: "Sign in to edit your page.",
    },
    signup: {
      title: "Create your account",
      description: "Sign up to start building your page.",
    },
    reset: {
      title: "Reset your password",
      description: "Enter your email and we'll send you a reset link.",
    },
  }[mode];

  // The username checklist and the password checklist are height-animated
  // rather than always-on, the way settings does it: the rules appear when the
  // field is in play (focused, filled, or holding up a submit) and fold away
  // when they have nothing to say. A form that opens with two grey checklists
  // already showing reads as a list of things you have got wrong.
  const showUsernameReqs = usernameFocused || username.length > 0 || attempted;
  const showPasswordReqs = passwordFocused || password.length > 0 || attempted;

  return (
    <AuthCard
      title={head.title}
      description={head.description}
      motionKey={mode}
    >
      {mode === "reset" ? (
        <form onSubmit={handleResetRequest} className="flex flex-col gap-4">
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
            <FormNote tone="danger">{emailError}</FormNote>
          </div>

          <FormNote tone="danger">{error}</FormNote>
          <FormNote tone="muted">{notice}</FormNote>

          <Button type="submit" disabled={loading || !emailOk}>
            {loading ? "Please wait…" : "Send reset link"}
          </Button>

          <p className="text-center text-muted-foreground text-sm">
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
            <GoogleMark className="size-4" />
            Continue with Google
          </Button>

          <div className="my-4 flex items-center gap-3 text-muted-foreground text-xs">
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
              <FormNote tone="danger">{emailError}</FormNote>
            </div>

            {mode === "signup" ? (
              <div className="flex flex-col gap-2">
                <Label htmlFor="username">Username</Label>
                {/* The app's one claim field — the same control as the
                            landing hero, the promo card and settings, prefix
                            inside the box and cycling brand ring included.
                            This used to be a bare <span> beside a plain
                            <Input>, which made the one screen where you
                            actually choose your address the only one where it
                            did not look like an address.

                            `--claim-fill` is the field's OPAQUE interior; its
                            default (`--card`) is the surface this card is made
                            of, so it would vanish into it. Matching the sibling
                            <Input>'s computed fill — `bg-input/30` over
                            `--card` — is what settings does, for the same
                            reason.

                            A <label>, not a <div>: the prefix sits inside the
                            box, so clicking it has to put the caret in the
                            input instead of swallowing the click. */}
                <label
                  htmlFor="username"
                  className="claim-field flex h-9 cursor-text items-center rounded-lg pl-3"
                  style={
                    {
                      "--claim-fill":
                        "color-mix(in oklab, var(--input) 30%, var(--card))",
                    } as React.CSSProperties
                  }
                >
                  <span
                    className="no-zoom shrink-0 select-none font-mono text-muted-foreground text-sm"
                    style={
                      {
                        "--no-zoom-fs": "0.875rem",
                      } as React.CSSProperties
                    }
                  >
                    stacked.page/
                  </span>
                  <input
                    id="username"
                    autoComplete="off"
                    spellCheck={false}
                    // Mobile keyboards capitalize a field's first
                    // letter by default, and usernames are stored
                    // case-preserving -- so without these, typing
                    // "kaze" on a phone claims "Kaze". Matches the
                    // hero's claim field (home-hero.tsx) and settings;
                    // keep the three username inputs in step.
                    autoCapitalize="none"
                    autoCorrect="off"
                    maxLength={30}
                    value={username}
                    onChange={(e) => setUsernameValue(e.target.value)}
                    onFocus={() => setUsernameFocused(true)}
                    onBlur={() => setUsernameFocused(false)}
                    // Locked while submitting: the handler has already
                    // captured this value, so letting it change
                    // mid-flight would claim a different name than the
                    // one that was checked.
                    disabled={loading}
                    className="no-zoom min-w-0 flex-1 bg-transparent py-2 pr-3 font-mono text-foreground text-sm outline-none disabled:opacity-50"
                    style={
                      {
                        "--no-zoom-fs": "0.875rem",
                      } as React.CSSProperties
                    }
                  />
                </label>

                <Collapse open={showUsernameReqs}>
                  <div className="pt-1">
                    <ul className="flex flex-col gap-1">
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
                    {/* Availability — the dot, not a checklist row: the two
                        rules above are things the visitor controls, this is a
                        verdict from the server. Same read-out as the promo card
                        and settings.

                        `show`, not a conditional: the row animates its own
                        height (see the component), and an unmounted row cannot
                        animate. It also stays gated on `usernameOk` — the hook
                        resets to idle when the rules stop passing, but that
                        lands a paint later, so without the gate typing a "-"
                        onto a name that had already come back green shows a
                        green "Available" for one frame directly beneath a rule
                        that has just gone red. */}
                    <UsernameAvailability avail={avail} show={usernameOk} />
                  </div>
                </Collapse>
              </div>
            ) : null}

            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={
                    mode === "signin" ? "current-password" : "new-password"
                  }
                  // Sign-up validity is enforced by the checklist below,
                  // so native `required` would block our custom red
                  // state.
                  required={mode === "signin"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                  className="pr-10"
                />
                <PasswordToggle
                  visible={showPassword}
                  onToggle={() => setShowPassword((v) => !v)}
                />
              </div>
              {mode === "signup" ? (
                <Collapse open={showPasswordReqs}>
                  <ul className="flex flex-col gap-1 pt-1">
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
                </Collapse>
              ) : null}
            </div>

            {mode === "signin" ? (
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                {/* The app's switch, not a bare checkbox painted with
                    `accent-foreground`: this is the same control every setting
                    uses, so "on" means the same thing here.

                    The switch and its label are ONE group at the start of the
                    row, with "Forgot password?" pushed to the far end.
                    Splitting them — label, link, switch — put an unrelated
                    control between a label and the thing it names, which reads
                    as though the link is what the switch turns on.

                    It WRAPS rather than squeezing. A 44px switch, "Stay signed
                    in" and "Forgot password?" need about 290px and a phone
                    gives this row 279, so held on one line the label broke
                    mid-phrase into "Stay signed / in" beside its own switch.
                    `nowrap` on the two pieces of text plus `flex-wrap` on the
                    row moves the link to its own line on the narrowest screens
                    instead. */}
                <div className="flex min-w-0 items-center gap-2.5">
                  <Toggle
                    id="stay-signed-in"
                    checked={staySignedIn}
                    onChange={setStaySignedIn}
                    label="Stay signed in"
                  />
                  <Label
                    htmlFor="stay-signed-in"
                    className="cursor-pointer whitespace-nowrap font-normal text-muted-foreground"
                  >
                    Stay signed in
                  </Label>
                </div>
                <button
                  type="button"
                  onClick={() => switchMode("reset")}
                  className="ml-auto shrink-0 whitespace-nowrap font-medium text-muted-foreground text-sm underline-offset-4 hover:text-foreground hover:underline"
                >
                  Forgot password?
                </button>
              </div>
            ) : null}

            <FormNote tone="danger">{error}</FormNote>
            <FormNote tone="muted">{notice}</FormNote>

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

          <p className="mt-4 text-center text-muted-foreground text-sm">
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
    </AuthCard>
  );
}
