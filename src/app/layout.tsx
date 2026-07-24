import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Footer } from "~/components/footer";
import { Navbar } from "~/components/navbar";
import { SessionGuard } from "~/components/session-guard";
import { createClient } from "~/lib/supabase/server";
import { UnsavedGuardProvider } from "~/lib/unsaved-guard";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "linkitall",
  description:
    "Build a fully customizable link-in-bio in minutes. Made for online creators.",
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
