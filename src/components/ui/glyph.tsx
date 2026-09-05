import { cn } from "~/lib/utils";

/*
 * The app's icon vocabulary.
 *
 * Every mark here is one or more paths on the SAME 24-unit grid at the SAME
 * 1.8 stroke weight, which is what makes a settings panel's icon, the Studio's
 * section rail and the auth card's header read as one drawing hand rather than
 * three. It lives here, not in settings-client.tsx, because the moment a second
 * page wanted `at` or `lock` the alternative was a copied path string -- and a
 * copied path is a fork that silently drifts (the two Google marks this module
 * replaced differed by 0.6 units in one arc for exactly that reason).
 *
 * Adding a mark: draw it on the 24-grid, stroke-only, no fills, and keep it
 * inside a ~3..21 box so it optically matches the rest at 16px.
 */

/** A glyph: one or more paths on the shared 24-grid and stroke weight. */
export function Glyph({
  d,
  className,
}: {
  d: string | readonly string[];
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn("size-4", className)}
    >
      {(typeof d === "string" ? [d] : d).map((path) => (
        <path key={path} d={path} />
      ))}
    </svg>
  );
}

export const GLYPH = {
  at: "M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm4-4v1.5a2.5 2.5 0 0 0 5 0V12a9 9 0 1 0-3.6 7.2",
  mail: "M3 7.5A1.5 1.5 0 0 1 4.5 6h15A1.5 1.5 0 0 1 21 7.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 16.5v-9Zm0 .5 9 6 9-6",
  lock: "M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4",
  link: "M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.8 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7",
  devices:
    "M4 5h16v10H4zM9 19h6M12 15v4M15.5 9.5 13 12l2.5 2.5M8.5 9.5 11 12l-2.5 2.5",
  shieldCheck: [
    "M12 3l7 3v6c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6l7-3Z",
    "m9 12 2 2 4-4",
  ],
  trash: "M4 7h16M9 7V5h6v2m-8 0 1 13h8l1-13M10 11v6M14 11v6",
  globe:
    "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM3.5 9h17M3.5 15h17M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18Z",
  window:
    "M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6ZM3 9h18M6.5 6.5h.01",
  eyeOff:
    "m2 2 20 20M6.7 6.7A10.8 10.8 0 0 0 2.1 11.6a1 1 0 0 0 0 .7 10.8 10.8 0 0 0 15.2 5M9.9 4.2A10.8 10.8 0 0 1 21.9 11.6a1 1 0 0 1 0 .7 10.9 10.9 0 0 1-3 4M9.9 9.9a3 3 0 0 0 4.2 4.2",
  chart: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  download: "M12 3v12m0 0 4-4m-4 4-4-4M4 19h16",
  bell: "M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0",
  spark: [
    "M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3Z",
    "M18.5 15l.6 1.7 1.7.6-1.7.6-.6 1.7-.6-1.7-1.7-.6 1.7-.6.6-1.7Z",
  ],
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3 2",
  chat: "M21 11.5a8 8 0 0 1-8 8H7l-4 3V11.5a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8Z",
  tag: "M3 12.5V5a2 2 0 0 1 2-2h7.5L21 11.5 13 19.5 3 12.5ZM7.5 7.5h.01",
  // The What's New dialog's own mark — this setting controls that dialog, so
  // the two are the same glyph rather than two drawings of a megaphone.
  megaphone: ["m3 11 18-5v12L3 14v-3z", "M11.6 16.8a3 3 0 1 1-5.8-1.6"],
} as const;
