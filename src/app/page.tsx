"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "~/components/ui/button";

// Landing page: a full-height hero, followed by a "what you get" section of
// three equally sized feature panels on a subtle grid backdrop.

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      {/* Scoped keyframes for the shining gradients on the hero adjectives. */}
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static, no user input */}
      <style dangerouslySetInnerHTML={{ __html: SLOT_SHINE_CSS }} />
      <section className="relative flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center overflow-hidden px-6 py-20 text-center">
        <div className="flex max-w-2xl flex-col items-center gap-6">
          <h1 className="text-balance text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
            All of you, in one
          </h1>
          <p className="max-w-xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
            stacked is the <span className="slot-shine italic">fastest</span>,{" "}
            <span className="slot-shine font-semibold">easiest</span>, and{" "}
            <span className="slot-shine font-serif italic text-[1.1em]">
              most customizable
            </span>{" "}
            way to create your link-in-bio page
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <Button asChild size="lg">
              <Link href="/my-page">Create Your Page for Free</Link>
            </Button>
          </div>
        </div>
      </section>

      <HowItWorks />
      <PageShowcase />
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
        className="size-8"
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
        className="size-8"
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
        className="size-8"
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
      <div className="relative z-10 mx-auto w-full max-w-[100rem] px-6 py-16 sm:px-12 sm:py-20 lg:px-20">
        <h2 className="mb-10 text-balance text-center text-3xl font-bold tracking-tight sm:mb-16 sm:text-5xl">
          Everything you need to{" "}
          <span className="slot-shine font-serif font-medium italic">grow</span>{" "}
          your audience
        </h2>
        <div className="grid gap-6 md:grid-cols-3 lg:gap-14">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="group flex flex-col rounded-2xl border border-border bg-background/85 p-8 backdrop-blur-sm transition duration-300 ease-out hover:-translate-y-1 hover:border-white/20 hover:bg-background hover:shadow-xl hover:shadow-black/40 sm:p-10 lg:p-14"
            >
              <div className="mb-6 flex size-14 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-transform duration-300 ease-out group-hover:scale-105 sm:mb-8 sm:size-16">
                {feature.icon}
              </div>
              <h3 className="mb-3 text-xl font-semibold tracking-tight sm:mb-4 sm:text-2xl">
                {feature.title}
              </h3>
              <p className="text-base leading-relaxed text-muted-foreground sm:text-lg">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Page showcase — a static mockup of a real stacked page shown on desktop and
// mobile, plus the "Claim Your Page" username field. The composition image lives
// at /public/showcase.png; regenerate it (scratchpad capture script) if the
// featured page changes.
// ---------------------------------------------------------------------------

function PageShowcase() {
  const router = useRouter();
  // The username typed into the "Claim Your Page" field.
  const [claim, setClaim] = useState("");

  // Send the visitor to sign-up in signup mode with their chosen username
  // pre-filled (the login page reads `mode` and `username` from the query).
  function handleClaim(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams({ mode: "signup" });
    const name = claim.trim();
    if (name) params.set("username", name);
    router.push(`/login?${params.toString()}`);
  }

  return (
    <section className="relative overflow-hidden border-t border-border bg-background">
      <div className="relative z-10 mx-auto w-full max-w-[100rem] px-6 py-16 sm:px-12 sm:py-24 lg:px-20">
        <div className="mx-auto mb-10 max-w-2xl text-center sm:mb-14">
          <h2 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl">
            Join us now.
          </h2>
          <p className="mt-5 text-balance text-lg leading-relaxed text-muted-foreground">
            Sign up now and make your own, it&apos;s free.
          </p>
          {/*
            Social proof lands here once there's real momentum. Hold the count
            until it reads as a crowd (~50+ creators), then drop in a line like
            "Join 1,200+ creators on stacked" fed by a `creator_count()`
            Supabase RPC granted to `anon` (mirrors get_public_page). Showing a
            tiny number now would undercut the pitch, so it's intentionally
            omitted for launch.
          */}
        </div>

        {/* Static composition of the featured page on desktop + mobile. */}
        {/* biome-ignore lint/performance/noImgElement: static hero mockup; next/image adds no value here */}
        <img
          src="/showcase.png"
          alt="A stacked page shown on a desktop browser and a phone"
          width={1250}
          height={843}
          className="mx-auto h-auto w-full max-w-5xl"
        />

        <form
          onSubmit={handleClaim}
          className="mx-auto mt-10 flex w-full max-w-lg flex-col gap-3 sm:mt-16 sm:flex-row"
        >
          {/* URL-style field: a fixed "stacked.page/" prefix in front of the
              editable username, matching the sign-up form's address preview. */}
          <div className="flex h-12 flex-1 items-center rounded-lg border border-input bg-background pl-3 transition focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/40">
            <span className="shrink-0 select-none text-muted-foreground text-sm">
              stacked.page/
            </span>
            <input
              value={claim}
              onChange={(e) => setClaim(e.target.value)}
              placeholder="yourname"
              aria-label="Choose your page username"
              autoComplete="off"
              spellCheck={false}
              maxLength={30}
              className="h-full w-full flex-1 bg-transparent pr-3 text-base outline-none placeholder:text-muted-foreground/60 sm:text-sm"
            />
          </div>
          <Button type="submit" size="lg" className="h-12">
            Claim Your Page
          </Button>
        </form>
      </div>
    </section>
  );
}

// A silver base with a bright highlight band that sweeps left→right, giving the
// text a periodic "shine". Shared by the hero adjectives and "grow" below.
const SLOT_SHINE_CSS = `
@keyframes slot-shine {
  from { background-position: 200% center; }
  to { background-position: -200% center; }
}
.slot-shine {
  /* inline-block + a sliver of horizontal padding so the italic glyphs' slant
     overhang isn't clipped by the background-clip:text box (e.g. the tail of
     "fastest"). The matching negative margins keep the surrounding spacing. */
  display: inline-block;
  padding: 0 0.08em;
  margin: 0 -0.08em;
  background-image: linear-gradient(100deg, #94a3b8 0%, #94a3b8 40%, #ffffff 50%, #94a3b8 60%, #94a3b8 100%);
  background-size: 200% auto;
  background-clip: text;
  -webkit-background-clip: text;
  color: transparent;
  -webkit-text-fill-color: transparent;
  animation: slot-shine 3s linear infinite;
}
`;
