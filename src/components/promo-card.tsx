"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { StackedMark } from "~/components/stacked-mark";
import { Button } from "~/components/ui/button";
import { CloseIcon } from "~/components/ui/close-icon";
import { UsernameAvailability } from "~/components/ui/username-availability";
import { useUsernameAvailability } from "~/lib/use-username-availability";
import { cn } from "~/lib/utils";

/**
 * How long after the page settles the card slides in. Long enough that the
 * creator's page is what the visitor sees first — this is an ad on somebody
 * else's page, and it arriving in the same frame as their work would read as
 * ours rather than as a footnote to theirs.
 */
const APPEAR_DELAY = 1400;

/** Matches `.animate-promo-out`'s --dur-enter, so the node leaves after it fades. */
const EXIT_MS = 200;

/** Session-scoped, so a dismissal lasts the visit and not forever: this is the
 *  one place a visitor is offered a page of their own, and a single stray click
 *  shouldn't retire it for good. */
const DISMISS_KEY = "stacked:promo-dismissed";

function readDismissed(): boolean {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    // Private mode / storage blocked. Showing the card is the safe failure.
    return false;
  }
}

/**
 * The "claim your own page" card that floats on a creator's public page for
 * visitors who don't have a page of their own yet.
 *
 * It is a promo, so it behaves like one: it waits for the page, it can be
 * dismissed, and it never covers anything that isn't the creator's background —
 * not their content (it sits along the bottom edge, centred, below everything a
 * profile actually puts on screen) and not the site footer (it is `sticky`
 * inside a rail that stops there, so it locks into place above it rather than
 * riding over it). `offsetForMusic` raises it clear of the floating music pill
 * on phones, where the card is wide enough to reach across into it.
 *
 * The whole card is a click target, but only once the name in it could actually
 * be claimed. Before then both the card and the Claim button put the cursor in
 * the field instead of navigating — the visitor has said what they want to do
 * and not yet what they want to call it, and sending them to a sign-up form to
 * be told that is a worse answer than showing them the empty box.
 */
