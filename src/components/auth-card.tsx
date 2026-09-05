"use client";

import Link from "next/link";
import { AuroraGlow } from "~/components/aurora-glow";
import { StackedMark } from "~/components/stacked-mark";

/**
 * The shell every signed-out auth screen sits in: sign in, sign up, request a
 * reset link, set a new password.
 *
 * It exists because those four are ONE flow — you land on the last one by
 * clicking a link in an email sent by the third — and they were drifting into
 * two looks. Sign-in/sign-up now wear the settings surface (`elev-card` over
 * `bg-card`, `.animate-rise` arrival) while /auth/reset was still on the
 * generic <Card>, so finishing a password reset meant watching the card change
 * shape mid-flow.
 *
 * The head is a title and one clause, and nothing else. It briefly carried a
 * violet glyph tile borrowed from a settings Panel, which was a mistake worth
 * naming: over there the tile is a scanning aid — it tells one panel in a long
 * list apart from the next — and a card that is the ONLY thing on screen has
 * nothing to be told apart from. It decorated a heading that was already doing
 * its job.
 *
 * `.brand-accent` is set here, once, which is what makes every Input, Button
 * and Toggle inside focus in the brand purple instead of grey.
 *
 * The one thing behind the card is {@link AuroraGlow}, shared with the 404 and
 * the error boundary — see the note at its call site below.
 */
export function AuthCard({
  title,
  description,
  /**
   * Changing this re-plays the card's slide/fade — the login screen passes its
   * mode so switching tabs animates the header along with the form, rather than
   * swapping the copy underneath a card that never moved.
   */
  motionKey,
  children,
}: {
  title: string;
  description: string;
  motionKey?: string;
  children: React.ReactNode;
}) {
  return (
    // `relative overflow-hidden` for the glow: it is `absolute` and its 120px
    // blur reaches well outside its own box, so an unclipped parent would let it
    // paint past the viewport and add a scrollbar to a screen that fits.
    <main className="brand-accent relative flex flex-1 items-center justify-center overflow-hidden px-6 py-16">
      {/* The same drifting brand glow the 404 and the error boundary sit on.
          These four screens are the same KIND of screen — one card on an empty
          page — and until now they were the only ones of the six without it, so
          a mistyped username got a warmer welcome than the front door. Kept at
          the error screen's dimmer value rather than the 404's: an auth card is
          something you read and type into, and the 404 is something you look at
          for two seconds. */}
      <AuroraGlow className="opacity-[0.08]" />
      <div className="relative flex w-full max-w-sm flex-col items-center gap-6">
        {/* Wordmark ties the auth screen back to the brand and links home. */}
        <Link
          href="/"
          className="group flex animate-rise items-center gap-2 rounded-md font-semibold text-lg tracking-tight focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <StackedMark
            variant="brand"
            className="size-6 transition-transform duration-300 group-hover:scale-110"
          />
          <span>
            stacked<span className="brand-text">.</span>
          </span>
        </Link>

        <div
          className="w-full animate-rise rounded-xl border border-border bg-card bg-clip-padding p-6 elev-card"
          style={{ animationDelay: "60ms" }}
        >
          <div key={motionKey} className="animate-slide-up">
            <header>
              <h1 className="font-semibold text-base tracking-tight">
                {title}
              </h1>
              <p className="mt-1 text-muted-foreground text-xs leading-relaxed">
                {description}
              </p>
            </header>
            <div className="mt-5">{children}</div>
          </div>
        </div>
      </div>
    </main>
  );
}
