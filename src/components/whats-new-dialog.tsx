"use client";

import { usePathname, useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "~/components/ui/button";
import { CloseIcon } from "~/components/ui/close-icon";
import { GLYPH, Glyph } from "~/components/ui/glyph";
import { type ChangelogEntry, latestEntry } from "~/lib/changelog";
import { lockBodyScroll, unlockBodyScroll } from "~/lib/scroll-lock";
import { EXIT_MS } from "~/lib/use-popover";
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
    if (!shouldAutoShow(entry.id)) return;

    // The owner's own page is also where an enabled intro splash renders, and
    // that splash is the top layer (z-[100] vs this panel's z-[70]). Opening now
    // would put a focus-trapping dialog under it, invisible — so wait for the
    // splash to be dismissed and open behind it, not beneath it.
    const root = document.documentElement;
    if (!root.hasAttribute("data-intro-splash")) {
      show();
      return;
    }
    const observer = new MutationObserver(() => {
      if (root.hasAttribute("data-intro-splash")) return;
      observer.disconnect();
      show();
    });
    observer.observe(root, {
      attributes: true,
      attributeFilter: ["data-intro-splash"],
    });
    return () => observer.disconnect();
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
    setTimeout(() => setOpen(false), EXIT_MS);
  }, [entry]);

  // "Don't show again" — suppress future auto pop-ups, then send the visitor to
  // the Preferences group in settings, where they can turn it back on. When
  // already on /settings, set the hash directly (fires `hashchange`, which the
  // settings page listens for); otherwise navigate there fresh.
  const dontShowAgain = useCallback(() => {
    if (entry) disableAutoShow(entry.id);
    setVisible(false);
    setTimeout(() => setOpen(false), EXIT_MS);
    if (pathname === "/settings") {
      window.location.hash = "preferences";
    } else {
      router.push("/settings#preferences");
    }
  }, [entry, pathname, router]);

  const panelRef = useRef<HTMLDivElement>(null);

  // Close on Escape, and keep Tab focus within the dialog (it declares
  // aria-modal, so focus must not escape to the page behind it).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
        return;
      }
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusable = panel.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  // While open: lock background scroll, move focus into the dialog ("Got it"),
  // and restore focus to whatever was focused before on close.
  const gotItRef = useRef<HTMLButtonElement>(null);
  const prevFocusRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!open) return;
    prevFocusRef.current = document.activeElement as HTMLElement | null;
    lockBodyScroll();
    gotItRef.current?.focus();
    return () => {
      unlockBodyScroll();
      prevFocusRef.current?.focus?.();
    };
  }, [open]);

  if (!open || !entry || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        // Kept out of the tab order so it isn't a second, visually-empty "Close"
        // stop next to the labeled X (Escape + the X + the backdrop click still
        // dismiss it).
        tabIndex={-1}
        className={cn(
          "absolute inset-0 bg-black/50",
          visible ? "animate-fade" : "animate-fade-out",
        )}
        onClick={close}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="whats-new-title"
        className={cn(
          "relative max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto overscroll-contain rounded-xl border border-border bg-popover text-popover-foreground shadow-xl",
          visible ? "animate-pop" : "animate-pop-out",
        )}
      >
        <div className="p-6">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium uppercase tracking-wide">
              <Glyph d={GLYPH.megaphone} className="text-foreground" />
              What's new
            </div>
            <div className="-mt-1 -mr-1 flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={dontShowAgain}
                className="rounded-md px-2 py-1 text-muted-foreground text-xs transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                Don't show again
              </button>
              <button
                type="button"
                aria-label="Close"
                onClick={close}
                className="flex size-10 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <CloseIcon className="size-5" />
              </button>
            </div>
          </div>

          <Entry entry={entry} />

          <Button ref={gotItRef} onClick={close} className="mt-6 w-full">
            Got it
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * When each change in the list starts rising.
 *
 * `BASE` waits out most of the panel's own 200ms `pop-in`, so the cascade reads
 * as the list settling INSIDE a panel that has already landed, rather than as
 * two animations racing. `STEP` is deliberately larger than the account menu's
 * 25ms: that menu is four one-word rows the eye takes in at a glance, and this
 * is six two-line paragraphs being read. The last of six starts at 265ms and
 * lands just under half a second — past that a list stops reading as arriving
 * and starts reading as loading.
 */
const ITEM_BASE_MS = 115;
const ITEM_STEP_MS = 30;
const itemDelay = (i: number): CSSProperties => ({
  animationDelay: `${ITEM_BASE_MS + i * ITEM_STEP_MS}ms`,
});

function Entry({ entry }: { entry: ChangelogEntry }) {
  return (
    <div>
      {/* The version carries the heading; the theme trails it in muted text so
          "Beta 1.2" stays the thing you read first even when the two wrap onto
          separate lines. Both sit inside the one labelled <h2>, so the dialog's
          accessible name is the full "Beta 1.2 — Everything around your page". */}
      <h2 id="whats-new-title" className="font-semibold text-lg">
        {entry.title}
        {entry.subtitle ? (
          <span className="font-normal text-muted-foreground">
            {" — "}
            {entry.subtitle}
          </span>
        ) : null}
      </h2>
      <p className="mt-0.5 text-muted-foreground text-sm">{entry.date}</p>
      {/* The changes arrive in sequence rather than all at once. Every other
          list in the app that appears as a unit already does this — the account
          menu's rows, the settings panels, the landing wall's cards — and the
          release notes, which are the one list a creator is actually asked to
          read, were the exception: the panel popped and six items were simply
          there. A cascade also does something a fade can't, which is tell you
          there is a LIST here and roughly how long it is, before you have read
          a word of it.

          `.animate-rise` and an inline delay is the app's existing recipe for
          exactly this (see globals.css) — `both` is what holds each item
          invisible through its own wait instead of flashing it at full opacity
          and then animating. */}
      <ul className="mt-4 flex flex-col gap-4">
        {entry.items.map((item, i) => (
          <li
            key={item.feature}
            className="flex animate-rise flex-col gap-0.5"
            style={itemDelay(i)}
          >
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
