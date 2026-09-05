"use client";

import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";
import { ProfileView } from "~/components/profile-view";
import { Reveal } from "~/components/reveal";
import { CHART_COLORS } from "~/lib/chart-colors";
import type { PageData } from "~/lib/pages";
import {
  SHOWCASE_BACKGROUNDS,
  SHOWCASE_STEPS,
  SHOWCASE_VARIANTS,
} from "~/lib/showcase-page";
import { cn } from "~/lib/utils";

// Landing section two: the product demo.
//
// A live page preview on one side; three steps on the other. The active step
// drives what the preview does -- restyling itself, raising the share sheet, or
// putting the numbers in front of it -- so the visitor watches the product work
// instead of reading a feature list. Each step shows a DIFFERENT example page,
// so the section demonstrates three real pages rather than one.
//
// The steps run in the order a real user lives them: build the page, share the
// link, then watch what comes back. Analytics last is deliberate; it's the
// payoff, and it's the better screen to end the section on.
//
// It auto-advances so a visitor who does nothing still sees all three, and stops
// advancing for good the moment they pick a step themselves -- an auto-rotation
// that keeps yanking the panel out from under someone who is reading it is worse
// than no rotation at all.

// Both frames render at their NATURAL size -- no transform: scale() anywhere.
// An earlier version rendered a 380px phone and a 1240px desktop viewport and
// scaled them down to fit, which cost more than it bought: at 0.5 the desktop's
// 14px body text became 7px and its 1px border became half a pixel. ProfileView
// is already responsive (its panel is `w-full max-w-lg`), so a frame just needs
// to BE the size it wants to look like, and the page lays itself out to fit at
// real type sizes and crisp borders.
//
// `col` is each mode's column width. It has to differ: the desktop frame is
// nearly twice the phone's width, and one column sized for both leaves whichever
// device isn't showing floating in the middle of an empty half-row.
//
// Every horizontal size here is a MAX-width over `w-full`, never a fixed width.
// That is what makes the section impossible to overflow: the frame and its card
// are bounded by their own column, so when the layout squeezes the column (see
// the copy column's min-width) they shrink with it instead of running out past
// the section's padding and being clipped. Heights stay fixed -- they are
// derived from the profile block, which doesn't change.
const FRAMES = {
  phone: {
    // 39rem = 624 >= 538 (the profile block) + 72 (the frame's py-9).
    frame:
      "h-[39rem] max-w-[18.5rem] sm:h-[40.5rem] sm:max-w-[20rem] lg:h-[42.5rem] lg:max-w-[21.25rem]",
    col: "lg:w-[25rem]",
    card: "max-w-[16.5rem] sm:max-w-[18.5rem] lg:max-w-[19rem]",
  },
  desktop: {
    // 38rem = 608 >= 538 + 32 (the frame's py-4).
    frame: "h-[38rem] max-w-[20rem] sm:max-w-[34rem] lg:max-w-[50rem]",
    col: "lg:w-[52rem]",
    card: "max-w-[18rem] sm:max-w-[24rem] lg:max-w-[30rem]",
  },
} as const;

type Mode = keyof typeof FRAMES;

/** How long each look holds on the customise step. */
const STYLE_MS = 2000;
/**
 * How long each step holds before the section moves itself along.
 *
 * Pinned to an exact whole number of looks (3 x STYLE_MS). At 2200ms a look and
 * 6000ms a step the customise step got through two and a half backgrounds before
 * the section moved on, so the third was usually never seen and the cycle read
 * as broken. Keep these two in step if either changes.
 */
const STEP_MS = SHOWCASE_BACKGROUNDS.length * STYLE_MS;

// The house "soft settle" curve, read from the token rather than written out
// again: --ease-settle in globals.css is the single definition, shared with the
// scroll reveals, the music card and the click-to-enter splash. Decelerates hard
// at the end without overshooting, which is what makes a card read as placed
// rather than merely moved.
const SETTLE = "var(--ease-settle)";

