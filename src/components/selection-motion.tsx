"use client";

import { useEffect } from "react";

/**
 * Turns the animated `::selection` highlight on only while text is selected.
 *
 * The colour and the two keyframes live in globals.css (see the "Text
 * selection" block there, which explains why the highlight has to be driven by
 * a registered custom property in the first place). This is just the switch:
 * `data-selecting` on <html> is what arms the timeline.
 *
 * It has to be gated. Both animated properties inherit, so every frame of the
 * sweep invalidates style for the entire document — a cost worth paying for the
 * few seconds a selection is on screen, and not worth paying for the whole
 * session on a page that nobody is selecting anything on.
 *
 * The attribute landing is also the only "a selection appeared" signal CSS can
 * see, so it doubles as the trigger for the fade-in.
 */
export function SelectionMotion() {
  useEffect(() => {
    const root = document.documentElement;
    // Mirror of the attribute, so the common case (a caret moving, which fires
    // this event on every keystroke) costs one boolean compare and no DOM write.
    let on = false;

    const sync = () => {
      // `isCollapsed` and not `toString()`: this runs on every frame of a drag,
      // and stringifying the range is O(selection length) — on a long article
      // that is real work per frame to answer a question a flag already answers.
      const sel = document.getSelection();
      let next = !!sel && !sel.isCollapsed;

      // A selection inside an <input> / <textarea> is NOT part of the document
      // selection — Chrome reports that one as collapsed — so without this the
      // highlight would sit static in exactly the fields people select text in
      // most (the username field, the share URL). `selectionchange` does fire on
      // the document for these, so there is nothing else to listen to.
      if (!next) {
        const el = document.activeElement;
        if (
          (el instanceof HTMLInputElement ||
            el instanceof HTMLTextAreaElement) &&
          el.selectionStart !== null &&
          el.selectionEnd !== null &&
          el.selectionStart !== el.selectionEnd
        ) {
          next = true;
        }
      }

      if (next === on) return;
      on = next;
      if (next) root.setAttribute("data-selecting", "");
      else root.removeAttribute("data-selecting");
    };

    document.addEventListener("selectionchange", sync);
    return () => {
      document.removeEventListener("selectionchange", sync);
      root.removeAttribute("data-selecting");
    };
  }, []);

  return null;
}
