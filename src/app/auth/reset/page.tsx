"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AuthCard } from "~/components/auth-card";
import { Button } from "~/components/ui/button";
import { Collapse } from "~/components/ui/collapse";
import { FormNote } from "~/components/ui/form-note";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { PasswordToggle } from "~/components/ui/password-toggle";
import { Requirement } from "~/components/ui/requirement";
import { createClient } from "~/lib/supabase/client";

/** Reached from the password-reset email (via /auth/callback, which exchanges
 * the recovery code into a session). The user sets a new password here. */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  // Drives the height-animated checklist under the field.
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // A recovery session must be present (established by /auth/callback). If it's
  // missing, the link was invalid, expired, or opened on another device.
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      setHasSession(Boolean(data.session));
      setChecking(false);
    });
  }, []);

  // Focus the password field once the form is shown so the user can type right
  // away (matches the login form's autofocus behavior).
  const passwordRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!checking && hasSession) passwordRef.current?.focus();
  }, [checking, hasSession]);

  // Clear the post-save redirect timer if the component unmounts first, so the
  // navigation can't fire against a torn-down router.
  const redirectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (redirectRef.current) clearTimeout(redirectRef.current);
    },
    [],
  );

  const reqs = [
    { label: "At least 8 characters", met: password.length >= 8 },
    { label: "Contains a letter", met: /[A-Za-z]/.test(password) },
    { label: "Contains a number", met: /[0-9]/.test(password) },
  ];
  const passwordOk = reqs.every((r) => r.met);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!passwordOk) {
      setAttempted(true);
      return;
    }
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    setDone(true);
    setLoading(false);
    // Give a beat to read the confirmation, then continue into the app.
    redirectRef.current = setTimeout(() => {
      router.push("/my-page");
      router.refresh();
    }, 1200);
  }

  return (
    <AuthCard
      title="Set a new password"
      description="Choose a new password for your account."
    >
      {checking ? (
        <FormNote tone="muted">Verifying your link…</FormNote>
      ) : !hasSession ? (
        <div className="flex flex-col gap-4">
          <FormNote tone="danger">
            This reset link is invalid or has expired. Request a new one from
            the sign-in page.
          </FormNote>
          <Button asChild variant="outline">
            <a href="/login">Back to sign in</a>
          </Button>
        </div>
      ) : done ? (
        <FormNote tone="muted">
          Password updated. Taking you to your page…
        </FormNote>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">New password</Label>
            <div className="relative">
              <Input
                ref={passwordRef}
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
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
            {/* Same height-animated checklist as sign-up, on the same trigger:
                the rules show once the field is in play and fold away when they
                have nothing to say. */}
            <Collapse
              open={passwordFocused || password.length > 0 || attempted}
            >
              <ul className="flex flex-col gap-1 pt-1">
                {reqs.map((r) => (
                  <Requirement key={r.label} met={r.met} attempted={attempted}>
                    {r.label}
                  </Requirement>
                ))}
              </ul>
            </Collapse>
          </div>

          <FormNote tone="danger">{error}</FormNote>

          <Button type="submit" disabled={loading}>
            {loading ? "Please wait…" : "Update password"}
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
