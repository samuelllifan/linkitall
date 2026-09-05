import { cn } from "~/lib/utils";

/**
 * A loading placeholder: a pulsing block standing in for content that hasn't
 * arrived. Sized by the caller (`className`) so one component covers a stat
 * number, a chart, a table row and a QR square.
 *
 * There were three of these. This one (unused, on `bg-accent`), a local copy in
 * dashboard-client.tsx on `bg-muted`, and a bare `animate-pulse rounded-lg
 * bg-muted` div in the share panel. `--accent` and `--muted` happen to be the
 * same value today — both `oklch(0.269 0 0)` — so nothing looked wrong, which
 * is precisely what makes it worth collapsing now: the day one of those tokens
 * moves, the dashboard's placeholders and the share panel's would drift apart
 * for no reason anybody could find. `bg-muted` is what survived, because that
 * is what the two that actually shipped were using.
 */
export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
}
