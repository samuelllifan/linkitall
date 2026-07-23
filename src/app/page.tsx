"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "~/components/ui/button";

// Landing page: a full-height hero with a cycling adjective in the sub-headline,
// followed by a "what you get" section of three equally sized feature panels on
// a subtle grid backdrop.

// Adjectives the slot cycles through in the sub-headline. All share one look —
// a shining gradient that sweeps across the text — and they're kept to a
// similar length so the slot reads cleanly.
const ADJECTIVES = ["easiest", "fastest", "simplest"];

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      {/* Scoped keyframes for the shining gradient on the cycling adjective. */}
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static, no user input */}
      <style dangerouslySetInnerHTML={{ __html: SLOT_SHINE_CSS }} />
      <section className="relative flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center overflow-hidden px-6 py-20 text-center">
        <div className="flex max-w-2xl flex-col items-center gap-6">
          <h1 className="text-balance text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
            All of you, in one
          </h1>
          <p className="max-w-xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
            linkitall is the <AdjectiveSlot /> way to create your link-in-bio
            page
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <Button asChild size="lg">
              <Link href="/my-page">Create Your Page for Free</Link>
            </Button>
          </div>
        </div>
      </section>

      <HowItWorks />
    </main>
  );
}

// Three equally sized panels laid out in a responsive grid (stacked on mobile,
// side-by-side from `md`). The whole block sits on a distinct, slightly raised
// surface with a top border so it reads as its own section — a clean divider
// from the full-height hero above rather than fading into the same void.
//
// Every icon is normalised to the same stroke and size, and the cards stretch
// to a shared height via the grid, so nothing looks uneven regardless of copy
// length.
const FEATURES = [
  {
    title: "Everything in one place",
    description:
      "Collect all your links, socials, and projects on a single page so your audience always knows where to find you.",
    icon: (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-6"
      >
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </svg>
    ),
  },
  {
    title: "Customize freely",
    description:
      "Tweak colors, layout, and backgrounds to make your page truly yours, quickly and easily. Or start from a preset template to match any vibe in seconds.",
    icon: (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-6"
      >
        <path d="M12 3v2m0 14v2m9-9h-2M5 12H3m14.66-6.66-1.42 1.42M7.76 16.24l-1.42 1.42m0-11.32 1.42 1.42m8.48 8.48 1.42 1.42" />
        <circle cx="12" cy="12" r="4" />
      </svg>
    ),
  },
  {
    title: "Know what's working",
    description:
      "Built-in analytics show your views and clicks, so you can see what resonates and grow your audience.",
    icon: (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-6"
      >
        <path d="M3 3v18h18" />
        <path d="M7 15l4-4 3 3 5-6" />
      </svg>
    ),
  },
];

function HowItWorks() {
  return (
    <section className="relative overflow-hidden border-t border-border bg-muted/20">
      {/* Subtle square grid, brightest in the middle and masked out toward the
          edges so it fades into the dark rather than ending in a hard line. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage:
            "radial-gradient(ellipse 100% 95% at 50% 48%, #000 45%, transparent 96%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 100% 95% at 50% 48%, #000 45%, transparent 96%)",
        }}
      />
      <div className="relative z-10 mx-auto w-full max-w-7xl px-6 py-16">
        <h2 className="mb-14 text-balance text-center text-3xl font-bold tracking-tight sm:text-4xl">
          Everything you need to{" "}
          <span className="slot-shine font-serif font-medium italic">grow</span>{" "}
          your audience
        </h2>
        <div className="grid gap-8 md:grid-cols-3">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="group flex flex-col rounded-2xl border border-border bg-background/85 p-10 backdrop-blur-sm transition duration-300 ease-out hover:-translate-y-1 hover:border-white/20 hover:bg-background hover:shadow-xl hover:shadow-black/40"
            >
              <div className="mb-7 flex size-14 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-transform duration-300 ease-out group-hover:scale-105">
                {feature.icon}
              </div>
              <h3 className="mb-3 text-xl font-semibold tracking-tight">
                {feature.title}
              </h3>
              <p className="leading-relaxed text-muted-foreground">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// A silver base with a bright highlight band that sweeps left→right, giving the
// text a periodic "shine".
const SLOT_SHINE_CSS = `
@keyframes slot-shine {
  from { background-position: 200% center; }
  to { background-position: -200% center; }
}
.slot-shine {
  background-image: linear-gradient(100deg, #94a3b8 0%, #94a3b8 40%, #ffffff 50%, #94a3b8 60%, #94a3b8 100%);
  background-size: 200% auto;
  background-clip: text;
  -webkit-background-clip: text;
  color: transparent;
  -webkit-text-fill-color: transparent;
  animation: slot-shine 3s linear infinite;
}
`;

// A vertical "slot machine" that scrolls through the adjectives.
//
// Each word occupies one full-height cell and is centered both ways; the column
// translates by whole-cell steps and the box clips to a single cell, so only
// one word shows at a time (neighbours stay outside the clip window).
//
// A duplicate of the first word is appended so stepping past the last word
// slides forward onto that clone; once it settles we snap back to the real
// first word with the transition disabled, making the wrap invisible.
const CELL_EM = 1.6;
const SLIDE_MS = 500;
const HOLD_MS = 2000;
const N = ADJECTIVES.length;
// `align-middle` centres the clipped box on the parent's x-height, which leaves
// the resting word's baseline sitting ~0.077em below the surrounding text.
// Everything here is font-size-relative, so this constant em nudge lands the
// baseline exactly on the sentence's baseline at every breakpoint. It's a
// visual transform only, so it doesn't disturb the slot's translate math.
const BASELINE_NUDGE_EM = 0.077;

function AdjectiveSlot() {
  // `slide` counts up 0..N (the last value lands on the appended clone).
  const [slide, setSlide] = useState(0);
  const [animate, setAnimate] = useState(true);

  useEffect(() => {
    const id = setInterval(() => {
      setAnimate(true);
      setSlide((s) => s + 1);
    }, HOLD_MS);
    return () => clearInterval(id);
  }, []);

  // When we land on the appended clone, wait for the slide to finish, then snap
  // back to the real first word with the transition disabled (invisible wrap).
  useEffect(() => {
    if (slide !== N) return;
    const id = setTimeout(() => {
      setAnimate(false);
      setSlide(0);
    }, SLIDE_MS);
    return () => clearTimeout(id);
  }, [slide]);

  const words = [...ADJECTIVES, ADJECTIVES[0]];

  return (
    <span
      className="relative inline-flex items-start overflow-hidden align-middle font-semibold"
      style={{
        height: `${CELL_EM}em`,
        transform: `translateY(${-BASELINE_NUDGE_EM}em)`,
      }}
    >
      <span
        className="flex flex-col"
        style={{
          transform: `translateY(-${slide * CELL_EM}em)`,
          transition: animate ? `transform ${SLIDE_MS}ms ease-in-out` : "none",
        }}
      >
        {words.map((word, i) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: static list, index is stable
            key={i}
            className="flex items-center justify-center leading-none"
            style={{ height: `${CELL_EM}em` }}
          >
            <span className="slot-shine whitespace-nowrap">{word}</span>
          </span>
        ))}
      </span>
    </span>
  );
}