export function PromoCard({
  offsetForMusic = false,
}: {
  /** The page has a floating music pill in the opposite corner. */
  offsetForMusic?: boolean;
}) {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [gone, setGone] = useState(false);
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const trimmed = name.trim();
  // The app's shared check — same debounce, race guard and fail-open branch as
  // sign-up and settings. See ~/lib/use-username-availability.
  const { avail } = useUsernameAvailability(name, trimmed.length > 0);

  // Is there a name here that could actually be claimed? Everything the card
  // does is gated on this: the Claim button's fill, the full-bleed link, and
  // where a click goes.
  //
  // `unavailable` and not `!== "available"` on purpose. That state is the union
  // of "malformed", "reserved" and "already taken" — every answer that is a real
  // NO — while `checking` and `idle` are both "we don't know yet". Gating on
  // "available" would mean an unanswerable check (offline, RPC down) locks the
  // button, turning a network blip into an unpassable gate; the availability
  // effect deliberately fails open for the same reason, and sign-up re-validates
  // authoritatively either way.
  const ready = trimmed.length > 0 && avail.state !== "unavailable";

  // ── Arrival ──────────────────────────────────────────────────────────────
  // Arrive once the page is the visitor's — and, when the creator has a
  // click-to-enter splash, only once they're actually through it. Without the
  // wait the timer burns while the splash owns the screen and the card is simply
  // there, un-animated, the moment they enter. The splash announces itself with
  // `data-intro-splash` on <html> (enter-overlay.tsx).
  useEffect(() => {
    if (readDismissed()) {
      setGone(true);
      return;
    }

    const root = document.documentElement;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let observer: MutationObserver | undefined;

    const waitForSplash = () => {
      observer?.disconnect();
      observer = new MutationObserver(() => {
        if (root.hasAttribute("data-intro-splash")) return;
        observer?.disconnect();
        observer = undefined;
        arm();
      });
      observer.observe(root, {
        attributes: true,
        attributeFilter: ["data-intro-splash"],
      });
    };

    const arm = () => {
      timer = setTimeout(() => {
        // Re-check on the way out, not only on the way in: this component and
        // the overlay both set up in effects, and if ours ran first the splash
        // had not marked the document yet when we looked.
        if (root.hasAttribute("data-intro-splash")) waitForSplash();
        else setVisible(true);
      }, APPEAR_DELAY);
    };

    if (root.hasAttribute("data-intro-splash")) waitForSplash();
    else arm();

    return () => {
      if (timer) clearTimeout(timer);
      observer?.disconnect();
    };
  }, []);

  function dismiss() {
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Storage blocked: it still goes away for this page view.
    }
    setLeaving(true);
    setTimeout(() => setGone(true), EXIT_MS);
  }

  // Sign-up with the name pre-filled. `/login` reads `?mode=signup&username=`
  // and opens on the sign-up tab (login-client.tsx). Only ever used while
  // `ready`, so there is no empty-username branch here.
  const signupHref = `/login?mode=signup&username=${encodeURIComponent(trimmed)}`;

  // Nothing to claim yet: put the cursor where the answer goes. Not a dead
  // click and not a validation error — the visitor has already said they want a
  // page, so the only thing missing is the name, and the field is where that is.
  function focusField() {
    inputRef.current?.focus();
  }

  function handleClaim(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) {
      focusField();
      return;
    }
    router.push(signupHref);
  }

  if (gone) return null;

  // The full-bleed click target. A real <Link> once there's a name worth
  // carrying, so cmd-click and "open in new tab" reach sign-up the way any link
  // would; a <button> before that, because an anchor with nowhere to go is a lie
  // to everything that reads hrefs.
  const overlayClass =
    "absolute inset-0 rounded-2xl focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2";

  return (
    // The rail the card slides along: `absolute inset-0` over `main`, which on
    // this route ends exactly where the site footer begins. That coincidence is
    // the entire mechanism — it makes `main` the sticky element's containing
    // block, and a sticky element is not allowed to leave its containing block.
    //
    // So the browser does the whole behaviour natively: while there is page
    // below, the card is held against the bottom of the VIEWPORT; the moment the
    // rail's own bottom edge comes up to meet it, the card is out of room and
    // simply stops, parked on the PAGE just above the footer and scrolling with
    // it from there. No scroll listener, no measurement, no threshold to tune,
    // and nothing running on the main thread while you scroll — which is what
    // finally makes it hold still. Two hand-written versions of this (one
    // tracking the footer per frame, one jumping to a computed park position)
    // were both trying to reimplement `position: sticky` by hand.
    //
    // `pointer-events-none`, because this rail covers the creator's entire page
    // and only the card itself may take a click.
    <div className="pointer-events-none absolute inset-0 z-40 flex flex-col justify-end px-3 pb-3">
      <div
        className={cn(
          // `bottom` is where it rides while stuck; the rail's `pb-3` is where
          // it comes to rest. They are allowed to differ, and here they do: the
          // card sits high enough to clear the music pill while floating, then
          // parks a normal 12px off the footer, where the pill is no longer
          // beside it (by then the pill is down inside the footer band).
          "pointer-events-auto sticky mx-auto w-full max-w-[23rem]",
          // On phones the card is nearly full width, so even centred it reaches
          // into the bottom-left corner where the floating music pill lives. Sit
          // above it there. The reset waits for md, not sm: at exactly 640px the
          // centred card's left edge and a long track title still meet.
          offsetForMusic
            ? "bottom-[max(4.25rem,calc(env(safe-area-inset-bottom)+4.25rem))] md:bottom-[max(0.75rem,env(safe-area-inset-bottom))]"
            : "bottom-[max(0.75rem,env(safe-area-inset-bottom))]",
          // Un-clickable until it has actually arrived, so the invisible card
          // can't swallow a click aimed at the page underneath it.
          !visible && "pointer-events-none",
        )}
      >
        {/* Inner: the entrance. Split from the wrapper because both want
          `transform` — the keyframes here, the scroll lift there — and a
          running animation wins over an inline style, so sharing one element
          would freeze the card at its resting height for the first 500ms. */}
        <div
          className={cn(
            !visible && "opacity-0",
            visible && !leaving && "animate-promo-in origin-bottom",
            leaving && "animate-promo-out origin-bottom",
          )}
        >
          {/* Dark glass, like the floating music pill: this card lands on top of a
            creator's background, which can be anything, so it carries its own
            contrast rather than trusting what's underneath. */}
          <div className="relative rounded-2xl border border-white/10 bg-black/70 p-3 shadow-2xl backdrop-blur-xl">
            {/* One faint brand wash in the corner the mark sits in — the card's
              only colour beyond the mark itself and the availability dot. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-2xl"
              style={{
                background:
                  "radial-gradient(120% 140% at 0% 0%, rgba(167,139,250,0.13), transparent 62%)",
              }}
            />

            {ready ? (
              <Link
                href={signupHref}
                aria-label={`Claim stacked.page/${trimmed}`}
                className={overlayClass}
              />
            ) : (
              <button
                type="button"
                onClick={focusField}
                aria-label="Choose a username to claim your free page"
                className={overlayClass}
              />
            )}

            {/* `pointer-events-none` so clicks fall through to the target above;
              each real control switches its own back on. */}
            <div className="pointer-events-none relative flex items-start gap-2.5">
              {/* Its own gradient id, NOT the default: the navbar's mark is first
                in document order and is `display: none` on this route, so
                sharing the id paints this one with no fill at all (see
                stacked-mark.tsx). */}
              <StackedMark
                variant="brand"
                gradientId="stacked-promo-grad"
                className="mt-1.5 size-7 shrink-0 sm:mt-1"
              />

              <div className="min-w-0 flex-1">
                <form
                  onSubmit={handleClaim}
                  className="pointer-events-auto flex flex-col gap-2 sm:flex-row sm:items-center"
                >
                  {/* Same URL-style field as the landing hero's claim box, down to
                    `.claim-field` drawing the hairline and the brand-gradient
                    focus ring. Both halves carry `.no-zoom`: iOS zooms the whole
                    page when a focused input computes under 16px, and it has to
                    go on the PREFIX as well or "stacked.page/" ends up a
                    different size from the name beside it and the URL stops
                    reading as one string. */}
                  <div className="claim-field flex h-9 min-w-0 flex-1 items-center rounded-lg pl-2.5">
                    <span
                      className="no-zoom shrink-0 select-none font-mono text-muted-foreground text-xs"
                      style={
                        { "--no-zoom-fs": "0.75rem" } as React.CSSProperties
                      }
                    >
                      stacked.page/
                    </span>
                    <input
                      ref={inputRef}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="yourname"
                      aria-label="Choose your page username"
                      aria-describedby="promo-availability"
                      autoComplete="off"
                      spellCheck={false}
                      // Usernames are case-preserving and phone keyboards
                      // capitalise the first letter, so without this someone
                      // typing "kaze" claims "Kaze" — a URL they never chose. Not
                      // a toLowerCase(), which would take away claiming
                      // "KazeEdits" on purpose.
                      autoCapitalize="none"
                      autoCorrect="off"
                      maxLength={30}
                      className="no-zoom h-full w-full min-w-0 flex-1 bg-transparent pr-2.5 font-mono text-xs outline-none placeholder:text-muted-foreground/80"
                      style={
                        { "--no-zoom-fs": "0.75rem" } as React.CSSProperties
                      }
                    />
                  </div>
                  {/* Not `disabled`: the Button primitive renders disabled states
                    at 50% opacity, and a half-transparent near-white pill on
                    this glass would let the creator's background show straight
                    through it. An opaque muted slab reads as inactive without
                    the bleed-through, and `aria-disabled` keeps the control in
                    the tab order — where it still does something useful, since
                    pressing it moves focus into the field it is waiting on. */}
                  <Button
                    type="submit"
                    size="sm"
                    aria-disabled={!ready}
                    className={cn(
                      "h-9 shrink-0 px-4 duration-300 ease-out active:scale-95 active:duration-75",
                      ready
                        ? "hover:scale-[1.03]"
                        : "cursor-not-allowed bg-muted text-muted-foreground hover:bg-muted/80",
                    )}
                  >
                    Claim
                  </Button>
                </form>

                {/* The shared availability read-out — the same dot and wording
                  as sign-up and settings. */}
                <UsernameAvailability
                  id="promo-availability"
                  avail={avail}
                  idleLabel="Claim your page for free"
                  availableLabel={`${trimmed} is available`}
                  className="mt-1"
                />
              </div>

              <button
                type="button"
                onClick={dismiss}
                aria-label="Dismiss"
                className="pointer-events-auto -mr-0.5 mt-1 shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
              >
                <CloseIcon className="size-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
