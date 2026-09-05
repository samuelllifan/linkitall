import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EnterOverlay } from "~/components/enter-overlay";
import { PageOffline, PageUnlock, SensitiveGate } from "~/components/page-gate";
import { ProfileView } from "~/components/profile-view";
import { PromoCard } from "~/components/promo-card";
import { Button } from "~/components/ui/button";
import { pageUnlockCookie } from "~/lib/page-unlock";
import { isLinkLive } from "~/lib/pages";
import {
  getPageServer,
  getPublicPageServer,
  getPublicPageUnlockedServer,
  type PublicPage,
} from "~/lib/pages.server";
import { queryUsername } from "~/lib/profiles";
import { createClient } from "~/lib/supabase/server";
import { plainText } from "~/lib/text";

// Always render with fresh data from the database on each request.
export const dynamic = "force-dynamic";

/**
 * A short, stable hash of the page's visible content, used to version the OG
 * image URL. When the owner changes anything the card shows (name, bio, avatar,
 * or background/styles), this changes, so the `og:image` URL changes too — which
 * defeats URL-keyed image caches and lets a re-scrape pick up the new card
 * instead of a stale one. (The image route itself is already `force-dynamic`.)
 */
function contentVersion(page: PublicPage): string {
  const { name, bio, avatar, nameStyle, bioStyle, background } = page.data;
  const key = JSON.stringify([
    name,
    bio,
    avatar,
    nameStyle,
    bioStyle,
    background,
  ]);
  let h = 2166136261; // FNV-1a
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

// Rich link previews when a page URL is shared (the companion `opengraph-image`
// route supplies the image). Falls back gracefully for unknown usernames.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const page = await getPublicPageServer(username);
  // `absolute`: the root layout appends "· stacked" to every title, and an
  // unknown username has no name of its own to put in front of it.
  if (!page) return { title: { absolute: "stacked" } };

  // A page its owner has taken offline or flagged as sensitive gets a bare
  // title and nothing else: no description, no share card, never indexed. The
  // database already withholds an offline page's content, so this is mostly
  // about `sensitive` — whose content is deliberately still readable (the gate
  // is a click-through, not a wall) and therefore has to be held back here.
  if (!page.live || page.sensitive) {
    return {
      title: `@${page.username}`,
      robots: { index: false, follow: false },
    };
  }

  const name = plainText(page.data.name) || `@${page.username}`;
  const description =
    plainText(page.data.bio) || `${name}'s links, all in one place.`;

  // Version the share-card URL by the page's content so it changes whenever the
  // owner updates their page (see contentVersion). Resolves against the app's
  // metadataBase (set in the root layout).
  const image = {
    url: `/${encodeURIComponent(page.username)}/opengraph-image?v=${contentVersion(page)}`,
    width: 1200,
    height: 630,
    alt: `${name} on stacked`,
  };

  return {
    // Browser tab title follows the account username (with an @), not the
    // display name, so it stays stable regardless of what the page is named.
    title: `@${page.username}`,
    description,
    // Honour the owner's search-visibility setting. When off, ask crawlers not
    // to index the page (it stays reachable by direct link). When on, leave
    // robots unset so the site-wide default applies.
    robots: page.indexable ? undefined : { index: false, follow: false },
    openGraph: {
      type: "profile",
      title: name,
      description,
      siteName: "stacked",
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: name,
      description,
      images: [image],
    },
  };
}

