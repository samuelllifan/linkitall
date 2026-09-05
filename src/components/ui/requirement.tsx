import { cn } from "~/lib/utils";

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

function Spinner({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      className={cn("animate-spin", className)}
      aria-hidden="true"
    >
      {/* Three-quarter arc, so the rotation is legible at 12px. */}
      <path d="M12 3a9 9 0 1 1-6.36 2.64" />
    </svg>
  );
}

/**
 * A single live requirement row for the sign-up / reset password checklists:
 * green with a check when met, red when unmet after a submit attempt, neutral
 * before that. Shared so both auth forms show an identical checklist.
 */
export function Requirement({
  met,
  attempted,
  pending = false,
  children,
}: {
  met: boolean;
  // Only tint unmet requirements red once the user has tried to submit;
  // before that they stay neutral so the form doesn't look angry on load.
  attempted: boolean;
  /**
   * The answer isn't known yet — used by the username availability row while its
   * check is in flight. Holds the row neutral (never red, never green) and swaps
   * the bullet for a spinner, so an unanswered requirement can't read as failed.
   */
  pending?: boolean;
  children: React.ReactNode;
}) {
  return (
    <li
      className={cn(
        "flex items-center gap-2 text-xs transition-colors",
        pending
          ? "text-muted-foreground"
          : met
            ? "text-success"
            : attempted
              ? "text-danger"
              : "text-muted-foreground",
      )}
    >
      <span className="flex size-3.5 shrink-0 items-center justify-center">
        {pending ? (
          <Spinner className="size-3" />
        ) : met ? (
          <CheckIcon className="size-3.5 animate-pop" />
        ) : (
          <span className="size-1 rounded-full bg-current" />
        )}
      </span>
      {children}
    </li>
  );
}
