import type { TimelinePoint } from "~/lib/analytics";
import { CHART_COLORS } from "~/lib/chart-colors";
import { countryFlag, countryName } from "~/lib/countries";
import { getCountryPaths } from "~/lib/world-map";
import { MultiLineChart, PieChart, ViewsLineChart } from "../dashboard/charts";
import { LocationMap } from "./location-map";
import { TimeFramePicker } from "./time-frame-picker";
import { type RangeCurrent, rangeLabel } from "./time-range";

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

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  /** Preformatted (e.g. "3.2%") or numeric — numbers get thousands grouping. */
  value: number | string;
  /** Optional secondary line, e.g. recent-window activity. */
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-1 text-3xl font-bold tabular-nums">
        {typeof value === "number" ? value.toLocaleString() : value}
      </div>
      {hint ? (
        <div className="mt-1 text-xs text-muted-foreground tabular-nums">
          {hint}
        </div>
      ) : null}
    </div>
  );
}

export function AdminView({
  overview,
  range,
}: {
  overview: AdminOverview;
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

  const rangeText = rangeLabel(range);

  // Device split, shaped for the shared pie chart.
  const deviceSlices = devices.map((d, i) => ({
    label: deviceLabel(d.device),
    value: d.views,
    color: CHART_COLORS[i % CHART_COLORS.length],
  }));

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every account and site-wide activity. Visible only to you.
          </p>
        </div>
        <TimeFramePicker current={range} />
      </header>

      <div className="mb-4 text-sm text-muted-foreground">
        Showing <span className="text-foreground">{rangeText}</span>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Users" value={totals.users} />
        <StatCard label="Unique visitors" value={uniqueVisitors} />
        <StatCard label="Views" value={totals.views} />
        <StatCard label="Clicks" value={totals.clicks} />
        <StatCard label="Click-through rate" value={`${ctr.toFixed(1)}%`} />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
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
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-4 text-sm font-semibold text-muted-foreground">
            Devices
          </h2>
          <PieChart slices={deviceSlices} />
        </section>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
          <h2 className="mb-4 text-sm font-semibold text-muted-foreground">
            New users · {granularityNote}
          </h2>
          <ViewsLineChart data={signupTimeline} />
        </section>
        <section className="rounded-xl border border-border bg-card p-5">
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
                        className="h-full rounded-full bg-[#ec4899]"
                        style={{ width: `${(l.clicks / linkMax) * 100}%` }}
                      />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="mt-8 rounded-xl border border-border bg-card p-5">
        <h2 className="mb-4 text-sm font-semibold text-muted-foreground">
          Where in the world · {locationTotal.toLocaleString()} views
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
                          className="h-full rounded-full bg-[#3b82f6]"
                          style={{ width: `${(l.views / locationMax) * 100}%` }}
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
            <thead className="border-border border-b bg-muted/40 text-xs text-muted-foreground uppercase">
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
