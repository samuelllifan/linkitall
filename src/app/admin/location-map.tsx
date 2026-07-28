"use client";

import { useState } from "react";
import {
  COUNTRIES,
  countryFlag,
  countryName,
  NUMERIC_TO_ALPHA2,
} from "~/lib/countries";
import {
  type CountryPath,
  MAP_HEIGHT,
  MAP_WIDTH,
} from "~/lib/world-map-config";

/** Base map tint — matches CHART_COLORS[0] used elsewhere in the admin view. */
const ACCENT = "#3b82f6";

export interface LocationDatum {
  /** ISO alpha-2 code, or "ZZ" for unknown. */
  country: string;
  views: number;
}

/**
 * Choropleth world map: each country is shaded by its share of total views, so
 * an admin can see at a glance where visitors come from. Paths are projected on
 * the server (see ~/lib/world-map); this component only colors and labels them.
 */
export function LocationMap({
  paths,
  locations,
}: {
  paths: CountryPath[];
  locations: LocationDatum[];
}) {
  const [hovered, setHovered] = useState<{
    numeric: string;
    x: number;
    y: number;
  } | null>(null);

  // View counts keyed by the world-atlas numeric id, so map regions line up.
  const viewsByNumeric = new Map<string, number>();
  let max = 0;
  for (const loc of locations) {
    const numeric = COUNTRIES[loc.country?.toUpperCase()]?.numeric;
    if (!numeric) continue; // unknown / non-mappable — shown in the list instead
    const next = (viewsByNumeric.get(numeric) ?? 0) + loc.views;
    viewsByNumeric.set(numeric, next);
    if (next > max) max = next;
  }

  const hoveredViews = hovered ? (viewsByNumeric.get(hovered.numeric) ?? 0) : 0;
  const hoveredAlpha2 = hovered
    ? NUMERIC_TO_ALPHA2[hovered.numeric]
    : undefined;

  return (
    <div className="relative w-full">
      {/* Hover is delegated to the svg (via data-numeric on each region): the
          map is a decorative enhancement — the ranked list beside it conveys
          the same data accessibly, so no keyboard interaction is required. */}
      <svg
        viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
        className="h-auto w-full text-foreground"
        role="img"
        aria-label="World map of views by country"
        onMouseLeave={() => setHovered(null)}
        onMouseMove={(e) => {
          const target = e.target as SVGElement;
          const numeric = target.getAttribute?.("data-numeric");
          if (!numeric) {
            setHovered(null);
            return;
          }
          const rect = e.currentTarget.getBoundingClientRect();
          setHovered({
            numeric,
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
          });
        }}
      >
        <title>Views by country</title>
        {paths.map((p) => {
          const views = viewsByNumeric.get(p.numeric) ?? 0;
          // Perceptual-ish scale: sqrt so small counts stay visible.
          const t = max > 0 && views > 0 ? Math.sqrt(views / max) : 0;
          const isHovered = hovered?.numeric === p.numeric;
          return (
            <path
              key={p.numeric}
              data-numeric={p.numeric}
              d={p.d}
              fill={views > 0 ? ACCENT : "currentColor"}
              fillOpacity={views > 0 ? 0.2 + t * 0.8 : 0.07}
              stroke={isHovered ? ACCENT : "currentColor"}
              strokeOpacity={isHovered ? 1 : 0.15}
              strokeWidth={isHovered ? 1.2 : 0.4}
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
      </svg>

      {hovered && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs shadow-md"
          style={{ left: hovered.x, top: hovered.y - 8 }}
        >
          <span className="font-medium">
            {countryFlag(hoveredAlpha2)} {countryName(hoveredAlpha2)}
          </span>
          <span className="ml-2 tabular-nums text-muted-foreground">
            {hoveredViews.toLocaleString()}{" "}
            {hoveredViews === 1 ? "view" : "views"}
          </span>
        </div>
      )}

      {/* Legend */}
      <div className="mt-3 flex items-center justify-end gap-2 text-[11px] text-muted-foreground">
        <span>Fewer</span>
        <span
          className="h-2 w-24 rounded-full"
          style={{
            background: `linear-gradient(to right, ${ACCENT}33, ${ACCENT})`,
          }}
        />
        <span>More</span>
      </div>
    </div>
  );
}
