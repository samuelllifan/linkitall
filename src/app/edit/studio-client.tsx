"use client";

/**
 * The editor shell (/edit) — a two-pane editing surface: organized sectioned
 * controls on the left, a true live preview on the right. Below `lg` the two
 * panes become one screen at a time, switched by the header's Edit / Preview
 * toggle.
 *
 * The signed-in user's real page is the initial draft, and Save writes it back
 * through `savePage`.
 */

import {
  type CSSProperties,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Button } from "~/components/ui/button";
import { type PageData, savePage } from "~/lib/pages";
import { useUnsavedGuard } from "~/lib/unsaved-guard";
import { usePresence } from "~/lib/use-popover";
import { useSlidingMarker } from "~/lib/use-sliding-marker";
import { cn } from "~/lib/utils";
import {
  type SectionId,
  StudioProvider,
  type StudioView,
  useStudio,
} from "./studio-context";
import {
  BackgroundPanel,
  IntroPanel,
  LinksPanel,
  MusicPanel,
  ProfilePanel,
} from "./studio-panels";
import { StudioPreview } from "./studio-preview";

function Icon({
  id,
  className,
  style,
}: {
  id: SectionId;
  className?: string;
  style?: CSSProperties;
}) {
  const paths: Record<SectionId, string> = {
    profile: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM5 20a7 7 0 0 1 14 0",
    links:
      "M9 15l6-6M8.5 13 6.5 15a3 3 0 1 0 4 4l2-2m1.5-4 2-2a3 3 0 1 0-4-4l-2 2",
    background: "M4 5h16v14H4zM4 15l4-4 4 4 3-3 5 5",
    music:
      "M9 18V6l10-2v12M9 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm10-2a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z",
    intro: "M12 3l2.1 5.9L20 11l-5.9 2.1L12 19l-2.1-5.9L4 11l5.9-2.1L12 3Z",
  };
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      style={style}
    >
      <path d={paths[id]} />
    </svg>
  );
}

/** The phone layout's pane toggle. */
function WrenchIcon({ className }: { className?: string }) {
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
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  );
}

