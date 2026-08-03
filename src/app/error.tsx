"use client";

import { useEffect } from "react";
import { Button } from "~/components/ui/button";

// Root error boundary. Replaces Next.js's unstyled default with an on-brand
// screen and a retry that re-renders the failed segment. Renders inside the
// root layout, so the navbar and footer stay in place.
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface the error for debugging (and any attached logging).
    console.error(error);
  }, [error]);

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
      <h1 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
        Something went wrong
      </h1>
      <p className="mt-3 max-w-md text-balance leading-relaxed text-muted-foreground">
        An unexpected error occurred on our end. You can try again, or head back
        home.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Button size="lg" onClick={reset}>
          Try again
        </Button>
        <Button asChild size="lg" variant="outline">
          {/* A plain anchor (full reload) rather than a client-side Link: it
              guarantees a clean slate away from whatever state broke. */}
          <a href="/">Back home</a>
        </Button>
      </div>
    </main>
  );
}
