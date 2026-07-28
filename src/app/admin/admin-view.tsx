import type { TimelinePoint } from "~/lib/analytics";
import { countryFlag, countryName } from "~/lib/countries";
import { getCountryPaths } from "~/lib/world-map";
import { CHART_COLORS, PieChart, ViewsLineChart } from "../dashboard/charts";
import { LocationMap } from "./location-map";

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
  totals: { users: number; views: number; clicks: number };
  /** Site-wide view counts grouped by the visitor's device. */
  devices: { device: string; views: number }[];
  /** Site-wide view counts grouped by the visitor's country ("ZZ" = unknown). */
  locations: { country: string; views: number }[];
  daily: { date: string; views: number; clicks: number }[];
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

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-1 text-3xl font-bold tabular-nums">
        {value.toLocaleString()}
      </div>
    </div>
  );
}

export function AdminView({ overview }: { overview: AdminOverview }) {
  // `locations` defaults to [] so the page still renders if the analytics
  // backend predates the location migration.
  const { users, totals, devices, daily } = overview;
  const locations = overview.locations ?? [];

  // Country outlines are projected on the server; the client map only colors
  // them. The ranked list below is fully static (no interactivity needed).
  const countryPaths = getCountryPaths();
  const locationTotal = locations.reduce((sum, l) => sum + l.views, 0);
  const topLocations = locations
    .slice()
    .sort((a, b) => b.views - a.views)
    .slice(0, 12);
  const locationMax = Math.max(1, ...topLocations.map((l) => l.views));

  // Site-wide views over the last 30 days, shaped for the shared line chart.
  const timeline: TimelinePoint[] = daily.map((d) => {
    const date = new Date(d.date);
    const label = Number.isNaN(date.getTime())
      ? d.date
      : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    return { label, count: d.views };
  });

  // Device split, shaped for the shared pie chart.
  const deviceSlices = devices.map((d, i) => ({
    label: deviceLabel(d.device),
    value: d.views,
    color: CHART_COLORS[i % CHART_COLORS.length],
  }));

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Admin</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every account and site-wide activity. Visible only to you.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Users" value={totals.users} />
        <StatCard label="Total views" value={totals.views} />
        <StatCard label="Total clicks" value={totals.clicks} />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
          <h2 className="mb-4 text-sm font-semibold text-muted-foreground">
            Views · last 30 days
          </h2>
          <ViewsLineChart data={timeline} />
        </section>
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-4 text-sm font-semibold text-muted-foreground">
            Devices
          </h2>
          <PieChart slices={deviceSlices} />
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
