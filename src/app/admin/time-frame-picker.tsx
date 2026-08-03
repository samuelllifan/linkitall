"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "~/lib/utils";
import { type RangeCurrent, rangeLabel } from "./time-range";

const PRESETS = [
  { key: "24h", label: "24 hours", href: "/admin?range=24h" },
  { key: "7d", label: "7 days", href: "/admin?range=7d" },
  { key: "all", label: "Lifetime", href: "/admin" },
] as const;

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

/** Today as a YYYY-MM-DD string (local), used to cap future days. */
function todayStr(): string {
  const t = new Date();
  return ymd(t.getFullYear(), t.getMonth(), t.getDate());
}

export function TimeFramePicker({ current }: { current: RangeCurrent }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const popoverId = useId();
  const today = todayStr();

  // Calendar working state. Two clicks pick a range; one click + Apply picks a
  // single day. Seeded from the active custom range when there is one.
  const seedFrom = current.preset === "custom" ? current.from : undefined;
  const [start, setStart] = useState<string | undefined>(seedFrom);
  const [end, setEnd] = useState<string | undefined>(
    current.preset === "custom" ? current.to : undefined,
  );
  const initialMonth = seedFrom ? new Date(`${seedFrom}T00:00:00`) : new Date();
  const [view, setView] = useState({
    y: initialMonth.getFullYear(),
    m: initialMonth.getMonth(),
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
    const to = end ?? start;
    setOpen(false);
    router.push(`/admin?from=${start}&to=${to}`);
  };

  const shiftMonth = (delta: number) => {
    setView((v) => {
      const d = new Date(v.y, v.m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  };

  // Build the visible month grid (leading blanks so day 1 lands on its weekday).
  const firstWeekday = new Date(view.y, view.m, 1).getDay();
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(ymd(view.y, view.m, d));

  const inRange = (day: string) => !!start && !!end && day > start && day < end;
  const isEdge = (day: string) => day === start || day === end;

  const customActive = current.preset === "custom";

  return (
    <div ref={containerRef} className="relative flex flex-wrap gap-1.5">
      {PRESETS.map((p) => {
        const active = current.preset === p.key;
        return (
          <button
            key={p.key}
            type="button"
            onClick={() => router.push(p.href)}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-sm transition-colors",
              active
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted-foreground hover:bg-muted/50",
            )}
          >
            {p.label}
          </button>
        );
      })}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={popoverId}
        className={cn(
          "rounded-lg border px-3 py-1.5 text-sm transition-colors",
          customActive
            ? "border-foreground bg-foreground text-background"
            : "border-border text-muted-foreground hover:bg-muted/50",
        )}
      >
        {customActive ? rangeLabel(current) : "Custom"}
      </button>

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
