import { createClient } from "~/lib/supabase/client";

export type DeviceType = "desktop" | "mobile" | "other";

/** The device buckets always shown on the dashboard, in display order. */
export const DEVICE_LIST: DeviceType[] = ["desktop", "mobile", "other"];

/** Selectable dashboard time ranges. `days: null` means all time. */
export interface TimeRange {
  key: string;
  label: string;
  days: number | null;
}

export const TIME_RANGES: TimeRange[] = [
  { key: "1d", label: "1 day", days: 1 },
  { key: "3d", label: "3 days", days: 3 },
  { key: "7d", label: "7 days", days: 7 },
  { key: "30d", label: "30 days", days: 30 },
  { key: "all", label: "Lifetime", days: null },
];

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
  const KEY = "linkitall-visitor";
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
 * Fire-and-forget: record a public view of `username`'s profile. Errors are
 * swallowed so tracking can never break the visitor's page.
 */
export async function recordView(username: string): Promise<void> {
  try {
    const supabase = createClient();
    await supabase.rpc("record_analytics_event", {
      page_username: username,
      event_kind: "view",
      visitor: getVisitorId(),
      device_type: detectDevice(),
    });
  } catch {
    // Ignore — analytics are non-critical.
  }
}

/** Fire-and-forget: record a click on one of `username`'s links. */
export async function recordClick(
  username: string,
  linkId: string,
  linkLabel: string,
): Promise<void> {
  try {
    const supabase = createClient();
    await supabase.rpc("record_analytics_event", {
      page_username: username,
      event_kind: "click",
      visitor: getVisitorId(),
      device_type: detectDevice(),
      link_id: linkId,
      link_label: linkLabel,
    });
  } catch {
    // Ignore — analytics are non-critical.
  }
}

interface RawEvent {
  kind: "view" | "click";
  visitor_id: string;
  device: string | null;
  link_id: string | null;
  link_label: string | null;
  created_at: string;
}

/** Clicks grouped by the event's link_id (or label when it has none). */
export interface ClickGroup {
  linkId: string | null;
  label: string;
  clicks: number;
}

/** One point on the views-over-time chart. */
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
  /** True when the analytics backend isn't reachable yet (migration pending). */
  unavailable: boolean;
}

const EMPTY_SUMMARY: AnalyticsSummary = {
  uniqueViews: 0,
  totalViews: 0,
  totalClicks: 0,
  clickThroughRate: 0,
  clickGroups: [],
  devices: DEVICE_LIST.map((device) => ({ device, views: 0 })),
  timeline: [],
  unavailable: false,
};

function hourLabel(d: Date): string {
  const h = d.getHours();
  return `${((h + 11) % 12) + 1}${h < 12 ? "a" : "p"}`;
}

function dayLabel(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/**
 * Bucket view timestamps for the chart: hourly over the last 24h for the 1-day
 * range, otherwise one bucket per day (lifetime spans from the first view).
 */
function buildTimeline(times: number[], days: number | null): TimelinePoint[] {
  const now = Date.now();
  const buckets: {
    label: string;
    start: number;
    end: number;
    count: number;
  }[] = [];

  if (days === 1) {
    const base = new Date(now);
    base.setMinutes(0, 0, 0);
    for (let i = 23; i >= 0; i--) {
      const start = base.getTime() - i * 3_600_000;
      buckets.push({
        label: hourLabel(new Date(start)),
        start,
        end: start + 3_600_000,
        count: 0,
      });
    }
  } else {
    let n = days ?? 0;
    if (days == null) {
      if (times.length === 0) return [];
      const earliest = new Date(Math.min(...times));
      earliest.setHours(0, 0, 0, 0);
      const today = new Date(now);
      today.setHours(0, 0, 0, 0);
      n = Math.round((today.getTime() - earliest.getTime()) / 86_400_000) + 1;
      n = Math.max(1, Math.min(n, 120)); // cap so the axis stays readable
    }
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    for (let i = n - 1; i >= 0; i--) {
      const start = today.getTime() - i * 86_400_000;
      buckets.push({
        label: dayLabel(new Date(start)),
        start,
        end: start + 86_400_000,
        count: 0,
      });
    }
  }

  for (const t of times) {
    for (const b of buckets) {
      if (t >= b.start && t < b.end) {
        b.count += 1;
        break;
      }
    }
  }
  return buckets.map((b) => ({ label: b.label, count: b.count }));
}

/**
 * Fetch the signed-in owner's events within `days` (null = all time) and reduce
 * them to a dashboard summary. Aggregation happens client-side; volumes are
 * small and RLS guarantees a user only ever sees their own events.
 */
export async function getAnalytics(
  days: number | null,
): Promise<AnalyticsSummary> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ...EMPTY_SUMMARY };

  let query = supabase
    .from("analytics_events")
    .select("kind, visitor_id, device, link_id, link_label, created_at")
    .eq("page_user_id", user.id);

  if (days != null) {
    const since = new Date(Date.now() - days * 86_400_000).toISOString();
    query = query.gte("created_at", since);
  }

  const { data, error } = await query;
  if (error) return { ...EMPTY_SUMMARY, unavailable: true };

  const events = (data ?? []) as RawEvent[];

  const viewers = new Set<string>();
  const clickers = new Set<string>();
  const deviceViews: Record<DeviceType, number> = {
    desktop: 0,
    mobile: 0,
    other: 0,
  };
  const clickMap = new Map<string, ClickGroup>();
  const viewTimes: number[] = [];
  let totalViews = 0;
  let totalClicks = 0;

  for (const e of events) {
    if (e.kind === "view") {
      viewers.add(e.visitor_id);
      totalViews += 1;
      deviceViews[normalizeDevice(e.device)] += 1;
      viewTimes.push(new Date(e.created_at).getTime());
    } else {
      clickers.add(e.visitor_id);
      totalClicks += 1;
      const label = e.link_label || e.link_id || "Untitled link";
      const key = e.link_id ?? `label:${label}`;
      const existing = clickMap.get(key);
      if (existing) existing.clicks += 1;
      else clickMap.set(key, { linkId: e.link_id, label, clicks: 1 });
    }
  }

  let clickingViewers = 0;
  for (const v of clickers) if (viewers.has(v)) clickingViewers += 1;

  const uniqueViews = viewers.size;
  const clickThroughRate =
    uniqueViews > 0 ? Math.round((clickingViewers / uniqueViews) * 100) : 0;

  return {
    uniqueViews,
    totalViews,
    totalClicks,
    clickThroughRate,
    clickGroups: [...clickMap.values()],
    devices: DEVICE_LIST.map((device) => ({
      device,
      views: deviceViews[device],
    })),
    timeline: buildTimeline(viewTimes, days),
    unavailable: false,
  };
}
