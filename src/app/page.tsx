import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center gap-8 p-8">
      <div className="flex flex-col items-center gap-4 text-center">
        <h1 className="text-4xl font-bold tracking-tight">
          Welcome to your Lumos App
        </h1>
        <p className="max-w-md text-lg text-muted-foreground">
          A starter template with a notes app backed by localStorage. Get
          started by exploring the{" "}
          <Link href="/notes" className="underline hover:text-foreground">
            Notes
          </Link>{" "}
          page or editing{" "}
          <code className="rounded bg-muted px-2 py-1 font-mono text-sm">
            src/app/page.tsx
          </code>
        </p>
      </div>
    </main>
  );
}
