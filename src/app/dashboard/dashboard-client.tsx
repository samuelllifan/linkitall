"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DeltaBadge } from "~/components/delta-badge";
import { LocationMap } from "~/components/location-map";
import { BrandIcon, getPlatform } from "~/components/profile-view";
import { TimeRangePicker } from "~/components/time-range-picker";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import {
  type AnalyticsSummary,
  type DeviceType,
  getAnalytics,
} from "~/lib/analytics";
import { CHART_COLORS } from "~/lib/chart-colors";
import { countryFlag, countryName } from "~/lib/countries";
import type { LinkItem } from "~/lib/pages";
import { type RangeCurrent, windowFor } from "~/lib/time-range";
import { cn } from "~/lib/utils";
import type { CountryPath } from "~/lib/world-map-config";
import { MultiLineChart, PieChart, type PieSlice } from "./charts";

/** Shared accent for the map + heatmap (matches the charts). */
const ACCENT = CHART_COLORS[0];

const WEEKDAY_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAY_FULL = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/** 20 → "9pm", 0 → "12am". */
function fmtHour(h: number): string {
  return `${((h + 11) % 12) + 1}${h < 12 ? "am" : "pm"}`;
}

/* --- Small inline icons (Lucide-style) for the stat cards. ---------------- */

function Icon({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn("size-4", className)}
    >
      {children}
    </svg>
  );
}

const UsersIcon = () => (
  <Icon>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </Icon>
);
const EyeIcon = () => (
  <Icon>
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </Icon>
);
const ClickIcon = () => (
  <Icon>
    <path d="m9 9 5 12 1.8-5.2L21 14Z" />
    <path d="M7.2 2.2 8 5.1" />
    <path d="m5.1 8-2.9-.8" />
    <path d="M14 4.1 12 6" />
    <path d="m6 12-1.9 2" />
  </Icon>
);
const TrendIcon = () => (
  <Icon>
    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
    <polyline points="16 7 22 7 22 13" />
  </Icon>
);

/* --- Building blocks ------------------------------------------------------- */

/**
 * Step between the headline cards as they arrive.
 *
 * The dashboard used to be the one signed-in page that did not move at all:
 * /settings rises its cards in on a 45ms stagger and this page — built from the
 * same `elev-card` shell, one nav click away — simply existed, fully formed, on
 * first paint. Same number as settings uses, so the two read as one product.
 */
const STAT_STAGGER = 45;

/** A headline metric with an icon and a period-over-period delta. */
function StatCard({
  label,
  value,
  icon,
  accent,
  loading,
  current,
  previous,
  delay = 0,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  loading: boolean;
  current: number;
  previous: number | null;
  /** This metric's series colour — see the icon tint below. */
  accent: string;
  /** Stagger, in ms, for the card's arrival. See `.animate-rise`. */
  delay?: number;
}) {
  return (
    <div
      className="animate-rise elev-card flex flex-col gap-1 rounded-xl border border-border bg-card p-5"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-muted-foreground">
          {label}
        </span>
        {/* Tinted with this metric's own series colour, so the tile row doubles
            as the legend for the charts below it. */}
        <span style={{ color: accent }}>{icon}</span>
      </div>
      {loading ? (
        <>
          <Skeleton className="mt-1 h-9 w-20" />
          <Skeleton className="mt-1 h-3 w-24" />
        </>
      ) : (
        <>
          <span className="text-3xl font-bold tabular-nums">{value}</span>
          {previous !== null ? (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <DeltaBadge current={current} previous={previous} />
              vs previous
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">all time</span>
          )}
        </>
      )}
    </div>
  );
}

