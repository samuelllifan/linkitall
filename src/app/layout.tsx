import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Footer } from "~/components/footer";
import { Navbar } from "~/components/navbar";
import { SessionGuard } from "~/components/session-guard";
import { createClient } from "~/lib/supabase/server";
import { UnsavedGuardProvider } from "~/lib/unsaved-guard";
import { ThemeProvider } from "./theme-provider";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "linkitall — one link for everything you make",
  description:
    "Build a link-in-bio and portfolio in minutes, customized with AI. Made for online creators.",
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
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", user.id)
      .maybeSingle();
    username = (data?.username as string | null) ?? null;
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} flex min-h-dvh flex-col`}>
        <ThemeProvider>
          <UnsavedGuardProvider>
            <SessionGuard />
            <Navbar userEmail={user?.email ?? null} username={username} />
            {children}
            <Footer />
          </UnsavedGuardProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
