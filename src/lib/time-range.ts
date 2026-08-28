// Unified time-frame model shared by the dashboard (client) and admin (server)
// pages and the single <TimeRangePicker> they both render.
//
// A selection is either a named preset (last 1 day / 7 days / 30 days /
// lifetime) or a custom calendar range. On admin it lives entirely in the URL
// (shareable, refresh-safe); on the dashboard it lives in client state. Either
// way it resolves to the SAME absolute [start, end) bounds via `windowFor`, so
// the two pages scope their data identically.

export type RangePreset = "1d" | "7d" | "30d" | "all" | "custom";

/** What the picker needs to render the active state and prefill the calendar. */
export interface RangeCurrent {
  preset: RangePreset;
  /** Inclusive custom-range bounds as YYYY-MM-DD (present only for "custom"). */
  from?: string;
  to?: string;
}

export interface RangeSelection {
  /** ISO bounds; null means "open" on that side. `end` is exclusive. */
  start: string | null;
  end: string | null;
  current: RangeCurrent;
}

/** Raw, untrusted URL params (admin). */
export interface RangeParams {
  range?: string;
  from?: string;
  to?: string;
}

/** Ordered preset segments shown in the picker. "Custom" is rendered separately
 *  (it opens the calendar), so it isn't listed here. */
export const RANGE_PRESETS: {
  key: Exclude<RangePreset, "custom">;
  label: string;
}[] = [
  { key: "1d", label: "1 Day" },
  { key: "7d", label: "7 Days" },
  { key: "30d", label: "30 Days" },
  { key: "all", label: "Lifetime" },
];

const DAY_MS = 24 * 60 * 60 * 1000;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** UTC midnight (start of day) for a YYYY-MM-DD string. */
function dayStartIso(day: string): string {
  return `${day}T00:00:00.000Z`;
}

/** UTC midnight of the day AFTER `day` — an exclusive upper bound. */
function dayEndIso(day: string): string {
  const d = new Date(`${day}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString();
}

/** Order a possibly-inverted custom range as [lo, hi]. */
function orderDays(from: string, to?: string): [string, string] {
  const t = to ?? from;
  return from <= t ? [from, t] : [t, from];
}

/**
 * Absolute [start, end) bounds for a selection. Rolling presets run up to "now"
 * (open `end`); "all" is fully open; a custom range uses UTC day bounds — the
 * same UTC the analytics are stored and bucketed in.
 */
export function windowFor(current: RangeCurrent): {
  start: string | null;
  end: string | null;
} {
  const now = Date.now();
  switch (current.preset) {
    case "1d":
      return { start: new Date(now - DAY_MS).toISOString(), end: null };
    case "7d":
      return { start: new Date(now - 7 * DAY_MS).toISOString(), end: null };
    case "30d":
      return { start: new Date(now - 30 * DAY_MS).toISOString(), end: null };
    case "custom": {
      if (current.from) {
        const [lo, hi] = orderDays(current.from, current.to);
        return { start: dayStartIso(lo), end: dayEndIso(hi) };
      }
      return { start: null, end: null };
    }
    default:
      return { start: null, end: null };
  }
}

/**
 * Turn admin URL params into a resolved selection. Custom wins when a valid
 * `from` is present; otherwise a named preset; otherwise lifetime. Anything
 * malformed degrades to lifetime rather than erroring.
 */
export function resolveRange(params: RangeParams): RangeSelection {
  const { range, from, to } = params;

  if (from && ISO_DAY.test(from)) {
    const toDay = to && ISO_DAY.test(to) ? to : from;
    const [lo, hi] = orderDays(from, toDay);
    const current: RangeCurrent = { preset: "custom", from: lo, to: hi };
    return { ...windowFor(current), current };
  }

  if (range === "1d" || range === "7d" || range === "30d") {
    const current: RangeCurrent = { preset: range };
    return { ...windowFor(current), current };
  }

  return { start: null, end: null, current: { preset: "all" } };
}

/** The admin URL that reflects a selection (shareable + refresh-safe). */
export function adminHref(current: RangeCurrent): string {
  if (current.preset === "custom" && current.from) {
    const [lo, hi] = orderDays(current.from, current.to);
    return `/admin?from=${lo}&to=${hi}`;
  }
  if (
    current.preset === "1d" ||
    current.preset === "7d" ||
    current.preset === "30d"
  ) {
    return `/admin?range=${current.preset}`;
  }
  return "/admin";
}

/** Short human label for a selection, e.g. "Last 7 days" or "Aug 1 – Aug 8". */
export function rangeLabel(current: RangeCurrent): string {
  switch (current.preset) {
    case "1d":
      return "Last 24 hours";
    case "7d":
      return "Last 7 days";
    case "30d":
      return "Last 30 days";
    case "custom": {
      const fmt = (day?: string) =>
        day
          ? new Date(`${day}T00:00:00.000Z`).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
              timeZone: "UTC",
            })
          : "";
      return current.from && current.to && current.from !== current.to
        ? `${fmt(current.from)} – ${fmt(current.to)}`
        : fmt(current.from);
    }
    default:
      return "Lifetime";
  }
}
