import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EnterOverlay } from "~/components/enter-overlay";
import { ProfileView } from "~/components/profile-view";
import { ShareButton } from "~/components/share-button";
import { Button } from "~/components/ui/button";
import { isLinkLive } from "~/lib/pages";
import {
  getPageServer,
  getPublicPageServer,
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
  if (!page) return { title: "stacked" };

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
    title: `@${page.username} · stacked`,
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
    if (own) page = { username: myUsername, data: own, indexable: true };
  }
  if (!page) notFound();

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
  const trackAs = isOwner ? undefined : page.username;

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
      <main className="mx-auto flex min-h-[calc(100dvh-3.5rem)] w-full max-w-md flex-col items-center justify-center gap-4 px-6 py-16 text-center">
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

  return (
    <main className="relative mx-auto flex min-h-[calc(100dvh-3.5rem)] w-full flex-col items-center justify-center px-6 pt-16 pb-28">
      <ShareButton />
      {intro?.enabled ? (
        <EnterOverlay config={intro}>
          <ProfileView data={publicData} username={trackAs} />
        </EnterOverlay>
      ) : (
        <ProfileView data={publicData} username={trackAs} />
      )}
      {isOwner ? (
        <>
          {/* Scheduled and expired links are filtered above, so without this the
              owner just sees links missing from their own page and reads it as a
              bug. Left under the intro splash's z-[100]: there's nothing to
              explain until the page itself is visible. */}
          {hiddenCount > 0 ? (
            <p className="fixed top-[4.5rem] left-4 z-40 max-w-[12rem] rounded-lg border border-border bg-background/90 px-3 py-2 text-muted-foreground text-xs backdrop-blur">
              {hiddenCount === 1
                ? "1 link is hidden right now"
                : `${hiddenCount} links are hidden right now`}{" "}
              — scheduled or expired.
            </p>
          ) : null}
          {/* Above the intro splash (z-[100]), which is `fixed inset-0` and locks
              body scroll: at a lower layer the owner would be sealed out of their
              own editor by their own splash screen. */}
          <Link
            href="/edit"
            className="fixed right-4 bottom-[calc(1.5rem+env(safe-area-inset-bottom))] z-[110] flex items-center gap-2 rounded-full border border-border bg-background/90 px-4 py-2 font-medium text-foreground text-sm shadow-lg backdrop-blur transition-colors hover:bg-muted"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="size-4"
            >
              <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
            Edit page
          </Link>
        </>
      ) : null}
    </main>
  );
}
