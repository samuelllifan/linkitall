import { createClient } from "~/lib/supabase/client";

export type DeviceType = "desktop" | "mobile" | "other";

/** The device buckets always shown on the dashboard, in display order. */
export const DEVICE_LIST: DeviceType[] = ["desktop", "mobile", "other"];

function randomId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `v-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

// Fallback id for when localStorage is unavailable (e.g. private mode). Cached
// at module scope so a view and its follow-up click share one id within a load.
let fallbackVisitorId: string | null = null;

/**
 * A stable, anonymous id for this browser, stored in localStorage so returning
 * guests keep the same id — a repeat visit from the same device/browser does
 * NOT count as a new unique view. Carries no personal information.
 */
export function getVisitorId(): string {
  const KEY = "stacked-visitor";
  try {
    const existing = localStorage.getItem(KEY);
    if (existing) return existing;
    const id = randomId();
    localStorage.setItem(KEY, id);
    return id;
  } catch {
    // localStorage blocked — reuse one id for the whole page load so the
    // visitor's view and click stay attributed to the same (anonymous) person.
    if (!fallbackVisitorId) fallbackVisitorId = randomId();
    return fallbackVisitorId;
  }
}

/** Best-effort device class from the user agent (tablets → "other"). */
export function detectDevice(): DeviceType {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  if (/iPad|Tablet|PlayBook|Silk/i.test(ua)) return "other";
  if (/Mobi|Android|iPhone|iPod|IEMobile|BlackBerry|Opera Mini/i.test(ua)) {
    return "mobile";
  }
  if (/Windows|Macintosh|Mac OS X|Linux|CrOS/i.test(ua)) return "desktop";
  return "other";
}

function normalizeDevice(device: string | null): DeviceType {
  if (device === "desktop" || device === "mobile") return device;
  return "other"; // includes legacy "tablet" and unknowns
}

/**
 * POST an event to our own /api/track route. Going through the server (rather
 * than calling the RPC directly from the browser) lets the server attach the
 * visitor's country from the request's geo headers — the browser can't see it.
 * `keepalive` lets a click still send while the page navigates away.
 */
async function sendEvent(payload: Record<string, string>): Promise<void> {
  try {
    await fetch("/api/track", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch {
    // Ignore — analytics are non-critical.
  }
}

/**
 * Fire-and-forget: record a public view of `username`'s profile. Errors are
 * swallowed so tracking can never break the visitor's page.
 */
export async function recordView(username: string): Promise<void> {
  await sendEvent({
    username,
    kind: "view",
    visitor: getVisitorId(),
    device: detectDevice(),
  });
}

/** Fire-and-forget: record a click on one of `username`'s links. */
export async function recordClick(
  username: string,
  linkId: string,
  linkLabel: string,
): Promise<void> {
  await sendEvent({
    username,
    kind: "click",
    visitor: getVisitorId(),
    device: detectDevice(),
    linkId,
    linkLabel,
  });
}

interface RawEvent {
  kind: "view" | "click";
  visitor_id: string;
  device: string | null;
  link_id: string | null;
  link_label: string | null;
  country: string | null;
  created_at: string;
}

/** Clicks grouped by the event's link_id (or label when it has none). */
export interface ClickGroup {
  linkId: string | null;
  label: string;
  clicks: number;
  /** Clicks in the immediately-preceding equal-length window (for momentum). */
  prevClicks: number;
}

/** View counts for one country (ISO alpha-2, or "ZZ" for unknown). */
export interface LocationDatum {
  country: string;
  views: number;
}

/** When the audience is active, in the owner's local time. */
export interface PeakActivity {
  /** View counts by hour of day (index 0–23). */
  byHour: number[];
  /** View counts by weekday (index 0 = Sunday … 6 = Saturday). */
  byWeekday: number[];
  /** weekday × hour matrix of view counts, for the heatmap ([7][24]). */
  heat: number[][];
  /** Busiest hour / weekday, or null when there are no views. */
  bestHour: number | null;
  bestWeekday: number | null;
}

/** New vs returning split of the window's unique visitors. */
export interface VisitorLoyalty {
  /** Visitors seen on a single day in the window. */
  newVisitors: number;
  /** Visitors seen on 2+ distinct days in the window. */
  returningVisitors: number;
}

/** Headline totals for one window, used to compare against the prior period. */
export interface PeriodTotals {
  uniqueViews: number;
  totalViews: number;
  totalClicks: number;
  clickThroughRate: number;
}

/** One point on the views/clicks-over-time chart. */
export interface TimelinePoint {
  label: string;
  count: number;
}

export interface AnalyticsSummary {
  /** Distinct visitors who viewed the profile. */
  uniqueViews: number;
  /** Total (non-unique) view events. */
  totalViews: number;
  /** Total clicks across all links. */
  totalClicks: number;
  /** % of unique viewers who clicked at least one link (0–100). */
  clickThroughRate: number;
  /** Click counts grouped by link (merged with the page's links in the UI). */
  clickGroups: ClickGroup[];
  /** View counts per device — always includes all of DEVICE_LIST. */
  devices: { device: DeviceType; views: number }[];
  /** View counts bucketed over the selected range. */
  timeline: TimelinePoint[];
  /** Click counts bucketed over the same range/buckets as `timeline`. */
  clickTimeline: TimelinePoint[];
  /** View counts by visitor country, most-viewed first. */
  locations: LocationDatum[];
  /** When the audience is active (owner-local time). */
  peak: PeakActivity;
  /** New vs returning visitor split. */
  loyalty: VisitorLoyalty;
  /** Totals for the equally-long window just before this one; null for
   *  lifetime (no comparable prior period). */
  previous: PeriodTotals | null;
  /** True when the analytics backend isn't reachable yet (migration pending). */
  unavailable: boolean;
}

function emptyPeak(): PeakActivity {
  return {
    byHour: new Array<number>(24).fill(0),
    byWeekday: new Array<number>(7).fill(0),
    heat: Array.from({ length: 7 }, () => new Array<number>(24).fill(0)),
    bestHour: null,
    bestWeekday: null,
  };
}

const EMPTY_SUMMARY: AnalyticsSummary = {
  uniqueViews: 0,
  totalViews: 0,
  totalClicks: 0,
  clickThroughRate: 0,
  clickGroups: [],
  devices: DEVICE_LIST.map((device) => ({ device, views: 0 })),
  timeline: [],
  clickTimeline: [],
  locations: [],
  peak: emptyPeak(),
  loyalty: { newVisitors: 0, returningVisitors: 0 },
  previous: null,
  unavailable: false,
};

function hourLabel(d: Date): string {
  const h = d.getHours();
  return `${((h + 11) % 12) + 1}${h < 12 ? "a" : "p"}`;
}

function dayLabel(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

interface Bucket {
  label: string;
  start: number;
  end: number;
}

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

/**
 * Build empty time buckets spanning [startMs, endMs]: hourly for windows up to
 * 48h (matching the admin RPC's granularity), otherwise daily, clamped to the
 * most-recent 120 days so the axis stays readable. Views and clicks share one
 * bucket set so their series line up.
 */
function buildBuckets(startMs: number, endMs: number): Bucket[] {
  const buckets: Bucket[] = [];
  const span = endMs - startMs;

  // `< endMs` (not `<=`) so a window whose exclusive end lands exactly on a
  // bucket boundary (custom ranges always do) doesn't get a trailing empty
  // bucket; rolling presets end at "now" (mid-bucket), so the current partial
  // bucket is still included.
  if (span <= 48 * HOUR_MS) {
    const base = new Date(startMs);
    base.setMinutes(0, 0, 0);
    for (let t = base.getTime(); t < endMs; t += HOUR_MS) {
      buckets.push({
        label: hourLabel(new Date(t)),
        start: t,
        end: t + HOUR_MS,
      });
    }
  } else {
    const dayFloor = (ms: number) => {
      const d = new Date(ms);
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    };
    // Step by re-flooring to the next LOCAL midnight each iteration (not a fixed
    // 24h) so buckets stay aligned to calendar days across DST transitions.
    const nextMidnight = (ms: number) => {
      const d = new Date(ms);
      d.setDate(d.getDate() + 1);
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    };
    let t = dayFloor(startMs);
    // Keep at most the most-recent ~120 days so the axis stays readable.
    const clamp = dayFloor(endMs - 119 * DAY_MS);
    if (t < clamp) t = clamp;
    while (t < endMs) {
      const next = nextMidnight(t);
      buckets.push({ label: dayLabel(new Date(t)), start: t, end: next });
      t = next;
    }
  }

  return buckets;
}

/** Count how many of `times` fall into each (contiguous) bucket. */
function countInto(buckets: Bucket[], times: number[]): number[] {
  const counts = new Array<number>(buckets.length).fill(0);
  for (const t of times) {
    for (let i = 0; i < buckets.length; i++) {
      if (t >= buckets[i].start && t < buckets[i].end) {
        counts[i] += 1;
        break;
      }
    }
  }
  return counts;
}

function eventTime(e: RawEvent): number {
  return new Date(e.created_at).getTime();
}

/** Stable grouping key + display fields for a click event's link. */
function linkKey(e: RawEvent): {
  key: string;
  label: string;
  linkId: string | null;
} {
  const label = e.link_label || e.link_id || "Untitled link";
  return { key: e.link_id ?? `label:${label}`, label, linkId: e.link_id };
}

/** Headline totals + CTR for an arbitrary set of events (the prior period). */
function periodTotals(events: RawEvent[]): PeriodTotals {
  const viewers = new Set<string>();
  const clickers = new Set<string>();
  let totalViews = 0;
  let totalClicks = 0;
  for (const e of events) {
    if (e.kind === "view") {
      viewers.add(e.visitor_id);
      totalViews += 1;
    } else {
      clickers.add(e.visitor_id);
      totalClicks += 1;
    }
  }
  let clickingViewers = 0;
  for (const v of clickers) if (viewers.has(v)) clickingViewers += 1;
  const uniqueViews = viewers.size;
  return {
    uniqueViews,
    totalViews,
    totalClicks,
    clickThroughRate:
      uniqueViews > 0 ? Math.round((clickingViewers / uniqueViews) * 100) : 0,
  };
}

/**
 * Fetch the signed-in owner's events for the given window and reduce them to a
 * dashboard summary. When the window is bounded, the immediately-preceding
 * equal-length window is fetched in the same query so the UI can show
 * period-over-period change (and per-link momentum). Aggregation is client-side;
 * volumes are small and RLS guarantees a user only ever sees their own events.
 */
export async function getAnalytics(window: {
  start: string | null;
  end: string | null;
}): Promise<AnalyticsSummary> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ...EMPTY_SUMMARY };

  const nowMs = Date.now();
  const startMs = window.start ? Date.parse(window.start) : null;
  const endMs = window.end ? Date.parse(window.end) : nowMs;
  const hasPrev = startMs !== null;
  const prevStartMs = hasPrev ? startMs - (endMs - startMs) : null;

  let query = supabase
    .from("analytics_events")
    .select(
      "kind, visitor_id, device, link_id, link_label, country, created_at",
    )
    .eq("page_user_id", user.id);
  // Fetch the current + prior window together (lower bound = prior start).
  if (prevStartMs !== null) {
    query = query.gte("created_at", new Date(prevStartMs).toISOString());
  }
  if (window.end) query = query.lt("created_at", window.end);
  // Newest first so that if the row cap ever truncates, it drops the OLDEST
  // rows (the prior comparison window) before the current window's own stats.
  query = query.order("created_at", { ascending: false });

  const { data, error } = await query;
  if (error) return { ...EMPTY_SUMMARY, unavailable: true };

  const rows = (data ?? []) as RawEvent[];

  // Partition into the current window and the immediately-preceding one.
  const current: RawEvent[] = [];
  const prev: RawEvent[] = [];
  for (const e of rows) {
    const t = eventTime(e);
    if (startMs === null || t >= startMs) current.push(e);
    else if (prevStartMs !== null && t >= prevStartMs) prev.push(e);
  }

  const viewers = new Set<string>();
  const clickers = new Set<string>();
  const deviceViews: Record<DeviceType, number> = {
    desktop: 0,
    mobile: 0,
    other: 0,
  };
  const clickMap = new Map<
    string,
    { linkId: string | null; label: string; clicks: number }
  >();
  const countryViews = new Map<string, number>();
  const visitorDays = new Map<string, Set<string>>();
  const peak = emptyPeak();
  const viewTimes: number[] = [];
  const clickTimes: number[] = [];
  let totalViews = 0;
  let totalClicks = 0;

  for (const e of current) {
    const t = eventTime(e);
    if (e.kind === "view") {
      viewers.add(e.visitor_id);
      totalViews += 1;
      deviceViews[normalizeDevice(e.device)] += 1;
      viewTimes.push(t);

      const country =
        e.country && /^[A-Za-z]{2}$/.test(e.country)
          ? e.country.toUpperCase()
          : "ZZ";
      countryViews.set(country, (countryViews.get(country) ?? 0) + 1);

      const d = new Date(t);
      const wd = d.getDay();
      const h = d.getHours();
      peak.byHour[h] += 1;
      peak.byWeekday[wd] += 1;
      peak.heat[wd][h] += 1;

      const dayKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      let days = visitorDays.get(e.visitor_id);
      if (!days) {
        days = new Set();
        visitorDays.set(e.visitor_id, days);
      }
      days.add(dayKey);
    } else {
      clickers.add(e.visitor_id);
      totalClicks += 1;
      clickTimes.push(t);
      const { key, label, linkId } = linkKey(e);
      const g = clickMap.get(key);
      if (g) g.clicks += 1;
      else clickMap.set(key, { linkId, label, clicks: 1 });
    }
  }

  // Prior-window clicks per link, for momentum badges. Keeps link identity so a
  // link whose clicks ALL fell in the prior window (0 now) still surfaces its
  // decline instead of dropping out entirely.
  const prevClickMap = new Map<
    string,
    { linkId: string | null; label: string; clicks: number }
  >();
  for (const e of prev) {
    if (e.kind !== "click") continue;
    const { key, label, linkId } = linkKey(e);
    const g = prevClickMap.get(key);
    if (g) g.clicks += 1;
    else prevClickMap.set(key, { linkId, label, clicks: 1 });
  }

  let clickingViewers = 0;
  for (const v of clickers) if (viewers.has(v)) clickingViewers += 1;
  const uniqueViews = viewers.size;
  const clickThroughRate =
    uniqueViews > 0 ? Math.round((clickingViewers / uniqueViews) * 100) : 0;

  let returningVisitors = 0;
  for (const days of visitorDays.values())
    if (days.size >= 2) returningVisitors += 1;

  // Busiest bucket, or null when there are no views at all.
  const argmax = (arr: number[]): number | null => {
    let best = 0;
    let idx = -1;
    for (let i = 0; i < arr.length; i++) {
      if (arr[i] > best) {
        best = arr[i];
        idx = i;
      }
    }
    return idx >= 0 ? idx : null;
  };
  peak.bestHour = argmax(peak.byHour);
  peak.bestWeekday = argmax(peak.byWeekday);

  // Time buckets. For lifetime (open start) anchor on the earliest event.
  const anchorTimes = viewTimes.concat(clickTimes);
  const bucketStart =
    startMs ?? (anchorTimes.length ? Math.min(...anchorTimes) : null);
  const buckets = bucketStart !== null ? buildBuckets(bucketStart, endMs) : [];
  const viewCounts = countInto(buckets, viewTimes);
  const clickCounts = countInto(buckets, clickTimes);

  const clickGroups: ClickGroup[] = [];
  for (const [key, g] of clickMap) {
    clickGroups.push({ ...g, prevClicks: prevClickMap.get(key)?.clicks ?? 0 });
  }
  // Links with prior-window clicks but none now — surface them (clicks: 0) so
  // the "declined to zero" momentum can still show.
  for (const [key, g] of prevClickMap) {
    if (clickMap.has(key)) continue;
    clickGroups.push({
      linkId: g.linkId,
      label: g.label,
      clicks: 0,
      prevClicks: g.clicks,
    });
  }

  const locations: LocationDatum[] = [...countryViews.entries()]
    .map(([country, views]) => ({ country, views }))
    .sort((a, b) => b.views - a.views);

  return {
    uniqueViews,
    totalViews,
    totalClicks,
    clickThroughRate,
    clickGroups,
    devices: DEVICE_LIST.map((device) => ({
      device,
      views: deviceViews[device],
    })),
    timeline: buckets.map((b, i) => ({ label: b.label, count: viewCounts[i] })),
    clickTimeline: buckets.map((b, i) => ({
      label: b.label,
      count: clickCounts[i],
    })),
    locations,
    peak,
    loyalty: {
      newVisitors: uniqueViews - returningVisitors,
      returningVisitors,
    },
    previous: hasPrev ? periodTotals(prev) : null,
    unavailable: false,
  };
}
