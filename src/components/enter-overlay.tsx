"use client";

import { type ReactNode, useCallback, useEffect, useState } from "react";
import { EntryGate } from "~/components/entry-gate";
import { styleToCss } from "~/components/profile-view";
import {
  DEFAULT_INTRO_SUBTEXT_STYLE,
  DEFAULT_INTRO_TEXT_STYLE,
  type IntroConfig,
} from "~/lib/intro";
import { lockBodyScroll, unlockBodyScroll } from "~/lib/scroll-lock";
import { cn } from "~/lib/utils";

/**
 * A full-screen "click to enter" splash (guns.lol-style). It sits on top of the
 * page and, on the visitor's first click or keypress, fades away to reveal it.
 *
 * Starting music on enter: the page behind the splash is wrapped in an
 * `EntryGate`, so `MusicPlayer` knows not to autoplay until the visitor has
 * actually entered — a page with a splash stays silent behind it even where
 * the browser would have permitted autoplay. The overlay also deliberately
 * does NOT stop the click's propagation, so the real pointer gesture bubbles
 * to `window`, where the gated player is listening for it (see
 * music-player.tsx): that same click both dismisses the splash and starts the
 * track, inside the gesture, which is what strict autoplay policies require.
 * Set the page's music to `autoplay: true` for "enter starts the music".
 *
 * The app is dark-only and intentionally does not gate on prefers-reduced-motion.
 */
export function EnterOverlay({
  config,
  children,
  onEnter,
}: {
  config: IntroConfig;
  /**
   * The page itself — rendered behind the splash. Optional: omit it to use the
   * overlay as a standalone splash layer over whatever is already on screen
   * (e.g. an editor preview).
   */
  children?: ReactNode;
  /** Fired once, when the visitor enters. */
  onEnter?: () => void;
}) {
  // `entered` starts the fade-out; `mounted` keeps the layer in the DOM until
  // the fade finishes so it can animate out rather than vanish.
  const [entered, setEntered] = useState(false);
  const [mounted, setMounted] = useState(true);

  const enter = useCallback(() => {
    setEntered((already) => {
      if (!already) onEnter?.();
      return true;
    });
  }, [onEnter]);

  // Lock page scroll while the splash covers everything, so a visitor can't
  // scroll the hidden page behind it. Restored the moment they enter.
  //
  // The `data-intro-splash` marker lets other overlays notice that the splash
  // owns the screen — the What's New dialog waits for it rather than opening
  // invisibly underneath (this is the top layer at z-[100]).
  useEffect(() => {
    if (entered) return;
    lockBodyScroll();
    document.documentElement.setAttribute("data-intro-splash", "");
    return () => {
      document.documentElement.removeAttribute("data-intro-splash");
      unlockBodyScroll();
    };
  }, [entered]);

  if (!config.enabled) return <>{children}</>;

  // The CTA is styled by the SAME TextStyle pipeline as the name/bio, merged
  // over a heading-like default (and falling back to the legacy `color`). The
  // splash is always dark, so adapt colors for a dark backdrop.
  const introStyle = { ...DEFAULT_INTRO_TEXT_STYLE, ...config.textStyle };
  if (!introStyle.color && config.color) introStyle.color = config.color;
  const color = introStyle.color || "#ffffff";

  // The subtitle uses the SAME TextStyle pipeline as the CTA. When no color is
  // picked it stays the muted default (a soft white), matching its original look.
  const subStyle = { ...DEFAULT_INTRO_SUBTEXT_STYLE, ...config.subtextStyle };

  return (
    <>
      <EntryGate entered={entered}>{children}</EntryGate>
      {mounted && (
        <button
          type="button"
          aria-label={config.text || "Click to enter"}
          onClick={enter}
          onTransitionEnd={() => {
            if (entered) setMounted(false);
          }}
          className={cn(
            "fixed inset-0 z-[100] flex cursor-pointer flex-col items-center justify-center gap-6 px-6 text-center outline-none transition-opacity duration-700 ease-out",
            config.backdrop === "blur"
              ? "bg-black/40 backdrop-blur-2xl"
              : "bg-black/90",
            entered && "pointer-events-none opacity-0",
          )}
          style={{ color }}
        >
          <span className="animate-enter-rise flex flex-col items-center gap-6">
            <span className="flex flex-col items-center gap-2">
              <span
                className="animate-enter-breathe break-words"
                style={styleToCss(introStyle, true)}
              >
                {config.text || "click to enter"}
              </span>
              {config.subtext ? (
                <span
                  className={cn(
                    "max-w-xs break-words",
                    !subStyle.color && "text-white/60",
                  )}
                  style={styleToCss(subStyle, true)}
                >
                  {config.subtext}
                </span>
              ) : null}
            </span>
          </span>
        </button>
      )}
    </>
  );
}
