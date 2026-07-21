import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProfileView } from "~/components/profile-view";
import { ShareButton } from "~/components/share-button";
import { getPageServer, getPublicPageServer } from "~/lib/pages.server";
import { createClient } from "~/lib/supabase/server";
import { plainText } from "~/lib/text";
import { MyPageClient } from "../my-page/my-page-client";

// Always render with fresh data from the database on each request.
export const dynamic = "force-dynamic";

// Rich link previews when a page URL is shared (the companion `opengraph-image`
// route supplies the image). Falls back gracefully for unknown usernames.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const page = await getPublicPageServer(username);
  if (!page) return { title: "linkitall" };

  const name = plainText(page.data.name) || `@${page.username}`;
  const description =
    plainText(page.data.bio) || `${name}'s links, all in one place.`;

  return {
    title: `${name} · linkitall`,
    description,
    openGraph: {
      type: "profile",
      title: name,
      description,
      siteName: "linkitall",
    },
    twitter: { card: "summary_large_image", title: name, description },
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
      return (
        <MyPageClient initialData={initialData} email={user.email ?? null} />
      );
    }
  }

  // Otherwise this is a public (or cross-account) view: read-only, resolved
  // through the public function.
  const page = await getPublicPageServer(username);
  if (!page) notFound();

  return (
    <main className="mx-auto flex min-h-[calc(100vh-3.5rem)] w-full max-w-lg flex-col items-center justify-center px-6 pt-16 pb-28">
      <ShareButton />
      <ProfileView data={page.data} username={page.username} />
    </main>
  );
}
