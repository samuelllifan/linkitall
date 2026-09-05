import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Fonts for the `next/og` share cards.
 *
 * Satori (what `ImageResponse` renders with) ships one default face — Noto Sans
 * — so a card built without an explicit `fonts` option renders in a typeface
 * the app never uses anywhere else. These are the latin-subset TTFs Google
 * Fonts serves for the two families `next/font` loads for the UI (Inter,
 * JetBrains Mono), vendored under `src/fonts` because Satori cannot read the
 * woff2 files `next/font` emits.
 *
 * Read from disk rather than fetched, so rendering a card never depends on
 * fonts.gstatic.com being reachable — including during the build, where the
 * site's own card is prerendered. `next.config.ts` lists `src/fonts` in
 * `outputFileTracingIncludes`: the path below is assembled at runtime, which
 * Next's file tracer cannot follow, so without that entry the files are pruned
 * from the deployed bundle and the (dynamic) profile card loses them.
 *
 * Failure is non-fatal by design: an empty array means "no `fonts` option",
 * which leaves Satori on its default face. A card in the wrong typeface is a
 * far better outcome than a build or an unfurl that errors.
 */
export type OgFont = {
  name: string;
  data: Buffer;
  weight: 400 | 500 | 700;
  style: "normal";
};

const FILES: { file: string; name: string; weight: 400 | 500 | 700 }[] = [
  { file: "Inter-Regular.ttf", name: "Inter", weight: 400 },
  { file: "Inter-Bold.ttf", name: "Inter", weight: 700 },
  { file: "JetBrainsMono-Medium.ttf", name: "JetBrains Mono", weight: 500 },
];

let cached: Promise<OgFont[]> | null = null;

/** The card fonts, read once per server instance. `[]` if they're unreadable. */
export function ogFonts(): Promise<OgFont[]> {
  cached ??= load();
  return cached;
}

async function load(): Promise<OgFont[]> {
  try {
    return await Promise.all(
      FILES.map(async ({ file, name, weight }) => ({
        name,
        data: await readFile(join(process.cwd(), "src/fonts", file)),
        weight,
        style: "normal" as const,
      })),
    );
  } catch {
    // Don't cache the failure — a later request gets to try again.
    cached = null;
    return [];
  }
}
