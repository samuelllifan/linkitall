import { DeltaBadge } from "~/components/delta-badge";
import { LocationMap } from "~/components/location-map";
import type { TimelinePoint } from "~/lib/analytics";
import { CHART_COLORS } from "~/lib/chart-colors";
import { countryFlag, countryName } from "~/lib/countries";
import type { RangeCurrent } from "~/lib/time-range";
import { getCountryPaths } from "~/lib/world-map";
import { MultiLineChart, PieChart, ViewsLineChart } from "../dashboard/charts";
import { AdminRangePicker } from "./admin-range-picker";

export interface AdminUserRow {
  id: string;
  username: string | null;
  email: string | null;
  /** Auth provider used to sign in (e.g. "google", "email"). */
  provider: string;
  lastSignInAt: string | null;
  createdAt: string | null;
  views: number;
  clicks: number;
}

export interface AdminOverview {
  users: AdminUserRow[];
  totals: {
    users: number;
    views: number;
    clicks: number;
    /** Distinct visitor browsers across all views ("people", not page loads). */
    uniqueVisitors: number;
  };
  /** Time-series bucket size chosen for the window: "hour" or "day". */
  granularity: "hour" | "day";
  /** Site-wide view counts grouped by the visitor's device. */
  devices: { device: string; views: number }[];
  /** Site-wide view counts grouped by the visitor's country ("ZZ" = unknown). */
  locations: { country: string; views: number }[];
  /** Most-clicked links site-wide, by denormalized label. */
  topLinks: { label: string; clicks: number }[];
  /** Zero-filled views/clicks series across the window (label pre-formatted). */
  trend: { label: string; views: number; clicks: number }[];
  /** Zero-filled new-accounts series across the window. */
  signups: { label: string; count: number }[];
}

/** "desktop" → "Desktop", "unknown" → "Unknown", etc. */
function deviceLabel(d: string): string {
  if (!d) return "Unknown";
  return d.charAt(0).toUpperCase() + d.slice(1);
}

/** "google" → "Google", "email" → "Email", etc. */
function providerLabel(p: string): string {
  if (!p) return "—";
  return p.charAt(0).toUpperCase() + p.slice(1);
}

/** Absolute date + time, or an em dash when missing. */
function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Stagger between the tiles' arrivals, in ms. The same number the dashboard
 * uses (`STAT_STAGGER` in dashboard-client.tsx) — these two pages are the same
 * screen twice over, down to sharing the stat tile's shell, the section card
 * and the range picker, and admin was the one that simply appeared fully formed
 * while its twin dealt itself in.
 */
const STAT_STAGGER = 45;

/**
 * When the chart panels below the tiles arrive. One step past the last tile, so
 * the page deals the top row and then the panels rather than everything at once
 * — the same relationship the dashboard's Panel has to its own stat row.
 */
const PANEL_DELAY: React.CSSProperties = {
  animationDelay: `${STAT_STAGGER * 5}ms`,
};

function StatCard({
  label,
  value,
  delta,
  delay = 0,
}: {
  label: string;
  /** Preformatted (e.g. "3.2%") or numeric — numbers get thousands grouping. */
  value: number | string;
  /** Optional period-over-period comparison (hidden when previous is null). */
  delta?: { current: number; previous: number | null };
  /** Stagger, in ms, for the card's arrival. See `.animate-rise`. */
  delay?: number;
}) {
  return (
    <div
      className="animate-rise elev-card rounded-xl border border-border bg-card p-5"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-1 text-3xl font-bold tabular-nums">
        {typeof value === "number" ? value.toLocaleString() : value}
      </div>
      {delta && delta.previous !== null ? (
        <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          <DeltaBadge current={delta.current} previous={delta.previous} />
          <span>vs previous</span>
        </div>
      ) : null}
    </div>
  );
}

