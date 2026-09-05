"use client";

import { useEffect } from "react";
import { AuroraGlow } from "~/components/aurora-glow";
import { StackedMark } from "~/components/stacked-mark";
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
    <main className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-6 py-20 text-center">
      {/* Faint brand aurora, dimmer than the 404's so an error screen stays
          calm. */}
      <AuroraGlow className="opacity-[0.08]" />
      <StackedMark className="relative size-12 text-muted-foreground" />
      <p className="relative mt-6 font-mono text-sm font-medium uppercase tracking-widest text-muted-foreground">
        Error
      </p>
      <h1 className="relative mt-2 text-balance text-3xl font-bold tracking-tight sm:text-4xl">
        Something went wrong
      </h1>
      <p className="relative mt-3 max-w-md text-balance leading-relaxed text-muted-foreground">
        An unexpected error occurred on our end. You can try again, or head back
        home.
      </p>
      <div className="relative mt-8 flex flex-wrap items-center justify-center gap-3">
        <Button size="lg" onClick={reset}>
          Try again
        </Button>
        <Button asChild size="lg" variant="outline">
          {/* A plain anchor (full reload) rather than a client-side Link: it
              guarantees a clean slate away from whatever state broke. */}
          <a href="/">Back home</a>
        </Button>
      </div>
      {error.digest ? (
        <p className="mt-6 text-xs text-muted-foreground">
          Reference: {error.digest}
        </p>
      ) : null}
    </main>
  );
}
