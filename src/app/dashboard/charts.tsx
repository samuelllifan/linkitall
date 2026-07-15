"use client";

import type { TimelinePoint } from "~/lib/analytics";

/** Distinct, theme-neutral slice colors for the pie charts. */
export const CHART_COLORS = [
  "#3b82f6",
  "#ec4899",
  "#f59e0b",
  "#22c55e",
  "#8b5cf6",
  "#06b6d4",
  "#f43f5e",
  "#84cc16",
  "#a855f7",
  "#14b8a6",
];

/**
 * Views-over-time line chart. y-axis is the view count (a few ticks on the
 * left), x-axis is the bucket label (date or hour). Labels thin out when there
 * are many buckets so they don't collide. The line is drawn in a 0–100 SVG
 * space stretched to fill, with a non-scaling stroke so it stays crisp.
 */
export function ViewsLineChart({ data }: { data: TimelinePoint[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">No views yet.</p>;
  }
  const max = Math.max(1, ...data.map((d) => d.count));
  const ticks = [max, Math.round(max / 2), 0].filter(
    (v, i, a) => a.indexOf(v) === i,
  );
  const labelStep = Math.ceil(data.length / 12);

  // At least two points so a single-bucket range renders a flat line.
  const pts =
    data.length === 1
      ? [
          { x: 0, y: 100 - (data[0].count / max) * 100 },
          { x: 100, y: 100 - (data[0].count / max) * 100 },
        ]
      : data.map((d, i) => ({
          x: (i / (data.length - 1)) * 100,
          y: 100 - (d.count / max) * 100,
        }));

  const line = pts
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(" ");
  const area = `M ${pts[0].x.toFixed(2)} 100 ${pts
    .map((p) => `L ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(" ")} L ${pts[pts.length - 1].x.toFixed(2)} 100 Z`;

  return (
    <div className="flex gap-2">
      {/* y-axis ticks */}
      <div className="flex h-44 flex-col justify-between text-right text-[10px] tabular-nums text-muted-foreground">
        {ticks.map((t) => (
          <span key={t}>{t}</span>
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <div className="h-44 border-b border-l border-border">
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="size-full text-foreground"
            role="img"
            aria-label="Views over time"
          >
            <path d={area} fill="currentColor" opacity={0.12} />
            <path
              d={line}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        </div>
        {/* x-axis labels */}
        <div className="flex gap-[3px]">
          {data.map((d, i) => (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: buckets are positional and fixed for a range
              key={i}
              className="h-3 min-w-0 flex-1 truncate text-center text-[9px] text-muted-foreground"
            >
              {i % labelStep === 0 ? d.label : ""}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export interface PieSlice {
  label: string;
  value: number;
  color: string;
}

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/** A pie chart with a legend showing each slice's value and share. */
export function PieChart({ slices }: { slices: PieSlice[] }) {
  const positive = slices.filter((s) => s.value > 0);
  const total = positive.reduce((sum, s) => sum + s.value, 0);

  if (total <= 0) {
    return <p className="text-sm text-muted-foreground">No data yet.</p>;
  }

  const C = 100;
  const R = 90;
  let angle = -90; // start at 12 o'clock
  const arcs = positive.map((s) => {
    const frac = s.value / total;
    const start = angle;
    const end = angle + frac * 360;
    angle = end;
    const p0 = polar(C, C, R, start);
    const p1 = polar(C, C, R, end);
    const large = end - start > 180 ? 1 : 0;
    const d = `M ${C} ${C} L ${p0.x.toFixed(2)} ${p0.y.toFixed(2)} A ${R} ${R} 0 ${large} 1 ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} Z`;
    return { d, color: s.color };
  });

  return (
    <div className="flex flex-wrap items-center gap-6">
      <svg
        viewBox="0 0 200 200"
        className="size-40 shrink-0"
        role="img"
        aria-label="Distribution pie chart"
      >
        {positive.length === 1 ? (
          <circle cx={C} cy={C} r={R} fill={positive[0].color} />
        ) : (
          arcs.map((a) => <path key={a.d} d={a.d} fill={a.color} />)
        )}
      </svg>
      <ul className="flex min-w-40 flex-1 flex-col gap-2">
        {slices.map((s) => (
          <li key={s.label} className="flex items-center gap-2 text-sm">
            <span
              className="size-3 shrink-0 rounded-sm"
              style={{ backgroundColor: s.color }}
            />
            <span className="min-w-0 flex-1 truncate">{s.label}</span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {s.value} ({total > 0 ? Math.round((s.value / total) * 100) : 0}%)
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
