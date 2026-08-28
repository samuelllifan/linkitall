"use client";

import { BrowserPreview } from "~/components/browser-preview";
import type { PageData } from "~/lib/pages";

// A diagonal wall of REAL stacked pages (rendered by <ProfileView>) shown as
// DESKTOP mockups that scroll horizontally, alternating direction row to row and
// running off both edges so it reads as one continuous, endless band. Each card
// renders the page at a large intrinsic resolution then scales down, so the
// content is true-to-size (not zoomed).

const GAP = 24; // space between cards (applied as margin, not flex gap)
const ROW_GAP = 24; // space between rows
// Display size + intrinsic render size. Rendering at real desktop resolution
// then scaling keeps the page content true-to-size and lets the background fill.
//
// Bigger cards are CHEAPER, not dearer: the band has to cover a fixed area, so
// the number of previews needed scales as area / card area. Going from 384x240 to
// 480x300 is what lets 4 rows do what 6 rows did, and it stops the band
// overshooting the viewport by a whole row at the top and bottom.
const CARD = { w: 480, h: 300, iw: 1160, ih: 725 };
const SCALE = CARD.w / CARD.iw;
// Cards per set. Each set is duplicated and the row translates by exactly one
// set width; see SEAMLESSNESS below for what sets the floor.
const PER_ROW = 6;

/**
 * How far the wall is nudged DOWN from the hero's centre, in screen px.
 *
 * The band is inclined -11deg (counter-clockwise: its right end rises, its left
 * end drops), so a centred band leaves two mirror-image wedges uncovered -- one
 * at the top-left, one at the bottom-right. Only the bottom-right one is
 * visible, because the hero stacks its copy column and an opaque left scrim over
 * the top-left twin. Shifting down trades the invisible wedge for the visible
 * one: it shrinks the bottom-right deficit by cos(11deg) * SHIFT and grows the
 * top-left one by the same amount, where the scrims swallow it.
 *
 * Kept small on purpose. The band is thicker than a short viewport strictly
 * needs, and whatever it overshoots by has to go somewhere; a large shift dumps
 * nearly all of that below the fold, so the last row renders 12 previews that
 * are never seen. Measured row fill at 1280x800 (fraction of each row actually
 * on screen):
 *
 *     shift   0 -> .21 .93 .86 .26   all four corners covered, but too short for 1920
 *     shift  88 -> .39 .99 .72 .12   all four covered, 1920 bottom-right covered
 *     shift 200 -> .67 .98 .46 .02   last row wasted, and top-left uncovered
 *
 * 88 is the balance point: nothing is wasted, a 1280-wide window is covered at
 * every corner, and a 1920-wide one still clears its bottom-right by ~37px.
 *
 * Must stay in px (not % -- that resolves against the wall's own height, which
 * changes with the row count -- and not vh, since the requirement isn't
 * proportional to viewport height).
 */
const SHIFT_Y = 88;

// Rows, each with its own cycle time. Longer = slower. Every row moves at a
// different speed and neighbours run in opposite directions, so the band never
// reads as one rigid sheet sliding past.
//
// A row's speed is (one set width) / duration. At CARD.w 480 and GAP 24 a set is
// 6 * 504 = 3024px, so these land between 26 and 30 px/s. The durations are
// scaled off the set width deliberately: cards got 25% wider, so the cycle times
// grew with them and the on-screen pace is unchanged.
const ROWS: { duration: number; reverse?: boolean }[] = [
  { duration: 101 },
  { duration: 121, reverse: true },
  { duration: 109 },
  { duration: 115, reverse: true },
];

/**
 * SEAMLESSNESS -- why the marquee is symmetric and why PER_ROW can't shrink.
 *
 * Each row renders its set twice (strip = 2S) and `wall-marquee` slides it from
 * +25% to -25%, i.e. from +S/2 to -S/2. Total travel is exactly one set width,
 * so the two endpoints render identically and the loop never jumps.
 *
 * Sliding symmetrically (rather than 0 -> -S) is what stops the row draining.
 * The strip is centred on the hero, so the region covered for the WHOLE cycle is
 * only the overlap of every translated position: with a 0 -> -S sweep that's
 * just the strip's left half, and the right side of the hero empties out near
 * the end of each cycle before snapping back. Sliding +S/2 -> -S/2 centres that
 * guaranteed region instead, making it [-S/2, +S/2].
 *
 * So the row is gap-free for the whole cycle as long as S/2 covers half the
 * hero's width measured along the tilted band:
 *
 *   S / 2  >=  (Vw * cos(11deg) + Vh * sin(11deg)) / 2
 *
 * At CARD.w 480 / GAP 24 / PER_ROW 6, S/2 = 1512px, which covers a 2560px-wide
 * display (which needs 1427px) with room to spare. The wider cards bought that
 * headroom for free.
 */

