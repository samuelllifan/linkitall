"use client";

import { FOOTER_LINK_CLASS } from "~/components/footer-link-class";
import { openWhatsNew } from "~/components/whats-new-dialog";

/**
 * Footer "What's new" trigger. A button (not a link) that SHARES the footer
 * links' class rather than imitating it — it used to carry `hover:underline`
 * with no transition, so one item in a row of four snapped a differently-offset
 * underline on while its three neighbours faded a rule in.
 */
export function WhatsNewLink() {
  return (
    <button type="button" onClick={openWhatsNew} className={FOOTER_LINK_CLASS}>
      What's New
    </button>
  );
}
