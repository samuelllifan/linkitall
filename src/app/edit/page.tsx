import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "~/components/ui/button";
import { mfaChallengePath, needsMfaChallenge } from "~/lib/mfa.server";
import { getPageForEdit } from "~/lib/pages.server";
import { queryUsername } from "~/lib/profiles";
import { createClient } from "~/lib/supabase/server";
import { StudioClient } from "./studio-client";

// The page editor. A dedicated surface rather than an overlay on /<username>:
// the public page stays exactly what visitors see, and this owns the whole
// viewport for the controls-plus-live-preview layout.
//
// Loads the signed-in user's own page through owner RLS (getPageForEdit), NOT
// through getPublicPageServer — the public mapper drops `styles.bgMemory`, so
// loading that way would make the first save wipe the user's remembered
// per-type background settings.

export const dynamic = "force-dynamic";

// "Studio", matching the navbar link — the tab and the thing you clicked to get
// here should agree on what this screen is called.
export const metadata: Metadata = { title: "Studio" };

export default async function EditPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/edit");

  // 2FA, if the account has it: an aal1 session gets no further than here. The
  // gate lives on the routes rather than in the sign-in form so it covers
  // Google sign-in too — see ~/lib/mfa.server.
  if (await needsMfaChallenge(supabase)) {
    redirect(mfaChallengePath("/edit"));
  }

  // A page lives at /<username>, so there is nothing to edit until one is
  // picked. Same hop /my-page has always made.
  const username = await queryUsername(supabase);
  if (!username) redirect("/settings");

  const result = await getPageForEdit();
  // A read failure must not open a blank editor over a page that exists — the
  // next save would upsert the blank draft over the real row. Say so instead.
  if (!result.ok) {
    return (
      <main className="mx-auto flex min-h-[calc(100dvh-var(--nav-space))] w-full max-w-md flex-col items-center justify-center gap-4 px-6 py-16 text-center">
        <h1 className="font-semibold text-2xl tracking-tight">
          Couldn't load your page
        </h1>
        <p className="text-muted-foreground">
          Your page is safe — we just couldn't read it right now. Try again in a
          moment.
        </p>
        <Button asChild size="lg" className="mt-2">
          <Link href="/edit">Retry</Link>
        </Button>
      </main>
    );
  }

  return <StudioClient initialData={result.data} username={username} />;
}
