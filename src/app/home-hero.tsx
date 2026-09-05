"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { InteractiveGrid } from "~/components/interactive-grid";
import { PagesWall } from "~/components/pages-wall";
import { Button } from "~/components/ui/button";
import { DEMO_PROFILES } from "~/lib/demo-profiles";
import type { PageData } from "~/lib/pages";
import { cn } from "~/lib/utils";

// How many distinct pages the wall wants before it starts repeating. The wall
// shows 6 rows of 6, so anything under this and the same faces come round again
// within a single screenful.
const TARGET_POOL = 12;

// Landing hero: a motto + slogan + claim field on the left, over an interactive
// grid, with a diagonal wall of real scrolling pages on the right.
export function HomeHero({
  ownerPage,
  featured,
  seed = 0,
}: {
  ownerPage: PageData | null;
  featured: PageData[];
  /** Hourly rotation seed from the server, so the wall's arrangement drifts
   *  instead of being frozen forever. */
  seed?: number;
}) {
  // Real pages lead the wall: the owner's own page (when signed in) followed by
  // the featured public pages, then demo pages to top the pool up. The demos
  // aren't only an empty-pool fallback any more -- with a handful of featured
  // usernames there aren't enough real pages to fill 36 visible cards without
  // obvious repeats, so they pad the tail. Add more real usernames to
  // FEATURED_USERNAMES and they push the demos out on their own.
  const real = ownerPage ? [ownerPage, ...featured] : featured;
  const pool =
    real.length >= TARGET_POOL
      ? real
      : [...real, ...DEMO_PROFILES].slice(0, TARGET_POOL);

  return (
    <section
      aria-labelledby="hero-heading"
      // Full-bleed: the negative top margin cancels the root layout's navbar
      // spacer so the wall of pages runs to the very top of the viewport and the
      // floating bar sits ON the hero instead of in a black strip above it. The
      // copy column below puts the room back as padding. The existing h-28 top
      // scrim is what keeps the bar legible over the moving cards.
      className="relative mt-[calc(var(--nav-space)*-1)] min-h-dvh overflow-hidden"
    >
      {/* Interactive grid background — cells light up around the cursor. */}
      <InteractiveGrid className="absolute inset-0 h-full w-full" />

      {/* Subtle brand gradient layered behind the wall — kept dim and warm so
          the background stays dark rather than reading as a blue wash. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-2/3"
        style={{
          background:
            "radial-gradient(50% 50% at 74% 66%, rgba(167,139,250,0.05), transparent 68%)",
        }}
      />

      {/* Diagonal wall of real pages, scrolling (rows alternate direction). */}
      <PagesWall profiles={pool} seed={seed} />

      {/* Readability + edge scrims, all gradients so transitions stay soft.
          On mobile the wall fills the screen behind the copy, so dim it flat.
          On md+ a left-to-right scrim keeps the copy crisp and confines the
          pages to roughly the right half; top/bottom fades soften where the
          rotated wall meets the section edges. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-background/55 md:bg-transparent"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-r from-background from-36% via-background/60 via-64% to-transparent to-82%"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-background to-transparent"
      />
      {/* The bottom fade carries the join into the next section, so it is much
          longer than the top one and it has a midpoint. Both for a reason:

          Length, because this is the transition into the next section, which is
          solid TRUE black -- darker than this page's own --background of
          rgb(10, 10, 10). So the ramp has to end on #000 rather than on
          --background, or the join shows as a ten-level step exactly where the
          eye is looking. Ending on black is also why there is no border between
          the two any more: there is nothing left to hide.

          The midpoint, because a two-stop fade to `transparent` is linear in
          ALPHA and the eye is not. A straight ramp shows a soft edge a little
          past halfway, where the coverage stops changing fast enough to register;
          pulling the middle down front-loads the fade and that edge goes. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-56"
        style={{
          background:
            "linear-gradient(to top, #000 0%, rgb(0 0 0 / 0.8) 26%, rgb(0 0 0 / 0.36) 58%, rgb(0 0 0 / 0) 100%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-background/80 to-transparent"
      />

      {/* Copy + claim. */}
      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-[100rem] flex-col justify-center px-6 pt-[var(--nav-space)] sm:px-10 lg:px-16">
        <div className="max-w-xl">
          <h1
            id="hero-heading"
            className="text-balance font-bold text-5xl leading-[0.95] tracking-tight sm:text-6xl md:text-7xl xl:text-8xl"
          >
            All of you,
            <br />
            all here
          </h1>
          <p className="mt-6 max-w-md text-lg text-muted-foreground leading-relaxed sm:text-xl">
            Join other creators building, sharing, and earning from one link.
          </p>
          <ClaimField className="mt-8" />
        </div>
      </div>
    </section>
  );
}

