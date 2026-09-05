import { cn } from "~/lib/utils";

/**
 * An inline form message — a rejected email, a failed sign-in, "check your
 * inbox", "this link has expired".
 *
 * Renders nothing for a null/empty message, so call sites read as
 * `<FormNote tone="danger">{error}</FormNote>` instead of repeating the same
 * ternary at every slot that might hold one.
 *
 * The dot and the 14px-wide icon slot are {@link UsernameAvailability}'s, not a
 * second design: a message under the email field and a verdict under the
 * username field now share one bullet column and one red, rather than a bare
 * red sentence sitting a few pixels left of every other status line on the
 * form.
 *
 * ## Why the slot is a line tall
 *
 * Its two siblings (UsernameAvailability, Requirement) are single-line rows and
 * can simply say `items-center`. This one can WRAP -- "Please add a little more
 * detail (at least 10 characters)." is two lines in a narrow field -- and
 * centering a two-line block would float the dot into the gap between the
 * lines. So the row is `items-start` and the dot has to be centred on the FIRST
 * line by itself.
 *
 * It used to do that with `mt-[0.28rem]`, a nudge hand-tuned against some
 * earlier font size, which put the dot 3.7px BELOW the centre of a 12px/16px
 * line -- visibly low, and wrong again at any other size. `h-[1lh]` makes the
 * slot exactly one line box tall instead, so `items-center` inside it lands the
 * dot on the first line's centre arithmetically, at whatever font size the note
 * inherits. `w-3.5` still pins the column width to the siblings' 14px.
 */
export function FormNote({
  tone,
  children,
}: {
  tone: "danger" | "muted";
  children: React.ReactNode;
}) {
  if (!children) return null;
  return (
    <p
      className={cn(
        "flex animate-slide-up items-start gap-2 text-xs",
        tone === "danger" ? "text-danger" : "text-muted-foreground",
      )}
    >
      <span
        aria-hidden
        className="flex h-[1lh] w-3.5 shrink-0 items-center justify-center"
      >
        <span
          className={cn(
            "size-2 rounded-full",
            tone === "danger"
              ? "bg-danger shadow-[0_0_0_3px_color-mix(in_oklab,var(--danger)_22%,transparent)]"
              : "bg-muted-foreground/40",
          )}
        />
      </span>
      <span className="min-w-0">{children}</span>
    </p>
  );
}
