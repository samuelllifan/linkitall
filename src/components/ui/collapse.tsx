import { cn } from "~/lib/utils";

/**
 * Height-animated show/hide. `grid-template-rows: 0fr -> 1fr` is the only way to
 * transition TO a content-derived height in CSS (a plain `height: auto` is not
 * animatable), so the outer grid owns the motion and the inner div owns the
 * clip -- without `overflow-hidden` the content spills out while collapsed.
 *
 * Opening is an ENTRANCE, so it runs on the app's entrance pair (--dur-enter on
 * --ease-settle) rather than on literals that happened to be near them. Named
 * tokens and not `duration-200 ease-out`, because Tailwind's `ease-out` utility
 * is a third curve again -- see the --ease-glide note in globals.css.
 */
export function Collapse({
  open,
  children,
}: {
  open: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "grid transition-[grid-template-rows,opacity] duration-[var(--dur-enter)] ease-[var(--ease-settle)]",
        open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
      )}
      // Collapsed content is visually gone, so keep it out of the tab order and
      // the accessibility tree too.
      inert={!open}
    >
      <div className="overflow-hidden">{children}</div>
    </div>
  );
}
