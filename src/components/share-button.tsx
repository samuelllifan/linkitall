"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";
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

  // Resolve the current page URL on the client (avoids threading the origin
  // through from the server).
  useEffect(() => {
    setUrl(window.location.href);
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

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
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

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Share this page"
        className="fixed top-[4.5rem] right-4 z-40 flex size-10 items-center justify-center rounded-full border border-border bg-background/80 text-foreground shadow-sm backdrop-blur transition-colors hover:bg-accent hover:text-accent-foreground"
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
            role="dialog"
            aria-modal="true"
            aria-label="Share this page"
            className="relative w-full max-w-xs animate-pop rounded-lg border border-border bg-background p-5 shadow-lg"
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
          </div>
        </div>
      ) : null}
    </>
  );
}
