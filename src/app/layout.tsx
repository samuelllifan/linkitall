import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Footer } from "~/components/footer";
import { Navbar } from "~/components/navbar";
import { SessionGuard } from "~/components/session-guard";
import { createClient } from "~/lib/supabase/server";
import { UnsavedGuardProvider } from "~/lib/unsaved-guard";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

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
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("username, is_admin")
      .eq("id", user.id)
      .maybeSingle();
    username = (data?.username as string | null) ?? null;
    isAdmin = Boolean(data?.is_admin);
  }

  return (
    // Dark-only app: the `dark` class is hardcoded and never changes.
    <html lang="en" className="dark">
      <body className={`${inter.className} flex min-h-dvh flex-col`}>
        <UnsavedGuardProvider>
          <SessionGuard />
          <Navbar
            userEmail={user?.email ?? null}
            username={username}
            isAdmin={isAdmin}
          />
          {children}
          <Footer />
        </UnsavedGuardProvider>
      </body>
    </html>
  );
}
