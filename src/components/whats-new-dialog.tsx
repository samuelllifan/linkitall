"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "~/components/ui/button";
import { type ChangelogEntry, latestEntry } from "~/lib/changelog";
import { cn } from "~/lib/utils";
import { disableAutoShow, markSeen, shouldAutoShow } from "~/lib/whats-new";

/**
 * Window event that opens the pop-up on demand, dispatched by the footer
 * "What's new" link (see {@link openWhatsNew}). A manual open ignores the
 * saved auto-show preferences (see ~/lib/whats-new).
 */
const OPEN_EVENT = "whatsnew:open";

/** Open the "What's New" pop-up from anywhere (e.g. the footer link). */
export function openWhatsNew() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

function MegaphoneIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="m3 11 18-5v12L3 14v-3z" />
      <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

/**
 * The "What's New" pop-up. Mounted once globally (in the root layout) so it can
 * be opened from anywhere. It shows automatically when a signed-in user visits
 * their own page (`/<ownUsername>`) and hasn't dismissed the newest
 * {@link latestEntry} yet — unless they've turned auto pop-ups off. The footer
 * "What's new" link ({@link openWhatsNew}) opens it on demand regardless.
 */
export function WhatsNewDialog({
  ownUsername,
}: {
  /** The signed-in visitor's own username, or null when signed out / unset. */
  ownUsername?: string | null;
}) {
  const entry = latestEntry();
  const pathname = usePathname();
  const router = useRouter();
  // `open` drives whether the dialog is present; `visible` drives the
  // enter/exit animation so it can animate out before unmounting.
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);

  const show = useCallback(() => {
    setOpen(true);
    // Next frame so the entrance animation runs from the hidden state.
    requestAnimationFrame(() => setVisible(true));
  }, []);

  // Auto-show: only on the owner's own page, and only when the saved
  // preferences allow it (see shouldAutoShow). Runs in an effect so
  // localStorage is read on the client only (never during SSR / hydration).
  useEffect(() => {
    if (!entry || !ownUsername) return;
    const onOwnPage =
      pathname.toLowerCase() === `/${ownUsername.toLowerCase()}`;
    if (!onOwnPage) return;
    if (shouldAutoShow(entry.id)) show();
  }, [entry, ownUsername, pathname, show]);

  // Manual open from the footer link — always shows, ignoring the flags.
  useEffect(() => {
    const onOpen = () => show();
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, [show]);

  const close = useCallback(() => {
    // Remember the newest entry as seen so the once-per-release pop-up doesn't
    // re-trigger for this release (a newer entry will show again).
    if (entry) markSeen(entry.id);
    setVisible(false);
    setTimeout(() => setOpen(false), 200);
  }, [entry]);

  // "Don't show again" — suppress future auto pop-ups, then send the visitor to
  // the Accessibility settings where they can turn it back on. When already on
  // /settings, set the hash directly (fires `hashchange`, which the settings
  // page listens for); otherwise navigate there fresh.
  const dontShowAgain = useCallback(() => {
    if (entry) disableAutoShow(entry.id);
    setVisible(false);
    setTimeout(() => setOpen(false), 200);
    if (pathname === "/settings") {
      window.location.hash = "accessibility";
    } else {
      router.push("/settings#accessibility");
    }
  }, [entry, pathname, router]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  if (!open || !entry || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        className={cn(
          "absolute inset-0 bg-black/50",
          visible ? "animate-fade" : "animate-fade-out",
        )}
        onClick={close}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="whats-new-title"
        className={cn(
          "relative w-full max-w-md overflow-hidden rounded-xl border border-border bg-background shadow-xl",
          visible ? "animate-pop" : "animate-pop-out",
        )}
      >
        <div className="p-6">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium uppercase tracking-wide">
              <MegaphoneIcon className="size-4 text-foreground" />
              What's new
            </div>
            <div className="-mt-1 -mr-1 flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={dontShowAgain}
                className="rounded-md px-2 py-1 text-muted-foreground text-xs transition-colors hover:bg-muted hover:text-foreground"
              >
                Don't show again
              </button>
              <button
                type="button"
                aria-label="Close"
                onClick={close}
                className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <CloseIcon className="size-5" />
              </button>
            </div>
          </div>

          <Entry entry={entry} />

          <Button onClick={close} className="mt-6 w-full">
            Got it
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Entry({ entry }: { entry: ChangelogEntry }) {
  return (
    <div>
      <h2 id="whats-new-title" className="font-semibold text-lg">
        {entry.title}
      </h2>
      <p className="mt-0.5 text-muted-foreground text-sm">{entry.date}</p>
      <ul className="mt-4 flex flex-col gap-4">
        {entry.items.map((item) => (
          <li key={item.feature} className="flex flex-col gap-0.5">
            <span className="font-medium text-foreground text-sm">
              {item.feature}
            </span>
            <span className="text-muted-foreground text-sm">
              {item.description}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
