"use client";

import { openWhatsNew } from "~/components/whats-new-dialog";

/**
 * Footer "What's new" trigger. A button (not a link) styled to match the footer
 * links; clicking it opens the What's New pop-up on demand from any page.
 */
export function WhatsNewLink() {
  return (
    <button
      type="button"
      onClick={openWhatsNew}
      className="text-left underline-offset-4 hover:text-foreground hover:underline"
    >
      What's new
    </button>
  );
}
