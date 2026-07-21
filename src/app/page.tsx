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
      <section className="relative overflow-hidden bg-accent/30">
        {/* Layered color glows — a richer gradient wash that stays dark and
            sleek. Each blob is heavily blurred and low-opacity, brightening a
            touch in dark mode so the color reads against the near-black base. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden"
        >
          {/* Top-right: indigo → violet → fuchsia, anchored behind the mockup. */}
          <div className="absolute -top-32 -right-24 aspect-square w-[42rem] rounded-full bg-gradient-to-br from-indigo-500/25 via-violet-500/20 to-fuchsia-500/20 blur-[100px] dark:from-indigo-500/35 dark:via-violet-500/25 dark:to-fuchsia-500/25" />
          {/* Bottom-left: cool sky/blue rising from the corner. */}
          <div className="absolute -bottom-40 -left-28 aspect-square w-[38rem] rounded-full bg-gradient-to-tr from-sky-500/20 via-blue-500/15 to-transparent blur-[100px] dark:from-sky-500/25 dark:via-blue-500/20" />
          {/* Soft violet core to fill the middle and tie the two together. */}
          <div className="absolute top-1/2 left-1/3 aspect-square w-[26rem] -translate-y-1/2 rounded-full bg-fuchsia-600/10 blur-[120px] dark:bg-fuchsia-600/15" />
        </div>
        <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-12 px-6 py-20 lg:grid-cols-2 lg:py-28">
          {/* Left: copy */}
          <div className="flex flex-col gap-6">
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              For online creators
            </span>
            <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              One link for everything you make, all in one place
            </h1>
            <p className="max-w-md text-lg leading-relaxed text-muted-foreground">
              linkitall brings your platforms, projects, and profiles together
              in a single, beautiful page. Build it in minutes, make it yours
              with deep customization, and share it anywhere.
            </p>
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Button asChild size="lg">
                <Link href="/my-page">
                  {signedIn ? "Go to your page" : "Create your page"}
                </Link>
              </Button>
              {!signedIn && (
                <Link
                  href="/login"
                  className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                >
                  Already have an account?
                </Link>
              )}
            </div>
          </div>

          {/* Right: page-preview mockup inside the blob */}
          <div className="relative flex justify-center lg:justify-end">
            <PagePreview />
          </div>
        </div>
      </section>

      {/* Feature row */}
      <section className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-10 px-6 py-20 md:grid-cols-3">
        {features.map((feature) => (
          <div key={feature.title} className="flex flex-col gap-3">
            <div className="flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground">
              {feature.icon}
            </div>
            <h3 className="text-lg font-semibold">{feature.title}</h3>
            <p className="leading-relaxed text-muted-foreground">
              {feature.description}
            </p>
          </div>
        ))}
      </section>
    </main>
  );
}

/* A stylized link-in-bio preview — the product itself, shown as the hero art. */
function PagePreview() {
  return (
    <div className="relative w-full max-w-xs rounded-3xl border bg-card p-6 shadow-2xl">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-8"
          >
            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className="text-sm font-semibold">@yourname</div>
          <div className="text-xs text-muted-foreground">
            Designer · Photographer · Art Director
          </div>
        </div>
      </div>
      <div className="mt-6 flex flex-col gap-3">
        {socials.map((social) => (
          <div
            key={social.label}
            className="flex h-11 items-center justify-center gap-2 rounded-xl border bg-background text-sm font-medium shadow-sm"
          >
            {social.icon}
            {social.label}
          </div>
        ))}
      </div>
    </div>
  );
}

