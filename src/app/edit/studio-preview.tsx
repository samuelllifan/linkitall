"use client";

/**
 * The live preview pane: the REAL <ProfileView> rendered from the draft (with
 * `selectable` on), inside a device frame. Every editable element carries a
 * `data-select` marker; hovering one outlines it, and clicking it selects it —
 * which jumps the left panel to that element's exact control. Background is the
 * fallback when the click lands on empty space.
 *
 * The music card is the one element whose controls are the card: it renders in
 * the player's editing mode here, so the cover, the title / artist / album (each
 * with its own type toolbar) and the clip window are edited in place.
 */

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { EnterOverlay } from "~/components/enter-overlay";
import { ProfileView } from "~/components/profile-view";
import { CloseIcon } from "~/components/ui/close-icon";
import type { MusicConfig } from "~/lib/music";
import { isLinkLive } from "~/lib/pages";
import { cn } from "~/lib/utils";
import { type DeviceMode, type Selection, useStudio } from "./studio-context";

/** In "auto", the preview pane must be at least this wide to show the desktop
 *  frame; below it the phone frame fits better. */
const AUTO_DESKTOP_MIN = 700;

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function ReplayIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M3 12a9 9 0 1 0 3-6.7M3 4v4h4" />
    </svg>
  );
}

function AutoIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4" />
    </svg>
  );
}

function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <rect x="7" y="2" width="10" height="20" rx="2" />
      <path d="M11 18h2" />
    </svg>
  );
}

function MonitorIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}

/** A rect in the frame's content coordinate space, for the outlines. */
type Box = { top: number; left: number; width: number; height: number };

/**
 * The position of `el` in the scroll container's CONTENT coordinates (so the
 * absolutely-positioned outline scrolls with the element automatically).
 */
function rectIn(root: HTMLElement, el: Element): Box {
  const r = el.getBoundingClientRect();
  const rr = root.getBoundingClientRect();
  return {
    top: r.top - rr.top + root.scrollTop,
    left: r.left - rr.left + root.scrollLeft,
    width: r.width,
    height: r.height,
  };
}

