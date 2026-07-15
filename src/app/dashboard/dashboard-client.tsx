"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BrandIcon, getPlatform } from "~/components/profile-view";
import {
  type AnalyticsSummary,
  type DeviceType,
  getAnalytics,
  TIME_RANGES,
} from "~/lib/analytics";
import type { LinkItem } from "~/lib/pages";
import { cn } from "~/lib/utils";
import {
  CHART_COLORS,
  PieChart,
  type PieSlice,
  ViewsLineChart,
} from "./charts";

/** A titled stat container. */
function Card({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-lg border border-border bg-card p-5",
        className,
      )}
    >
      <h2 className="text-sm font-medium text-muted-foreground">{title}</h2>
      {children}
    </div>
  );
}

function LinkGlyph({ link }: { link: { href: string; logo?: string } }) {
  const platform = getPlatform(link.href);
  if (link.logo) {
    // biome-ignore lint/performance/noImgElement: small inline data-URL logo
    return <img src={link.logo} alt="" className="size-4 object-contain" />;
  }
  if (platform?.icon) {
    return (
      <BrandIcon
        icon={platform.icon}
        color={platform.color}
        className="size-4"
      />
    );
  }
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="size-4 text-muted-foreground"
    >
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

const DEVICE_LABELS: Record<DeviceType, string> = {
  desktop: "Desktop",
  mobile: "Mobile",
  other: "Other",
};

type GraphTab = "views" | "devices" | "links";

export function DashboardClient({
  username,
  links,
}: {
  username: string | null;
  links: LinkItem[];
}) {
  const [rangeKey, setRangeKey] = useState("7d");
  const [graphTab, setGraphTab] = useState<GraphTab>("views");
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const range = TIME_RANGES.find((r) => r.key === rangeKey) ?? TIME_RANGES[2];

  useEffect(() => {
    let active = true;
    setLoading(true);
    getAnalytics(range.days).then((s) => {
      if (active) {
        setSummary(s);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [range.days]);

  // Merge click counts onto the page's current links so every link shows —
  // including ones with zero clicks — then append clicked links that no longer
  // exist on the page (e.g. removed since). Sorted most-clicked first.
  const linkRows = useMemo(() => {
    const groups = summary?.clickGroups ?? [];
    const usedKeys = new Set<string>();
    const rows = links.map((l) => {
      // Match by id first, then fall back to label.
      const g =
        groups.find((x) => x.linkId && x.linkId === l.id) ??
        groups.find((x) => x.label === l.label);
      if (g) usedKeys.add(g.linkId ?? `label:${g.label}`);
      return {
        key: l.id,
        label: l.label,
        href: l.href,
        logo: l.logo,
        clicks: g?.clicks ?? 0,
      };
    });
    for (const g of groups) {
      const key = g.linkId ?? `label:${g.label}`;
      if (usedKeys.has(key)) continue;
      rows.push({
        key,
        label: g.label,
        href: "",
        logo: undefined,
        clicks: g.clicks,
      });
    }
    return rows.sort((a, b) => b.clicks - a.clicks);
  }, [links, summary]);

  const maxLinkClicks = Math.max(0, ...linkRows.map((l) => l.clicks));
  const totalDeviceViews =
    summary?.devices.reduce((sum, d) => sum + d.views, 0) ?? 0;

  const deviceSlices: PieSlice[] = (summary?.devices ?? []).map((d, i) => ({
    label: DEVICE_LABELS[d.device],
    value: d.views,
    color: CHART_COLORS[i % CHART_COLORS.length],
  }));
  const linkSlices: PieSlice[] = linkRows.map((l, i) => ({
    label: l.label,
    value: l.clicks,
    color: CHART_COLORS[i % CHART_COLORS.length],
  }));

  return (
    <main className="mx-auto w-full max-w-3xl px-6 pt-10 pb-24">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {username ? (
              <>
                Analytics for{" "}
                <Link
                  href={`/${username}`}
                  className="text-foreground underline-offset-4 hover:underline"
                >
                  linkitall.net/{username}
                </Link>
              </>
            ) : (
              "Your profile analytics"
            )}
          </p>
        </div>

        {/* Time-range selector */}
        <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-card p-1">
          {TIME_RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setRangeKey(r.key)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                r.key === rangeKey
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {!username ? (
        <div className="mt-6 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
          Pick a username in{" "}
          <Link
            href="/settings"
            className="text-foreground underline-offset-4 hover:underline"
          >
            Settings
          </Link>{" "}
          so people can visit your page — then views and clicks will show up
          here.
        </div>
      ) : null}

      {summary?.unavailable ? (
        <div className="mt-6 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-foreground">
          Analytics aren't set up yet. Once the analytics database migration is
          applied, your stats will appear here.
        </div>
      ) : null}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Unique views */}
        <Card title="Unique views">
          <p className="text-4xl font-semibold tabular-nums">
            {loading ? "—" : summary?.uniqueViews.toLocaleString()}
          </p>
        </Card>

        {/* Click-through rate */}
        <Card title="Click-through rate">
          <p className="text-4xl font-semibold tabular-nums">
            {loading ? "—" : `${summary?.clickThroughRate}%`}
          </p>
          <p className="text-xs text-muted-foreground">
            {loading
              ? " "
              : `${summary?.totalClicks.toLocaleString()} total clicks`}
          </p>
        </Card>

        {/* Most-clicked links — every link, icon + count, zeros included */}
        <Card title="Most-clicked links" className="sm:col-span-2">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : linkRows.length > 0 ? (
            <ul className="mt-1 flex flex-col gap-3">
              {linkRows.map((link) => (
                <li key={link.key} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex min-w-0 items-center gap-2 font-medium">
                      <LinkGlyph link={link} />
                      <span className="truncate">{link.label}</span>
                    </span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {link.clicks.toLocaleString()}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-foreground"
                      style={{
                        width: `${maxLinkClicks > 0 ? (link.clicks / maxLinkClicks) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No links yet.</p>
          )}
        </Card>

        {/* Devices — always Desktop / Mobile / Other, with views + share */}
        <Card title="Devices" className="sm:col-span-2">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <ul className="mt-1 flex flex-col gap-3">
              {(summary?.devices ?? []).map((d) => (
                <li key={d.device} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium">
                      {DEVICE_LABELS[d.device]}
                    </span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {d.views.toLocaleString()} view
                      {d.views === 1 ? "" : "s"} ·{" "}
                      {totalDeviceViews > 0
                        ? Math.round((d.views / totalDeviceViews) * 100)
                        : 0}
                      %
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-foreground"
                      style={{
                        width: `${totalDeviceViews > 0 ? (d.views / totalDeviceViews) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Switchable graph: views over time (bars), devices/links (pies) */}
        <Card title="Graph" className="sm:col-span-2">
          <div className="mb-2 flex flex-wrap gap-1">
            {(
              [
                ["views", "Views"],
                ["devices", "Devices"],
                ["links", "Links"],
              ] as [GraphTab, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setGraphTab(key)}
                className={cn(
                  "rounded-md px-3 py-1 text-sm font-medium transition-colors",
                  graphTab === key
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="mt-2">
            {loading || !summary ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : graphTab === "views" ? (
              <ViewsLineChart data={summary.timeline} />
            ) : graphTab === "devices" ? (
              <PieChart slices={deviceSlices} />
            ) : (
              <PieChart slices={linkSlices} />
            )}
          </div>
        </Card>
      </div>
    </main>
  );
}