function EyeIcon({ className }: { className?: string }) {
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
      <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

const VIEWS: { id: StudioView; label: string; icon: typeof WrenchIcon }[] = [
  { id: "edit", label: "Edit", icon: WrenchIcon },
  { id: "preview", label: "Preview", icon: EyeIcon },
];

/** Controls-panel width bounds (px) for the draggable divider. */
const ASIDE_MIN = 300;
const ASIDE_MAX = 680;

/** A link whose URL is empty or a bare scheme — not safe to publish. */
function isBlankHref(href: string): boolean {
  const t = href.trim();
  return t === "" || /^https?:\/\/$/i.test(t) || /^discord:$/i.test(t);
}

const NAV: { id: SectionId; label: string }[] = [
  { id: "profile", label: "Profile" },
  { id: "links", label: "Links" },
  { id: "background", label: "Background" },
  { id: "music", label: "Music" },
  { id: "intro", label: "Intro" },
];

function SectionBody({ section }: { section: SectionId }) {
  switch (section) {
    case "profile":
      return <ProfilePanel />;
    case "links":
      return <LinksPanel />;
    case "background":
      return <BackgroundPanel />;
    case "music":
      return <MusicPanel />;
    case "intro":
      return <IntroPanel />;
  }
}

function Shell({ username }: { username: string }) {
  const {
    data,
    section,
    setSection,
    selection,
    select,
    selectNonce,
    dirty,
    reset,
    markSaved,
    view,
    setView,
  } = useStudio();
  const liveHref = `/${username}`;

  // Save flow + unsaved-changes UX: a bottom pill that appears while there are
  // unsaved edits, a confirm dialog, and guards that stop you from leaving
  // (in-app nav, reload, tab close) before saving.
  const [saving, setSaving] = useState(false);
  const [confirmingSave, setConfirmingSave] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  // Restart the pill's attention flash when a blocked exit is attempted.
  const [flashKey, setFlashKey] = useState(0);
  const [flashing, setFlashing] = useState(false);
  const confirmSaveBtnRef = useRef<HTMLButtonElement>(null);

  const flash = useCallback(() => {
    setFlashKey((k) => k + 1);
    setFlashing(true);
  }, []);

  // Block in-app navbar navigation while dirty; a blocked click flashes the bar.
  const guard = useUnsavedGuard();
  useEffect(() => {
    guard.setDirty(dirty);
    guard.setOnBlocked(dirty ? flash : null);
    return () => {
      guard.setDirty(false);
      guard.setOnBlocked(null);
    };
  }, [dirty, guard, flash]);

  // Also prompt on hard navigations — reload, tab close, OS/back gesture.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const unsavedBar = usePresence(dirty);
  // The "Saved" pill lands in the same slot the unsaved bar just left, and that
  // bar slides away on `animate-slide-down`. Without its own presence this one
  // simply blinked out of the same few pixels a moment later — the same toast
  // position behaving two different ways within one second.
  const savedToast = usePresence(justSaved);
  // The confirm dialog is the Studio's one remaining hand-rolled modal (the
  // shared `Modal` in studio-ui carries a ✕ and a smaller title this one does
  // not want). It still owes the app an exit: settings' two dialogs fade and
  // scale away and this one used to be deleted mid-frame.
  const confirmDlg = usePresence(confirmingSave);

  function save() {
    setSaveError(null);
    // Don't let a half-finished link (blank/placeholder URL) save silently — it
    // would render as a dead entry. Jump to the first offender instead.
    const blank = data.links.find((l) => isBlankHref(l.href));
    if (blank) {
      select(`link:${blank.id}`);
      setSaveError("Add a URL to every link before saving.");
      return;
    }
    setConfirmingSave(true);
  }

  async function confirmSave() {
    setConfirmingSave(false);
    setSaving(true);
    setSaveError(null);
    try {
      // `savePage` also lifts any inline base64 avatar/media into Storage before
      // it writes the row. It's given the draft, so the local baseline stays the
      // pre-upload draft.
      await savePage(data);
      markSaved();
      setJustSaved(true);
      window.setTimeout(() => setJustSaved(false), 2000);
    } catch (err) {
      console.error("Failed to save page:", err);
      setSaveError(
        err instanceof Error && err.message
          ? err.message
          : "Couldn't save your changes. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  // Save-confirm dialog keyboard: focus Confirm on open, Escape cancels, Enter
  // confirms. A ref holds the latest confirmSave so the listener stays keyed
  // only to `confirmingSave`.
  const confirmSaveRef = useRef(confirmSave);
  confirmSaveRef.current = confirmSave;
  useEffect(() => {
    if (!confirmingSave) return;
    confirmSaveBtnRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setConfirmingSave(false);
      else if (e.key === "Enter") confirmSaveRef.current();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [confirmingSave]);

  // Guard the Studio's own "Back" link the same way the navbar links are guarded.
  function guardedBack(e: React.MouseEvent) {
    if (dirty) {
      e.preventDefault();
      flash();
    }
  }

  // Global shortcuts: Cmd/Ctrl+S saves; Escape clears the selection (collapsing
  // the focused card). A ref keeps the handler current without re-subscribing on
  // every keystroke.
  const shortcutRef = useRef<(e: KeyboardEvent) => void>(() => {});
  shortcutRef.current = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      if (dirty && !confirmingSave) save();
      return;
    }
    if (e.key === "Escape" && !confirmingSave && selection) {
      // Modals own their own Escape; don't also deselect underneath them.
      if (document.querySelector('[role="dialog"]')) return;
      select(null);
    }
  };
  useEffect(() => {
    const h = (e: KeyboardEvent) => shortcutRef.current(e);
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, []);

  // Resizable divider between the controls and the preview. The chosen width
  // persists so the layout sticks between visits.
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const [asideWidth, setAsideWidth] = useState(360);
  const asideWidthRef = useRef(asideWidth);
  asideWidthRef.current = asideWidth;

  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem("studio:asideWidth"));
      if (saved >= ASIDE_MIN && saved <= ASIDE_MAX) setAsideWidth(saved);
    } catch {
      /* ignore — width just falls back to the default */
    }
  }, []);

  const clampWidth = useCallback((raw: number) => {
    const container = bodyRef.current;
    // Always leave room for the preview so it can't be dragged shut.
    const max = container
      ? Math.max(ASIDE_MIN, Math.min(ASIDE_MAX, container.clientWidth - 360))
      : ASIDE_MAX;
    return Math.max(ASIDE_MIN, Math.min(raw, max));
  }, []);

  const persistWidth = (w: number) => {
    try {
      localStorage.setItem("studio:asideWidth", String(w));
    } catch {
      /* ignore */
    }
  };

  function startResize(e: React.PointerEvent) {
    e.preventDefault();
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    const onMove = (ev: PointerEvent) => {
      const container = bodyRef.current;
      if (!container) return;
      setAsideWidth(
        clampWidth(ev.clientX - container.getBoundingClientRect().left),
      );
    };
    const onUp = () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      persistWidth(asideWidthRef.current);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function nudgeResize(e: React.KeyboardEvent) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const next = clampWidth(
      asideWidthRef.current + (e.key === "ArrowLeft" ? -24 : 24),
    );
    setAsideWidth(next);
    persistWidth(next);
  }

  // The focus bridge: when something is picked in the preview, scroll its
  // control into view in the left panel and flash it, so a click on the page
  // lands you on the exact thing you clicked. `selectNonce` re-fires this even
  // when the same element is re-picked.
  const panelScrollRef = useRef<HTMLDivElement | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `selectNonce` isn't read inside — it's an intentional trigger so re-picking the same element re-fires the scroll-and-flash.
  useEffect(() => {
    const root = panelScrollRef.current;
    if (!root || !selection) return;
    // Reset any lingering highlight first, so rapid re-selection can't leave a
    // stray outline stuck on a previously-flashed control.
    const clearAll = () => {
      for (const n of root.querySelectorAll<HTMLElement>("[data-focus]")) {
        n.style.outline = "";
        n.style.outlineOffset = "";
        n.style.borderRadius = "";
      }
    };
    clearAll();
    const el = root.querySelector<HTMLElement>(`[data-focus="${selection}"]`);
    if (!el) return;
    el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    el.style.outline = "2px solid var(--ring)";
    el.style.outlineOffset = "3px";
    el.style.borderRadius = "10px";
    const t = setTimeout(clearAll, 1000);
    return () => {
      clearTimeout(t);
      clearAll();
    };
  }, [selection, selectNonce]);

  // The section rail's sliding marker — the same one the navbar and the settings
  // rail wear. `section` is the trigger; the marker finds the active chip by
  // `[data-rail-active]`.
  const {
    ref: markerRef,
    marker,
    placed: markerPlaced,
  } = useSlidingMarker<HTMLElement>(section, "[data-rail-active]");

  return (
    // `--sec` is the current section's hue, published once here so the controls
    // AND the preview inherit the same one. `.studio-shell` (globals.css) is what
    // turns it into --ring, slider accent colours and the .sec-* state classes,
    // so nothing downstream has to know which section is open.
    <div
      style={{ "--sec": `var(--sec-${section})` } as CSSProperties}
      className="studio-shell flex h-[calc(100dvh-var(--nav-space))] flex-col overflow-hidden bg-background"
    >
      {/* Top bar — the exit, the page identity, and (phones only) the pane
          toggle. Saving lives in the bottom unsaved-changes bar, and the preview
          itself is the live view. Matches the navbar's h-14 on phones so the
          toggle gets a real touch target. */}
      <header className="flex h-14 shrink-0 items-center gap-2 border-border border-b px-3 text-sm lg:h-12">
        <a
          href={liveHref}
          onClick={guardedBack}
          className="flex items-center gap-1 rounded-md px-1.5 py-1 text-muted-foreground hover:text-foreground"
        >
          <span aria-hidden>‹</span> Back
        </a>
        {/* Below sm the pane toggle takes the room the URL would need, so the
            identity drops out — as the navbar drops its @username. */}
        <span className="hidden text-border sm:inline">|</span>
        <span className="hidden min-w-0 items-center gap-1.5 truncate text-muted-foreground sm:inline-flex">
          {/* This page is already public — the header says what it is, and that
              it is live is the one part that was missing. Green means "good"
              app-wide and appears nowhere in the brand gradient, so it can only
              be read as status here. */}
          <span
            aria-hidden
            className="size-1.5 shrink-0 rounded-full bg-success"
          />
          stacked.page/{username}
        </span>

        {/* Phone pane toggle: the controls and the preview each take the whole
            screen, so one of them is always fully usable. */}
        <div className="ml-auto flex gap-1 rounded-lg border border-border bg-card p-1 lg:hidden">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setView(v.id)}
              aria-pressed={view === v.id}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-2 font-medium text-xs transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                view === v.id
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <v.icon className="size-3.5" />
              {v.label}
            </button>
          ))}
        </div>
      </header>

      {/* Body: controls | divider | preview on desktop; on phones exactly one of
          the two panes is displayed, chosen by `view`. Both stay MOUNTED — the
          preview's outline measurements, scroll position and ResizeObserver all
          survive a toggle that way, and a hidden pane simply reports zero width. */}
      <div ref={bodyRef} className="flex min-h-0 flex-1">
        <aside
          // The dragged width is handed over as a custom property rather than an
          // inline `width`, which no class could override at the breakpoint.
          style={{ "--studio-aside": `${asideWidth}px` } as CSSProperties}
          className={cn(
            "min-w-0 flex-col bg-card lg:flex lg:w-[var(--studio-aside)] lg:shrink-0",
            view === "edit" ? "flex w-full" : "hidden",
          )}
        >
          {/* Section rail. The active section is ONE object that slides between
              the five chips — the navbar's marker and the settings rail's, the
              third and last place in the app that answers "where am I".

              It used to be a chip fill plus a 2px bar rendered INSIDE whichever
              button was active, so the answer vanished here and reappeared
              there. That was the more expensive failure of the three: the fill
              is `bg-secondary` and the hover fill is `bg-muted/50`, which
              resolve to the same token at two opacities, so a crossfade between
              them is very nearly no signal at all. Moving it is.

              `relative` because the marker measures itself with offsetLeft/Top
              against this element. The buttons keep their own `relative` too —
              a positioned marker would otherwise paint over their icons. */}
          <nav
            ref={markerRef}
            className="relative grid grid-cols-5 gap-1 border-border border-b p-2"
          >
            {/* Translated AND sized, rather than stretched with top-0/bottom-0
                the way the navbar's is: this rail has `p-2`, so a stretched
                marker would overshoot the chips by 8px at each end. */}
            <span
              aria-hidden
              style={{
                transform: `translate(${marker.x}px, ${marker.y}px)`,
                width: marker.w,
                height: marker.h,
              }}
              className={cn(
                "pointer-events-none absolute top-0 left-0 rounded-md bg-secondary",
                markerPlaced &&
                  (marker.snap ? "nav-marker-fade" : "nav-marker"),
                marker.on ? "opacity-100" : "opacity-0",
              )}
            >
              {/* The section hue rides along inside the marker. `var(--sec)` and
                  not `var(--sec-<id>)`: the shell publishes the CURRENT
                  section's hue as --sec (see the wrapper above), and the marker
                  is only ever on the current section — so it re-tints itself and
                  can never disagree with the panel it belongs to. */}
              <span
                className="absolute inset-x-2 bottom-1 h-[2px] rounded-full"
                style={{ background: "var(--sec)" }}
              />
            </span>

            {NAV.map((n) => {
              const on = section === n.id;
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => setSection(n.id)}
                  aria-pressed={on}
                  // How the marker finds its target — by attribute, not index.
                  data-rail-active={on ? "" : undefined}
                  className={cn(
                    "relative flex min-w-0 flex-col items-center gap-1 rounded-md px-1 pt-2 pb-2.5 transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                    on
                      ? "text-foreground"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                  )}
                >
                  <Icon
                    id={n.id}
                    className="size-[18px] shrink-0"
                    style={on ? { color: `var(--sec-${n.id})` } : undefined}
                  />
                  <span className="w-full truncate text-center text-[10px] leading-none">
                    {n.label}
                  </span>
                </button>
              );
            })}
          </nav>
          <div
            ref={panelScrollRef}
            // Extra bottom room on phones so the fixed unsaved-changes pill never
            // parks on top of the last control. On desktop the pill is centred on
            // the viewport, which puts it over the preview, not the panel.
            className="min-h-0 flex-1 overflow-y-auto p-4 pb-28 lg:pb-4"
          >
            <SectionBody section={section} />
          </div>
        </aside>

        {/* Drag to resize; arrow keys nudge. A thin line in a wider hit area.
            Unrendered on phones, where there is nothing to resize — which also
            means no phone session can ever write the persisted width. */}
        {/* biome-ignore lint/a11y/useSemanticElements: an interactive drag handle, not an <hr> */}
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize the controls panel"
          aria-valuenow={Math.round(asideWidth)}
          aria-valuemin={ASIDE_MIN}
          aria-valuemax={ASIDE_MAX}
          tabIndex={0}
          onPointerDown={startResize}
          onKeyDown={nudgeResize}
          className="group relative z-10 hidden w-3 shrink-0 cursor-col-resize touch-none items-stretch justify-center focus-visible:outline-none lg:flex"
        >
          <div className="w-px bg-border transition-colors group-hover:bg-ring group-focus-visible:bg-ring group-active:bg-ring" />
        </div>

        <StudioPreview />
      </div>

      {/* Unsaved-changes bar — a subtle bottom-center pill; the only way to save.
          It flashes when you try to leave with unsaved edits. */}
      {unsavedBar.value ? (
        <div
          className={cn(
            "pointer-events-none fixed inset-x-0 bottom-[calc(1.5rem+env(safe-area-inset-bottom))] z-40 flex flex-col items-center gap-2 px-4",
            unsavedBar.visible ? "animate-slide-up" : "animate-slide-down",
          )}
        >
          {saveError ? (
            <div className="pointer-events-auto max-w-xs rounded-lg border border-danger/30 bg-background px-4 py-2 text-center text-danger text-sm shadow-lg">
              {saveError}
            </div>
          ) : null}
          <div
            key={flashKey}
            onAnimationEnd={() => setFlashing(false)}
            className={cn(
              "pointer-events-auto flex items-center gap-4 rounded-lg border border-warning/35 bg-background px-4 py-2 shadow-lg",
              flashing && "animate-flash",
            )}
          >
            <span className="flex items-center gap-2 whitespace-nowrap text-muted-foreground text-sm">
              <span
                aria-hidden
                className={cn(
                  "size-1.5 shrink-0 rounded-full bg-warning",
                  saving && "animate-pulse",
                )}
              />
              {/* The full sentence plus both buttons overflows a 375px phone. */}
              <span className="sm:hidden">Unsaved changes</span>
              <span className="hidden sm:inline">You have unsaved changes</span>
            </span>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={reset}>
                Reset
              </Button>
              <Button size="sm" onClick={save} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Brief "Saved" confirmation — stands in for the bar as it slides away. */}
      {savedToast.value ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(1.5rem+env(safe-area-inset-bottom))] z-40 flex justify-center px-4">
          <div
            className={cn(
              "flex items-center gap-2 rounded-lg border border-success/35 bg-background px-4 py-2 font-medium text-foreground text-sm shadow-lg",
              savedToast.visible ? "animate-slide-up" : "animate-slide-down",
            )}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="size-4 text-success"
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
            Saved
          </div>
        </div>
      ) : null}

      {/* Confirm save dialog */}
      {confirmDlg.value ? (
        <div
          className={cn(
            "fixed inset-0 z-50 flex items-center justify-center p-4",
            // Stop the fading-out dialog from swallowing clicks aimed at the
            // editor it is uncovering.
            !confirmDlg.visible && "pointer-events-none",
          )}
        >
          <button
            type="button"
            aria-label="Close"
            className={cn(
              "absolute inset-0 bg-black/50",
              confirmDlg.visible ? "animate-fade" : "animate-fade-out",
            )}
            onClick={() => setConfirmingSave(false)}
          />
          <div
            className={cn(
              "relative w-full max-w-sm rounded-xl border border-border bg-popover p-6 text-popover-foreground shadow-xl",
              confirmDlg.visible ? "animate-pop" : "animate-pop-out",
            )}
          >
            <h2 className="font-semibold text-lg">Confirm changes</h2>
            <p className="mt-2 text-muted-foreground text-sm">
              Are you sure you want to save these changes?
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmingSave(false)}
              >
                Cancel
              </Button>
              <Button ref={confirmSaveBtnRef} size="sm" onClick={confirmSave}>
                Confirm
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function StudioClient({
  initialData,
  username,
}: {
  initialData: PageData | null;
  username: string;
}) {
  // No page row yet: start from a blank draft seeded with their username, so
  // the first thing they see is their own name rather than an empty field. The
  // baseline stays truly empty so that seeded name counts as an unsaved change
  // and the Save pill is on screen from the first paint.
  const blank: PageData = { name: "", bio: "", links: [] };
  const initial: PageData = initialData ?? { ...blank, name: username };

  return (
    <StudioProvider initial={initial} baseline={initialData ?? blank}>
      <Shell username={username} />
    </StudioProvider>
  );
}
