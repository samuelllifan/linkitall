"use client";

import type { CSSProperties } from "react";
import { ProfileView } from "~/components/profile-view";
import type { PageData } from "~/lib/pages";
import { cn } from "~/lib/utils";

// A display-only DESKTOP preview of a real stacked page — the landscape
// companion to <ProfilePreview> (a clean, chrome-less screen; its landscape
// shape reads as "desktop" against the portrait phone). Same safety recipe:
// the real <ProfileView> with no `username` (no analytics), inert +
// pointer-events-none (not focusable/announced), and a relative overflow-hidden
// + transform frame so the page background stays clipped inside the screen.
export function BrowserPreview({
  data,
  className,
  style,
}: {
  data: PageData;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={cn(
        "relative transform-gpu overflow-hidden rounded-xl border border-white/10 bg-background shadow-2xl shadow-black/60",
        className,
      )}
      style={style}
    >
      {/* Viewport — ProfileView centered, its PageBackground filling this box.
          inert + aria-hidden: decorative mockup, not focusable or announced. */}
      <div
        inert
        aria-hidden="true"
        className="pointer-events-none relative flex h-full w-full flex-col items-center justify-center overflow-hidden px-6 py-4"
      >
        <ProfileView data={data} decorative />
      </div>
    </div>
  );
}
