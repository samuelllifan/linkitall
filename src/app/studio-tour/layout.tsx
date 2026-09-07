import type { Metadata } from "next";
import type { ReactNode } from "react";

/**
 * Metadata for the temporary /studio-tour review page. It lives in a layout
 * because the page itself is a client component, which can't export `metadata`.
 */
export const metadata: Metadata = {
  title: "Studio tour",
  robots: { index: false, follow: false },
};

export default function StudioTourLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