// Every part of the device switch -- the column, the frame and the card -- moves
// on exactly this, so the three read as one object changing shape rather than
// three things racing. Deliberately short: resizing the frame relayouts the
// mounted pages on every frame, so the longer it runs the more chances there are
// for a dropped frame to show. 300ms is under the threshold where a stutter
// registers as one.
const SWITCH = "duration-300 ease-out";

// Illustrative, and deliberately modest. Real numbers would mean putting some
// user's traffic on the marketing page; inflated ones would set an expectation
// the product can't keep.
const VIEW_SERIES = [9, 12, 10, 16, 14, 21, 18, 25, 22, 30, 27, 35, 33, 41];
const CLICK_SERIES = [2, 4, 3, 6, 5, 8, 7, 10, 8, 12, 11, 15, 13, 17];
const TOTAL_VIEWS = 1284;
const TOTAL_CLICKS = 312;

// The demo's lead accent IS the app's first chart series, read from the one list
// rather than re-typed: the visitor meets this exact colour again on their own
// dashboard, and it had already been written out by hand in both places, so the
// two could drift apart with nothing to catch it. Since the palette was re-led
// by the brand purple, CHART_COLORS[0] is #a78bfa — so the demo's lead accent
// and the brand are now the same colour by construction.
//
// The SECOND series deliberately does NOT follow CHART_COLORS[1] (#22d3ee).
// The real dashboard keeps a multi-hue palette because ten categorical series
// have to be told apart, and that reasoning does not reach down here: this chart
// has exactly two lines, and two lines separate perfectly well on lightness
// (#d8b4fe against #a78bfa is 11.2:1 vs 7.3:1 on the page). Following the array
// blindly would have put the only non-purple pixel on the whole landing page in
// the middle of the shopfront, to distinguish two things that were never
// confusable. Keep this a step of the brand ramp.
const ACCENT = CHART_COLORS[0];
const ACCENT_2 = "#d8b4fe"; // --brand-lilac

function SlidersIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
    >
      <line x1="4" y1="6" x2="20" y2="6" />
      <circle cx="9" cy="6" r="2" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <circle cx="15" cy="12" r="2" />
      <line x1="4" y1="18" x2="20" y2="18" />
      <circle cx="8" cy="18" r="2" />
    </svg>
  );
}

function LinkIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M10.5 13.5a5 5 0 0 0 7.07 0l2-2a5 5 0 0 0-7.07-7.07l-1.2 1.2" />
      <path d="M13.5 10.5a5 5 0 0 0-7.07 0l-2 2a5 5 0 0 0 7.07 7.07l1.2-1.2" />
    </svg>
  );
}

function ChartIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M4 19h16" />
      <polyline points="5 15 10 10 14 13 20 6" />
    </svg>
  );
}

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
      <path d="M10.5 5.5h3" />
    </svg>
  );
}

function DesktopIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="2.5" y="4" width="19" height="12.5" rx="2" />
      <path d="M9 20h6M12 16.5V20" />
    </svg>
  );
}

const STEPS = [
  {
    key: "customize",
    title: "Make it yours",
    body: "Backgrounds, fonts, colors, layout. Change something and it changes as you watch.",
    Icon: SlidersIcon,
  },
  {
    key: "share",
    title: "Share one link",
    body: "Every platform behind a single link. Copy it, or let people scan the code.",
    Icon: LinkIcon,
  },
  {
    key: "track",
    title: "See what works",
    body: "Views, clicks, and which links people actually press.",
    Icon: ChartIcon,
  },
] as const;

