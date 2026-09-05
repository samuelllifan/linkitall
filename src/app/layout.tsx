import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Footer } from "~/components/footer";
import { FooterSlot } from "~/components/footer-slot";
import { Navbar } from "~/components/navbar";
import { SelectionMotion } from "~/components/selection-motion";
import { SessionGuard } from "~/components/session-guard";
import { WhatsNewDialog } from "~/components/whats-new-dialog";
import { SITE_DESCRIPTION, SITE_TITLE } from "~/lib/site-meta";
import { createClient } from "~/lib/supabase/server";
import { UnsavedGuardProvider } from "~/lib/unsaved-guard";
import "./globals.css";

// Inter carries the whole UI; JetBrains Mono is the "technical" accent voice —
// @handles, stat counters, eyebrow labels, timestamps. Both wired as CSS
// variables so Tailwind's `font-sans` / `font-mono` utilities resolve to them.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
});

// Copy lives in `~/lib/site-meta` rather than inline: the same description has
// to appear in three places here plus the share card, and when it was written
// out four times it went stale in all four.
//
// `title` is a default + a template, not a plain string. `default` stays the
// bare wordmark for anything that sets no title of its own — a tagline here
// would put the landing page's pitch in the tab of /dashboard and /edit — and
// `template` is what lets every route name itself in one word ("Settings",
// "Dashboard") and still be identifiable in a strip of pinned tabs. Before
// this, every route but four rendered the same "stacked", so a creator with
// the Studio, their dashboard and their live page open had three
// indistinguishable tabs.
//
// The separator is "·", which is what the profile route already used; /terms
// and /privacy had hand-written "— stacked" suffixes and are now on the
// template like everything else. A page that must NOT be suffixed (the landing
// page, whose title is a full sentence) passes `title: { absolute: … }`.
export const metadata: Metadata = {
  metadataBase: new URL("https://stacked.page"),
  title: { default: "stacked", template: "%s · stacked" },
  description: SITE_DESCRIPTION,
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: "https://stacked.page",
    siteName: "stacked",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
};

// The app is dark-only: pin the mobile browser chrome (address bar, status bar)
// to the page background so it blends in instead of flashing white. Zoom is left
// enabled — pinch-to-zoom is an accessibility affordance, not something to lock.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0a0a0a",
  colorScheme: "dark",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let username: string | null = null;
  let isAdmin = false;
  // The navbar avatar mirrors the one on the owner's own page: their uploaded
  // picture when set, else the first letter of their page name (matching
  // profile-view's fallback). Both live on the `pages` row, not `profiles`.
  let avatarUrl: string | null = null;
  let displayName: string | null = null;
  if (user) {
    const [{ data: profile }, { data: page }] = await Promise.all([
      supabase
        .from("profiles")
        .select("username, is_admin")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("pages")
        .select("avatar, name")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);
    username = (profile?.username as string | null) ?? null;
    isAdmin = Boolean(profile?.is_admin);
    avatarUrl = (page?.avatar as string | null) ?? null;
    displayName = (page?.name as string | null) ?? null;
  }

  return (
    // Dark-only app: the `dark` class is hardcoded and never changes.
    <html lang="en" className="dark scroll-smooth">
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} flex min-h-dvh flex-col font-sans`}
      >
        <UnsavedGuardProvider>
          <SessionGuard />
          {/* Arms the animated ::selection highlight (globals.css) while text is
              selected. Renders nothing. */}
          <SelectionMotion />
          <Navbar
            userEmail={user?.email ?? null}
            username={username}
            isAdmin={isAdmin}
            avatarUrl={avatarUrl}
            displayName={displayName}
          />
          {/* The navbar is a fixed floating island, so it occupies no document
              flow. This spacer stands in for it, which keeps every page's own
              top spacing measured from below the bar exactly as it was when the
              bar was part of the page. A page that wants to run its background
              up UNDER the bar (the public profile page) cancels this with a
              negative margin rather than the spacer being made conditional. */}
          <div aria-hidden className="h-[var(--nav-space)] shrink-0" />
          {children}
          <FooterSlot>
            <Footer />
          </FooterSlot>
          {/* Mounted globally so the footer "What's new" link works on every
              page; auto-shows only on the owner's own page (see the component). */}
          <WhatsNewDialog ownUsername={username} />
        </UnsavedGuardProvider>
      </body>
    </html>
  );
}
