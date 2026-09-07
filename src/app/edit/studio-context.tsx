"use client";

/**
 * Shared state for the page editor (/edit).
 *
 * One `draft: PageData` is the single source of truth. Every control writes the
 * draft; the live preview renders the real <ProfileView data={draft} />. This is
 * the core of the editor redesign: "controls that produce a PageData" + "the same
 * renderer everyone else sees", with PageData as the only contract between them.
 *
 * That draft lives inside an undo history. Every write goes through `commit`,
 * which files the outgoing draft on the undo stack before installing the new
 * one — so panels keep calling `update`/`setData` exactly as before and get
 * undo for free, with no per-control bookkeeping.
 */

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import type { LinkItem, LinkKind, PageData } from "~/lib/pages";

/** The left-panel sections, in nav order. */
export type SectionId =
  | "themes"
  | "profile"
  | "links"
  | "background"
  | "status"
  | "music"
  | "intro";

/** What's currently picked in the preview (drives which controls are focused). */
export type Selection =
  | "avatar"
  | "name"
  | "bio"
  | "background"
  | "panel"
  | "status"
  | "music"
  | "intro"
  | "intro-text"
  | "intro-subtitle"
  | `link:${string}`
  | null;

/** Which section a given selection belongs to (for the click-to-jump bridge). */
function sectionForSelection(sel: Selection): SectionId | null {
  if (!sel) return null;
  if (sel === "avatar" || sel === "name" || sel === "bio") return "profile";
  if (sel === "background" || sel === "panel") return "background";
  if (sel === "status") return "status";
  if (sel === "music") return "music";
  if (sel === "intro" || sel.startsWith("intro-")) return "intro";
  if (sel.startsWith("link:")) return "links";
  return null;
}

/** The rendered frame size. */
export type DeviceMode = "mobile" | "desktop";
/** The user's frame preference — "auto" fits the frame to the preview width. */
export type DevicePref = "auto" | "mobile" | "desktop";

/**
 * Which of the two panes the phone layout is showing. Inert from `lg` up, where
 * the controls and the preview are always both on screen.
 */
export type StudioView = "edit" | "preview";

/**
 * How many edits back undo reaches. Each entry is a shallow copy of PageData,
 * so an avatar or a video background is shared by reference across every
 * snapshot — depth costs a handful of pointers, not megabytes of base64.
 */
const HISTORY_LIMIT = 100;

/**
 * Consecutive edits touching the same fields merge into one undo step when they
 * land within this many milliseconds of each other. One drag of a slider and
 * one typed word are each a single step, not forty.
 */
const COALESCE_MS = 600;

interface HistoryState {
  past: PageData[];
  present: PageData;
  future: PageData[];
}

/**
 * A stable signature of the top-level keys two drafts differ on, used to decide
 * whether an edit continues the previous one. Values are compared by reference:
 * every control writes a fresh object for the field it owns, so a touched key
 * always yields a new reference and an untouched one never does.
 */
function changedKeys(a: PageData, b: PageData): string {
  const changed: string[] = [];
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const k = key as keyof PageData;
    if (!Object.is(a[k], b[k])) changed.push(key);
  }
  return changed.sort().join(",");
}

interface StudioValue {
  data: PageData;
  /** Merge a shallow patch into the draft. */
  update: (patch: Partial<PageData>) => void;
  /** Full functional update, for nested edits. */
  setData: (updater: (prev: PageData) => PageData) => void;
  dirty: boolean;
  reset: () => void;
  /** Commit the current draft as the saved baseline (clears `dirty`). */
  markSaved: () => void;
  /** Bumped whenever the draft is replaced wholesale (undo, redo, reset).
   * Uncontrolled fields (the contentEditable name/bio) key off this to re-seed
   * their DOM. */
  revision: number;

  /** Step back one edit. No-op with nothing to undo. */
  undo: () => void;
  /** Step forward again after an undo. Cleared by the next edit. */
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;

  section: SectionId;
  setSection: (s: SectionId) => void;

  selection: Selection;
  /**
   * Set the selection AND route the left panel to its section. `reveal` (the
   * default) also brings the Edit pane forward on the phone layout; pass false
   * for an incidental pick that shouldn't pull the user out of the preview.
   */
  select: (sel: Selection, reveal?: boolean) => void;
  /** Bumped on every `select` call, so re-picking the same element re-fires the
   * left-panel scroll-to-and-flash even when `selection` is unchanged. */
  selectNonce: number;

  deviceMode: DevicePref;
  setDeviceMode: (d: DevicePref) => void;

  /** The phone layout's visible pane. Ignored by the desktop two-pane layout. */
  view: StudioView;
  setView: (v: StudioView) => void;

