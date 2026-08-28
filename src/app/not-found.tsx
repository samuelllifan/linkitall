import Link from "next/link";
import { StackedMark } from "~/components/stacked-mark";
import { Button } from "~/components/ui/button";

// Branded 404, shown for unknown routes and for `notFound()` (e.g. an unclaimed
// username). Renders inside the root layout, so it keeps the navbar and footer.
export default function NotFound() {
  return (
    <main className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-6 py-20 text-center">
      {/* Faint brand aurora so the empty state still feels part of the site. */}
      <div
        aria-hidden
        className="aurora-a pointer-events-none absolute left-1/2 top-1/2 h-[380px] w-[520px] max-w-[90vw] rounded-full opacity-[0.1] blur-[120px]"
        style={{ background: "var(--brand-grad)" }}
      />
      <StackedMark variant="brand" className="relative size-12" />
      <p className="relative mt-6 font-mono text-sm font-medium uppercase tracking-widest text-muted-foreground">
        404
      </p>
      <h1 className="relative mt-2 text-balance text-3xl font-bold tracking-tight sm:text-4xl">
        This page doesn&apos;t exist
      </h1>
      <p className="relative mt-3 max-w-md text-balance leading-relaxed text-muted-foreground">
        The page you&apos;re looking for may have been moved, or the username
        isn&apos;t claimed yet.
      </p>
      <div className="relative mt-8 flex flex-wrap items-center justify-center gap-3">
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
