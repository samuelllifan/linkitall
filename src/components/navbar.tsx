"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { StackedMark } from "~/components/stacked-mark";
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

function MenuIcon({ className }: { className?: string }) {
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
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
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
      <path d="M18 6 6 18M6 6l12 12" />
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
  isAdmin = false,
}: {
  userEmail: string | null;
  username: string | null;
  isAdmin?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // Mobile nav drawer (the inline page links collapse into this below `sm`).
  const [mobileOpen, setMobileOpen] = useState(false);
  const prevEmailRef = useRef(userEmail);

  if (prevEmailRef.current !== userEmail) {
    prevEmailRef.current = userEmail;
    if (signingOut) setSigningOut(false);
  }
  const menuRef = useRef<HTMLDivElement | null>(null);
  const mobileNavRef = useRef<HTMLDivElement | null>(null);

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

  // Close the mobile nav drawer on outside click or Escape.
  useEffect(() => {
    if (!mobileOpen) return;
    function onPointerDown(e: MouseEvent) {
      if (
        mobileNavRef.current &&
        !mobileNavRef.current.contains(e.target as Node)
      ) {
        setMobileOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMobileOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileOpen]);

  // Close the mobile drawer whenever the route changes (a link was followed).
  // biome-ignore lint/correctness/useExhaustiveDependencies: close on navigation
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const guard = useUnsavedGuard();

  // A user's page lives at /<username>; fall back to /my-page (which routes to
  // settings) until they've picked one. The Dashboard is account-only.
  // "My Page" only points at a real /<username> when the visitor is actually
  // signed in (userEmail present). For guests it always routes to /my-page,
  // which redirects to /login — so a guest can never be sent to someone's page.
  const links = [
    { href: "/", label: "Home" },
    {
      href: userEmail && username ? `/${username}` : "/my-page",
      label: "My Page",
    },
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
    <nav
      ref={mobileNavRef}
      className="sticky top-0 z-50 border-b border-border bg-background"
    >
      <div className="flex h-14 w-full items-center gap-3 px-4 sm:gap-6 sm:px-6">
        <Link
          href="/"
          onClick={guardedClick}
          className="flex items-center gap-2 font-semibold tracking-tight"
        >
          <StackedMark className="size-5" />
          stacked
        </Link>
        {/* Inline page links — collapsed into the mobile drawer below `sm`. */}
        <div className="hidden gap-4 sm:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={guardedClick}
              className={cn(
                "whitespace-nowrap text-sm transition-colors hover:text-foreground",
                pathname === link.href
                  ? "text-foreground"
                  : "text-muted-foreground",
              )}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-1 sm:gap-3">
          {/* Hamburger — reveals the page links on mobile only. */}
          <button
            type="button"
            onClick={() => setMobileOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            className="flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:hidden"
          >
            {mobileOpen ? (
              <CloseIcon className="size-5" />
            ) : (
              <MenuIcon className="size-5" />
            )}
          </button>

          {userEmail ? (
            <div className="relative z-50" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-label="Account menu"
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

                  {isAdmin ? (
                    <Link
                      href="/admin"
                      role="menuitem"
                      onClick={() => setMenuOpen(false)}
                      className="flex w-full items-center rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
                    >
                      Admin
                    </Link>
                  ) : null}

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

      {/* Mobile drawer — the page links, shown only below `sm`. */}
      {mobileOpen ? (
        <div
          id="mobile-nav"
          className="animate-slide-up border-t border-border bg-background px-2 py-2 sm:hidden"
        >
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={(e) => {
                guardedClick(e);
                if (!guard.dirty) setMobileOpen(false);
              }}
              className={cn(
                "block rounded-md px-4 py-3 text-base transition-colors hover:bg-muted",
                pathname === link.href
                  ? "font-medium text-foreground"
                  : "text-muted-foreground",
              )}
            >
              {link.label}
            </Link>
          ))}
        </div>
      ) : null}
    </nav>
  );
}
