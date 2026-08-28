"use client";

/**
 * Shared state for the page editor (/edit).
 *
 * One `draft: PageData` is the single source of truth. Every control writes the
 * draft; the live preview renders the real <ProfileView data={draft} />. This is
 * the core of the editor redesign: "controls that produce a PageData" + "the same
 * renderer everyone else sees", with PageData as the only contract between them.
 */

import {
  createContext,
  type ReactNode,
  useContext,
  useMemo,
  useState,
} from "react";
import type { LinkItem, PageData } from "~/lib/pages";

/** The left-panel sections, in nav order. */
export type SectionId = "profile" | "links" | "background" | "music" | "intro";

/** What's currently picked in the preview (drives which controls are focused). */
export type Selection =
  | "avatar"
  | "name"
  | "bio"
  | "background"
  | "panel"
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
  /** Bumped whenever the draft is replaced wholesale (reset). Uncontrolled
   * fields (the contentEditable name/bio) key off this to re-seed their DOM. */
  revision: number;

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
  /** Append a link (optionally seeded from a picked platform) and select it. */
  addLink: (seed?: { label?: string; href?: string }) => void;
  patchLink: (id: string, patch: Partial<LinkItem>) => void;
  removeLink: (id: string) => void;
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
  const [data, setDataState] = useState<PageData>(initial);
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

  const value = useMemo<StudioValue>(() => {
    const update = (patch: Partial<PageData>) =>
      setDataState((prev) => ({ ...prev, ...patch }));

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
      setData: setDataState,
      dirty,
      reset: () => {
        setDataState(saved);
        setSelection(null);
        setRevision((r) => r + 1);
      },
      markSaved: () => setSaved(data),
      revision,
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
        setDataState((prev) => ({
          ...prev,
          links: [
            ...prev.links,
            {
              id,
              label: seed?.label ?? "",
              href: seed?.href ?? "https://",
            },
          ],
        }));
        select(`link:${id}`);
      },
      patchLink: (id, patch) =>
        setDataState((prev) => ({
          ...prev,
          links: prev.links.map((l) => (l.id === id ? { ...l, ...patch } : l)),
        })),
      removeLink: (id) => {
        setDataState((prev) => ({
          ...prev,
          links: prev.links.filter((l) => l.id !== id),
        }));
        // Don't leave a dangling selection pointing at a card that's now gone.
        if (selection === `link:${id}`) setSelection(null);
      },
      moveLink: (id, dir) =>
        setDataState((prev) => {
          const i = prev.links.findIndex((l) => l.id === id);
          const j = i + dir;
          if (i < 0 || j < 0 || j >= prev.links.length) return prev;
          const links = [...prev.links];
          [links[i], links[j]] = [links[j], links[i]];
          return { ...prev, links };
        }),
      moveLinkTo: (id, toIndex) =>
        setDataState((prev) => {
          const from = prev.links.findIndex((l) => l.id === id);
          if (from < 0) return prev;
          const to = Math.max(0, Math.min(toIndex, prev.links.length - 1));
          if (to === from) return prev;
          const links = [...prev.links];
          const [moved] = links.splice(from, 1);
          links.splice(to, 0, moved);
          return { ...prev, links };
        }),
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
  ]);

  return (
    <StudioContext.Provider value={value}>{children}</StudioContext.Provider>
  );
}
