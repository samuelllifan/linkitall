import Link from "next/link";
import { Button } from "~/components/ui/button";
import { createClient } from "~/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const signedIn = Boolean(user);

  return (
    <main className="flex flex-1 flex-col">
      {/* Hero */}
      <section className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-24 text-center">
        <h1 className="max-w-2xl text-balance text-4xl font-bold tracking-tight sm:text-6xl">
          All of you, all here.
        </h1>
        <p className="max-w-xl text-balance text-lg leading-relaxed text-muted-foreground">
          linkitall brings your platforms, projects, and profiles together in
          one organized space.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Button asChild size="lg">
            <Link href="/my-page">
              {signedIn ? "Go to your page" : "Create your page"}
            </Link>
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          {signedIn
            ? "Pick up right where you left off."
            : "Set up in minutes. Share it anywhere."}
        </p>
      </section>
    </main>
  );
}
