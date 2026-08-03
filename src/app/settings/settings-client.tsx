"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { PasswordToggle } from "~/components/ui/password-toggle";
import { setUsername as saveUsername } from "~/lib/profiles";
import { createClient } from "~/lib/supabase/client";
import { useUnsavedGuard } from "~/lib/unsaved-guard";
import { cn } from "~/lib/utils";
import { isEveryOpen, setEveryOpen } from "~/lib/whats-new";

type Category = "account" | "security" | "privacy" | "accessibility";

const CATEGORIES: { key: Category; label: string }[] = [
  { key: "account", label: "Account" },
  { key: "security", label: "Security" },
  { key: "privacy", label: "Privacy" },
  { key: "accessibility", label: "Accessibility" },
];

const CATEGORY_KEYS = new Set<string>(CATEGORIES.map((c) => c.key));

const PASSWORD_PLACEHOLDER = "••••••••";
// Pragmatic client-side check; Supabase re-validates authoritatively on save.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Hand-rolled switch — the repo has no toggle primitive, and the monochrome dark
 * theme needs the thumb colour to flip with state (a fixed thumb colour vanishes
 * against either the on- or off-track). role="switch" keeps it accessible.
 */
function Toggle({
  id,
  checked,
  onChange,
  label,
}: {
  id?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        checked ? "bg-foreground" : "bg-muted",
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block size-5 rounded-full shadow transition-transform",
          checked
            ? "translate-x-5 bg-background"
            : "translate-x-0.5 bg-foreground",
        )}
      />
    </button>
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
  emailInput,
  setEmailInput,
  password,
  setPassword,
  showPassword,
  setShowPassword,
  editingPassword,
  setEditingPassword,
  onDelete,
}: {
  usernameInput: string;
  setUsernameInput: (v: string) => void;
  emailInput: string;
  setEmailInput: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  showPassword: boolean;
  setShowPassword: (v: boolean | ((p: boolean) => boolean)) => void;
  editingPassword: boolean;
  setEditingPassword: (v: boolean) => void;
  onDelete: () => void;
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
          type="email"
          value={emailInput}
          onChange={(e) => setEmailInput(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          spellCheck={false}
          className="max-w-xs"
        />
        <p className="text-xs text-muted-foreground">
          Changing this sends a confirmation link to the new address; it stays
          the same until you confirm.
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
          <PasswordToggle
            visible={showPassword}
            onToggle={() => setShowPassword((v: boolean) => !v)}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Enter a new password (at least 6 characters) to change it.
        </p>
      </div>

      {/* Delete account — lives at the bottom of Account, set apart by a
          divider and destructive styling rather than its own section. */}
      <div className="flex flex-col gap-3 border-border border-t pt-8">
        <div className="flex flex-col gap-1">
          <h2 className="font-medium text-foreground text-sm">
            Delete account
          </h2>
          <p className="max-w-md text-muted-foreground text-xs">
            Permanently deletes your account, your page, and all associated
            data. This can't be undone.
          </p>
        </div>
        <Button
          variant="destructive"
          size="sm"
          className="w-fit"
          onClick={onDelete}
        >
          Delete account
        </Button>
      </div>
    </div>
  );
}

function SecuritySection({
  signingOutAll,
  onSignOutEverywhere,
}: {
  signingOutAll: boolean;
  onSignOutEverywhere: () => void;
}) {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Label>Sign out of all devices</Label>
        <p className="max-w-md text-xs text-muted-foreground">
          Ends every active session, including other browsers and devices.
          You'll need to sign in again everywhere. Useful if you've lost a
          device or signed in somewhere you don't trust.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-1 w-fit"
          onClick={onSignOutEverywhere}
          disabled={signingOutAll}
        >
          {signingOutAll ? "Signing out…" : "Sign out everywhere"}
        </Button>
      </div>
    </div>
  );
}