export function HowItWorks() {
  const sectionRef = useRef<HTMLElement>(null);
  const [step, setStep] = useState(0);
  const [cycle, setCycle] = useState(0);
  const [mode, setMode] = useState<Mode>("phone");
  // Auto-advance stops permanently once the visitor picks a step, and pauses
  // while the pointer or keyboard focus is on the step list so it can't move
  // mid-sentence. Switching device is not "picking a step", so it deliberately
  // does not stop the rotation.
  const [picked, setPicked] = useState(false);
  const [hovering, setHovering] = useState(false);
  // `active` gates the timers (an off-screen section shouldn't tick); `seen`
  // latches on first sight and gates MOUNTING the previews, so the aurora page's
  // WebGL context is never created for a visitor who doesn't scroll this far.
  const [active, setActive] = useState(false);
  const [seen, setSeen] = useState(false);
  const [qr, setQr] = useState<string | null>(null);

  const running = active && !picked && !hovering;

  // Each step owns a profile; the customise step's profile owns three
  // backgrounds and cycles them. `?? [0]` so adding a step without adding a
  // profile falls back rather than crashing.
  const stepDef = SHOWCASE_STEPS[step] ?? SHOWCASE_STEPS[0];
  const variant = stepDef.variants[cycle % stepDef.variants.length];

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        setActive(entry.isIntersecting);
        if (entry.isIntersecting) setSeen(true);
      },
      { threshold: 0.3 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Step auto-advance. A timeout per step rather than one interval, so a pause
  // can't leave a half-spent interval running underneath it.
  //
  // `step` is load-bearing in the deps even though the updater never reads it:
  // the effect re-running is what schedules the NEXT step. Drop it and the
  // section advances exactly once and then sits there.
  // biome-ignore lint/correctness/useExhaustiveDependencies: see above
  useEffect(() => {
    if (!running) return;
    const t = setTimeout(() => setStep((s) => (s + 1) % STEPS.length), STEP_MS);
    return () => clearTimeout(t);
  }, [running, step]);

  // Resuming after a pause schedules a WHOLE new STEP_MS above -- a setTimeout
  // has no memory of how much of the last one it already served. The progress
  // bar underneath does have a memory: it is a CSS animation that was merely
  // `paused`, so left alone it would carry on from wherever it stopped, finish
  // early, and then sit pinned at 100% waiting for a timer that is only halfway
  // through. Hovering the step list is enough to cause it, and the step list is
  // exactly what a visitor puts their pointer on.
  //
  // So the timer stays authoritative and the bar is restarted to match: this
  // counter bumps on every resume and is part of the bar's `key`, which remounts
  // it from zero on the same commit that schedules the fresh timeout. The other
  // direction -- making the bar authoritative via onAnimationEnd -- was rejected
  // because it would advance the step within a few hundred ms of the pointer
  // leaving, which is the reading-interrupted behaviour the note at the top of
  // this file calls worse than no rotation at all.
  const [runId, setRunId] = useState(0);
  useEffect(() => {
    if (running) setRunId((r) => r + 1);
  }, [running]);

  // The customise step's whole point is the page changing, so it keeps cycling
  // whether the visitor got here on their own or not -- `picked` only stops the
  // step rotation, not this.
  //
  // The cycle RESTARTS at the first page each time the step is entered. Letting
  // it resume mid-sequence meant arriving on the customise step could show one
  // page and then jump straight to the step change, so the same page appeared
  // twice in a row and the run never looked like a complete loop.
  useEffect(() => {
    const variants = SHOWCASE_STEPS[step]?.variants.length ?? 1;
    if (!active || variants <= 1) return;
    setCycle(0);
    const t = setInterval(() => setCycle((c) => c + 1), STYLE_MS);
    return () => clearInterval(t);
  }, [active, step]);

  useEffect(() => {
    if (!seen) return;
    let alive = true;
    QRCode.toDataURL(`https://stacked.page/${stepDef.username}`, {
      width: 480,
      margin: 1,
      errorCorrectionLevel: "M",
    })
      .then((url) => {
        if (alive) setQr(url);
      })
      .catch(() => {
        if (alive) setQr(null);
      });
    return () => {
      alive = false;
    };
  }, [seen, stepDef.username]);

  return (
    <section
      ref={sectionRef}
      aria-labelledby="how-it-works-heading"
      // Solid black, and DARKER than the page it sits in: --background is
      // oklch(0.145), which is rgb(10, 10, 10), not black. That difference is the
      // whole transition. The hero above ends by fading its wall of pages down to
      // this same true black, so the two sections meet with nothing between them
      // -- no border (there used to be one, and a 1px line is the one thing a
      // gradient on either side cannot hide) and no step in value.
      //
      // Flat black all the way down, with no ramp at the bottom edge: the
      // closing CTA below is black too, and it now owns the ramp back up to
      // --background for the footer. Whichever section is LAST has to be the one
      // that ramps; a ramp here would put a ten-level step in the middle of an
      // otherwise continuous black field.
      className="relative overflow-hidden bg-black py-20 sm:py-28"
    >
      <div className="relative mx-auto w-full max-w-[100rem] px-6 sm:px-10 lg:px-16">
        {/* Two columns, sized so neither leaves a void: the demo column is cut
            to the active device and the copy column takes the rest.

            `contents` on the copy wrapper is what lets the two layouts differ
            in ORDER rather than only in geometry: on narrow screens the wrapper
            drops out of the box tree, its heading and step list become flex
            items of this container in their own right, and the demo can be
            ordered BETWEEN them -- so a step is never separated from the thing
            it drives. At lg the wrapper is a normal block holding column one. */}
        <div className="flex flex-col gap-10 lg:flex-row lg:items-center lg:gap-12">
          {/* flex-1, so switching device visibly pushes this column aside: the
              demo column's width is what animates, and this one re-flows to
              fill whatever is left on every frame of it.

              The min-width is a floor, and it is what keeps the section inside
              its own box. Between lg and xl the desktop column wants more room
              than the container has; without a floor this column was handed the
              16px that were left over and its heading spilled out of the
              section. With one, the demo column gives way instead -- it is the
              side that can shrink gracefully, because every width in it is a
              max-width. */}
          <div className="contents lg:block lg:min-w-[21rem] lg:flex-1">
            {/* `as="h2"` rather than a wrapping div: the parent is
                `display: contents` on mobile, so this element IS the flex item
                and `order-1` has to stay on it. */}
            <Reveal
              as="h2"
              id="how-it-works-heading"
              className="order-1 text-balance font-bold text-3xl leading-tight tracking-tight sm:text-4xl md:text-5xl"
            >
              How it works
            </Reveal>

            <ol
              className="order-3 flex flex-col gap-2 lg:mt-10"
              onMouseEnter={() => setHovering(true)}
              onMouseLeave={() => setHovering(false)}
              onFocusCapture={() => setHovering(true)}
              onBlurCapture={() => setHovering(false)}
            >
              {STEPS.map((s, i) => {
                const isActive = i === step;
                return (
                  // The reveal goes on the <li>, not the <button> underneath:
                  // `.reveal` sets transition-property to opacity+transform,
                  // which would knock out the button's own colour transitions.
                  <Reveal as="li" key={s.key} delay={i * 70}>
                    <button
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => {
                        setStep(i);
                        setPicked(true);
                      }}
                      className={cn(
                        // The focus ring is a box-shadow and so is NOT clipped
                        // by this element's own `overflow-hidden` (that only
                        // clips children), which is what lets a bordered,
                        // clipping card still show one.
                        "relative w-full overflow-hidden rounded-xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:p-5",
                        isActive
                          ? // The ring IS the border here, so the element's own
                            // border goes transparent -- otherwise the two stack
                            // and read as a double outline.
                            "brand-ring border-transparent bg-card"
                          : "border-transparent hover:border-border/60 hover:bg-card/40",
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={cn(
                            "font-mono text-xs tabular-nums transition-colors",
                            isActive
                              ? "text-foreground"
                              : // Not /50: that is ~2.6:1 on this section's true
                                // black, under the 4.5:1 floor, and it is the cue
                                // that tells a visitor the steps are sequenced.
                                // Full token, matching the inactive title beside
                                // it, so an inactive row has one colour rather
                                // than two -- the active state is already marked
                                // by the ring, the card fill and the icon.
                                "text-muted-foreground",
                          )}
                        >
                          {`0${i + 1}`}
                        </span>
                        {/* Colour lands on the icon only. The title stays plain
                            white, so the accent marks the state without turning
                            the copy into decoration. */}
                        <s.Icon
                          className={cn(
                            "size-4 shrink-0 transition-colors",
                            !isActive && "text-muted-foreground",
                          )}
                          {...(isActive ? { style: { color: ACCENT } } : {})}
                        />
                        <span
                          className={cn(
                            "font-medium text-base transition-colors",
                            isActive
                              ? "text-foreground"
                              : "text-muted-foreground",
                          )}
                        >
                          {s.title}
                        </span>
                      </div>
                      <p className="mt-2 pl-[2.6rem] text-muted-foreground text-sm leading-relaxed">
                        {s.body}
                      </p>

                      {/* Time left on this step, in the brand gradient. Absent
                          once the visitor has taken over, because nothing is
                          counting down any more. Inset by a pixel so the ring's
                          bottom segment doesn't paint over it. */}
                      {isActive && !picked ? (
                        <span
                          aria-hidden
                          className="absolute inset-x-px bottom-px h-0.5 bg-border/50"
                        >
                          <span
                            key={`${step}-${runId}`}
                            className="brand-bg block h-full origin-left animate-step-progress"
                            style={{
                              animationDuration: `${STEP_MS}ms`,
                              animationPlayState: running
                                ? "running"
                                : "paused",
                            }}
                          />
                        </span>
                      ) : null}
                    </button>
                  </Reveal>
                );
              })}
            </ol>
          </div>

          <div
            className={cn(
              "order-2 transition-[width] lg:min-w-0",
              SWITCH,
              FRAMES[mode].col,
            )}
          >
            <DeviceSwitch mode={mode} onChange={setMode} />
            <Stage
              mode={mode}
              step={step}
              variantKey={variant.key}
              username={stepDef.username}
              seen={seen}
              active={active}
              qr={qr}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

/** Phone / desktop toggle. A real control, so it lives OUTSIDE the decorative
 *  (aria-hidden, pointer-events-none) stage below it. Hidden on the narrowest
 *  screens, where there is no room for a desktop frame and phone is the truthful
 *  default anyway. A fieldset + visually-hidden legend rather than
 *  role="group": it is the native grouping element, so the toggle carries a name
 *  for screen readers without inventing an ARIA role. Its visual language is
 *  deliberately the app's shipped segmented control (time-range-picker.tsx). */
function DeviceSwitch({
  mode,
  onChange,
}: {
  mode: Mode;
  onChange: (m: Mode) => void;
}) {
  const options = [
    { key: "phone" as const, label: "Phone", Icon: PhoneIcon },
    { key: "desktop" as const, label: "Desktop", Icon: DesktopIcon },
  ];
  return (
    <fieldset className="mb-4 hidden border-0 p-0 sm:block">
      <legend className="sr-only">Preview device</legend>
      <div className="mx-auto flex w-fit gap-1 rounded-lg border border-border bg-card p-1">
        {options.map((o) => {
          const on = o.key === mode;
          return (
            <button
              key={o.key}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(o.key)}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-medium text-xs transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                on
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <o.Icon className="size-3.5" />
              {o.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/** The device the pages are shown in: a portrait screen or a landscape one.
 *
 *  Deliberately not <BrowserPreview> (which the hero wall uses) paired with
 *  <ProfilePreview>: switching between two components means unmounting one and
 *  mounting the other. Here the device is a state ONE frame is in, so it changes
 *  its own radius and padding and the pages inside it never move house.
 *
 *  Same safety recipe as the shared previews: the real ProfileView with no
 *  `username` (so nothing is recorded -- inert and aria-hidden do NOT stop
 *  analytics), inert + aria-hidden + pointer-events-none because a decorative
 *  mockup is not content, and a transform-gpu overflow-hidden box so
 *  ProfileView's absolutely-positioned background stays inside the screen
 *  instead of escaping across the section. */
function DeviceFrame({ data, mode }: { data: PageData; mode: Mode }) {
  const phone = mode === "phone";
  return (
    <div
      className={cn(
        "relative h-full transform-gpu overflow-hidden border border-white/10 bg-background shadow-2xl shadow-black/60 transition-[border-radius]",
        SWITCH,
        phone ? "rounded-[2rem]" : "rounded-xl",
      )}
    >
      <div
        inert
        aria-hidden="true"
        className={cn(
          "pointer-events-none relative flex h-full w-full flex-col items-center justify-center transition-[padding]",
          SWITCH,
          phone ? "px-5 py-9" : "px-6 py-4",
        )}
      >
        <ProfileView data={data} decorative />
      </div>
    </div>
  );
}

function Stage({
  mode,
  step,
  variantKey,
  username,
  seen,
  active,
  qr,
}: {
  mode: Mode;
  step: number;
  variantKey: string;
  username: string;
  seen: boolean;
  active: boolean;
  qr: string | null;
}) {
  const frame = FRAMES[mode];

  return (
    <div
      aria-hidden
      // Height is pinned to the PHONE at every breakpoint, so switching device
      // swaps what is in the stage without the page below it jumping. The
      // shorter desktop frame just centres in the leftover room.
      className="pointer-events-none relative flex h-[41rem] w-full items-center justify-center sm:h-[42.5rem] lg:h-[44rem]"
    >
      {/* Everything is positioned against the FRAME's box, not the stage's, so
          the overlays keep the same relationship to the page at every viewport
          width and in either device. */}
      <div
        className={cn(
          "relative w-full transition-[max-width,height]",
          SWITCH,
          frame.frame,
        )}
      >
        {/* NOT keyed on mode. An earlier version was, so that React would
            replace the subtree and the incoming device could play an entrance --
            but that meant a device switch tore down five ProfileViews and built
            five more (one of them a fresh WebGL context) in the same frame the
            resize was starting, which is exactly what made the switch stutter.
            One `DeviceFrame` that changes its own chrome instead keeps the pages
            mounted, so switching device is a resize and nothing else. */}
        {seen ? (
          <div className="absolute inset-0 animate-fade">
            {/* All three pages are mounted at once and cross-faded on opacity: a
                gradient background swapping for a grid one is a DISCRETE change
                (a background-image cannot be interpolated), so the only way to
                dissolve between them is two painted layers. They are built to
                identical dimensions for exactly this reason -- see
                showcase-page.ts. */}
            {SHOWCASE_VARIANTS.map((v) => (
              <div
                key={v.key}
                className={cn(
                  "absolute inset-0 transition-opacity duration-400 ease-out",
                  v.key === variantKey ? "opacity-100" : "opacity-0",
                )}
              >
                <DeviceFrame data={v.data} mode={mode} />
              </div>
            ))}
          </div>
        ) : null}

        {/* One card slot for all three steps, hanging off the frame's lower
            edge. Every step puts its detail in the SAME place, so the section
            reads as one surface changing contents rather than three unrelated
            flourishes -- and nothing ever covers the avatar or the name, which
            is what makes the numbers read as belonging to THIS page.

            The tallest card (analytics) is the one in flow and sets the slot's
            height; the other two are absolutely bottom-aligned inside it. So all
            three share a bottom edge and the frame never shifts as steps
            change. */}
        <div className="-bottom-4 absolute inset-x-0 flex justify-center">
          {/* `w-full` plus a max-width, so the card is always the smaller of
              "what it wants to be" and "what the frame can hold". This flex
              container is inset-x-0 on the FRAME, so that second bound is the
              frame's own width and the card can never reach the section's edge,
              at any viewport, in either device. */}
          <div
            className={cn(
              "relative w-full transition-[max-width]",
              SWITCH,
              frame.card,
            )}
          >
            <SlotCard on={step === 2}>
              <AnalyticsCard run={active && step === 2} />
            </SlotCard>
            <SlotCard on={step === 0} pinned>
              <BackgroundCard variantKey={variantKey} />
            </SlotCard>
            <SlotCard on={step === 1} pinned>
              <ShareCard qr={qr} username={username} />
            </SlotCard>
          </div>
        </div>
      </div>
    </div>
  );
}

/** A card in the shared slot. `pinned` bottom-aligns it over the in-flow card
 *  instead of taking part in layout. Lifts and settles on the house curve. */
function SlotCard({
  on,
  pinned,
  children,
}: {
  on: boolean;
  pinned?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "transition-[opacity,transform] duration-500",
        pinned && "absolute inset-x-0 bottom-0",
        on
          ? "translate-y-0 scale-100 opacity-100"
          : "translate-y-2 scale-[0.98] opacity-0",
      )}
      style={{ transitionTimingFunction: SETTLE }}
    >
      {children}
    </div>
  );
}

/** Shared chrome for the three slot cards, so they can't drift apart. */
function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card/95 p-3.5 shadow-2xl shadow-black/60 backdrop-blur-sm">
      {children}
    </div>
  );
}

function BackgroundCard({ variantKey }: { variantKey: string }) {
  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <p className="shrink-0 text-muted-foreground text-xs">Background</p>
        <div className="flex gap-1">
          {/* The active chip is a faint white wash, not a solid white pill.
              The pill looked worse the moment it changed: fading a fully opaque
              slab out over half a second left two chips half-white at once, and
              the one being left read as a lagging ghost rather than a
              deselection. A 10% fill has nowhere far to fall, so the swap lands
              cleanly -- and it suits a dark section better besides. Faster than
              the page cross-fade on purpose: the control should answer before
              the thing it controls. */}
          {SHOWCASE_BACKGROUNDS.map((v) => (
            <span
              key={v.key}
              className={cn(
                "rounded-md px-2 py-1 font-mono text-xs transition-colors duration-200",
                v.key === variantKey
                  ? "bg-white/10 text-foreground"
                  : "text-muted-foreground",
              )}
            >
              {v.label}
            </span>
          ))}
        </div>
      </div>
    </Card>
  );
}

function ShareCard({ qr, username }: { qr: string | null; username: string }) {
  return (
    <Card>
      {/* Sized so the longest demo URL fits without truncating in the PHONE
          card, which is the narrowest place this ever renders -- a link-in-bio
          product showing off a link that ends in an ellipsis is not a good look.
          The QR and the label give up the pixels rather than the URL. */}
      <div className="flex items-center gap-2.5">
        <div className="size-12 shrink-0 overflow-hidden rounded-lg bg-white p-1">
          {qr ? (
            // biome-ignore lint/performance/noImgElement: local data URL, nothing to load or optimise
            <img
              src={qr}
              alt=""
              className="size-full"
              width={480}
              height={480}
            />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[0.6875rem] text-muted-foreground">Your link</p>
          <p className="truncate font-mono text-xs">stacked.page/{username}</p>
        </div>
        {/* Dropped on the narrowest card, where the pixels are worth more to
            the URL than to a button that is only an affordance here anyway. */}
        <span className="hidden size-8 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground sm:flex">
          <CopyIcon className="size-4" />
        </span>
      </div>
    </Card>
  );
}

function AnalyticsCard({ run }: { run: boolean }) {
  const views = useCountUp(TOTAL_VIEWS, run);
  const clicks = useCountUp(TOTAL_CLICKS, run);

  return (
    <Card>
      <p className="font-medium text-sm">Last 7 days</p>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Stat label="Views" value={views} color={ACCENT} delta="+18%" />
        <Stat label="Clicks" value={clicks} color={ACCENT_2} delta="+24%" />
      </div>

      <Sparkline run={run} />
    </Card>
  );
}

function Stat({
  label,
  value,
  color,
  delta,
}: {
  label: string;
  value: number;
  color: string;
  delta: string;
}) {
  return (
    <div className="rounded-lg bg-muted/40 p-2">
      <div className="flex items-center gap-1.5">
        <span
          className="size-1.5 rounded-full"
          style={{ backgroundColor: color }}
        />
        <span className="text-muted-foreground text-xs">{label}</span>
      </div>
      <div className="mt-0.5 flex items-baseline gap-1.5">
        <span className="font-mono font-medium text-lg tabular-nums">
          {value.toLocaleString()}
        </span>
        <span className="text-[0.6875rem] text-success">{delta}</span>
      </div>
    </div>
  );
}

function Sparkline({ run }: { run: boolean }) {
  const W = 380;
  const H = 48;
  // The lines replay by REMOUNTING on the rising edge of `run`, never by being
  // reset on the falling edge.
  //
  // They used to swap `animate-draw-line` for an inline
  // `strokeDashoffset: 1` whenever `run` went false, which is what the section's
  // IntersectionObserver does as the card scrolls out -- so the chart's two
  // lines blinked out in a single frame while the card was still on screen,
  // right above two stat numbers that hold their final value. Half the card
  // vanished and half of it stayed.
  //
  // Latching with a `drawn` flag would have been the obvious fix and is the
  // wrong one: `useCountUp` replays from zero on every rising edge, so a
  // permanent latch would freeze the chart from the second cycle on while the
  // numbers kept counting -- the same asymmetry, reversed. Bumping a key
  // instead keeps both halves replaying together, and moves the snap back to
  // dashoffset 1 onto the way IN, where the card is still at opacity 0 and it
  // cannot be seen.
  const [take, setTake] = useState(0);
  useEffect(() => {
    if (run) setTake((t) => t + 1);
  }, [run]);
  const max = Math.max(...VIEW_SERIES);
  const path = (series: number[]) =>
    series
      .map((v, i) => {
        const x = (i / (series.length - 1)) * W;
        const y = H - (v / max) * (H - 6) - 3;
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="mt-3 w-full"
      role="presentation"
      style={{ height: H }}
    >
      <defs>
        <linearGradient id="hiw-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={ACCENT} stopOpacity="0.3" />
          <stop offset="1" stopColor={ACCENT} stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Fades in rather than drawing: an area sweeping open under a line that
          is drawing itself reads as two competing animations. */}
      <path
        d={`${path(VIEW_SERIES)} L${W} ${H} L0 ${H} Z`}
        fill="url(#hiw-area)"
        className={cn(
          "transition-opacity duration-1000",
          run ? "opacity-100" : "opacity-0",
        )}
      />
      {[
        { d: path(VIEW_SERIES), c: ACCENT },
        { d: path(CLICK_SERIES), c: ACCENT_2 },
      ].map((line) => (
        <path
          key={`${line.c}-${take}`}
          d={line.d}
          fill="none"
          stroke={line.c}
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          className="animate-draw-line"
        />
      ))}
    </svg>
  );
}

/** Counts 0 -> target once `run` turns on, and holds the target afterwards. */
function useCountUp(target: number, run: boolean, duration = 900) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!run) return;
    let raf = 0;
    let start = 0;
    const tick = (now: number) => {
      if (!start) start = now;
      const t = Math.min((now - start) / duration, 1);
      // easeOutCubic, so the number lands rather than stopping dead
      setValue(Math.round(target * (1 - (1 - t) ** 3)));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [run, target, duration]);

  return value;
}
