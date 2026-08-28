import { cn } from "~/lib/utils";

/**
 * Period-over-period change chip. Green ▲ up / red ▼ down / muted flat, or
 * "New" when the prior period had none and this one has some. Renders nothing
 * when there's no comparable prior period (`previous === null`, e.g. lifetime).
 */
export function DeltaBadge({
  current,
  previous,
  className,
}: {
  current: number;
  previous: number | null;
  className?: string;
}) {
  if (previous === null) return null;

  let pct: number | null;
  let isNew = false;
  if (previous === 0) {
    if (current === 0) {
      pct = 0;
    } else {
      isNew = true;
      pct = null;
    }
  } else {
    pct = Math.round(((current - previous) / previous) * 100);
  }

  const up = isNew || (pct !== null && pct > 0);
  const down = pct !== null && pct < 0;
  const tone = up
    ? "text-emerald-400"
    : down
      ? "text-rose-400"
      : "text-muted-foreground";
  const arrow = up ? "▲" : down ? "▼" : "•";
  const text = isNew
    ? "New"
    : pct === null
      ? ""
      : `${pct > 0 ? "+" : ""}${pct}%`;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-medium tabular-nums",
        tone,
        className,
      )}
    >
      <span aria-hidden>{arrow}</span>
      {text}
    </span>
  );
}
