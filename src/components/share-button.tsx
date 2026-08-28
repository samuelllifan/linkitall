"use client";

import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";
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
 * A floating share control for public pages: opens a modal with the page URL
 * (one-click copy) and a scannable QR code that links to the same page.
 */
export function ShareButton() {
  const [open, setOpen] = useState(false);
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

  const dialogRef = useRef<HTMLDivElement>(null);

  // Close on Escape, and keep Tab focus inside the modal (it declares
  // aria-modal, so focus must not wander to the page behind it).
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (e.key !== "Tab") return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = dialog.querySelectorAll<HTMLElement>(
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
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // While open: move focus into the dialog (the Copy button) and restore it to
  // the share trigger on close, so keyboard users aren't dropped back at the top.
  const copyBtnRef = useRef<HTMLButtonElement>(null);
  const prevFocusRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!open) return;
    prevFocusRef.current = document.activeElement as HTMLElement | null;
    copyBtnRef.current?.focus();
    return () => prevFocusRef.current?.focus?.();
  }, [open]);

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
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Share this page"
        className="fixed top-[4.5rem] right-4 z-40 flex size-11 items-center justify-center rounded-full border border-border bg-background/80 text-foreground shadow-sm backdrop-blur transition-colors hover:bg-accent hover:text-accent-foreground"
      >
        <ShareIcon className="size-5" />
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0 animate-fade bg-black/50"
            onClick={() => setOpen(false)}
          />
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Share this page"
            className="relative max-h-[calc(100dvh-2rem)] w-full max-w-xs animate-pop overflow-y-auto overscroll-contain rounded-lg border border-border bg-background p-5 shadow-lg"
          >
            <h2 className="text-sm font-semibold">Share this page</h2>

            {/* QR code on a white plate so it scans in any theme. */}
            <div className="mt-4 flex justify-center">
              {qr ? (
                // biome-ignore lint/performance/noImgElement: generated data-URL QR; next/image adds no value
                <img
                  src={qr}
                  alt="QR code linking to this page"
                  className="size-44 rounded-lg bg-white p-2"
                />
              ) : (
                <div className="size-44 animate-pulse rounded-lg bg-muted" />
              )}
            </div>

            {/* URL + copy button. */}
            <div className="mt-4 flex items-center gap-2 rounded-md border border-border bg-muted/50 p-1 pl-3">
              <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                {url}
              </span>
              <button
                ref={copyBtnRef}
                type="button"
                onClick={copyLink}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition-colors",
                  copied
                    ? "bg-green-500/15 text-green-600 dark:text-green-400"
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
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={downloadQr}
                disabled={!qr}
                className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-md border border-border bg-transparent px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
              >
                <DownloadIcon className="size-4" />
                Download QR
              </button>
              {canShare ? (
                <button
                  type="button"
                  onClick={nativeShare}
                  className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-md border border-border bg-transparent px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <ShareIcon className="size-4" />
                  Share…
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