// Claim-username field — the single primary action. Sends the visitor to
// sign-up with their chosen name pre-filled.
function ClaimField({ className }: { className?: string }) {
  const router = useRouter();
  const [claim, setClaim] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const ready = claim.trim().length > 0;

  function handleClaim(e: React.FormEvent) {
    e.preventDefault();
    // Empty field: rather than a dead click, put the cursor where the visitor
    // needs to type. The button is aria-disabled instead of disabled so it stays
    // reachable by keyboard and screen readers, which a truly disabled button
    // would hide from them entirely until the field had text.
    if (!ready) {
      inputRef.current?.focus();
      return;
    }
    const params = new URLSearchParams({
      mode: "signup",
      username: claim.trim(),
    });
    router.push(`/login?${params.toString()}`);
  }

  return (
    <form
      onSubmit={handleClaim}
      className={cn(
        "flex w-full max-w-md flex-col gap-3 sm:flex-row",
        className,
      )}
    >
      {/* URL-style field: a fixed "stacked.page/" prefix in front of the name.
          `.claim-field` (globals.css) draws the hairline and the brand-gradient
          focus ring; the border/fill utilities live there so the gradient ring
          has the border box to itself.

          Both halves carry `.no-zoom`. iOS Safari zooms the whole page when a
          focused input computes under 16px, and `sm:text-sm` puts this one at
          14px on every viewport at or above 640px -- which includes every iPhone
          in landscape. Tapping the page's single primary action would jump-zoom
          the hero and leave the visitor zoomed in until they pinched back out.
          `.no-zoom` floors the rendered size at 16px on coarse pointers only
          (globals.css), so desktop is untouched. It goes on the PREFIX too, not
          just the input: they sit on one line and have to stay the same size, or
          "stacked.page/" ends up 14px next to a 16px name and the URL stops
          reading as one string. */}
      <div className="claim-field flex h-12 flex-1 items-center rounded-lg pl-3">
        <span
          className="no-zoom shrink-0 select-none font-mono text-muted-foreground text-sm"
          style={{ "--no-zoom-fs": "0.875rem" } as React.CSSProperties}
        >
          stacked.page/
        </span>
        <input
          ref={inputRef}
          value={claim}
          onChange={(e) => setClaim(e.target.value)}
          placeholder="yourname"
          aria-label="Choose your page username"
          autoComplete="off"
          spellCheck={false}
          // Usernames are case-preserving, and mobile keyboards capitalize the
          // first letter of a field by default -- so without this someone typing
          // "kaze" on a phone claims "Kaze", a URL they never chose and are not
          // asked to confirm. Not a `toLowerCase()`, which would take away the
          // deliberate ability to claim "KazeEdits".
          autoCapitalize="none"
          autoCorrect="off"
          maxLength={30}
          // /80 rather than /50: at /50 the placeholder is ~2.7:1 on the field
          // fill, under the 4.5:1 body-text floor, and it is the only hint of the
          // expected format. Not full opacity -- that is exactly the prefix's
          // colour, so "stacked.page/yourname" would read as an already-filled
          // value instead of a prefix plus a hint.
          className="no-zoom h-full w-full flex-1 bg-transparent pr-3 font-mono text-base outline-none placeholder:text-muted-foreground/80 sm:text-sm"
          style={{ "--no-zoom-fs": "0.875rem" } as React.CSSProperties}
        />
      </div>
      {/* Not `disabled`: the shared Button primitive renders disabled states at
          50% opacity, and a half-transparent near-white pill sitting over the
          moving wall let the cards show straight through it. An opaque muted
          slab reads as inactive without the bleed-through, and aria-disabled
          keeps the control in the tab order. */}
      <Button
        type="submit"
        size="lg"
        aria-disabled={!ready}
        // Matches the feel of the link tiles rendered inside the wall cards
        // behind this button (profile-view.tsx): 300ms gesture, scale up on
        // hover, press in on 75ms. Those ARE stacked's primary buttons, so a
        // visitor's first press of one shouldn't feel different from the real
        // thing. The lift is left out on purpose -- translation reads badly over
        // a moving background.
        className={cn(
          "h-12 px-6 duration-300 ease-out active:scale-95 active:duration-75",
          ready
            ? "hover:scale-[1.03]"
            : // Inactive, not inert: the click isn't dead (it focuses the field),
              // so give the hover something to animate instead of repeating the
              // resting colour.
              "cursor-not-allowed bg-muted text-muted-foreground hover:bg-muted/80",
        )}
      >
        Claim for free
      </Button>
    </form>
  );
}
