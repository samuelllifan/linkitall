import type { TimelinePoint } from "~/lib/analytics";
import { ViewsLineChart } from "../dashboard/charts";

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
  daily: { date: string; views: number; clicks: number }[];
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
  const { users, totals, daily } = overview;

  // Site-wide views over the last 30 days, shaped for the shared line chart.
  const timeline: TimelinePoint[] = daily.map((d) => {
    const date = new Date(d.date);
    const label = Number.isNaN(date.getTime())
      ? d.date
      : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    return { label, count: d.views };
  });

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

      <section className="mt-8 rounded-xl border border-border bg-card p-5">
        <h2 className="mb-4 text-sm font-semibold text-muted-foreground">
          Views · last 30 days
        </h2>
        <ViewsLineChart data={timeline} />
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
