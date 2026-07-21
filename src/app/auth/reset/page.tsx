"use client";

import { useRouter } from "next/navigation";
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
import { createClient } from "~/lib/supabase/client";
import { cn } from "~/lib/utils";

/** Reached from the password-reset email (via /auth/callback, which exchanges
 * the recovery code into a session). The user sets a new password here. */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
    setTimeout(() => {
      router.push("/my-page");
      router.refresh();
    }, 1200);
  }

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Set a new password</CardTitle>
          <CardDescription className="mt-1.5">
            Choose a new password for your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {checking ? (
            <p className="text-sm text-muted-foreground">
              Verifying your link…
            </p>
          ) : !hasSession ? (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-red-400">
                This reset link is invalid or has expired. Request a new one
                from the sign-in page.
              </p>
              <Button asChild variant="outline">
                <a href="/login">Back to sign in</a>
              </Button>
            </div>
          ) : done ? (
            <p className="animate-slide-up text-sm text-muted-foreground">
              Password updated. Taking you to your page…
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="password">New password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pr-16"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
                <ul className="mt-1 flex flex-col gap-1">
                  {reqs.map((r) => (
                    <li
                      key={r.label}
                      className={cn(
                        "flex items-center gap-2 text-xs transition-colors duration-200",
                        r.met
                          ? "text-green-500"
                          : attempted
                            ? "text-red-400"
                            : "text-muted-foreground",
                      )}
                    >
                      <span
                        className={cn(
                          "size-1.5 rounded-full",
                          r.met ? "bg-green-500" : "bg-current",
                        )}
                      />
                      {r.label}
                    </li>
                  ))}
                </ul>
              </div>

              {error ? (
                <p className="animate-slide-up text-sm text-red-400">{error}</p>
              ) : null}

              <Button type="submit" disabled={loading}>
                {loading ? "Please wait…" : "Update password"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
