import Link from "next/link";
import { StackedMark } from "~/components/stacked-mark";
import { Button } from "~/components/ui/button";

// Branded 404, shown for unknown routes and for `notFound()` (e.g. an unclaimed
// username). Renders inside the root layout, so it keeps the navbar and footer.
export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
      <StackedMark className="size-12 text-muted-foreground" />
      <p className="mt-6 text-sm font-medium uppercase tracking-widest text-muted-foreground">
        404
      </p>
      <h1 className="mt-2 text-balance text-3xl font-bold tracking-tight sm:text-4xl">
        This page doesn&apos;t exist
      </h1>
      <p className="mt-3 max-w-md text-balance leading-relaxed text-muted-foreground">
        The page you&apos;re looking for may have been moved, or the username
        isn&apos;t claimed yet.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Button asChild size="lg">
          <Link href="/">Back home</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/my-page">Create your page</Link>
        </Button>
      </div>
    </main>
  );
}
