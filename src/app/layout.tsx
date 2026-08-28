import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Footer } from "~/components/footer";
import { FooterSlot } from "~/components/footer-slot";
import { Navbar } from "~/components/navbar";
import { SessionGuard } from "~/components/session-guard";
import { WhatsNewDialog } from "~/components/whats-new-dialog";
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

export const metadata: Metadata = {
  metadataBase: new URL("https://stacked.page"),
  title: "stacked",
  description:
    "stacked is the fastest, easiest, and most customizable way to create your link-in-bio page.",
  openGraph: {
    title: "stacked",
    description:
      "stacked is the fastest, easiest, and most customizable way to create your link-in-bio page.",
    url: "https://stacked.page",
    siteName: "stacked",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "stacked",
    description:
      "stacked is the fastest, easiest, and most customizable way to create your link-in-bio page.",
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
          <Navbar
            userEmail={user?.email ?? null}
            username={username}
            isAdmin={isAdmin}
            avatarUrl={avatarUrl}
            displayName={displayName}
          />
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
