import type * as React from "react";

import { cn } from "~/lib/utils";

/**
 * Everything a text field looks like, minus its own height.
 *
 * Exported because {@link Textarea} (ui/textarea.tsx) is the same control in a
 * taller box, and the contact form used to reach that by pasting this string
 * into a bare `<textarea>` — which meant the app had two field designs that
 * only looked identical because nobody had touched one of them yet. The focus
 * ring, the invalid state and the disabled state all live here once.
 *
 * Height and padding are deliberately NOT in it: an input is a fixed `h-9` row
 * and a textarea grows, so the one property they genuinely disagree about is
 * the one each supplies for itself.
 */
export const FIELD_CLASS = [
  "w-full min-w-0 rounded-md border border-input bg-transparent px-3 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30",
  "focus-visible:border-ring/70 focus-visible:ring-2 focus-visible:ring-ring/20",
  "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
].join(" ");

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        FIELD_CLASS,
        "h-9 py-1 file:inline-flex file:h-7 file:border-0 file:bg-transparent file:font-medium file:text-foreground file:text-sm",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
