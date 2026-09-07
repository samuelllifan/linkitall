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
  StatusPanel,
  ThemesPanel,
} from "./studio-panels";
import { StudioPreview } from "./studio-preview";
import { Modal } from "./studio-ui";

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
    // A paint-roller-ish swatch: the one control that repaints the whole page.
    themes:
      "M4.5 4.5h11v5h-11zM15.5 7h3a1.5 1.5 0 0 1 1.5 1.5V12a1.5 1.5 0 0 1-1.5 1.5H12v2M10.5 15.5h3v5h-3z",
    profile: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM5 20a7 7 0 0 1 14 0",
    links:
      "M9 15l6-6M8.5 13 6.5 15a3 3 0 1 0 4 4l2-2m1.5-4 2-2a3 3 0 1 0-4-4l-2 2",
    background: "M4 5h16v14H4zM4 15l4-4 4 4 3-3 5 5",
    // A speech bubble wearing a presence dot: the two halves of a status line.
    status:
      "M4 6.5A2.5 2.5 0 0 1 6.5 4h8A2.5 2.5 0 0 1 17 6.5v5a2.5 2.5 0 0 1-2.5 2.5H9l-4 3.5v-3.5H6.5A2.5 2.5 0 0 1 4 11.5zM19 6.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z",
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

/** Undo / redo. Mirrored rather than two separate arrows, so the pair reads as
 *  one control with two directions.
 *
 *  The arc is a half turn, not the near-complete circle it used to be: a 350°
 *  sweep plus an arrowhead reads as "reload", which is the one thing undo must
 *  not be mistaken for, and at 16px the gap closed up into a blob. A chevron
 *  head on a clean semicircle keeps the direction legible at that size, and its
 *  bounding box is centred in the 24-box so the two sit level in their track. */
function UndoIcon({ className, flip }: { className?: string; flip?: boolean }) {
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
      style={flip ? { transform: "scaleX(-1)" } : undefined}
    >
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H10" />
    </svg>
  );
}

function CopyIcon({ className }: { className?: string }) {
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
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function ExternalIcon({ className }: { className?: string }) {
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
      <path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </svg>
  );
}

function KeyboardIcon({ className }: { className?: string }) {
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
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8" />
    </svg>
  );
}

/** A header icon button for one direction of the history. Square and sized in
 *  whole pixels, so the two are identical mirrored blocks rather than a pair of
 *  padded icons whose optical weight drifts with the glyph. Hover fills to full
 *  --muted, a clear step up from the 40%-strength fill of the track behind it,
 *  so the highlight still reads now that the pair sits inside a box. */
function HistoryButton({
  label,
  hint,
  disabled,
  onClick,
  flip,
}: {
  label: string;
  hint: string;
  disabled: boolean;
  onClick: () => void;
  flip?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={`${label} (${hint})`}
      aria-label={label}
      className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:bg-transparent disabled:opacity-30 lg:size-7"
    >
      <UndoIcon className="size-4 lg:size-3.5" flip={flip} />
    </button>
  );
}

const VIEWS: { id: StudioView; label: string; icon: typeof WrenchIcon }[] = [
  { id: "edit", label: "Edit", icon: WrenchIcon },
  { id: "preview", label: "Preview", icon: EyeIcon },
];

/** Controls-panel width bounds (px) for the draggable divider. */
const ASIDE_MIN = 300;
const ASIDE_MAX = 680;

/** Where "don't ask again on this device" for the publish dialog is kept. */
const SKIP_CONFIRM_KEY = "studio:skipSaveConfirm";

/**
 * Whether a keydown landed in something the user is typing into — an input, a
 * textarea, or the contentEditable name/bio field. Bare-letter shortcuts have
 * to stand down inside these, or they eat the character.
 */
function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || !el.tagName) return false;
  return (
    el.tagName === "INPUT" ||
    el.tagName === "TEXTAREA" ||
    el.tagName === "SELECT" ||
    el.isContentEditable
  );
}

/** A link whose URL is empty or a bare scheme — not safe to publish. */
function isBlankHref(href: string): boolean {
  const t = href.trim();
  return t === "" || /^https?:\/\/$/i.test(t) || /^discord:$/i.test(t);
}

