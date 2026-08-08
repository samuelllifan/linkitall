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

/**
 * A single live requirement row for the sign-up / reset password checklists:
 * green with a check when met, red when unmet after a submit attempt, neutral
 * before that. Shared so both auth forms show an identical checklist.
 */
export function Requirement({
  met,
  attempted,
  children,
}: {
  met: boolean;
  // Only tint unmet requirements red once the user has tried to submit;
  // before that they stay neutral so the form doesn't look angry on load.
  attempted: boolean;
  children: React.ReactNode;
}) {
  return (
    <li
      className={cn(
        "flex items-center gap-2 text-xs transition-colors duration-200",
        met
          ? "text-green-500"
          : attempted
            ? "text-red-400"
            : "text-muted-foreground",
      )}
    >
      <span className="flex size-3.5 shrink-0 items-center justify-center">
        {met ? (
          <CheckIcon className="size-3.5 animate-pop" />
        ) : (
          <span className="size-1 rounded-full bg-current" />
        )}
      </span>
      {children}
    </li>
  );
}