export function AdminView({
  overview,
  previous,
  range,
}: {
  overview: AdminOverview;
  previous?: AdminOverview | null;
  range: RangeCurrent;
}) {
  // New fields default so the page still renders if the analytics backend
  // predates a given migration.
  const { users, totals, devices } = overview;
  const locations = overview.locations ?? [];
  const topLinks = overview.topLinks ?? [];
  const trend = overview.trend ?? [];
  const signups = overview.signups ?? [];
  const granularity = overview.granularity ?? "day";
  const uniqueVisitors = totals.uniqueVisitors ?? 0;

  // Click-through rate across all traffic. Guard against divide-by-zero.
  const ctr = totals.views > 0 ? (totals.clicks / totals.views) * 100 : 0;

  // Prior-period totals for the headline deltas (null when not comparable).
  const prevTotals = previous?.totals ?? null;
  const prevCtr =
    prevTotals && prevTotals.views > 0
      ? (prevTotals.clicks / prevTotals.views) * 100
      : null;

  // Top links, ranked and shaped for the horizontal bar list below.
  const rankedLinks = topLinks
    .slice()
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 10);
  const linkMax = Math.max(1, ...rankedLinks.map((l) => l.clicks));

  // Country outlines are projected on the server; the client map only colors
  // them. The ranked list below is fully static (no interactivity needed).
  const countryPaths = getCountryPaths();
  const locationTotal = locations.reduce((sum, l) => sum + l.views, 0);
  const topLocations = locations
    .slice()
    .sort((a, b) => b.views - a.views)
    .slice(0, 12);
  const locationMax = Math.max(1, ...topLocations.map((l) => l.views));

  // Trend labels come pre-formatted from the server (hour or day, per the
  // window). The two series share this one axis.
  const trendLabels = trend.map((d) => d.label);
  const granularityNote = granularity === "hour" ? "by hour" : "by day";

  // New signups over the window, shaped for the shared line chart.
  const signupTimeline: TimelinePoint[] = signups.map((s) => ({
    label: s.label,
    count: s.count,
  }));

  // Device split, shaped for the shared pie chart.
  const deviceSlices = devices.map((d, i) => ({
    label: deviceLabel(d.device),
    value: d.views,
    color: CHART_COLORS[i % CHART_COLORS.length],
  }));

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            All accounts and site-wide activity.
          </p>
        </div>
        <AdminRangePicker current={range} />
      </header>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Users" value={totals.users} delay={STAT_STAGGER * 0} />
        <StatCard
          label="Unique visitors"
          value={uniqueVisitors}
          delta={{
            current: uniqueVisitors,
            previous: prevTotals?.uniqueVisitors ?? null,
          }}
          delay={STAT_STAGGER * 1}
        />
        <StatCard
          label="Views"
          value={totals.views}
          delta={{ current: totals.views, previous: prevTotals?.views ?? null }}
          delay={STAT_STAGGER * 2}
        />
        <StatCard
          label="Clicks"
          value={totals.clicks}
          delta={{
            current: totals.clicks,
            previous: prevTotals?.clicks ?? null,
          }}
          delay={STAT_STAGGER * 3}
        />
        <StatCard
          label="Click-through rate"
          value={`${ctr.toFixed(1)}%`}
          delta={{ current: ctr, previous: prevCtr }}
          delay={STAT_STAGGER * 4}
        />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section
          className="animate-rise elev-card rounded-xl border border-border bg-card p-5 lg:col-span-2"
          style={PANEL_DELAY}
        >
          <h2 className="mb-4 text-sm font-semibold text-muted-foreground">
            Views &amp; clicks · {granularityNote}
          </h2>
          <MultiLineChart
            labels={trendLabels}
            series={[
              {
                name: "Views",
                color: CHART_COLORS[0],
                values: trend.map((d) => d.views),
              },
              {
                name: "Clicks",
                color: CHART_COLORS[1],
                values: trend.map((d) => d.clicks),
              },
            ]}
          />
        </section>
        <section
          className="animate-rise elev-card rounded-xl border border-border bg-card p-5"
          style={PANEL_DELAY}
        >
          <h2 className="mb-4 text-sm font-semibold text-muted-foreground">
            Devices
          </h2>
          <PieChart slices={deviceSlices} />
        </section>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section
          className="animate-rise elev-card rounded-xl border border-border bg-card p-5 lg:col-span-2"
          style={PANEL_DELAY}
        >
          <h2 className="mb-4 text-sm font-semibold text-muted-foreground">
            New users · {granularityNote}
          </h2>
          <ViewsLineChart data={signupTimeline} />
        </section>
        <section
          className="animate-rise elev-card rounded-xl border border-border bg-card p-5"
          style={PANEL_DELAY}
        >
          <h2 className="mb-4 text-sm font-semibold text-muted-foreground">
            Top links · by clicks
          </h2>
          {rankedLinks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No clicks yet.</p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {rankedLinks.map((l, i) => (
                <li
                  // biome-ignore lint/suspicious/noArrayIndexKey: labels can repeat across pages; rank order is stable
                  key={`${l.label}-${i}`}
                  className="flex items-center gap-3 text-sm"
                >
                  <span className="w-4 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate">{l.label}</span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {l.clicks.toLocaleString()}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(l.clicks / linkMax) * 100}%`,
                          backgroundColor: CHART_COLORS[1],
                        }}
                      />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="elev-card mt-8 rounded-xl border border-border bg-card p-5">
        <h2 className="mb-4 text-sm font-semibold text-muted-foreground">
          Where in the world
        </h2>
        {locationTotal === 0 ? (
          <p className="text-sm text-muted-foreground">No views yet.</p>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <LocationMap paths={countryPaths} locations={locations} />
            </div>
            <ul className="flex flex-col gap-2.5">
              {topLocations.map((l) => {
                const isUnknown = !l.country || l.country === "ZZ";
                const label = isUnknown ? "Unknown" : countryName(l.country);
                const flag = isUnknown ? "🌐" : countryFlag(l.country);
                const share =
                  locationTotal > 0
                    ? Math.round((l.views / locationTotal) * 100)
                    : 0;
                return (
                  <li
                    key={l.country}
                    className="flex items-center gap-3 text-sm"
                  >
                    <span className="w-5 shrink-0 text-base leading-none">
                      {flag}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate">{label}</span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">
                          {l.views.toLocaleString()} ({share}%)
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${(l.views / locationMax) * 100}%`,
                            backgroundColor: CHART_COLORS[0],
                          }}
                        />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
          Users · {users.length}
        </h2>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-border border-b bg-muted/40 text-muted-foreground text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Sign-in</th>
                <th className="px-4 py-3 font-medium">Last active</th>
                <th className="px-4 py-3 font-medium">Joined</th>
                <th className="px-4 py-3 text-right font-medium">Views</th>
                <th className="px-4 py-3 text-right font-medium">Clicks</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    No users yet.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr
                    key={u.id}
                    className="border-border border-b last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-4 py-3 font-medium">
                      {u.username ? `@${u.username}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {u.email ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {providerLabel(u.provider)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDateTime(u.lastSignInAt)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(u.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {u.views.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {u.clicks.toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
