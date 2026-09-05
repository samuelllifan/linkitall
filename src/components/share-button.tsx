"use client";

import QRCode from "qrcode";
import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { Skeleton } from "~/components/ui/skeleton";
import { useDismissOnOutside, usePopover } from "~/lib/use-popover";
import { cn } from "~/lib/utils";

function ShareIcon({ className }: { className?: string }) {
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
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}

function CopyIcon({ className }: { className?: string }) {
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
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function DownloadIcon({ className }: { className?: string }) {
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
      <path d="M12 3v12" />
      <path d="m7 12 5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  );
}

/** A tidy download filename for the QR PNG, derived from the page URL. */
function qrFilename(url: string): string {
  let slug = "page";
  try {
    const path = new URL(url).pathname.replace(/^\/+|\/+$/g, "");
    if (path) slug = path.replace(/[^a-z0-9-]+/gi, "-").toLowerCase();
  } catch {
    // Keep the default slug for a malformed URL.
  }
  return `stacked-${slug}-qr.png`;
}

/** Legacy clipboard copy via a hidden textarea; returns whether it succeeded. */
function legacyCopy(text: string): boolean {
  try {
    const el = document.createElement("textarea");
    el.value = text;
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}

/**
 * NOT CURRENTLY MOUNTED. Removed from the public page (see `app/[username]/
 * page.tsx`) pending a rework of how sharing is presented. Kept because the
 * fiddly parts are all still correct and worth starting from: QR generation,
 * the iOS-Safari download workaround, and the legacy clipboard fallback.
 *
 * A floating share control for public pages: a button in the BOTTOM-RIGHT
 * corner that opens a dropdown with the page URL (one-click copy) and a
 * scannable QR code.
 *
 * It used to sit top-right and open a centred modal over a dimmed backdrop.
 * Both were wrong for what this is: sharing is a side errand, and a modal is
 * the interaction for something that must be dealt with before anything else
 * can happen. Taking over the screen also hid the very page the visitor was
 * about to share. As a corner-anchored dropdown it explains itself — the panel
 * is visibly attached to the button that opened it — and the page stays on
 * screen behind it.
 *
 * Bottom-right specifically: the top edge is spoken for (the navbar, its pull
 * tab at centre, the owner's hidden-links notice at top-left), and bottom-left
 * belongs to the music player. Bottom-right is the only free corner, and it is
 * where a page-level action is looked for anyway.
 */
export function ShareButton() {
  // `open` is "mounted", `shown` is "on screen" — the panel has to outlive the
  // close by one exit animation. Everything conditional keys off `shown`.
  const { open, shown, hide, toggle } = usePopover();
  const [url, setUrl] = useState("");
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // Whether the browser exposes the native share sheet (mainly mobile). Resolved
  // after mount so the server and client render the same initial markup.
  const [canShare, setCanShare] = useState(false);

  // Resolve the current page URL on the client (avoids threading the origin
  // through from the server).
  useEffect(() => {
    setUrl(window.location.href);
    setCanShare(typeof navigator !== "undefined" && "share" in navigator);
  }, []);

  // Generate the QR once the modal opens and the URL is known.
  useEffect(() => {
    if (!open || !url) return;
    let active = true;
    QRCode.toDataURL(url, { width: 480, margin: 1, errorCorrectionLevel: "M" })
      .then((dataUrl) => {
        if (active) setQr(dataUrl);
      })
      .catch(() => {
        if (active) setQr(null);
      });
    return () => {
      active = false;
    };
  }, [open, url]);

  // Wraps the trigger AND the panel, so an outside-click is measured against
  // both — clicking the trigger while open must not count as "outside" and
  // race the toggle into reopening.
  const rootRef = useRef<HTMLDivElement>(null);
  useDismissOnOutside(shown, rootRef, hide);

  // The focus trap that used to live here is gone with the modal. Trapping Tab
  // is what you do when the rest of the page is inert; this panel deliberately
  // leaves the page live behind it, so holding focus hostage would be a lie
  // about the state of the document. Focus still MOVES in (to Copy, the one
  // action most opens are for) and is restored to the trigger on close, so a
  // keyboard user is never dropped back at the top of the page.
  const copyBtnRef = useRef<HTMLButtonElement>(null);
  const prevFocusRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!shown) return;
    prevFocusRef.current = document.activeElement as HTMLElement | null;
    copyBtnRef.current?.focus();
    return () => prevFocusRef.current?.focus?.();
  }, [shown]);

  async function copyLink() {
    let ok = false;
    try {
      await navigator.clipboard.writeText(url);
      ok = true;
    } catch {
      // Async Clipboard API can be blocked (insecure context, denied
      // permission). Fall back to the legacy execCommand path.
      ok = legacyCopy(url);
    }
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
    // If both fail, the URL stays visible for manual copy.
  }

  // Open the OS share sheet (mobile / supported desktops). A cancelled share
  // rejects; swallow it so it's a no-op.
  async function nativeShare() {
    try {
      await navigator.share({ title: document.title || "stacked", url });
    } catch {
      // User dismissed the sheet, or sharing isn't permitted here.
    }
  }

  // Save the generated QR as a PNG. iOS Safari ignores the `download` attribute
  // on `data:` URLs (it just opens the image), so convert the data URL to a
  // Blob and download that via an object URL, which WebKit honors.
  function downloadQr() {
    if (!qr) return;
    const name = qrFilename(url);
    try {
      const [meta, base64] = qr.split(",");
      const mime = meta.match(/:(.*?);/)?.[1] ?? "image/png";
      const bytes = atob(base64);
      const buf = new Uint8Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) buf[i] = bytes.charCodeAt(i);
      const objectUrl = URL.createObjectURL(new Blob([buf], { type: mime }));
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Revoke on the next tick so the download has started.
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch {
      // Fall back to the data-URL anchor if Blob conversion isn't available.
      const a = document.createElement("a");
      a.href = qr;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  }

  return (
    // One fixed root in the corner holding the trigger AND the panel, so the
    // panel can be positioned against the button with plain `absolute` instead
    // of measured coordinates. `bottom` uses max(1rem, safe-area) so the button
    // clears an iPhone's home indicator once the viewport opts into cover.
    <div
      ref={rootRef}
      className="fixed right-[max(1rem,env(safe-area-inset-right))] bottom-[max(1rem,env(safe-area-inset-bottom))] z-40"
    >
      <button
        type="button"
        onClick={toggle}
        aria-label="Share this page"
        aria-haspopup="dialog"
        aria-expanded={shown}
        className={cn(
          "flex size-11 items-center justify-center rounded-full border border-border bg-background/80 text-foreground shadow-sm backdrop-blur",
          "transition-[color,background-color,scale] duration-[var(--dur-fast)] hover:bg-accent hover:text-accent-foreground",
          "active:scale-95 active:duration-[var(--dur-press)]",
          "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
          shown && "bg-accent text-accent-foreground",
        )}
      >
        <ShareIcon className="size-5" />
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Share this page"
          // Anchored to the trigger's top-right corner and growing up-and-left,
          // which is the only direction with room in this corner.
          // `--menu-rise`/`--menu-fall` flip the shared menu animation to rise
          // instead of drop (see @keyframes menu-in) — without them the panel
          // would slide DOWN into a position above its trigger, which reads as
          // the panel escaping rather than opening.
          //
          // The width is capped against the viewport so the panel cannot run
          // off the left edge on a narrow phone, and the height against the
          // dynamic viewport so a short landscape window scrolls the panel
          // rather than clipping the QR.
          style={
            {
              "--menu-rise": "0.5rem",
              "--menu-fall": "0.25rem",
            } as CSSProperties
          }
          className={cn(
            "absolute right-0 bottom-full mb-3 w-72 max-w-[calc(100vw-2rem)]",
            "max-h-[calc(100dvh-6rem)] overflow-y-auto overscroll-contain",
            "origin-bottom-right rounded-2xl border border-border bg-popover p-4 text-popover-foreground nav-island",
            shown ? "animate-menu-in" : "animate-menu-out",
          )}
        >
          <h2 className="font-semibold text-sm">Share this page</h2>

          {/* QR code on a white plate so it scans in any theme. */}
          <div className="mt-3 flex justify-center">
            {qr ? (
              // biome-ignore lint/performance/noImgElement: generated data-URL QR; next/image adds no value
              <img
                src={qr}
                alt="QR code linking to this page"
                className="size-40 rounded-lg bg-white p-2"
              />
            ) : (
              <Skeleton className="size-40 rounded-lg" />
            )}
          </div>

          {/* URL + copy button. */}
          <div className="mt-3 flex items-center gap-2 rounded-md border border-border bg-muted/50 p-1 pl-3">
            <span className="min-w-0 flex-1 truncate text-muted-foreground text-sm">
              {url}
            </span>
            <button
              ref={copyBtnRef}
              type="button"
              onClick={copyLink}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded px-3 py-1.5 font-medium text-sm transition-colors",
                "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                copied
                  ? "bg-success/15 text-success"
                  : "bg-primary text-primary-foreground hover:bg-primary/90",
              )}
            >
              {copied ? (
                <>
                  <CheckIcon className="size-4" />
                  Copied
                </>
              ) : (
                <>
                  <CopyIcon className="size-4" />
                  Copy
                </>
              )}
            </button>
          </div>

          {/* Secondary actions: save the QR, and (where supported) open the
              native share sheet. */}
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={downloadQr}
              disabled={!qr}
              className="flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-md border border-border bg-transparent px-3 py-2 font-medium text-foreground text-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
            >
              <DownloadIcon className="size-4" />
              Download QR
            </button>
            {canShare ? (
              <button
                type="button"
                onClick={nativeShare}
                className="flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-md border border-border bg-transparent px-3 py-2 font-medium text-foreground text-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <ShareIcon className="size-4" />
                Share…
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
