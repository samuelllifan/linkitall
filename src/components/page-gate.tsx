"use client";

import { useState } from "react";
import { StackedMark } from "~/components/stacked-mark";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { PasswordToggle } from "~/components/ui/password-toggle";
import { cn } from "~/lib/utils";

/**
 * The three screens that can stand in front of somebody else's page — offline,
 * sensitive-content, and password.
 *
 * They share one shell, {@link GateShell}, on purpose. All three are stacked's
 * own chrome interrupting a creator's page, and a visitor who meets two of them
 * in a week should recognise the second as the same kind of thing rather than
 * as a second design. The shell is the app's own surface — near-black, one card,
 * the brand mark — because there is deliberately nothing of the creator's page
 * to borrow from yet: on a protected page the content has not been fetched, and
 * on an offline one the owner has asked for it not to be shown.
 */
function GateShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-[calc(100dvh-var(--nav-space))] w-full max-w-sm flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <div className="animate-rise flex w-full flex-col items-center gap-5">
        <StackedMark variant="brand" className="size-9" />
        <h1 className="font-semibold text-xl tracking-tight">{title}</h1>
        {children}
      </div>
    </main>
  );
}

/** The owner has taken this page offline. Not a 404: the username is claimed. */
export function PageOffline({ username }: { username: string }) {
  return (
    <GateShell title="This page isn't available">
      <p className="text-muted-foreground text-sm leading-relaxed">
        <span className="font-mono text-foreground">
          stacked.page/{username}
        </span>{" "}
        has been taken offline by its owner. It may come back.
      </p>
    </GateShell>
  );
}

/**
 * The owner has flagged their page as sensitive. A confirmation, not a real age
 * check — which is exactly what the equivalent on every other link-in-bio tool
 * is, and the copy says so rather than implying a verification that isn't
 * happening.
 *
 * Client-side and unpersisted on purpose: the page behind it has already been
 * fetched (unlike the password gate, where it has not), so this is a courtesy
 * screen, and one that should come back on the next visit.
 */
export function SensitiveGate({
  username,
  children,
}: {
  username: string;
  children: React.ReactNode;
}) {
  const [entered, setEntered] = useState(false);
  if (entered) return <>{children}</>;
  return (
    <GateShell title="Sensitive content">
      <p className="text-muted-foreground text-sm leading-relaxed">
        <span className="font-mono text-foreground">
          stacked.page/{username}
        </span>{" "}
        may contain content that isn't suitable for everyone.
      </p>
      <div className="flex w-full flex-col gap-2">
        <Button className="w-full" onClick={() => setEntered(true)}>
          I'm over 18 — continue
        </Button>
        <Button variant="ghost" className="w-full" asChild>
          <a href="/">Go back</a>
        </Button>
      </div>
    </GateShell>
  );
}

/**
 * The page is behind a visitor password.
 *
 * Nothing of the page is on this screen or in the payload that produced it —
 * `get_public_page` withholds every content column while a password is set, so
 * there is nothing here to read out of the DOM. A correct password sets an
 * httpOnly cookie (see /api/page-unlock) and the route re-renders with the real
 * page.
 */
export function PageUnlock({ username }: { username: string }) {
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!password || checking) return;
    setChecking(true);
    setError(null);
    try {
      const res = await fetch("/api/page-unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        setError("That password isn't right.");
        setChecking(false);
        return;
      }
      // A full reload rather than router.refresh(): the cookie was just set on
      // this response, and the page is a `force-dynamic` server render that has
      // to be re-requested WITH it.
      window.location.reload();
    } catch {
      setError("Couldn't check that right now. Please try again.");
      setChecking(false);
    }
  }

  return (
    <GateShell title="This page is private">
      <p className="text-muted-foreground text-sm leading-relaxed">
        Enter the password{" "}
        <span className="font-mono text-foreground">
          stacked.page/{username}
        </span>{" "}
        was shared with.
      </p>
      <form onSubmit={submit} className="flex w-full flex-col gap-2">
        <div className="relative">
          <Input
            type={show ? "text" : "password"}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (error) setError(null);
            }}
            placeholder="Page password"
            autoComplete="off"
            spellCheck={false}
            aria-label="Page password"
            aria-invalid={error ? true : undefined}
            className={cn("pr-10 text-center", error && "border-danger/60")}
          />
          <PasswordToggle visible={show} onToggle={() => setShow((v) => !v)} />
        </div>
        <Button
          type="submit"
          className="w-full"
          disabled={!password || checking}
        >
          {checking ? "Checking…" : "Unlock"}
        </Button>
      </form>
      {error ? (
        <p aria-live="polite" className="animate-slide-up text-danger text-sm">
          {error}
        </p>
      ) : null}
    </GateShell>
  );
}
