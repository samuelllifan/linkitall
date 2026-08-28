import Link from "next/link";
import { Reveal } from "~/components/reveal";
import { Button } from "~/components/ui/button";

// Landing section three: the close.
//
// It is deliberately the quietest thing on the page. The hero is a wall of
// moving pages with a form in front of it and section two is a device demo that
// restyles itself on a timer; by the time a visitor arrives here they have been
// shown a lot, and the useful thing to do is stop showing them things. Nothing
// in this section moves after it has arrived, and there is one control in it.
//
// The three things it names are the three the demo above physically cannot show:
// section two can style a page, share it and measure it, but it cannot play
// music, put a splash screen in front of the page, or take a link down on a
// date. That is the whole reason this section earns its place — new information
// at the point of decision, not a recap of the two sections above. If this list
// is ever replaced with a summary ("everything you need", "all the features"),
// the section stops paying for itself and becomes a button with padding.
//
// All three are shipped and user-facing: the Music, Intro and Links panels in
// the Studio (src/app/edit/studio-panels.tsx). Nothing here may name a surface
// that does not exist -- this is the last thing a visitor reads before signing
// up, so it is the worst possible place to set an expectation the product
// cannot keep. "Music" and not "music that starts when they land" for exactly
// that reason: `autoplay` defaults to false, and music-player.tsx holds
// playback until the visitor's first gesture regardless, because browser
// autoplay policy demands it.
//
// No second claim-username field. The hero already has one; repeating it here
// would make the page's last impression a form the visitor already skipped once.
export function FinalCta() {
  return (
    <section
      aria-labelledby="final-cta-heading"
      className="relative overflow-hidden"
      // Same recipe as how-it-works, moved down one section: true black for the
      // body, ramping back up to --background over the last few percent for the
      // footer, which is bg-background like the rest of the app.
      //
      // The ramp has to live on whichever section is LAST, and it used to be
      // section two — so that section is now flat #000 and this one owns the
      // hand-off. Between the two of them there is nothing at all: no border, no
      // change in value, so the join is invisible and the black reads as one
      // continuous field from the bottom of the hero's fade to the footer rule.
      style={{
        background:
          "linear-gradient(to top, var(--background) 0%, #000 7%, #000 100%)",
      }}
    >
      {/* The section's one piece of colour, and it is barely there: a violet
          bloom lifting the black behind the heading so the block doesn't sit in
          a dead void. Same idiom and roughly the same weight as the hero's
          gradient (home-hero.tsx) — a wash at single-digit alpha, never a
          visible shape. Sits behind everything and eats no pointer events. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(56% 46% at 50% 34%, rgba(167,139,250,0.09), transparent 72%)",
        }}
      />

      {/* Asymmetric padding, on purpose. The section above already contributes
          112px of its own bottom padding, so a symmetric block here stacked to
          240px of empty black before the heading and read as a gap rather than
          as air. The bottom keeps its full measure -- there is nothing below it
          but the footer rule, and the button needs room under it or the close
          feels cramped against the chrome. */}
      <div className="relative mx-auto flex max-w-2xl flex-col items-center px-6 pt-16 pb-28 text-center sm:pt-20 sm:pb-32 lg:pt-24 lg:pb-40">
        {/* The brand spectrum, as a rule rather than as text. Same treatment as
            the navbar's active-tab underline (`brand-bg`, 2px, pill) at closing
            scale, and the same gesture as the step timer in section two: a
            gradient bar growing from its own centre. One spectrum moment in the
            section, on something that isn't type — so it reads as a mark and
            never fights the headline for the eye.

            96px, not the navbar underline's 16px: --brand-grad is a six-stop
            spectrum, and below roughly this width the cool end never gets a
            pixel, so the mark reads as a pink smudge instead of as the brand. */}
        <Reveal className="h-[2px] w-24" rise="0px" aria-hidden>
          <span className="brand-bg reveal-grow block h-full w-full rounded-full" />
        </Reveal>

        <Reveal
          as="h2"
          id="final-cta-heading"
          delay={60}
          className="mt-8 text-balance font-bold text-4xl leading-[1.05] tracking-tight sm:text-5xl md:text-6xl"
        >
          What are you waiting for?
        </Reveal>

        <Reveal
          as="p"
          delay={120}
          className="mt-6 text-pretty text-lg text-muted-foreground leading-relaxed sm:text-xl"
        >
          Start creating your page now. Music, an intro screen, scheduled links
          — all for free.
        </Reveal>

        <Reveal delay={180} className="mt-10">
          <Button
            asChild
            size="lg"
            // Same gesture as the hero's claim button and as the link tiles on a
            // real page: 300ms out, scale up on hover, press in on 75ms. Those
            // tiles are the product's primary button, so a visitor's press here
            // should feel identical to a press on the thing they're signing up
            // to make. No lift — translation reads badly on a centered block
            // with nothing beside it to move against.
            className="h-12 px-7 text-base duration-300 ease-out hover:scale-[1.03] active:scale-95 active:duration-75"
          >
            <Link href="/login?mode=signup">Claim your page</Link>
          </Button>
        </Reveal>
      </div>
    </section>
  );
}