export function StudioPreview() {
  const { data, setData, selection, select, deviceMode, setDeviceMode, view } =
    useStudio();
  const paneRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [box, setBox] = useState<Box | null>(null);
  const [hoverBox, setHoverBox] = useState<Box | null>(null);
  const hoverElRef = useRef<Element | null>(null);
  // Live width of the preview pane; drives the "auto" device choice.
  const [paneWidth, setPaneWidth] = useState(0);
  // Bumped by the ResizeObserver to force the outline to recompute on resize.
  const [tick, setTick] = useState(0);
  // "View as a visitor": replays the real entry experience (intro splash, music
  // autoplay, live links) with click-to-select off. The nonce remounts that
  // subtree so Replay / re-entering plays the intro & music from the top.
  const [playing, setPlaying] = useState(false);
  const [playNonce, setPlayNonce] = useState(0);
  const startPlay = () => {
    setPlaying(true);
    setPlayNonce((n) => n + 1);
  };

  // A pinned desktop frame is only honest when the pane can host one, so a
  // measured-narrow pane overrides the preference — that covers dragging the
  // divider until the preview is too narrow, and a "desktop" pref chosen on a
  // laptop being carried into the phone layout. A pane width of 0 means "not
  // measured yet" (before the first ResizeObserver callback, or while the phone
  // layout keeps this pane hidden), which must not downgrade a pinned frame.
  const narrow = paneWidth > 0 && paneWidth < AUTO_DESKTOP_MIN;
  // In "auto", the frame simply follows the available width.
  const device: DeviceMode = narrow
    ? "mobile"
    : deviceMode === "auto"
      ? paneWidth >= AUTO_DESKTOP_MIN
        ? "desktop"
        : "mobile"
      : deviceMode;

  // Resolve a clicked element to its selection via the nearest `data-select`
  // marker; empty space falls back to the background.
  //
  // This runs in the capture phase, and stopping propagation there is what
  // keeps a click from *also* doing what it would do on the real page: in the
  // editor you're pointing at a thing to change it, not using it. Without the
  // stop, the click still reaches the element's own handler underneath —
  // copying a Discord username, hitting play on the music player, and so on.
  // (preventDefault alone only covers default actions like following an <a>.)
  function handleClick(e: React.MouseEvent) {
    const marker = (e.target as HTMLElement).closest<HTMLElement>(
      "[data-select]",
    );
    const id = marker?.dataset.select;
    // The music card is the exception: it renders its own editors, so its clicks
    // have to land — swallowing them would leave the cover button, the metadata
    // fields and the clip window inert, which is exactly the gap this closes.
    // Route the left panel to Music on the way past, but only when it isn't
    // already there, so working inside the card doesn't re-flash the panel on
    // every click.
    if (id === "music") {
      if (selection !== "music") select("music");
      return;
    }
    // Nothing else in the preview should *do* anything while editing, marker or
    // not — an unmarked control (the mini music pill, say) would otherwise still
    // fire its own handler on the way down.
    e.preventDefault();
    e.stopPropagation();
    // A tap on empty space selects the background, but it's also just how you
    // look around the preview — don't yank the phone layout back to the controls.
    if (id) select(id as Selection);
    else select("background", false);
  }

  // Outline the element under the cursor so it's clear everything is editable.
  // Pointer-type-gated: a touch has no hover state, and a tap would otherwise
  // leave the outline stranded on whatever was last touched (nothing fires the
  // leave handler on the way out).
  function handleMove(e: React.PointerEvent) {
    const root = frameRef.current;
    if (!root) return;
    if (e.pointerType !== "mouse") {
      handleLeave();
      return;
    }
    const marker = (e.target as HTMLElement).closest("[data-select]");
    if (marker === hoverElRef.current) return;
    hoverElRef.current = marker;
    setHoverBox(marker ? rectIn(root, marker) : null);
  }

  function handleLeave() {
    hoverElRef.current = null;
    setHoverBox(null);
  }

  // While editing, never autoplay the page's track — the preview should be
  // silent until the owner asks. (Editing music still flows through otherwise.)
  const previewData = data.music?.autoplay
    ? { ...data, music: { ...data.music, autoplay: false } }
    : data;

  // "View as a visitor" has to agree with the real public page, which filters
  // scheduled and expired links on the server (see [username]/page.tsx). Without
  // this, a link scheduled for next week would show up in the very preview meant
  // to prove what visitors actually see.
  const visitorData = {
    ...data,
    links: data.links.filter((link) => isLinkLive(link)),
  };

  // An inline card edit hands back a whole MusicConfig — and the copy the player
  // was rendered from has `autoplay` forced off just above, so writing it back
  // verbatim would quietly clear the owner's autoplay setting the first time
  // they retyped a song title. Keep the draft's own value.
  const onMusicChange = (next: MusicConfig) =>
    setData((prev) => ({
      ...prev,
      music: { ...next, autoplay: prev.music?.autoplay ?? next.autoplay },
    }));

  // Position the selection outline over the selected element. Runs after layout
  // and whenever the draft/selection changes (which can move things).
  // biome-ignore lint/correctness/useExhaustiveDependencies: `device` and `tick` aren't read inside — they're intentional triggers to recompute the outline after the frame width changes or the frame resizes.
  useLayoutEffect(() => {
    const root = frameRef.current;
    // `background` has no element of its own; everything else carries a marker.
    if (!root || !selection || selection === "background") {
      setBox(null);
      return;
    }
    // The phone layout hides this pane rather than unmounting it, and a hidden
    // element measures zero — which would park the outline in the frame's
    // top-left corner. Keep the last good box instead; the ResizeObserver
    // re-measures the moment the pane is shown again.
    if (root.clientWidth === 0) return;
    const el = root.querySelector(`[data-select="${selection}"]`);
    setBox(el ? rectIn(root, el) : null);
  }, [selection, data, device, tick]);

  // Track the pane width (for the "auto" device choice) and recompute the
  // outline whenever the pane resizes — window resize or dragging the divider.
  useEffect(() => {
    const el = paneRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      setPaneWidth(entries[0]?.contentRect.width ?? 0);
      setTick((t) => t + 1);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // The phone layout hides this pane rather than unmounting it, so a visitor
  // replay left running would keep going — audio included — behind the Edit
  // pane. A hidden pane measures zero width; take that as "stop playing".
  useEffect(() => {
    if (playing && paneWidth === 0) setPlaying(false);
  }, [playing, paneWidth]);

  // Device caps: a phone-ish max in mobile, a wide max in desktop. The frame
  // itself grows to fill the pane (up to these), so more of the background shows.
  const maxWidth = device === "mobile" ? 440 : 1280;

  return (
    <div
      ref={paneRef}
      // From `lg` up this is always the right-hand pane. Below it, the shell's
      // Edit/Preview toggle decides which of the two panes is displayed; the
      // element stays mounted either way, so its scroll position, outlines and
      // ResizeObserver survive the switch.
      className={cn(
        "studio-stage relative min-w-0 flex-1 flex-col lg:flex",
        view === "preview" ? "flex" : "hidden",
      )}
    >
      {/* In the editor the links are selection targets, not live links: neutralize
          their hover lift/scale so the selection & hover outlines line up with the
          icon. Tailwind v4 animates the individual `translate`/`scale`/`rotate`
          properties (not the `transform` shorthand), so all must be reset. Skip
          this while "playing" so the real hover animations show for a visitor. */}
      <style>{`.studio-canvas:not(.studio-playing) a,.studio-canvas:not(.studio-playing) button{transition:none!important;transform:none!important;translate:none!important;scale:none!important;rotate:none!important}`}</style>

      {/* View-as-visitor controls (top-left). "Preview entry" replays the real
          first-visit experience; while playing, Replay re-triggers it and Exit
          returns to editing. */}
      <div className="absolute top-3 left-3 z-20 flex gap-1">
        {playing ? (
          <>
            <PillButton onClick={() => setPlayNonce((n) => n + 1)}>
              <ReplayIcon className="size-3.5" />
              Replay
            </PillButton>
            <PillButton onClick={() => setPlaying(false)}>
              <CloseIcon className="size-3.5" />
              Exit
            </PillButton>
          </>
        ) : (
          <PillButton brand onClick={startPlay}>
            <PlayIcon className="size-3.5" />
            Preview entry
          </PillButton>
        )}
      </div>

      {/* Device toggle — the only chrome on the preview, kept minimal. "Auto"
          fits the frame to the pane width; Mobile/Desktop pin it. Hidden on the
          phone layout, where there is no room for a desktop frame and the phone
          frame is the truthful default anyway. */}
      <div className="absolute top-3 right-3 z-10 hidden gap-1 rounded-lg border border-border bg-card/80 p-1 backdrop-blur lg:flex">
        <DeviceButton
          active={deviceMode === "auto"}
          onClick={() => setDeviceMode("auto")}
          label="Auto — fit to width"
        >
          <AutoIcon className="size-4" />
        </DeviceButton>
        <DeviceButton
          active={deviceMode === "mobile"}
          onClick={() => setDeviceMode("mobile")}
          label="Mobile"
        >
          <PhoneIcon className="size-4" />
        </DeviceButton>
        <DeviceButton
          active={deviceMode === "desktop"}
          onClick={() => setDeviceMode("desktop")}
          label="Desktop"
        >
          <MonitorIcon className="size-4" />
        </DeviceButton>
      </div>

      {/* The device frame fills the available space (up to the device cap), so
          the page's background shows all around the centered profile. */}
      {/* Enough margin for the canvas underneath to actually read. At the old
          `p-3` the frame all but filled the pane in Desktop mode, so it stopped
          looking like a device sitting on a workspace and started looking like
          a second panel butted against the first. */}
      <div className="flex min-h-0 flex-1 justify-center p-4 sm:p-6 lg:p-8">
        <div
          // `transform` makes this the containing block for any `position:fixed`
          // descendants (e.g. the "hidden" music player's floating control), so
          // they stay inside the device frame instead of overlapping the editor.
          className="h-full w-full transform-gpu overflow-hidden rounded-[1.75rem] border border-border shadow-2xl transition-[max-width] duration-300 ease-out"
          style={{ maxWidth }}
          // The outline is measured the instant the cap changes, i.e. at the
          // START of this 300ms width animation — so re-measure once it lands.
          onTransitionEnd={(e) => {
            if (e.propertyName === "max-width") setTick((t) => t + 1);
          }}
        >
          {/* A click-to-select canvas with no keyboard role of its own: every
              selection it can make is also reachable from the left panel's own
              controls, which are the accessible path. */}
          <div
            ref={frameRef}
            onClickCapture={playing ? undefined : handleClick}
            onPointerMove={playing ? undefined : handleMove}
            onPointerLeave={playing ? undefined : handleLeave}
            className={cn(
              "studio-canvas relative h-full overflow-auto",
              playing ? "studio-playing cursor-default" : "cursor-pointer",
            )}
          >
            <div
              // Remounts on Replay / entering play so the intro + music restart.
              key={playing ? `play-${playNonce}` : "edit"}
              className="relative flex min-h-full w-full flex-col items-center justify-center px-6 py-16"
            >
              {playing ? (
                data.intro?.enabled ? (
                  <EnterOverlay config={data.intro}>
                    <ProfileView data={visitorData} />
                  </EnterOverlay>
                ) : (
                  <ProfileView data={visitorData} />
                )
              ) : (
                <ProfileView
                  data={previewData}
                  selectable
                  onMusicChange={onMusicChange}
                />
              )}
            </div>

            {/* Hover outline — a soft cue that the element is editable. */}
            {!playing && hoverBox ? (
              <div
                className="pointer-events-none absolute z-10 rounded-lg outline outline-1 outline-ring/50"
                style={{
                  top: hoverBox.top - 4,
                  left: hoverBox.left - 4,
                  width: hoverBox.width + 8,
                  height: hoverBox.height + 8,
                }}
              />
            ) : null}

            {/* Selection outline. */}
            {!playing && box ? (
              <div
                className="pointer-events-none absolute z-20 rounded-lg outline outline-2 outline-ring transition-all duration-100"
                style={{
                  top: box.top - 4,
                  left: box.left - 4,
                  width: box.width + 8,
                  height: box.height + 8,
                }}
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function PillButton({
  onClick,
  brand = false,
  children,
}: {
  onClick: () => void;
  /** Marks the pane's one headline action ("Preview entry") with the brand ring
   *  on hover/focus. `.brand-ring-hover` needs `.brand-ring` for the ring itself
   *  and a TRANSPARENT host border, or the two stack into a double outline. */
  brand?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-lg border bg-card/80 px-2.5 py-1.5 font-medium text-foreground text-xs backdrop-blur transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
        brand
          ? "brand-ring brand-ring-hover border-transparent"
          : "border-border",
      )}
    >
      {children}
    </button>
  );
}

function DeviceButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "relative flex size-7 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
        // `bg-secondary` is byte-identical to `bg-muted`, so the active chip was
        // the hover state at 2x opacity. The 2px hue bar is what actually says
        // "this one" — same idiom as the section rail and the navbar.
        active
          ? "bg-secondary text-foreground after:absolute after:inset-x-1.5 after:bottom-0.5 after:h-[2px] after:rounded-full after:bg-[var(--sec)]"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