/** A titled section container used for the charts and lists. */
function Panel({
  title,
  subtitle,
  children,
  className,
  /**
   * Stagger, in ms. Defaults to landing just after the stat row above, so the
   * page arrives in two beats — the headline numbers, then everything under
   * them — rather than eight panels each announcing themselves separately.
   */
  delay = STAT_STAGGER * 4,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <section
      className={cn(
        "animate-rise elev-card flex flex-col rounded-xl border border-border bg-card p-5",
        className,
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-muted-foreground">{title}</h2>
        {subtitle ? (
          <span className="shrink-0 text-xs text-muted-foreground">
            {subtitle}
          </span>
        ) : null}
      </div>
      {children}
    </section>
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

/** weekday × hour view-intensity grid — "when your audience is active". */
function PeakHeatmap({ heat }: { heat: number[][] }) {
  const max = Math.max(1, ...heat.flat());
  return (
    <div>
      <div className="flex flex-col gap-0.5">
        {heat.map((row, wd) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed 7-weekday grid
          <div key={wd} className="flex items-center gap-1.5">
            <span className="w-7 shrink-0 text-[10px] text-muted-foreground">
              {WEEKDAY_ABBR[wd]}
            </span>
            <div className="flex flex-1 gap-0.5">
              {row.map((v, h) => (
                <div
                  // biome-ignore lint/suspicious/noArrayIndexKey: fixed 24-hour grid
                  key={h}
                  className={cn(
                    "aspect-square flex-1 rounded-[2px]",
                    v === 0 && "bg-muted/40",
                  )}
                  style={
                    v > 0
                      ? {
                          backgroundColor: ACCENT,
                          opacity: 0.2 + 0.8 * (v / max),
                        }
                      : undefined
                  }
                  title={`${WEEKDAY_ABBR[wd]} ${fmtHour(h)} — ${v} view${v === 1 ? "" : "s"}`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      {/* Hour axis */}
      <div className="mt-1 flex items-center gap-1.5">
        <span className="w-7 shrink-0" />
        <div className="flex flex-1 justify-between text-[9px] text-muted-foreground">
          <span>12a</span>
          <span>6a</span>
          <span>12p</span>
          <span>6p</span>
          <span>11p</span>
        </div>
      </div>
    </div>
  );
}

const DEVICE_LABELS: Record<DeviceType, string> = {
  desktop: "Desktop",
  mobile: "Mobile",
  other: "Other",
};

export function DashboardClient({
  username,
  links,
  countryPaths,
}: {
  username: string | null;
  links: LinkItem[];
  countryPaths: CountryPath[];
}) {
  const [current, setCurrent] = useState<RangeCurrent>({ preset: "7d" });
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore the last-used range. localStorage is client-only, so reconcile
  // after mount rather than during SSR to avoid a hydration mismatch.
  useEffect(() => {
    try {
      const raw = localStorage.getItem("dashboard:range");
      if (raw) {
        const parsed = JSON.parse(raw) as RangeCurrent;
        if (parsed && typeof parsed.preset === "string") setCurrent(parsed);
      }
    } catch {
      // Ignore malformed/blocked storage — fall back to the default range.
    }
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getAnalytics(windowFor(current)).then((s) => {
      if (active) {
        setSummary(s);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [current]);

  const onSelect = (next: RangeCurrent) => {
    setCurrent(next);
    try {
      localStorage.setItem("dashboard:range", JSON.stringify(next));
    } catch {
      // Non-critical — the range just won't persist across reloads.
    }
  };

  const hasPrev = summary?.previous != null;

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
        prevClicks: g?.prevClicks ?? 0,
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
        prevClicks: g.prevClicks,
      });
    }
    return rows.sort((a, b) => b.clicks - a.clicks);
  }, [links, summary]);

  const maxLinkClicks = Math.max(0, ...linkRows.map((l) => l.clicks));

  const deviceSlices: PieSlice[] = (summary?.devices ?? []).map((d, i) => ({
    label: DEVICE_LABELS[d.device],
    value: d.views,
    color: CHART_COLORS[i % CHART_COLORS.length],
  }));

  // Views + clicks share one x-axis (built from the same buckets server-side).
  const timelineLabels = summary?.timeline.map((t) => t.label) ?? [];
  const viewValues = summary?.timeline.map((t) => t.count) ?? [];
  const clickValues = summary?.clickTimeline.map((t) => t.count) ?? [];

  // Locations.
  const locations = summary?.locations ?? [];
  const locationTotal = locations.reduce((sum, l) => sum + l.views, 0);
  const topLocations = locations.slice(0, 8);
  const locationMax = Math.max(1, ...topLocations.map((l) => l.views));

  // Audience loyalty.
  const returning = summary?.loyalty.returningVisitors ?? 0;
  const newVisitors = summary?.loyalty.newVisitors ?? 0;
  const loyaltyTotal = returning + newVisitors;

  // Peak activity.
  const peak = summary?.peak;
  const peakHeadline =
    peak && peak.bestWeekday !== null && peak.bestHour !== null
      ? `Most active on ${WEEKDAY_FULL[peak.bestWeekday]}s around ${fmtHour(peak.bestHour)}`
      : "Not enough data yet";

  // Match the chart's actual bucketing (hourly for windows ≤ 48h), not the
  // preset name — a short custom range renders hourly too.
  const granWin = windowFor(current);
  const granStart = granWin.start ? Date.parse(granWin.start) : null;
  const granEnd = granWin.end ? Date.parse(granWin.end) : Date.now();
  const granularityNote =
    granStart !== null && granEnd - granStart <= 48 * 3_600_000
      ? "by hour"
      : "by day";

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 pt-10 pb-24">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {username ? (
              <>
                Analytics for{" "}
                <Link
                  href={`/${username}`}
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                >
                  stacked.page/{username}
                </Link>
              </>
            ) : (
              "Your profile analytics"
            )}
          </p>
        </div>

        <TimeRangePicker current={current} onSelect={onSelect} />
      </div>

      {!username ? (
        <div className="mt-6 rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
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
        <div className="mt-6 rounded-xl border border-warning/35 bg-warning/10 p-4 text-sm text-warning">
          Analytics aren't set up yet. Once the analytics database migration is
          applied, your stats will appear here.
        </div>
      ) : null}

      {/* Headline metrics */}
      <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          delay={STAT_STAGGER * 0}
          label="Unique views"
          value={(summary?.uniqueViews ?? 0).toLocaleString()}
          icon={<UsersIcon />}
          accent={CHART_COLORS[0]}
          loading={loading}
          current={summary?.uniqueViews ?? 0}
          previous={hasPrev ? (summary?.previous?.uniqueViews ?? 0) : null}
        />
        <StatCard
          delay={STAT_STAGGER * 1}
          label="Total views"
          value={(summary?.totalViews ?? 0).toLocaleString()}
          icon={<EyeIcon />}
          accent={CHART_COLORS[0]}
          loading={loading}
          current={summary?.totalViews ?? 0}
          previous={hasPrev ? (summary?.previous?.totalViews ?? 0) : null}
        />
        <StatCard
          delay={STAT_STAGGER * 2}
          label="Total clicks"
          value={(summary?.totalClicks ?? 0).toLocaleString()}
          icon={<ClickIcon />}
          accent={CHART_COLORS[1]}
          loading={loading}
          current={summary?.totalClicks ?? 0}
          previous={hasPrev ? (summary?.previous?.totalClicks ?? 0) : null}
        />
        <StatCard
          delay={STAT_STAGGER * 3}
          label="Click-through rate"
          value={`${summary?.clickThroughRate ?? 0}%`}
          icon={<TrendIcon />}
          accent={CHART_COLORS[1]}
          loading={loading}
          current={summary?.clickThroughRate ?? 0}
          previous={hasPrev ? (summary?.previous?.clickThroughRate ?? 0) : null}
        />
      </div>

      {/* Views vs. clicks over time — the hero chart */}
      <Panel title="Views & clicks" subtitle={granularityNote} className="mt-8">
        {loading ? (
          <Skeleton className="h-52 w-full" />
        ) : (
          <MultiLineChart
            labels={timelineLabels}
            series={[
              { name: "Views", color: CHART_COLORS[0], values: viewValues },
              { name: "Clicks", color: CHART_COLORS[1], values: clickValues },
            ]}
          />
        )}
      </Panel>

      <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Most-clicked links — every link, icon + count + momentum */}
        <Panel
          title="Most-clicked links"
          subtitle="by clicks"
          className="lg:col-span-2"
        >
          {loading ? (
            <div className="flex flex-col gap-3">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-8" />
                  </div>
                  <Skeleton className="h-2 w-full" />
                </div>
              ))}
            </div>
          ) : linkRows.length > 0 ? (
            <ul className="flex flex-col gap-3">
              {linkRows.map((link) => (
                <li key={link.key} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex min-w-0 items-center gap-2 font-medium">
                      <LinkGlyph link={link} />
                      <span className="truncate">{link.label}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <DeltaBadge
                        current={link.clicks}
                        previous={
                          hasPrev && (link.clicks > 0 || link.prevClicks > 0)
                            ? link.prevClicks
                            : null
                        }
                      />
                      <span className="tabular-nums text-muted-foreground">
                        {link.clicks.toLocaleString()}
                      </span>
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-foreground transition-[width] duration-500"
                      style={{
                        width: `${maxLinkClicks > 0 ? (link.clicks / maxLinkClicks) * 100 : 0}%`,
                        // The row's own platform colour, held slightly back so a
                        // long bar doesn't out-shout the numbers beside it. The
                        // monochrome brands (x, tiktok, github) and unrecognized
                        // URLs keep the neutral bar, which is the honest answer.
                        backgroundColor:
                          getPlatform(link.href)?.color ?? undefined,
                        opacity: getPlatform(link.href)?.color ? 0.85 : 1,
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-col items-start gap-3">
              <p className="text-muted-foreground text-sm">
                No links yet — add some and their clicks will show up here.
              </p>
              <Button asChild variant="outline" size="sm">
                <Link href="/edit">Add your links</Link>
              </Button>
            </div>
          )}
        </Panel>

        {/* Device split */}
        <Panel title="Devices" subtitle="by views">
          {loading ? (
            <div className="flex items-center gap-6">
              <Skeleton className="size-32 rounded-full" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            </div>
          ) : (
            <PieChart slices={deviceSlices} />
          )}
        </Panel>
      </div>

      {/* Where in the world — map + ranked list */}
      <Panel title="Where in the world" subtitle="by views" className="mt-8">
        {loading ? (
          <Skeleton className="h-48 w-full" />
        ) : locationTotal === 0 ? (
          <p className="text-sm text-muted-foreground">No views yet.</p>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <LocationMap paths={countryPaths} locations={locations} />
            </div>
            <ul className="flex flex-col gap-2.5">
              {topLocations.map((l) => {
                const unknown = !l.country || l.country === "ZZ";
                const label = unknown ? "Unknown" : countryName(l.country);
                const flag = unknown ? "🌐" : countryFlag(l.country);
                const share = Math.round((l.views / locationTotal) * 100);
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
                            backgroundColor: ACCENT,
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
      </Panel>

      <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Peak activity heatmap */}
        <Panel
          title="When your audience is active"
          subtitle="your time"
          className="lg:col-span-2"
        >
          {loading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <>
              <p className="mb-3 text-sm">{peakHeadline}</p>
              {peak ? <PeakHeatmap heat={peak.heat} /> : null}
            </>
          )}
        </Panel>

        {/* New vs returning visitors */}
        <Panel title="Visitors" subtitle="new vs returning">
          {loading ? (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
            </div>
          ) : loyaltyTotal === 0 ? (
            <p className="text-sm text-muted-foreground">No visitors yet.</p>
          ) : (
            <div className="flex flex-col gap-4">
              <div>
                <span className="text-3xl font-bold tabular-nums">
                  {Math.round((returning / loyaltyTotal) * 100)}%
                </span>
                <span className="ml-2 text-sm text-muted-foreground">
                  returning
                </span>
              </div>
              <ul className="flex flex-col gap-3 text-sm">
                {[
                  { label: "Returning", value: returning, color: ACCENT },
                  {
                    label: "New",
                    value: newVisitors,
                    color: CHART_COLORS[1],
                  },
                ].map((row) => (
                  <li key={row.label} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{row.label}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {row.value.toLocaleString()} (
                        {Math.round((row.value / loyaltyTotal) * 100)}%)
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(row.value / loyaltyTotal) * 100}%`,
                          backgroundColor: row.color,
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Panel>
      </div>
    </main>
  );
}
