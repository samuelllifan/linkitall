import type * as React from "react";

import { FIELD_CLASS } from "~/components/ui/input";
import { cn } from "~/lib/utils";

/**
 * A multi-line text field — today just the contact form's message box.
 *
 * A one-call-site component earns its keep here because of what it replaced: a
 * bare `<textarea>` carrying a hand-pasted copy of {@link Input}'s class
 * string. That copy was already a fork — it had silently missed the disabled
 * state — and it is exactly the drift this codebase keeps writing components to
 * avoid (see ui/glyph.tsx and ui/close-icon.tsx). Sharing `FIELD_CLASS` means
 * the message box and the fields above it cannot focus, error or disable
 * differently.
 *
 * `py-2` rather than the input's `py-1`, and no fixed height: a single line of
 * text centres itself in a 36px row, but several lines need real padding at the
 * top and bottom, and the box's height is the caller's business (`rows`).
 */
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(FIELD_CLASS, "py-2", className)}
      {...props}
    />
  );
}

export { Textarea };
