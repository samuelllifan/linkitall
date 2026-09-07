"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Renders the site footer everywhere except the editor.
 *
 * /edit is a fixed-height surface (`100dvh` minus the navbar) that owns its own
 * scrolling. A footer underneath it makes the document taller than the viewport,
 * so the whole editor scrolls away behind the site chrome while its fixed save
 * bar floats over whatever you scrolled to.
 *
 * A wrapper rather than a check inside `Footer` itself, so the footer stays a
 * server component — only this boundary ships to the client.
 */
/** Routes that mount the Studio shell and therefore own the whole viewport. */
const FULL_HEIGHT_ROUTES = new Set(["/edit", "/studio-demo"]);

export function FooterSlot({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (FULL_HEIGHT_ROUTES.has(pathname)) return null;
  return <>{children}</>;
}
