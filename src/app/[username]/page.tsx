import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProfileView } from "~/components/profile-view";
import { ShareButton } from "~/components/share-button";
import { isLinkLive } from "~/lib/pages";
import {
  getPageServer,
  getPublicPageServer,
  type PublicPage,
} from "~/lib/pages.server";
import { createClient } from "~/lib/supabase/server";
import { plainText } from "~/lib/text";
import { MyPageClient } from "../my-page/my-page-client";

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

  // If the signed-in visitor owns this username, load and edit their page
  // through normal owner permissions — no public function required, so the
  // owner's page works even before the public-access migration is applied.
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", user.id)
      .maybeSingle();
    const myUsername = (data?.username as string | null) ?? null;
    if (myUsername && myUsername.toLowerCase() === username.toLowerCase()) {
      const initialData = await getPageServer();
      return <MyPageClient initialData={initialData} username={myUsername} />;
    }
  }

  // Otherwise this is a public (or cross-account) view: read-only, resolved
  // through the public function.
  const page = await getPublicPageServer(username);
  if (!page) notFound();

  // Hide scheduled links that aren't live yet (or have expired) from visitors.
  // The owner still sees them in their editor. Rendered on the server so hidden
  // links never reach the client — no flash, no hydration mismatch.
  const publicData = {
    ...page.data,
    links: page.data.links.filter((link) => isLinkLive(link)),
  };

  return (
    <main className="relative mx-auto flex min-h-[calc(100vh-3.5rem)] w-full flex-col items-center justify-center px-6 pt-16 pb-28">
      <ShareButton />
      <ProfileView data={publicData} username={page.username} />
    </main>
  );
}
