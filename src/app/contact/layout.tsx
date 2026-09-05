import type { Metadata } from "next";

/**
 * Exists only to name the tab. `page.tsx` here is a client component (the form
 * holds its own state), and a client component cannot export `metadata` — so
 * the title has to come from a server file, and a one-line layout is the
 * cheapest one. See `src/app/auth/reset/layout.tsx`, which is here for the
 * same reason.
 */
export const metadata: Metadata = { title: "Contact us" };

export default function ContactLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