const NAV: { id: SectionId; label: string }[] = [
  // Themes first: it is where a new page should start, and one click there
  // does more than twenty in any other section.
  { id: "themes", label: "Themes" },
  { id: "profile", label: "Profile" },
  { id: "links", label: "Links" },
  // "Page" rather than "Background": the section owns the page surface AND the
  // panel behind the profile block, and at six chips the longer word was the
  // one label in the rail that truncated.
  { id: "background", label: "Page" },
  // Status sits with the identity sections (it renders under the name), ahead
  // of the two page-wide extras.
  { id: "status", label: "Status" },
  { id: "music", label: "Music" },
  { id: "intro", label: "Intro" },
];

function SectionBody({ section }: { section: SectionId }) {
  switch (section) {
    case "themes":
      return <ThemesPanel />;
    case "profile":
      return <ProfilePanel />;
    case "links":
      return <LinksPanel />;
    case "background":
      return <BackgroundPanel />;
    case "status":
      return <StatusPanel />;
    case "music":
      return <MusicPanel />;
    case "intro":
      return <IntroPanel />;
  }
}

function Shell({
  username,
  demo = false,
}: {
  username: string;
  demo?: boolean;
}) {
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
    undo,
    redo,
    canUndo,
    canRedo,
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
  const [copied, setCopied] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  // "Don't ask again" for the publish confirmation. Read after mount rather
  // than in the initializer so the server render and the first client render
  // agree; the flag only gates a dialog, so a first paint without it is
  // harmless (nothing can be saved before the user clicks).
  const [skipConfirm, setSkipConfirmState] = useState(false);
  useEffect(() => {
    try {
      setSkipConfirmState(localStorage.getItem(SKIP_CONFIRM_KEY) === "1");
    } catch {
      /* ignore — the dialog just keeps asking, which is the safe default */
    }
  }, []);
  const setSkipConfirm = useCallback((v: boolean) => {
    setSkipConfirmState(v);
    try {
      if (v) localStorage.setItem(SKIP_CONFIRM_KEY, "1");
      else localStorage.removeItem(SKIP_CONFIRM_KEY);
    } catch {
      /* ignore — the preference just won't survive a reload */
    }
  }, []);

  // Copy the page's public URL. Built from the live origin rather than a
  // hard-coded stacked.page so a preview deployment copies its own address
  // instead of one that points at production.
  const copyLink = useCallback(() => {
    const url = `${window.location.origin}/${username}`;
    navigator.clipboard
      ?.writeText(url)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      })
      .catch(() => {
        /* Clipboard denied (insecure context, or the user said no). The URL is
           right there in the header to select by hand — no error worth a toast. */
      });
  }, [username]);

  // The history shortcuts, spelled the way this keyboard spells them. Resolved
  // after mount so the server render and the first client render agree.
  const [isMac, setIsMac] = useState(false);
  useEffect(() => {
    setIsMac(/mac/i.test(navigator.platform || navigator.userAgent));
  }, []);
  const undoHint = isMac ? "\u2318Z" : "Ctrl+Z";
  const redoHint = isMac ? "\u21e7\u2318Z" : "Ctrl+Y";

  const flash = useCallback(() => {
    setFlashKey((k) => k + 1);
    setFlashing(true);
  }, []);

  // Block in-app navbar navigation while dirty; a blocked click flashes the bar.
  const guard = useUnsavedGuard();
  useEffect(() => {
    // The sandbox has nothing to lose, so it never blocks navigation.
    const guarded = dirty && !demo;
    guard.setDirty(guarded);
    guard.setOnBlocked(guarded ? flash : null);
    return () => {
      guard.setDirty(false);
      guard.setOnBlocked(null);
    };
  }, [dirty, demo, guard, flash]);

  // Also prompt on hard navigations — reload, tab close, OS/back gesture.
  useEffect(() => {
    if (!dirty || demo) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty, demo]);

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
    // Headers are labels, not destinations — they have no URL to be missing.
    const blank = data.links.find(
      (l) => l.kind !== "header" && isBlankHref(l.href),
    );
    if (blank) {
      select(`link:${blank.id}`);
      setSaveError("Add a URL to every link before saving.");
      return;
    }
    if (skipConfirm) {
      confirmSaveRef.current();
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
      // pre-upload draft. The sandbox skips the write entirely — everything
      // else about the flow (the pill, the toast, the baseline advancing) is
      // exactly what a real save does, which is the point of the demo.
      if (!demo) await savePage(data);
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
    if (dirty && !demo) {
      e.preventDefault();
      flash();
    }
  }

  // Global shortcuts: Cmd/Ctrl+S saves; Cmd/Ctrl+Z steps through the history;
  // Escape clears the selection (collapsing the focused card). A ref keeps the
  // handler current without re-subscribing on every keystroke.
  const shortcutRef = useRef<(e: KeyboardEvent) => void>(() => {});
  shortcutRef.current = (e: KeyboardEvent) => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === "s") {
      e.preventDefault();
      if (dirty && !confirmingSave) save();
      return;
    }
    // Undo/redo owns the whole draft, so it fires from inside a text field too.
    // Every field here renders from the draft, and leaving the browser's own
    // per-field undo running underneath would let the two stacks drift apart —
    // one Cmd+Z restoring a word the preview never agreed to. Ctrl+Y is here for
    // the Windows muscle memory that never learned Ctrl+Shift+Z.
    if (mod && !confirmingSave) {
      const key = e.key.toLowerCase();
      if (key === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (key === "y") {
        e.preventDefault();
        redo();
        return;
      }
    }
    // "?" opens the shortcut sheet — but only from outside a text field, or it
    // would swallow the question mark in a bio.
    if (e.key === "?" && !mod && !isTypingTarget(e.target)) {
      e.preventDefault();
      setShortcutsOpen((v) => !v);
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
        {/* The page's address, and the two things anyone ever wants to do with
            it: copy it, or go look at it. It used to be inert text, so the
            single most common task after editing a link-in-bio page — send
            someone the link — meant retyping the URL from the header by hand. */}
        <div className="hidden min-w-0 items-center gap-0.5 sm:flex">
          <button
            type="button"
            onClick={copyLink}
            title="Copy your page link"
            className="flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {/* This page is already public — the header says what it is, and
                that it is live is the one part that was missing. Green means
                "good" app-wide and appears nowhere in the brand gradient, so it
                can only be read as status here. */}
            <span
              aria-hidden
              className="size-1.5 shrink-0 rounded-full bg-success"
            />
            <span className="truncate">stacked.page/{username}</span>
            {copied ? (
              <CheckIcon className="size-3.5 shrink-0 text-success" />
            ) : (
              <CopyIcon className="size-3.5 shrink-0 opacity-60" />
            )}
          </button>
          <a
            href={liveHref}
            target="_blank"
            rel="noopener noreferrer"
            title="Open your live page in a new tab"
            aria-label="Open your live page in a new tab"
            className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <ExternalIcon className="size-3.5" />
          </a>
        </div>

        {/* Undo / redo. In the header rather than beside any one control: it
            belongs to the draft as a whole, and it has to be in the same place
            whichever section is open.

            The two share one recessed track with a hairline divider between
            them. Loose, they read as two unrelated round glyphs adrift in the
            header — the same mistake the section rail used to make. Boxed, they
            are one control with two directions, which is what they are, and the
            box gives the disabled state something to be dim against. */}
        <div className="ml-auto flex items-center gap-1">
          <div className="flex items-center rounded-lg border border-border bg-muted/40 p-0.5">
            <HistoryButton
              label="Undo"
              hint={undoHint}
              disabled={!canUndo}
              onClick={undo}
            />
            <span aria-hidden className="h-4 w-px shrink-0 bg-border" />
            <HistoryButton
              label="Redo"
              hint={redoHint}
              disabled={!canRedo}
              onClick={redo}
              flip
            />
          </div>
          {/* Discoverability for the shortcuts that already existed. ⌘S, ⌘Z and
              Escape were all live and documented nowhere on screen. */}
          <button
            type="button"
            onClick={() => setShortcutsOpen(true)}
            title="Keyboard shortcuts (?)"
            aria-label="Keyboard shortcuts"
            className="hidden size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 lg:flex"
          >
            <KeyboardIcon className="size-4" />
          </button>
        </div>

        {/* Phone pane toggle: the controls and the preview each take the whole
            screen, so one of them is always fully usable. */}
        <div className="flex gap-1 rounded-lg border border-border bg-card p-1 lg:hidden">
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
            className="relative grid grid-cols-6 gap-1 border-border border-b p-2"
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
            // `@container`, so panels can respond to the PANEL's width rather
            // than the viewport's: this pane is user-resizable between 300 and
            // 680px, which no viewport breakpoint knows anything about.
            className="@container min-h-0 flex-1 overflow-y-auto p-4 pb-28 lg:pb-4"
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

      {/* Keyboard shortcuts. Reuses the Studio's shared Modal so it fades and
          scales like every other dialog here. */}
      <Modal
        open={shortcutsOpen}
        title="Keyboard shortcuts"
        onClose={() => setShortcutsOpen(false)}
        size="sm"
      >
        <dl className="flex flex-col">
          {[
            { keys: [isMac ? "⌘" : "Ctrl", "S"], what: "Save your changes" },
            { keys: [isMac ? "⌘" : "Ctrl", "Z"], what: "Undo" },
            {
              keys: isMac ? ["⇧", "⌘", "Z"] : ["Ctrl", "Y"],
              what: "Redo",
            },
            { keys: ["Esc"], what: "Deselect / close" },
            { keys: ["?"], what: "This list" },
          ].map((row) => (
            <div
              key={row.what}
              className="flex items-center justify-between gap-4 border-border/60 border-b py-2 last:border-0"
            >
              <dt className="text-muted-foreground text-sm">{row.what}</dt>
              <dd className="flex shrink-0 items-center gap-1">
                {row.keys.map((k) => (
                  <kbd
                    key={k}
                    className="min-w-6 rounded border border-border bg-muted px-1.5 py-0.5 text-center font-medium font-sans text-[11px] text-foreground"
                  >
                    {k}
                  </kbd>
                ))}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-muted-foreground/70 text-[11px]">
          Undo covers every edit in the Studio, including applying a theme and
          discarding changes.
        </p>
      </Modal>

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
            <h2 className="font-semibold text-lg">Publish changes</h2>
            <p className="mt-2 text-muted-foreground text-sm">
              This updates your live page at{" "}
              <span className="text-foreground">stacked.page/{username}</span>{" "}
              right away.
            </p>
            {/* An escape hatch from a dialog that, once you've read it once,
                stands between you and every subsequent save. The safety net is
                worth having the first time — it isn't worth having the
                fortieth, and an editor that asks "are you sure?" on every save
                trains people to click through it without reading. */}
            <label className="mt-4 flex cursor-pointer select-none items-center gap-2 text-muted-foreground text-sm hover:text-foreground">
              <input
                type="checkbox"
                checked={skipConfirm}
                onChange={(e) => setSkipConfirm(e.target.checked)}
                className="size-4 accent-[var(--brand-violet)]"
              />
              Don't ask again on this device
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmingSave(false)}
              >
                Cancel
              </Button>
              <Button ref={confirmSaveBtnRef} size="sm" onClick={confirmSave}>
                Publish
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
  demo = false,
}: {
  initialData: PageData | null;
  username: string;
  /**
   * Sandbox mode: the whole editor works, but Save never writes a row and the
   * unsaved-changes guards stand down. Used by the /studio-demo tour route so
   * the Studio can be shown (and driven) without an account behind it.
   */
  demo?: boolean;
}) {
  // No page row yet: start from a blank draft seeded with their username, so
  // the first thing they see is their own name rather than an empty field. The
  // baseline stays truly empty so that seeded name counts as an unsaved change
  // and the Save pill is on screen from the first paint.
  const blank: PageData = { name: "", bio: "", links: [] };
  const initial: PageData = initialData ?? { ...blank, name: username };

  return (
    <StudioProvider initial={initial} baseline={initialData ?? blank}>
      <Shell username={username} demo={demo} />
    </StudioProvider>
  );
}
