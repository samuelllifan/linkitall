"use client";

import { useEffect, useId, useRef, useState } from "react";
import { RANGE_PRESETS, type RangeCurrent, rangeLabel } from "~/lib/time-range";
import { cn } from "~/lib/utils";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

/** Today as YYYY-MM-DD in UTC, so the future-day cap lines up with the UTC day
 *  bounds the range model applies (analytics are stored/bucketed in UTC). */
function todayStr(): string {
  const t = new Date();
  return ymd(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate());
}

/**
 * The one time-range control used by both the dashboard and the admin page. It
 * renders the preset segments (1 Day / 7 Days / 30 Days / Lifetime) plus a
 * Custom segment that opens a calendar. It's fully controlled: `current` drives
 * the active state, and every choice is reported through `onSelect` — the
 * caller decides what to do (navigate the URL on admin, set state on the
 * dashboard).
 */
export function TimeRangePicker({
  current,
  onSelect,
  className,
}: {
  current: RangeCurrent;
  onSelect: (current: RangeCurrent) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const popoverId = useId();
  const today = todayStr();

  // Calendar working state. Two clicks pick a range; one click + Apply picks a
  // single day. Seeded from the active custom range whenever the popover opens.
  const [start, setStart] = useState<string | undefined>();
  const [end, setEnd] = useState<string | undefined>();
  // The grid is rendered in UTC so it lines up with the UTC future-day cap
  // (todayStr) and the UTC day bounds the range model applies to a selection.
  const [view, setView] = useState(() => {
    const seed =
      current.preset === "custom" && current.from
        ? new Date(`${current.from}T00:00:00.000Z`)
        : new Date();
    return { y: seed.getUTCFullYear(), m: seed.getUTCMonth() };
  });

  // Close the popover on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const openCalendar = () => {
    // Seed the working range + month from the active selection each time it
    // opens, so it stays in sync with `current` (which may change externally).
    const seedFrom = current.preset === "custom" ? current.from : undefined;
    const seedTo = current.preset === "custom" ? current.to : undefined;
    setStart(seedFrom);
    setEnd(seedTo);
    const base = seedFrom ? new Date(`${seedFrom}T00:00:00.000Z`) : new Date();
    setView({ y: base.getUTCFullYear(), m: base.getUTCMonth() });
    setOpen(true);
  };

  const pickDay = (day: string) => {
    // First pick, or restart after a full range is already chosen.
    if (!start || (start && end)) {
      setStart(day);
      setEnd(undefined);
      return;
    }
    // Second pick completes the range (auto-ordered).
    if (day < start) {
      setEnd(start);
      setStart(day);
    } else {
      setEnd(day);
    }
  };

  const apply = () => {
    if (!start) return;
    setOpen(false);
    onSelect({ preset: "custom", from: start, to: end ?? start });
  };

  const shiftMonth = (delta: number) => {
    setView((v) => {
      const d = new Date(Date.UTC(v.y, v.m + delta, 1));
      return { y: d.getUTCFullYear(), m: d.getUTCMonth() };
    });
  };

  // Build the visible month grid (leading blanks so day 1 lands on its weekday),
  // all in UTC to match the cap + range model.
  const firstWeekday = new Date(Date.UTC(view.y, view.m, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(ymd(view.y, view.m, d));

  const inRange = (day: string) => !!start && !!end && day > start && day < end;
  const isEdge = (day: string) => day === start || day === end;
  const customActive = current.preset === "custom";

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {/* Segmented control — hugs its content and scrolls only if it can't fit,
          so the pills never clip mid-label on narrow phones. */}
      <div className="flex max-w-full gap-1 overflow-x-auto rounded-lg border border-border bg-card p-1 sm:overflow-visible">
        {RANGE_PRESETS.map((p) => {
          const active = current.preset === p.key;
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => {
                // Close the calendar too, so a stale Apply can't override the
                // preset the user just picked.
                setOpen(false);
                setStart(undefined);
                setEnd(undefined);
                onSelect({ preset: p.key });
              }}
              aria-pressed={active}
              className={cn(
                "shrink-0 whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors sm:px-3 sm:text-sm",
                active
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {p.label}
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => (open ? setOpen(false) : openCalendar())}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={popoverId}
          aria-pressed={customActive}
          className={cn(
            "shrink-0 whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors sm:px-3 sm:text-sm",
            customActive
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          {customActive ? rangeLabel(current) : "Custom"}
        </button>
      </div>

      {open ? (
        <div
          id={popoverId}
          role="dialog"
          aria-label="Choose a date range"
          className="absolute top-full right-0 z-20 mt-2 w-72 rounded-xl border border-border bg-card p-3 shadow-lg"
        >
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              aria-label="Previous month"
              className="rounded-md px-2 py-1 text-muted-foreground hover:bg-muted/60"
            >
              ‹
            </button>
            <span className="text-sm font-medium">
              {MONTHS[view.m]} {view.y}
            </span>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              aria-label="Next month"
              className="rounded-md px-2 py-1 text-muted-foreground hover:bg-muted/60"
            >
              ›
            </button>
          </div>

          <div className="grid grid-cols-7 gap-0.5 text-center">
            {WEEKDAYS.map((w, i) => (
              <span
                // biome-ignore lint/suspicious/noArrayIndexKey: fixed weekday header
                key={i}
                className="py-1 text-[10px] font-medium text-muted-foreground"
              >
                {w}
              </span>
            ))}
            {cells.map((day, i) => {
              if (!day)
                return (
                  // biome-ignore lint/suspicious/noArrayIndexKey: fixed leading blank
                  <span key={`b${i}`} />
                );
              const future = day > today;
              const edge = isEdge(day);
              const mid = inRange(day);
              return (
                <button
                  key={day}
                  type="button"
                  disabled={future}
                  onClick={() => pickDay(day)}
                  className={cn(
                    "h-8 rounded-md text-xs tabular-nums transition-colors",
                    future && "text-muted-foreground/40",
                    !future && !edge && !mid && "hover:bg-muted/60",
                    mid && "bg-muted text-foreground",
                    edge && "bg-foreground font-medium text-background",
                  )}
                >
                  {Number(day.slice(-2))}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">
              {start
                ? end && end !== start
                  ? `${start} → ${end}`
                  : start
                : "Pick a day or range"}
            </span>
            <button
              type="button"
              onClick={apply}
              disabled={!start}
              className={cn(
                "rounded-lg border border-border px-3 py-1.5 text-sm transition-colors",
                start
                  ? "hover:bg-muted/50"
                  : "cursor-not-allowed text-muted-foreground/50",
              )}
            >
              Apply
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
