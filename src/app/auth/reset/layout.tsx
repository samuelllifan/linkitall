import type { Metadata } from "next";

/**
 * Exists only to name the tab — `page.tsx` here is a client component (it reads
 * the recovery session on mount) and cannot export `metadata` itself. Same
 * arrangement as `src/app/contact/layout.tsx`.
 */
export const metadata: Metadata = { title: "Choose a new password" };

export default function ResetLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