function PrivacySection({
  indexable,
  setIndexable,
}: {
  indexable: boolean;
  setIndexable: (v: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <div className="flex max-w-md items-center justify-between gap-4">
          <Label htmlFor="settings-indexable">
            Show my page in search engines
          </Label>
          <Toggle
            id="settings-indexable"
            checked={indexable}
            onChange={setIndexable}
            label="Show my page in search engines"
          />
        </div>
        <p className="max-w-md text-xs text-muted-foreground">
          When off, your public page asks Google and other search engines not to
          index it. It stays reachable by anyone who has the direct link.
        </p>
      </div>
    </div>
  );
}

function AccessibilitySection({
  whatsNewEveryOpen,
  setWhatsNewEveryOpen,
}: {
  whatsNewEveryOpen: boolean;
  setWhatsNewEveryOpen: (v: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <div className="flex max-w-md items-center justify-between gap-4">
          <Label htmlFor="settings-whatsnew">
            Show What's New on every visit
          </Label>
          <Toggle
            id="settings-whatsnew"
            checked={whatsNewEveryOpen}
            onChange={setWhatsNewEveryOpen}
            label="Show What's New on every visit"
          />
        </div>
        <p className="max-w-md text-muted-foreground text-xs">
          When on, the What's New dialog pops up every time you open your own
          page — not just once per update. You can always reopen it from the
          "What's new" link in the footer.
        </p>
      </div>
    </div>
  );
}

export function SettingsClient({
  userId,
  userEmail,
  username,
  searchIndexable,
}: {
  userId: string;
  userEmail: string;
  username: string | null;
  searchIndexable: boolean;
}) {
  const router = useRouter();
  const [active, setActive] = useState<Category>("account");

  // Open the section named in the URL hash (e.g. /settings#accessibility, used
  // by the What's New "Don't show again" link) — on mount and whenever the hash
  // changes, so it works even when already on the settings page. Field state is
  // lifted here, so switching sections never discards in-progress edits.
  useEffect(() => {
    const applyHash = () => {
      const hash = window.location.hash.slice(1);
      if (CATEGORY_KEYS.has(hash)) setActive(hash as Category);
    };
    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, []);

  // Editable fields — state lifted here so the unsaved bar can track dirty.
  const [usernameInput, setUsernameInput] = useState(username ?? "");
  const [emailInput, setEmailInput] = useState(userEmail);
  // Baseline for the email diff. Unlike username, an email change only takes
  // effect after the user confirms it by link, so the server prop keeps showing
  // the old address; tracking a local baseline lets the "dirty" state clear on
  // save instead of getting stuck.
  const [baselineEmail, setBaselineEmail] = useState(userEmail);
  const [password, setPassword] = useState(PASSWORD_PLACEHOLDER);
  const [showPassword, setShowPassword] = useState(false);
  const [editingPassword, setEditingPassword] = useState(false);
  const [indexable, setIndexable] = useState(searchIndexable);
  const [baselineIndexable, setBaselineIndexable] = useState(searchIndexable);

  // Save flow.
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; error: boolean } | null>(null);
  const [confirming, setConfirming] = useState(false);

  // Security / account actions (immediate, outside the save flow).
  const [signingOutAll, setSigningOutAll] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  // Re-entered password confirming the account deletion.
  const [deletePassword, setDeletePassword] = useState("");
  const [showDeletePassword, setShowDeletePassword] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // "Show What's New on every visit" — a per-device preference stored in
  // localStorage (see ~/lib/whats-new). Read on mount so it never runs on the
  // server, and applied immediately on toggle (no save round-trip).
  const [whatsNewEveryOpen, setWhatsNewEveryOpenState] = useState(false);
  useEffect(() => {
    setWhatsNewEveryOpenState(isEveryOpen());
  }, []);
  const toggleWhatsNewEveryOpen = useCallback((v: boolean) => {
    setEveryOpen(v);
    setWhatsNewEveryOpenState(v);
  }, []);

  const usernameChanged = usernameInput.trim() !== (username ?? "");
  const emailTrimmed = emailInput.trim();
  const emailChanged =
    emailTrimmed.toLowerCase() !== baselineEmail.toLowerCase();
  const passwordChanged = editingPassword && password.length >= 6;
  const indexableChanged = indexable !== baselineIndexable;
  const dirty =
    usernameChanged || emailChanged || passwordChanged || indexableChanged;

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
    if (cat === active) return;
    if (dirty) {
      setFlashKey((k) => k + 1);
      setFlashing(true);
      return;
    }
    setMsg(null);
    setActive(cat);
  }

  function reset() {
    setUsernameInput(username ?? "");
    setEmailInput(baselineEmail);
    setPassword(PASSWORD_PLACEHOLDER);
    setShowPassword(false);
    setEditingPassword(false);
    setIndexable(baselineIndexable);
    setMsg(null);
    setConfirming(false);
  }

  function handleSave() {
    setConfirming(true);
  }

  // The type-to-confirm input in the delete dialog — focused on open so the
  // user can start typing the confirmation immediately.
  const deleteInputRef = useRef<HTMLInputElement | null>(null);

  // Close whichever dialog is open on Escape (matches the share modal and the
  // navbar menus). The delete dialog stays put while a deletion is in flight.
  useEffect(() => {
    if (!confirming && !deleteOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (confirming) setConfirming(false);
      else if (deleteOpen && !deleting) setDeleteOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [confirming, deleteOpen, deleting]);

  // Focus the confirmation field when the delete dialog opens.
  useEffect(() => {
    if (deleteOpen) deleteInputRef.current?.focus();
  }, [deleteOpen]);

  async function confirmSave() {
    setSaving(true);
    setMsg(null);
    setConfirming(false);

    try {
      const supabase = createClient();
      if (usernameChanged) {
        await saveUsername(usernameInput);
      }
      if (emailChanged) {
        if (!EMAIL_PATTERN.test(emailTrimmed)) {
          throw new Error("Enter a valid email address.");
        }
        const { error } = await supabase.auth.updateUser({
          email: emailTrimmed,
        });
        if (error) throw new Error(error.message);
      }
      if (passwordChanged) {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw new Error(error.message);
      }
      if (indexableChanged) {
        const { error } = await supabase
          .from("profiles")
          .update({ search_indexable: indexable })
          .eq("id", userId);
        if (error) throw new Error(error.message);
        setBaselineIndexable(indexable);
      }
      setMsg({
        text: emailChanged
          ? "Saved. Check your new email inbox for a link to confirm the change."
          : "Changes saved.",
        error: false,
      });
      setPassword(PASSWORD_PLACEHOLDER);
      setShowPassword(false);
      setEditingPassword(false);
      if (emailChanged) setBaselineEmail(emailTrimmed);
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

  async function signOutEverywhere() {
    setSigningOutAll(true);
    await createClient().auth.signOut({ scope: "global" });
    router.push("/");
    router.refresh();
  }

  // Deletion is gated on re-entering the current password (any non-empty entry
  // is submittable; Supabase validates it authoritatively below).
  const deleteReady = deletePassword.length > 0;

  function openDelete() {
    setDeletePassword("");
    setShowDeletePassword(false);
    setDeleteError(null);
    setDeleteOpen(true);
  }

  async function confirmDelete() {
    if (!deleteReady || deleting) return;
    setDeleting(true);
    setDeleteError(null);
    setMsg(null);
    try {
      const supabase = createClient();
      // Re-authenticate with the typed password before the irreversible delete.
      // A successful sign-in on the current session just confirms the password;
      // a failure means it was wrong.
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password: deletePassword,
      });
      if (authError) {
        setDeleteError("Incorrect password. Please try again.");
        setDeleting(false);
        return;
      }
      const { error } = await supabase.rpc("delete_own_account");
      if (error) throw new Error(error.message);
      // Clear the now-invalid local session, then leave the app.
      await supabase.auth.signOut();
      router.push("/");
      router.refresh();
    } catch (err) {
      setMsg({
        text: err instanceof Error ? err.message : "Couldn't delete account.",
        error: true,
      });
      setDeleting(false);
      setDeleteOpen(false);
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
          {active === "account" && (
            <AccountSection
              usernameInput={usernameInput}
              setUsernameInput={setUsernameInput}
              emailInput={emailInput}
              setEmailInput={setEmailInput}
              password={password}
              setPassword={setPassword}
              showPassword={showPassword}
              setShowPassword={setShowPassword}
              editingPassword={editingPassword}
              setEditingPassword={setEditingPassword}
              onDelete={openDelete}
            />
          )}
          {active === "security" && (
            <SecuritySection
              signingOutAll={signingOutAll}
              onSignOutEverywhere={signOutEverywhere}
            />
          )}
          {active === "privacy" && (
            <PrivacySection indexable={indexable} setIndexable={setIndexable} />
          )}
          {active === "accessibility" && (
            <AccessibilitySection
              whatsNewEveryOpen={whatsNewEveryOpen}
              setWhatsNewEveryOpen={toggleWhatsNewEveryOpen}
            />
          )}

          {msg ? (
            <p
              className={cn(
                "mt-8 text-sm",
                msg.error ? "text-red-400" : "text-muted-foreground",
              )}
            >
              {msg.text}
            </p>
          ) : null}
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
          <div className="relative w-full max-w-sm animate-pop rounded-lg border border-border bg-background p-6 shadow-lg">
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

      {/* Delete-account dialog */}
      {deleteOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0 animate-fade bg-black/50"
            onClick={() => !deleting && setDeleteOpen(false)}
          />
          <div className="relative w-full max-w-sm animate-pop rounded-lg border border-border bg-background p-6 shadow-lg">
            <h2 className="text-lg font-semibold">Delete account</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              This permanently deletes your account and page. This can't be
              undone. Enter your password to confirm.
            </p>
            <div className="relative mt-3">
              <Input
                ref={deleteInputRef}
                type={showDeletePassword ? "text" : "password"}
                value={deletePassword}
                onChange={(e) => {
                  setDeletePassword(e.target.value);
                  if (deleteError) setDeleteError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && deleteReady && !deleting) {
                    confirmDelete();
                  }
                }}
                placeholder="Your password"
                autoComplete="current-password"
                spellCheck={false}
                className="pr-10"
                aria-label="Enter your password to confirm account deletion"
                aria-invalid={deleteError ? true : undefined}
              />
              <PasswordToggle
                visible={showDeletePassword}
                onToggle={() => setShowDeletePassword((v) => !v)}
              />
            </div>
            {deleteError ? (
              <p className="mt-2 text-red-400 text-sm">{deleteError}</p>
            ) : null}
            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDeleteOpen(false)}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={confirmDelete}
                disabled={!deleteReady || deleting}
              >
                {deleting ? "Deleting…" : "Delete account"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
