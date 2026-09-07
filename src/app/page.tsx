import type { Metadata } from "next";
import { cookies } from "next/headers";
import { FinalCta } from "~/components/final-cta";
import { HowItWorks } from "~/components/how-it-works";
import { type Background, isLinkLive, type PageData } from "~/lib/pages";
import { getFeaturedPagesServer, getPageServer } from "~/lib/pages.server";
import { SITE_TITLE } from "~/lib/site-meta";
import { HomeHero } from "./home-hero";

// Only the landing page gets the headline in its title; see SITE_TITLE for why
// the root layout keeps the bare wordmark. `title` alone here on purpose —
// Next merges metadata SHALLOWLY, so declaring `openGraph` would replace the
// root layout's whole block and silently drop siteName / type / description
// with it. og:title is already pinned at the root, so there is nothing to fix.
// `absolute`, so the root layout's "%s · stacked" template does not append the
// wordmark to a title that already ends in it.
export const metadata: Metadata = { title: { absolute: SITE_TITLE } };

// Real public pages featured in the landing wall (rendered exactly as their
// owners' public pages look). Resolved live via get_public_page; any that don't
// resolve are simply dropped.
const FEATURED_USERNAMES = ["syun", "anyix", "bored", "hazelcolonthree"];

// Landing page: hero -> product demo -> close. When signed in, the owner's own
// page leads the hero's wall; it's filled out with the featured real pages above.
export default async function Home() {
  // Fast path for the common logged-out visitor: with no Supabase auth cookie,
  // skip the owner-page auth + DB round-trip entirely. (Reading cookies already
  // makes the route dynamic; this only avoids the network work.)
  const cookieStore = await cookies();
  const hasSession = cookieStore
    .getAll()
    .some((c) => c.name.includes("-auth-token"));

  // Fetch the owner's page (if signed in) and the featured pages together. The
  // featured set is public and identical for everyone, so it's served from a
  // shared hourly cache; only the owner lookup is per-request.
  const [ownerRaw, featuredRaw] = await Promise.all([
    hasSession ? getPageServer() : Promise.resolve(null),
    getFeaturedPagesServer(FEATURED_USERNAMES),
  ]);

  let ownerPage: PageData | null = null;
  if (ownerRaw && (ownerRaw.name.trim() || ownerRaw.links.length > 0)) {
    ownerPage = sanitizeForPreview(ownerRaw);
  }

  // Drop any featured page its owner has since gated. `get_public_page` already
  // withholds the CONTENT of an offline or password-protected page, so without
  // this the wall would render them as blank cards — and a sensitive page has no
  // business being the landing page's showcase at all. Pages that resolve to
  // nothing are dropped by getFeaturedPagesServer already.
  const featured = featuredRaw
    .filter((p) => p.live && !p.passwordProtected && !p.sensitive)
    .map((p) => sanitizeForPreview(p.data));

  // Rotates which pool page lands in which wall slot, changing once an hour so
  // repeat visitors don't always meet the same faces. Computed here on the
  // server and passed down: `Math.random()` would hydration-mismatch, and a
  // client-side `Date.now()` can land in a different hour bucket than the
  // server did right on the boundary.
  const seed = Math.floor(Date.now() / 3_600_000);

  return (
    <main className="flex flex-1 flex-col">
      <HomeHero ownerPage={ownerPage} featured={featured} seed={seed} />
      <HowItWorks />
      <FinalCta />
    </main>
  );
}

// Prepare a real page for a display-only card: drop scheduled/expired links (as
// the public page would), strip music so nothing autoplays, drop any click-to-
// enter intro so no overlay covers the card, drop the avatar effect (its
// particles are positioned with Math.random(), which SSR-hydration-mismatches
// and runs a perpetual animation on every card), and swap an aurora background
// for a plain gradient.
//
// The shader swap is a hard requirement, not a nicety: every shader background
// creates a WebGL context per mount (ShaderCanvas), and pinning `speed` to 0
// only stops the rAF loop -- the context is still created. One featured page
// with a shader background appears once per card, so the wall was holding ~10
// live contexts at 2316x1446 each (~13MB of GPU memory apiece). Browsers cap
// live WebGL contexts around 16 and silently drop the oldest, which blanks
// cards. A static two-stop gradient reads almost identically at the wall's card
// size and costs nothing.
//
// This applies to EVERY shader type, not just aurora -- adding a fifth one
// means adding it to `staticStandIn` below, or the wall starts blanking again.
function sanitizeForPreview(page: PageData): PageData {
  return {
    ...page,
    links: page.links.filter((l) => isLinkLive(l)),
    music: undefined,
    intro: undefined,
    avatarEffect: undefined,
    background: staticStandIn(page.background),
  };
}

/**
 * A no-WebGL stand-in for a shader background, for the landing wall's cards.
 * Anything else is returned untouched.
 *
 * Each one keeps the page's own colours and the direction its light actually
 * comes from, so a card still looks like the page it is advertising:
 *
 *  - Aurora blooms from the top and fades out well before the bottom, so the
 *    blend is biased upward rather than sitting at the 50% default.
 *  - Ripple is lit from above too, but far more weakly, and its base colour is
 *    most of what a card-sized version shows.
 */
function staticStandIn(bg: Background | undefined): Background | undefined {
  if (!bg) return bg;
  if (bg.type === "aurora") {
    return {
      type: "gradient",
      from: bg.color,
      to: bg.baseColor,
      direction: "vertical",
      distribution: 35,
    };
  }
  if (bg.type === "ripple") {
    return {
      type: "gradient",
      from: bg.glowColor,
      to: bg.baseColor,
      direction: "vertical",
      distribution: 12,
    };
  }
  return bg;
}
