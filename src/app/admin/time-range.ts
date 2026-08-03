// Time-frame model shared by the admin page (server) and its picker (client).
//
// A selection is either a named preset (last 24h / 7 days / lifetime) or a
// custom calendar range. It lives entirely in the URL, so it's shareable and
// refresh-safe; the picker only ever navigates.

export type RangePreset = "24h" | "7d" | "all" | "custom";

/** What the picker needs to render the active state and prefill the calendar. */
export interface RangeCurrent {
  preset: RangePreset;
  /** Inclusive custom-range bounds as YYYY-MM-DD (present only for "custom"). */
  from?: string;
  to?: string;
}

export interface RangeSelection {
  /** ISO bounds for the RPC; null means "open" on that side. */
  start: string | null;
  end: string | null;
  current: RangeCurrent;
}

/** Raw, untrusted URL params. */
export interface RangeParams {
  range?: string;
  from?: string;
  to?: string;
}

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

/**
 * Turn URL params into absolute bounds. Custom ranges win when a valid `from`
 * is present; otherwise a named preset; otherwise lifetime. Anything malformed
 * degrades to lifetime rather than erroring.
 */
export function resolveRange(params: RangeParams): RangeSelection {
  const { range, from, to } = params;

  if (from && ISO_DAY.test(from)) {
    const toDay = to && ISO_DAY.test(to) ? to : from;
    // Guard against an inverted range by swapping.
    const [lo, hi] = from <= toDay ? [from, toDay] : [toDay, from];
    return {
      start: dayStartIso(lo),
      end: dayEndIso(hi),
      current: { preset: "custom", from: lo, to: hi },
    };
  }

  if (range === "24h") {
    return {
      start: new Date(Date.now() - DAY_MS).toISOString(),
      end: null,
      current: { preset: "24h" },
    };
  }

  if (range === "7d") {
    return {
      start: new Date(Date.now() - 7 * DAY_MS).toISOString(),
      end: null,
      current: { preset: "7d" },
    };
  }

  return { start: null, end: null, current: { preset: "all" } };
}

/** Short human label for the active selection, e.g. "Last 7 days". */
export function rangeLabel(current: RangeCurrent): string {
  switch (current.preset) {
    case "24h":
      return "Last 24 hours";
    case "7d":
      return "Last 7 days";
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