export default async function UserPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The owner sees exactly what visitors see — editing lives at /edit — so the
  // only thing ownership changes here is the extra owner-only chrome below.
  const myUsername = user ? await queryUsername(supabase) : null;
  const isOwner =
    !!myUsername && myUsername.toLowerCase() === username.toLowerCase();

  let page = await getPublicPageServer(username);
  // That RPC reports every failure as null, which for a visitor is a 404 either
  // way. The owner shouldn't lose their own page to a transient RPC error
  // though, so fall back to their own RLS-scoped read — which is how this route
  // loaded for them before the editor moved to /edit.
  if (!page && isOwner && myUsername) {
    const own = await getPageServer();
    if (own) {
      page = {
        username: myUsername,
        data: own,
        indexable: true,
        live: true,
        sensitive: false,
        countOwnVisits: false,
        passwordProtected: false,
      };
    }
  }
  if (!page) notFound();

  // ── The owner's own page is never gated ────────────────────────────────
  // Offline, sensitive and password-protected are all things the owner has
  // asked to happen to VISITORS. Applying them to the owner would take away
  // the only view they have of their own live page — and, for a password, lock
  // them behind a screen they'd have to fill in to check their own work. So the
  // owner reads their page straight from their own RLS-scoped row: while a
  // password is set, `get_public_page` deliberately returns no content at all.
  //
  // `!page.live` is in this condition, not just `passwordProtected`, because
  // `get_public_page` withholds the content of an OFFLINE page too. Without it
  // the owner of a page they had taken offline would be handed a row with every
  // content column null — and `isEmpty` below would then congratulate them on
  // their empty page over the top of a page that is not empty at all.
  if ((page.passwordProtected || !page.live) && isOwner) {
    const own = await getPageServer();
    if (own) page = { ...page, data: own };
  }

  if (!isOwner) {
    // Offline is checked BEFORE the password: a page the owner has taken down
    // should say so, not first demand a password and only then admit it is
    // gone. (`get_public_page_unlocked` enforces the same precedence, so a
    // visitor who knows the password cannot resurrect it either.)
    //
    // Not `notFound()`: the username IS claimed, and telling a visitor it does
    // not exist would be a different — and wrong — answer from "taken down".
    if (!page.live) return <PageOffline username={page.username} />;

    if (page.passwordProtected) {
      // The cookie holds the password itself and is re-verified here on every
      // render (see ~/lib/page-unlock), so changing the password locks existing
      // visitors out immediately.
      const supplied = (await cookies()).get(
        pageUnlockCookie(page.username),
      )?.value;
      const unlocked = supplied
        ? await getPublicPageUnlockedServer(page.username, supplied)
        : null;
      if (!unlocked) return <PageUnlock username={page.username} />;
      page = unlocked;
    }
  }

  // Hide scheduled links that aren't live yet (or have expired) from visitors.
  // The owner still sees them in their editor. Rendered on the server so hidden
  // links never reach the client — no flash, no hydration mismatch.
  const publicData = {
    ...page.data,
    links: page.data.links.filter((link) => isLinkLive(link)),
  };
  const hiddenCount = page.data.links.length - publicData.links.length;

  const intro = publicData.intro;

  // `username` is what arms analytics inside ProfileView (recordView, and
  // recordClick per link) — withholding it for the owner keeps their own visits
  // and clicks out of their stats, which is how the old inline editor behaved by
  // never rendering the public view at all. The markup is otherwise identical.
  //
  // That exclusion used to be unconditional. It is now the DEFAULT rather than
  // the rule: `countOwnVisits` (Settings → Privacy) lets an owner opt into
  // being counted. Note what it can and cannot do — this branch only knows the
  // owner is the owner because they are signed in HERE, so opening your own
  // page signed out, or on a phone you never signed in on, still counts either
  // way. The setting says so.
  const trackAs = isOwner && !page.countOwnVisits ? undefined : page.username;

  // `get_public_page` LEFT JOINs, so a profile with no page row resolves to a
  // 200 with empty fields rather than a 404. A visitor should still get that
  // empty page, but for the owner it would be a blank screen with no hint of
  // what to do — so show them what this URL is and point at the editor. Never
  // redirect: they'd lose the ability to ever view their own live page.
  //
  // Deliberately generous about what counts as content: a page with no name and
  // no links can still be a real page (an avatar, a bio, a background, a music
  // card), and telling that owner it's empty would be both false and a way to
  // deny them the only view they have of their own live page.
  const isEmpty =
    !plainText(page.data.name) &&
    !plainText(page.data.bio) &&
    !page.data.avatar &&
    !page.data.background &&
    !page.data.music?.enabled &&
    !page.data.intro?.enabled &&
    page.data.links.length === 0;
  if (isOwner && isEmpty) {
    return (
      <main className="mx-auto flex min-h-[calc(100dvh-var(--nav-space))] w-full max-w-md flex-col items-center justify-center gap-4 px-6 py-16 text-center">
        <h1 className="font-semibold text-2xl tracking-tight">
          Your page is empty
        </h1>
        <p className="text-muted-foreground">
          This is your public link —{" "}
          <span className="text-foreground">stacked.page/{page.username}</span>.
          Visitors don't see anything here yet.
        </p>
        <Button asChild size="lg" className="mt-2">
          <Link href="/edit">Set up your page</Link>
        </Button>
      </main>
    );
  }

  const body = (
    // Full-bleed, unlike every other page: the negative top margin cancels the
    // root layout's navbar spacer so the creator's own background runs all the
    // way to the top of the viewport and our floating bar sits ON it, rather
    // than their page starting below a 5rem strip of stacked's black. The
    // padding puts it back as space, so nothing lands under the bar. This
    // element is the positioning context for ProfileView's `absolute inset-0`
    // background, which is why the margin has to be here and not on a wrapper.
    <main
      // Not your page? Then stacked's bar comes off it entirely — see the
      // `data-page-chrome` rule in globals.css. The OWNER keeps it (it is their
      // only way back to the dashboard from here) and can park it themselves
      // with the control on the bar, which is what makes this route previewable
      // rather than merely bare.
      data-page-chrome={isOwner ? undefined : "off"}
      className="relative mx-auto mt-[calc(var(--nav-space)*-1)] flex min-h-dvh w-full flex-col items-center justify-center px-6 pt-[calc(var(--nav-space)+1rem)] pb-28"
    >
      {/* No share control on the page right now. `~/components/share-button`
          still exists and still works — it is simply not mounted, pending a
          rework. Re-mounting it is this one line. */}
      {intro?.enabled ? (
        <EnterOverlay config={intro}>
          <ProfileView data={publicData} username={trackAs} />
        </EnterOverlay>
      ) : (
        <ProfileView data={publicData} username={trackAs} />
      )}
      {/* stacked's own pitch, on somebody else's page.

          Gated on `!myUsername` rather than on `!isOwner`, which is the stricter
          of the two and subsumes it: it hides the card on your own page (an ad
          for the thing you are looking at), AND on everyone else's once you have
          a page of your own. That second half is not a nicety — every route this
          card offers ends at /login, and /login redirects a signed-in visitor
          straight to their own editor, so for them the whole card is a button
          that says "claim your page for free" and goes to the page they already
          have. Someone signed in who has NOT claimed a name yet still sees it,
          because for them the offer is real.

          A sibling of the splash rather than a child of it, so it is not inside
          the EntryGate — it is our chrome, not part of the creator's page, and
          it waits for the splash on its own (see promo-card.tsx). The floating
          music pill owns the bottom-LEFT corner, so tell the card to lift clear
          of it on phones, where it is wide enough to reach across. */}
      {!myUsername ? (
        <PromoCard
          offsetForMusic={
            !!publicData.music?.enabled && publicData.music.display === "hidden"
          }
        />
      ) : null}
      {/* The editor is reached from the navbar's Studio link, not from a button
          down here. A floating "Edit page" pill used to live in this corner, and
          it was the one thing that made previewing your own page impossible:
          park the bar to see the page as visitors do, and a control no visitor
          can see was still sitting in the bottom-right of it.

          The cost is that an owner whose intro splash is enabled has to click
          through their own splash before the navbar is reachable — the splash is
          `fixed inset-0` at z-[100] and the bar sits at z-[45]. That is one
          click, on your own page, at the moment you were previewing anyway. */}
      {/* Scheduled and expired links are filtered above, so without this the
          owner just sees links missing from their own page and reads it as a
          bug. Left under the intro splash's z-[100]: there's nothing to explain
          until the page itself is visible. */}
      {isOwner && hiddenCount > 0 ? (
        <p className="fixed top-[var(--chrome-top)] left-4 z-40 max-w-[12rem] rounded-lg border border-border bg-background/90 px-3 py-2 text-muted-foreground text-xs backdrop-blur">
          {hiddenCount === 1
            ? "1 link is hidden right now"
            : `${hiddenCount} links are hidden right now`}{" "}
          — scheduled or expired.
        </p>
      ) : null}
    </main>
  );

  // The sensitive-content interstitial wraps the whole page rather than sitting
  // inside it, so it also covers the intro splash and our own promo card — a
  // visitor who has not yet said "yes, show me" should not be met by a
  // creator's full-screen splash, nor by an ad of ours over it.
  //
  // Deliberately not a security boundary, and it does not pretend to be: the
  // page has already been fetched by the time this renders (unlike the password
  // gate, where the database withholds the content outright), so this is a
  // courtesy screen of exactly the kind every other link-in-bio tool ships.
  return !isOwner && page.sensitive ? (
    <SensitiveGate username={page.username}>{body}</SensitiveGate>
  ) : (
    body
  );
}
