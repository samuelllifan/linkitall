"use client";

import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { setUsername as saveUsername } from "~/lib/profiles";
import { createClient } from "~/lib/supabase/client";
import { useUnsavedGuard } from "~/lib/unsaved-guard";
import { cn } from "~/lib/utils";

type Category = "account" | "accessibility";

const CATEGORIES: { key: Category; label: string }[] = [
  { key: "account", label: "Account" },
  { key: "accessibility", label: "Accessibility" },
];

const PASSWORD_PLACEHOLDER = "••••••••";

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" x2="22" y1="2" y2="22" />
    </svg>
  );
}

function usePresence(active: boolean, duration = 250) {
  const [value, setValue] = useState(active);
  const [visible, setVisible] = useState(active);

  useEffect(() => {
    if (active) {
      setValue(true);
      setVisible(true);
      return;
    }
    if (value) {
      setVisible(false);
      const t = setTimeout(() => setValue(false), duration);
      return () => clearTimeout(t);
    }
  }, [active, value, duration]);

  return { value, visible };
}

function AccountSection({
  usernameInput,
  setUsernameInput,
  password,
  setPassword,
  showPassword,
  setShowPassword,
  editingPassword,
  setEditingPassword,
  userEmail,
  msg,
}: {
  usernameInput: string;
  setUsernameInput: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  showPassword: boolean;
  setShowPassword: (v: boolean | ((p: boolean) => boolean)) => void;
  editingPassword: boolean;
  setEditingPassword: (v: boolean) => void;
  userEmail: string;
  msg: { text: string; error: boolean } | null;
}) {
  return (
    <div className="flex flex-col gap-8">
      {/* Username */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="settings-username">Username</Label>
        <Input
          id="settings-username"
          value={usernameInput}
          onChange={(e) => setUsernameInput(e.target.value)}
          placeholder="username"
          autoComplete="off"
          spellCheck={false}
          className="max-w-xs"
        />
        <p className="text-xs text-muted-foreground">
          This is your public page address.
        </p>
      </div>

      {/* Email */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="settings-email">Email</Label>
        <Input
          id="settings-email"
          value={userEmail}
          readOnly
          className="max-w-xs cursor-default text-muted-foreground focus-visible:ring-0"
        />
        <p className="text-xs text-muted-foreground">
          The email your account is connected to.
        </p>
      </div>

      {/* Password */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="settings-password">Password</Label>
        <div className="relative max-w-xs">
          <Input
            id="settings-password"
            type={editingPassword && showPassword ? "text" : "password"}
            value={password}
            onFocus={() => {
              if (!editingPassword) {
                setEditingPassword(true);
                setPassword("");
              }
            }}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            minLength={6}
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v: boolean) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground transition-colors hover:text-foreground"
          >
            {showPassword ? (
              <EyeOffIcon className="size-4" />
            ) : (
              <EyeIcon className="size-4" />
            )}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          Enter a new password (at least 6 characters) to change it.
        </p>
      </div>

      {msg ? (
        <p
          className={cn(
            "text-sm",
            msg.error ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {msg.text}
        </p>
      ) : null}
    </div>
  );
}

function AccessibilitySection() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = mounted && resolvedTheme === "dark";

  return (
    <div className="flex max-w-md items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium">Dark mode</p>
        <p className="text-xs text-muted-foreground">
          Switch between light and dark themes.
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={isDark}
        aria-label="Toggle dark mode"
        onClick={() => setTheme(isDark ? "light" : "dark")}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
          isDark ? "bg-foreground" : "bg-input",
        )}
      >
        <span
          className={cn(
            "inline-block size-4 rounded-full bg-background transition-transform",
            isDark ? "translate-x-6" : "translate-x-1",
          )}
        />
      </button>
    </div>
  );
}

export function SettingsClient({
  userEmail,
  username,
}: {
  userEmail: string;
  username: string | null;
}) {
  const router = useRouter();
  const [active, setActive] = useState<Category>("account");

  // Editable fields — state lifted here so the unsaved bar can track dirty.
  const [usernameInput, setUsernameInput] = useState(username ?? "");
  const [password, setPassword] = useState(PASSWORD_PLACEHOLDER);
  const [showPassword, setShowPassword] = useState(false);
  const [editingPassword, setEditingPassword] = useState(false);

  // Save flow.
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; error: boolean } | null>(null);
  const [confirming, setConfirming] = useState(false);

  const usernameChanged = usernameInput.trim() !== (username ?? "");
  const passwordChanged = editingPassword && password.length >= 6;
  const dirty = usernameChanged || passwordChanged;

  const bar = usePresence(dirty);

  // Flash animation for the bar.
  const [flashing, setFlashing] = useState(false);
  const [flashKey, setFlashKey] = useState(0);

  // Sync dirty state with the global unsaved guard so navbar links are blocked.
  const guard = useUnsavedGuard();

  const flash = useCallback(() => {
    setFlashKey((k) => k + 1);
    setFlashing(true);
  }, []);

  useEffect(() => {
    guard.setDirty(dirty);
    guard.setOnBlocked(dirty ? flash : null);
    return () => {
      guard.setDirty(false);
      guard.setOnBlocked(null);
    };
  }, [dirty, guard, flash]);

  // Prevent switching category with unsaved changes.
  function handleCategorySwitch(cat: Category) {
    if (dirty) {
      setFlashKey((k) => k + 1);
      setFlashing(true);
      return;
    }
    setActive(cat);
  }

  function reset() {
    setUsernameInput(username ?? "");
    setPassword(PASSWORD_PLACEHOLDER);
    setShowPassword(false);
    setEditingPassword(false);
    setMsg(null);
    setConfirming(false);
  }

  function handleSave() {
    setConfirming(true);
  }

  // Ref to track the confirm dialog for outside-click handling.
  const confirmRef = useRef<HTMLDivElement | null>(null);

  async function confirmSave() {
    setSaving(true);
    setMsg(null);
    setConfirming(false);

    try {
      if (usernameChanged) {
        await saveUsername(usernameInput);
      }
      if (passwordChanged) {
        const { error } = await createClient().auth.updateUser({ password });
        if (error) throw new Error(error.message);
      }
      setMsg({ text: "Changes saved.", error: false });
      setPassword(PASSWORD_PLACEHOLDER);
      setShowPassword(false);
      setEditingPassword(false);
      router.refresh();
    } catch (err) {
      setMsg({
        text: err instanceof Error ? err.message : "Couldn't save changes.",
        error: true,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
      <h1 className="mb-8 text-2xl font-semibold tracking-tight">Settings</h1>

      <div className="flex flex-col gap-8 sm:flex-row sm:gap-12">
        {/* Category sidebar */}
        <nav className="flex shrink-0 gap-1 overflow-x-auto sm:w-48 sm:flex-col sm:overflow-visible">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              type="button"
              onClick={() => handleCategorySwitch(cat.key)}
              aria-current={active === cat.key}
              className={cn(
                "rounded-md px-3 py-2 text-left text-sm transition-colors",
                active === cat.key
                  ? "bg-muted font-medium text-foreground"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
            >
              {cat.label}
            </button>
          ))}
        </nav>

        {/* Active section */}
        <section key={active} className="animate-slide-up min-w-0 flex-1">
          {active === "account" ? (
            <AccountSection
              usernameInput={usernameInput}
              setUsernameInput={setUsernameInput}
              password={password}
              setPassword={setPassword}
              showPassword={showPassword}
              setShowPassword={setShowPassword}
              editingPassword={editingPassword}
              setEditingPassword={setEditingPassword}
              userEmail={userEmail}
              msg={msg}
            />
          ) : (
            <AccessibilitySection />
          )}
        </section>
      </div>

      {/* Unsaved-changes bar */}
      {bar.value ? (
        <div
          className={cn(
            "pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center px-4",
            bar.visible ? "animate-slide-up" : "animate-slide-down",
          )}
        >
          <div
            key={flashKey}
            onAnimationEnd={() => setFlashing(false)}
            className={cn(
              "pointer-events-auto flex items-center gap-4 rounded-lg border border-border bg-background px-4 py-2 shadow-lg",
              flashing && "animate-flash",
            )}
          >
            <span className="text-sm text-muted-foreground">
              You have unsaved changes
            </span>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={reset}>
                Reset
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Confirm dialog */}
      {confirming ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0 animate-fade bg-black/50"
            onClick={() => setConfirming(false)}
          />
          <div
            ref={confirmRef}
            className="relative w-full max-w-sm animate-pop rounded-lg border border-border bg-background p-6 shadow-lg"
          >
            <h2 className="text-lg font-semibold">Confirm changes</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Are you sure you want to save these changes?
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirming(false)}
                className="text-red-400 hover:bg-red-400/10 hover:text-red-400 dark:hover:bg-red-400/10"
              >
                Cancel
              </Button>
              <Button size="sm" onClick={confirmSave}>
                Confirm
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
