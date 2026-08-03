/**
 * Distinct, theme-neutral slice colors for the pie charts.
 *
 * Kept in a plain (non-"use client") module so it can be imported by both
 * Server Components (e.g. the admin view) and Client Components. Importing a
 * non-component value from a "use client" module hands the server a client
 * reference proxy instead of the real array, which is why the admin pie chart
 * rendered black — see the admin/dashboard chart usages.
 */
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
