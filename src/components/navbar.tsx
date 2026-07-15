"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createClient } from "~/lib/supabase/client";
import { useUnsavedGuard } from "~/lib/unsaved-guard";
import { cn } from "~/lib/utils";

function UserIcon({ className }: { className?: string }) {
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
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
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
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function Avatar() {
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
      <UserIcon className="size-4" />
    </span>
  );
}

export function Navbar({
  userEmail,
  username,
}: {
  userEmail: string | null;
  username: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const prevEmailRef = useRef(userEmail);

  if (prevEmailRef.current !== userEmail) {
    prevEmailRef.current = userEmail;
    if (signingOut) setSigningOut(false);
  }
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Close the account menu on outside click or Escape.
  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const guard = useUnsavedGuard();

  // A user's page lives at /<username>; fall back to /my-page (which routes to
  // settings) until they've picked one. The Dashboard is account-only.
  const links = [
    { href: "/", label: "Home" },
    { href: username ? `/${username}` : "/my-page", label: "My Page" },
    ...(userEmail ? [{ href: "/dashboard", label: "Dashboard" }] : []),
  ];

  function guardedClick(e: React.MouseEvent) {
    if (guard.dirty) {
      e.preventDefault();
      guard.onBlocked?.();
    }
  }

  async function signOut() {
    setSigningOut(true);
    await createClient().auth.signOut();
    setMenuOpen(false);
    router.push("/");
    router.refresh();
  }

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-background">
      <div className="flex h-14 w-full items-center gap-6 px-6">
        <Link
          href="/"
          onClick={guardedClick}
          className="font-semibold tracking-tight"
        >
          linkitall
        </Link>
        <div className="flex gap-4">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={guardedClick}
              className={cn(
                "text-sm transition-colors hover:text-foreground",
                pathname === link.href
                  ? "text-foreground"
                  : "text-muted-foreground",
              )}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-3">
          {userEmail ? (
            <div className="relative z-50" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                className="flex items-center gap-2 rounded-full py-1 pr-2 pl-1 transition-colors hover:bg-muted"
              >
                <Avatar />
                <span className="hidden max-w-[12rem] truncate text-sm text-muted-foreground sm:inline">
                  {username ? `@${username}` : userEmail}
                </span>
                <ChevronDownIcon
                  className={cn(
                    "size-4 text-muted-foreground transition-transform",
                    menuOpen && "rotate-180",
                  )}
                />
              </button>

              {menuOpen ? (
                <div
                  role="menu"
                  aria-label="Account"
                  className="absolute right-0 mt-2 w-72 origin-top-right animate-pop rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg"
                >
                  <div className="px-3 py-2">
                    <p className="truncate text-sm font-medium">
                      {username ? `@${username}` : "No username yet"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {userEmail}
                    </p>
                  </div>

                  <div className="my-1 h-px bg-border" />

                  <Link
                    href="/settings"
                    role="menuitem"
                    onClick={(e) => {
                      if (guard.dirty) {
                        e.preventDefault();
                        guard.onBlocked?.();
                        return;
                      }
                      setMenuOpen(false);
                    }}
                    className="flex w-full items-center rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
                  >
                    Settings
                  </Link>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      if (guard.dirty) {
                        guard.onBlocked?.();
                        return;
                      }
                      signOut();
                    }}
                    disabled={signingOut}
                    className="flex w-full items-center rounded-md px-3 py-2 text-left text-sm text-red-400 transition-colors hover:bg-red-400/10 disabled:pointer-events-none disabled:opacity-50"
                  >
                    {signingOut ? "Signing out…" : "Sign out"}
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <Link
              href="/login"
              className="flex items-center gap-2 rounded-full py-1 pr-3 pl-1 transition-colors hover:bg-muted"
            >
              <Avatar />
              <span className="text-sm text-muted-foreground">
                Not signed in
              </span>
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