const socials = [
  {
    label: "Instagram",
    icon: (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="currentColor"
        className="size-4"
      >
        <path d="M12 2.2c3.2 0 3.6 0 4.9.07 1.17.05 1.8.25 2.23.42.56.22.96.48 1.38.9.42.42.68.82.9 1.38.17.42.37 1.06.42 2.23.06 1.3.07 1.68.07 4.9s0 3.6-.07 4.9c-.05 1.17-.25 1.8-.42 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.17-1.06.37-2.23.42-1.3.06-1.68.07-4.9.07s-3.6 0-4.9-.07c-1.17-.05-1.8-.25-2.23-.42-.56-.22-.96-.48-1.38-.9-.42-.42-.68-.82-.9-1.38-.17-.42-.37-1.06-.42-2.23C2.21 15.6 2.2 15.2 2.2 12s0-3.6.07-4.9c.05-1.17.25-1.8.42-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.17 1.06-.37 2.23-.42C8.4 2.21 8.8 2.2 12 2.2Zm0 1.8c-3.15 0-3.5.01-4.75.07-.9.04-1.38.19-1.7.32-.43.16-.73.36-1.05.68-.32.32-.52.62-.68 1.05-.13.32-.28.8-.32 1.7C3.21 9.35 3.2 9.7 3.2 12s.01 2.65.07 3.9c.04.9.19 1.38.32 1.7.16.43.36.73.68 1.05.32.32.62.52 1.05.68.32.13.8.28 1.7.32 1.25.06 1.6.07 4.75.07s3.5-.01 4.75-.07c.9-.04 1.38-.19 1.7-.32.43-.16.73-.36 1.05-.68.32-.32.52-.62.68-1.05.13-.32.28-.8.32-1.7.06-1.25.07-1.6.07-3.9s-.01-2.65-.07-3.9c-.04-.9-.19-1.38-.32-1.7a2.8 2.8 0 0 0-.68-1.05 2.8 2.8 0 0 0-1.05-.68c-.32-.13-.8-.28-1.7-.32C15.5 4.01 15.15 4 12 4Zm0 3.06A4.94 4.94 0 1 1 12 16.94 4.94 4.94 0 0 1 12 7.06Zm0 1.8a3.14 3.14 0 1 0 0 6.28 3.14 3.14 0 0 0 0-6.28Zm5.14-.9a1.15 1.15 0 1 1-2.3 0 1.15 1.15 0 0 1 2.3 0Z" />
      </svg>
    ),
  },
  {
    label: "TikTok",
    icon: (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="currentColor"
        className="size-4"
      >
        <path d="M16.6 5.82a4.28 4.28 0 0 1-1.05-2.82h-3.1v12.4a2.52 2.52 0 1 1-2.5-2.9c.26 0 .52.04.76.11v-3.2a5.7 5.7 0 0 0-.76-.05 5.67 5.67 0 1 0 5.67 5.67V8.9a7.34 7.34 0 0 0 4.3 1.38V7.16a4.28 4.28 0 0 1-3.27-1.34Z" />
      </svg>
    ),
  },
  {
    label: "YouTube",
    icon: (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="currentColor"
        className="size-4"
      >
        <path d="M23.5 6.5a3 3 0 0 0-2.1-2.12C19.5 3.86 12 3.86 12 3.86s-7.5 0-9.4.52A3 3 0 0 0 .5 6.5 31.2 31.2 0 0 0 0 12a31.2 31.2 0 0 0 .5 5.5 3 3 0 0 0 2.1 2.12c1.9.52 9.4.52 9.4.52s7.5 0 9.4-.52a3 3 0 0 0 2.1-2.12A31.2 31.2 0 0 0 24 12a31.2 31.2 0 0 0-.5-5.5ZM9.6 15.57V8.43L15.8 12l-6.2 3.57Z" />
      </svg>
    ),
  },
  {
    label: "X",
    icon: (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="currentColor"
        className="size-4"
      >
        <path d="M18.9 2.5h3.3l-7.2 8.24L23.5 21.5h-6.63l-5.2-6.8-5.95 6.8H2.4l7.7-8.8L1.5 2.5h6.8l4.7 6.2 5.9-6.2Zm-1.16 17h1.83L7.34 4.4H5.38l12.36 15.1Z" />
      </svg>
    ),
  },
];

const features = [
  {
    title: "Everything in one place",
    description:
      "Collect all your links, socials, and projects on a single page so your audience always knows where to find you.",
    icon: (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-5"
      >
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </svg>
    ),
  },
  {
    title: "Customize freely",
    description:
      "Tweak colors, layout, and backgrounds to make your page truly yours, quickly and easily. Or start from a preset template to match any vibe in seconds.",
    icon: (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-5"
      >
        <path d="M12 3v2m0 14v2m9-9h-2M5 12H3m14.66-6.66-1.42 1.42M7.76 16.24l-1.42 1.42m0-11.32 1.42 1.42m8.48 8.48 1.42 1.42" />
        <circle cx="12" cy="12" r="4" />
      </svg>
    ),
  },
  {
    title: "Know what's working",
    description:
      "Built-in analytics show your views and clicks, so you can see what resonates and grow your audience.",
    icon: (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-5"
      >
        <path d="M3 3v18h18" />
        <path d="M7 15l4-4 3 3 5-6" />
      </svg>
    ),
  },
];
