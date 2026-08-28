"use client";

import type { CSSProperties } from "react";
import { ProfileView } from "~/components/profile-view";
import type { PageData } from "~/lib/pages";
import { cn } from "~/lib/utils";

// A non-interactive, display-only stacked profile inside a phone-like frame,
// for the landing hero. We render the REAL <ProfileView> — the same component
// the public pages use — so the mockup is always authentic, never a screenshot.
//
// - No `username` prop  => no analytics recorded (recordView/recordClick skip).
// - `pointer-events-none` => links don't navigate, no music, no preview popovers.
// - The frame is `relative overflow-hidden` + a transform (`transform-gpu`) so
//   ProfileView's absolutely-positioned PageBackground stays clipped inside the
//   "screen" and becomes the containing block for any fixed descendants,
//   instead of escaping across the whole hero.
export function ProfilePreview({
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
        "relative transform-gpu overflow-hidden rounded-[2rem] border border-white/10 bg-background shadow-2xl shadow-black/60",
        className,
      )}
      style={style}
    >
      {/* inert + aria-hidden: this is a decorative mockup — its links/heading
          must not be keyboard-focusable or announced by screen readers.
          pointer-events-none stays as a fallback for engines without inert. */}
      <div
        inert
        aria-hidden="true"
        className="pointer-events-none relative flex h-full w-full flex-col items-center justify-center px-5 py-9"
      >
        <ProfileView data={data} decorative />
      </div>
    </div>
  );
}