  // Link helpers.
  /** Append a row (optionally seeded from a picked platform) and select it. */
  addLink: (seed?: { label?: string; href?: string; kind?: LinkKind }) => void;
  patchLink: (id: string, patch: Partial<LinkItem>) => void;
  removeLink: (id: string) => void;
  /** Copy a row, drop it directly below the original, and select the copy. */
  duplicateLink: (id: string) => void;
  /** Nudge a link one slot up (-1) or down (+1) — used by keyboard reordering. */
  moveLink: (id: string, dir: -1 | 1) => void;
  /** Move a link to an absolute index — used by drag-to-reorder. */
  moveLinkTo: (id: string, toIndex: number) => void;
}

const StudioContext = createContext<StudioValue | null>(null);

export function useStudio(): StudioValue {
  const ctx = useContext(StudioContext);
  if (!ctx) throw new Error("useStudio must be used within a StudioProvider");
  return ctx;
}

/** Generate a link id (secure-context crypto, with a plain fallback). */
function uid(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `id-${Math.random().toString(36).slice(2, 10)}`;
}

export function StudioProvider({
  initial,
  baseline = initial,
  children,
}: {
  initial: PageData;
  /**
   * What's actually stored server-side, when that differs from the starting
   * draft. A user with no page row yet opens on a draft seeded with their
   * username against an empty baseline, so the editor starts dirty and the Save
   * affordance is on screen — rather than pre-filling a name with no visible way
   * to keep it.
   */
  baseline?: PageData;
  children: ReactNode;
}) {
  const [history, setHistory] = useState<HistoryState>(() => ({
    past: [],
    present: initial,
    future: [],
  }));
  // A mirror of `history` that's current the instant a commit runs, so several
  // edits in one tick chain off each other instead of racing a pending render.
  // Only the writers below touch it, and they always write both — never assign
  // it during render.
  const historyRef = useRef<HistoryState>(history);
  // What the last commit touched, and when — the input to coalescing.
  const lastEdit = useRef<{ at: number; keys: string } | null>(null);
  const data = history.present;

  // The last-saved baseline: `dirty` compares against it, `reset` reverts to it,
  // and `markSaved` advances it to the current draft after a successful save.
  const [saved, setSaved] = useState<PageData>(baseline);
  const [section, setSection] = useState<SectionId>("profile");
  const [selection, setSelection] = useState<Selection>(null);
  const [selectNonce, setSelectNonce] = useState(0);
  const [revision, setRevision] = useState(0);
  const [deviceMode, setDeviceMode] = useState<DevicePref>("auto");
  // Not persisted, like `section` and `deviceMode`: "edit" is the right thing to
  // land on every visit, and the preview is one tap away.
  const [view, setView] = useState<StudioView>("edit");

  const dirty = useMemo(
    () => JSON.stringify(data) !== JSON.stringify(saved),
    [data, saved],
  );

  const applyHistory = useCallback((next: HistoryState) => {
    historyRef.current = next;
    setHistory(next);
  }, []);

  /**
   * Replace the draft and record the outgoing one on the undo stack.
   *
   * `coalesce` (the default) folds this edit into the entry already on the
   * stack when it touches the same fields as the previous one moments ago —
   * that entry holds the state from before the whole run began, which is where
   * undo should land. Discrete actions (adding a link, discarding changes) pass
   * false so they always stand on their own.
   */
  const commit = useCallback(
    (updater: (prev: PageData) => PageData, coalesce = true) => {
      const h = historyRef.current;
      const prev = h.present;
      const next = updater(prev);
      // Upstream no-op guards (a link dragged back onto its own slot) return the
      // same object — nothing changed, so nothing goes on the stack.
      if (next === prev) return;
      const keys = changedKeys(prev, next);
      const last = lastEdit.current;
      const merge =
        coalesce &&
        h.past.length > 0 &&
        last !== null &&
        last.keys === keys &&
        Date.now() - last.at < COALESCE_MS;
      lastEdit.current = { at: Date.now(), keys };
      applyHistory({
        past: merge ? h.past : [...h.past, prev].slice(-HISTORY_LIMIT),
        present: next,
        // Any fresh edit forks the timeline; the redo branch is gone.
        future: [],
      });
    },
    [applyHistory],
  );

  /**
   * Move one step along the history. Both directions replace the draft
   * wholesale, so both bump `revision` (re-seeding the uncontrolled name/bio)
   * and drop a selection pointing at a link the restored draft doesn't have.
   */
  const travel = useCallback(
    (dir: -1 | 1) => {
      const h = historyRef.current;
      const stack = dir === -1 ? h.past : h.future;
      if (stack.length === 0) return;
      const next =
        dir === -1
          ? {
              past: h.past.slice(0, -1),
              present: h.past[h.past.length - 1],
              future: [h.present, ...h.future].slice(0, HISTORY_LIMIT),
            }
          : {
              past: [...h.past, h.present].slice(-HISTORY_LIMIT),
              present: h.future[0],
              future: h.future.slice(1),
            };
      // The next edit starts a new run — never merge it into a restored entry.
      lastEdit.current = null;
      applyHistory(next);
      setRevision((r) => r + 1);
      setSelection((sel) =>
        sel?.startsWith("link:") &&
        !next.present.links.some((l) => `link:${l.id}` === sel)
          ? null
          : sel,
      );
    },
    [applyHistory],
  );

  const undo = useCallback(() => travel(-1), [travel]);
  const redo = useCallback(() => travel(1), [travel]);

  const value = useMemo<StudioValue>(() => {
    const update = (patch: Partial<PageData>) =>
      commit((prev) => ({ ...prev, ...patch }));

    const select = (sel: Selection, reveal = true) => {
      setSelection(sel);
      setSelectNonce((n) => n + 1);
      const next = sectionForSelection(sel);
      if (next) setSection(next);
      // Picking something is a request to change it, so hand over its controls.
      // On the phone layout that means showing the Edit pane — otherwise a tap in
      // the preview would draw an outline and dead-end, and a save blocked by a
      // blank link URL would scroll an off-screen panel. Inert on desktop.
      //
      // The music card is the exception: its cover, metadata and clip window are
      // edited on the card itself, so flipping panes would yank the owner away
      // from the field they just tapped — and back on the Preview pane the tap
      // would flip them away again. Its section is still routed, so the Music
      // panel is waiting when they cross over on their own.
      //
      // Nor for an incidental pick: a tap on empty background is how you look
      // *around* the preview, and flipping panes on it would make the phone
      // preview impossible to inspect.
      if (reveal && sel !== "music") setView("edit");
    };

    return {
      data,
      update,
      setData: (updater) => commit(updater),
      dirty,
      reset: () => {
        // Discarding is itself undoable — it's the one click in the editor that
        // can throw away an afternoon.
        commit(() => saved, false);
        setSelection(null);
        setRevision((r) => r + 1);
      },
      markSaved: () => setSaved(data),
      revision,
      undo,
      redo,
      canUndo: history.past.length > 0,
      canRedo: history.future.length > 0,
      section,
      setSection: (s) => {
        setSection(s);
        setSelection(null);
      },
      selection,
      select,
      selectNonce,
      deviceMode,
      setDeviceMode,
      view,
      setView,
      addLink: (seed) => {
        const id = uid();
        commit(
          (prev) => ({
            ...prev,
            links: [
              ...prev.links,
              {
                id,
                label: seed?.label ?? "",
                // A header has no destination. Seeding it with the usual
                // "https://" placeholder would leave every header tripping the
                // save guard's blank-URL check forever.
                href: seed?.kind === "header" ? "" : (seed?.href ?? "https://"),
                ...(seed?.kind && seed.kind !== "link"
                  ? { kind: seed.kind }
                  : {}),
              },
            ],
          }),
          false,
        );
        select(`link:${id}`);
      },
      duplicateLink: (id) => {
        const copyId = uid();
        commit((prev) => {
          const i = prev.links.findIndex((l) => l.id === id);
          if (i < 0) return prev;
          const links = [...prev.links];
          // Straight below the original, not appended: a duplicate is almost
          // always the start of a variation on its neighbour, and landing at
          // the bottom of a twenty-row list means scrolling to find it.
          links.splice(i + 1, 0, { ...prev.links[i], id: copyId });
          return { ...prev, links };
        }, false);
        select(`link:${copyId}`);
      },
      patchLink: (id, patch) =>
        commit((prev) => ({
          ...prev,
          links: prev.links.map((l) => (l.id === id ? { ...l, ...patch } : l)),
        })),
      removeLink: (id) => {
        commit(
          (prev) => ({
            ...prev,
            links: prev.links.filter((l) => l.id !== id),
          }),
          false,
        );
        // Don't leave a dangling selection pointing at a card that's now gone.
        if (selection === `link:${id}`) setSelection(null);
      },
      moveLink: (id, dir) =>
        commit((prev) => {
          const i = prev.links.findIndex((l) => l.id === id);
          const j = i + dir;
          if (i < 0 || j < 0 || j >= prev.links.length) return prev;
          const links = [...prev.links];
          [links[i], links[j]] = [links[j], links[i]];
          return { ...prev, links };
        }, false),
      moveLinkTo: (id, toIndex) =>
        commit((prev) => {
          const from = prev.links.findIndex((l) => l.id === id);
          if (from < 0) return prev;
          const to = Math.max(0, Math.min(toIndex, prev.links.length - 1));
          if (to === from) return prev;
          const links = [...prev.links];
          const [moved] = links.splice(from, 1);
          links.splice(to, 0, moved);
          return { ...prev, links };
        }, false),
    };
  }, [
    data,
    saved,
    dirty,
    section,
    selection,
    selectNonce,
    revision,
    deviceMode,
    view,
    commit,
    undo,
    redo,
    history.past.length,
    history.future.length,
  ]);

  return (
    <StudioContext.Provider value={value}>{children}</StudioContext.Provider>
  );
}