function Card({ data }: { data: PageData }) {
  return (
    <div
      className="relative shrink-0"
      // marginRight (not a flex gap) so the two tiled sets are spaced identically
      // -- the trailing gap after the last card of set 1 leads into set 2 exactly,
      // making the -25%/+25% translation line up pixel-perfect (no hard reset).
      // A flex `gap` would give 12W + 11G and be off by G/2.
      style={{ width: CARD.w, height: CARD.h, marginRight: GAP }}
    >
      <BrowserPreview
        data={data}
        className="absolute top-1/2 left-1/2"
        style={{
          width: CARD.iw,
          height: CARD.ih,
          marginLeft: -CARD.iw / 2,
          marginTop: -CARD.ih / 2,
          transform: `scale(${SCALE})`,
        }}
      />
    </div>
  );
}

// One marquee row: the pages are rendered twice so the symmetric slide loops
// seamlessly. `reverse` flips the scroll direction.
function Row({
  pages,
  reverse,
  duration,
}: {
  pages: PageData[];
  reverse?: boolean;
  duration: number;
}) {
  return (
    <div
      className="flex w-max"
      style={{
        animation: `wall-marquee ${duration}s linear infinite`,
        animationDirection: reverse ? "reverse" : "normal",
      }}
    >
      {[...pages, ...pages].map((p, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static, order-stable list
        <Card key={i} data={p} />
      ))}
    </div>
  );
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/**
 * Pick, for each row, a starting index and a step through the pool.
 *
 * A step coprime with the pool size walks the entire pool before repeating, so
 * every row shows PER_ROW *distinct* pages (as long as the pool is that big).
 * Starting indices are then chosen so no two rows ever put the same page in the
 * same column, which is what stops the wall reading as a tiled pattern.
 *
 * Steps may repeat between rows: two rows sharing a step but starting at
 * different indices are offset by a constant, so they can never collide.
 *
 * Pure and deterministic (no RNG, no clock), so the server and the client agree.
 */
function layout(n: number, rows: number, perRow: number) {
  const coprime: number[] = [];
  for (let s = 1; s < n; s++) {
    if (gcd(s, n) === 1) coprime.push(s);
  }
  if (coprime.length === 0) coprime.push(1);
  // There are usually fewer coprime steps than rows (a pool of 12 has only
  // 1, 5, 7, 11), so cycle through them; rows that share a step are pulled apart
  // by their starting index instead.
  const steps = Array.from(
    { length: rows },
    (_, r) => coprime[r % coprime.length],
  );

  // Greedy, but scored rather than first-fit: take the start with the FEWEST
  // same-column clashes against the rows already placed. For a pool comfortably
  // larger than `perRow` the best score is always 0; when the pool is too small
  // for a perfect answer this degrades to the least-bad arrangement instead of
  // falling back to an arbitrary one.
  const starts: number[] = [];
  for (let r = 0; r < rows; r++) {
    let chosen = r % n;
    let fewest = Number.POSITIVE_INFINITY;
    for (let a = 0; a < n; a++) {
      let clashes = 0;
      for (let j = 0; j < r; j++) {
        for (let k = 0; k < perRow; k++) {
          if ((a + steps[r] * k) % n === (starts[j] + steps[j] * k) % n) {
            clashes++;
          }
        }
      }
      if (clashes < fewest) {
        fewest = clashes;
        chosen = a;
        if (clashes === 0) break;
      }
    }
    starts.push(chosen);
  }
  return { steps, starts };
}

export function PagesWall({
  profiles,
  seed = 0,
}: {
  profiles: PageData[];
  /** Rotates every row by the same amount, so the wall isn't frozen on one
   *  arrangement forever. Adding a constant to every start leaves the gaps
   *  between them untouched, so the no-two-rows-collide guarantee survives. */
  seed?: number;
}) {
  const n = profiles.length;
  const { steps, starts } = layout(n, ROWS.length, PER_ROW);

  const row = (r: number) =>
    Array.from(
      { length: PER_ROW },
      (_, k) => profiles[(starts[r] + seed + steps[r] * k) % n],
    );

  return (
    // Tilted so the band ascends to the right, wide enough to run off both edges,
    // and nudged down so it doesn't leave a bare wedge at the bottom-right.
    <div
      aria-hidden
      className="pointer-events-none absolute top-1/2 left-1/2 w-max origin-center"
      style={{
        transform: `translate(-50%, calc(-50% + ${SHIFT_Y}px)) rotate(-11deg)`,
      }}
    >
      <div className="flex flex-col" style={{ gap: ROW_GAP }}>
        {ROWS.map((r, i) => (
          <Row
            // biome-ignore lint/suspicious/noArrayIndexKey: static, order-stable list
            key={i}
            pages={row(i)}
            duration={r.duration}
            reverse={r.reverse}
          />
        ))}
      </div>
    </div>
  );
}
