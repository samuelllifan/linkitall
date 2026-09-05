"use client";

/**
 * The left-panel section bodies. Each panel edits one slice of the draft
 * PageData and nothing else — this is the "organized, easy to navigate"
 * replacement for the ~15 popovers scattered across the old inline editor.
 *
 * Music and Intro reuse the app's existing editors verbatim; the rest are wired
 * directly to the draft so the preview updates live.
 */

import {
  type CSSProperties,
  Fragment,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { AvatarCropper } from "~/components/avatar-cropper";
import { DEFAULT_MEDIA_FRAME, MediaFramer } from "~/components/media-framer";
import { MusicEditor } from "~/components/music-editor";
import {
  BrandIcon,
  DEFAULT_BIO_BOX,
  DEFAULT_BIO_STYLE,
  DEFAULT_LINK_BOX,
  DEFAULT_NAME_BOX,
  DEFAULT_NAME_STYLE,
  DEFAULT_PANEL,
  discordUsername,
  getPlatform,
  isDiscordLink,
  NO_TINT,
  PLATFORMS,
  resolveLinkBox,
  sanitizeRichHtml,
} from "~/components/profile-view";
import { ColorPicker, TextStyleEditor } from "~/components/text-style-editor";
import { Button } from "~/components/ui/button";
import { CloseIcon } from "~/components/ui/close-icon";
import { Collapse } from "~/components/ui/collapse";
import { InfoTip } from "~/components/ui/info-tip";
import { Input } from "~/components/ui/input";
import {
  MAX_IMAGE_SIZE,
  readFileAsDataUrl,
  readImageDownscaled,
} from "~/lib/files";
import {
  DEFAULT_INTRO_CONFIG,
  DEFAULT_INTRO_SUBTEXT_STYLE,
  DEFAULT_INTRO_TEXT_STYLE,
  type IntroBackdrop,
  type IntroConfig,
} from "~/lib/intro";
import { DEFAULT_MUSIC_CONFIG } from "~/lib/music";
import {
  type Background,
  type BackgroundMemory,
  type BoxStyle,
  formatScheduleDate,
  isoToLocalInput,
  type LinkItem,
  type LinkSchedule,
  linkScheduleStatus,
  localInputToIso,
  type MediaBackground,
  type PageData,
  type PanelStyle,
  type TextStyle,
} from "~/lib/pages";
import { cn } from "~/lib/utils";
import { useStudio } from "./studio-context";
import {
  AccordionCard,
  BoxControls,
  Disclosure,
  Group,
  Modal,
  Row,
  Segmented,
  Slider,
  Swatch,
  ToggleRow,
} from "./studio-ui";

/** Ghost-button styling for destructive actions. */
const DESTRUCTIVE_GHOST = "text-danger hover:bg-danger/10 hover:text-danger";

/** Strip HTML tags from a rich-text value for a one-line collapsed summary. */
function plainText(value: string): string {
  return value.replace(/<[^>]*>/g, "").trim();
}

/**
 * A contentEditable field for the name/bio, which are stored as (sanitized) HTML
 * so existing inline formatting renders correctly instead of leaking raw tags —
 * the plain <input> that was here corrupted formatted values. Seeded once on
 * mount (the DOM then owns the value); remount via `key` to reload after a reset.
 *
 * Both the name and the bio are multi-line: Enter inserts a <br> (an allowed tag
 * the sanitizer keeps), and ProfileView renders both with `whitespace-pre-wrap`,
 * so a two-line stage name authored here lands exactly as typed.
 */
function RichTextField({
  initialHtml,
  placeholder,
  onInput,
  ariaLabel,
}: {
  initialHtml: string;
  placeholder: string;
  onInput: (html: string) => void;
  ariaLabel: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: seed once on mount; the DOM owns the value afterwards
  useEffect(() => {
    if (ref.current) ref.current.innerHTML = sanitizeRichHtml(initialHtml);
  }, []);
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: a contentEditable rich-text field is an interactive text region
    // biome-ignore lint/a11y/useAriaPropsSupportedByRole: aria-label names the editable region for assistive tech
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      aria-label={ariaLabel}
      data-placeholder={placeholder}
      spellCheck={false}
      onInput={(e) => {
        const el = e.currentTarget;
        if (!el.textContent) el.innerHTML = "";
        onInput(el.innerHTML);
      }}
      onKeyDown={(e) => {
        // Insert an explicit <br> rather than letting the browser wrap the line
        // in a <div>/<p>, which the sanitizer strips — collapsing the break.
        if (e.key === "Enter") {
          e.preventDefault();
          document.execCommand("insertLineBreak");
        }
      }}
      onPaste={(e) => {
        // Paste plain text (preserving line breaks) so foreign markup can't leak.
        e.preventDefault();
        const text = e.clipboardData.getData("text/plain");
        text.split(/\r?\n/).forEach((line, i) => {
          if (i > 0) document.execCommand("insertLineBreak");
          if (line) document.execCommand("insertText", false, line);
        });
      }}
      style={{ "--no-zoom-fs": "14px" } as CSSProperties}
      className="no-zoom w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm text-foreground outline-none transition-colors before:text-muted-foreground focus-visible:border-ring"
    />
  );
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export function ProfilePanel() {
  const { data, update, revision } = useStudio();
  const outline = data.avatarOutline;
  const [avatarError, setAvatarError] = useState<string | null>(null);

  async function pickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setAvatarError(null);
    try {
      // Downscaled on the way in: the avatar is stored as the source image (the
      // crop is a transform on top), so an untouched phone photo would otherwise
      // put several MB of base64 through every save. PNG keeps the transparency
      // a cut-out profile picture usually has.
      const avatar = await readImageDownscaled(
        file,
        MAX_IMAGE_SIZE.avatar,
        "image/png",
      );
      // A fresh photo starts un-cropped — don't inherit the old one's framing.
      update({ avatar, avatarCrop: undefined });
    } catch {
      setAvatarError("Couldn't read that image. Try another file.");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <AccordionCard
        id="avatar"
        title="Avatar"
        summary={data.avatar ? "Photo set" : "Default"}
      >
        <div className="flex gap-2">
          <Button
            asChild
            variant="outline"
            size="sm"
            className="flex-1 cursor-pointer"
          >
            <label>
              {data.avatar ? "Change photo" : "Upload photo"}
              <input
                type="file"
                accept="image/*"
                onChange={pickAvatar}
                className="hidden"
              />
            </label>
          </Button>
          {data.avatar ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                update({ avatar: undefined, avatarCrop: undefined })
              }
              className={DESTRUCTIVE_GHOST}
            >
              Remove
            </Button>
          ) : null}
        </div>
        {avatarError ? (
          <p className="text-danger text-xs">{avatarError}</p>
        ) : null}
        {data.avatar ? (
          <AvatarCropper
            src={data.avatar}
            value={data.avatarCrop}
            onChange={(crop) => update({ avatarCrop: crop })}
          />
        ) : null}
        <ToggleRow
          label="Outline"
          checked={outline?.enabled ?? false}
          onChange={(v) =>
            update({
              avatarOutline: { color: outline?.color ?? "#ffffff", enabled: v },
            })
          }
        />
        {outline?.enabled ? (
          <Row label="Outline color">
            <ColorPicker
              value={outline.color}
              onChange={(c) =>
                update({ avatarOutline: { enabled: true, color: c } })
              }
              ariaLabel="Outline color"
            />
          </Row>
        ) : null}
      </AccordionCard>

      <AccordionCard
        id="name"
        title="Name"
        summary={plainText(data.name) || "Empty"}
      >
        <RichTextField
          key={`name-${revision}`}
          initialHtml={data.name}
          placeholder="Your name"
          ariaLabel="Name"
          onInput={(html) => update({ name: html })}
        />
        {/* Merged with the defaults the page actually renders, so the toolbar
            reflects the real look (a fresh name IS bold) instead of showing
            every control as unset. */}
        <TextStyleEditor
          style={{ ...DEFAULT_NAME_STYLE, ...data.nameStyle }}
          onChange={(patch) =>
            update({ nameStyle: { ...data.nameStyle, ...patch } })
          }
          defaultSize={24}
        />
        <BoxControls
          box={data.nameBox ?? DEFAULT_NAME_BOX}
          onChange={(patch) =>
            update({
              nameBox: { ...(data.nameBox ?? DEFAULT_NAME_BOX), ...patch },
            })
          }
        />
      </AccordionCard>

      <AccordionCard
        id="bio"
        title="Bio"
        summary={plainText(data.bio) || "Empty"}
      >
        <RichTextField
          key={`bio-${revision}`}
          initialHtml={data.bio}
          placeholder="A short line about you"
          ariaLabel="Bio"
          onInput={(html) => update({ bio: html })}
        />
        <TextStyleEditor
          style={{ ...DEFAULT_BIO_STYLE, ...data.bioStyle }}
          onChange={(patch) =>
            update({ bioStyle: { ...data.bioStyle, ...patch } })
          }
          defaultSize={14}
        />
        {/* Older pages had one box behind the name and bio together, so an
            un-customized bio inherits the name's box — both here and in
            ProfileView. Patching onto that chain keeps the inherited look. */}
        <BoxControls
          box={data.bioBox ?? data.nameBox ?? DEFAULT_BIO_BOX}
          onChange={(patch) =>
            update({
              bioBox: {
                ...(data.bioBox ?? data.nameBox ?? DEFAULT_BIO_BOX),
                ...patch,
              },
            })
          }
        />
      </AccordionCard>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Links
// ---------------------------------------------------------------------------

function GripIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <circle cx="9" cy="6" r="1.6" />
      <circle cx="15" cy="6" r="1.6" />
      <circle cx="9" cy="12" r="1.6" />
      <circle cx="15" cy="12" r="1.6" />
      <circle cx="9" cy="18" r="1.6" />
      <circle cx="15" cy="18" r="1.6" />
    </svg>
  );
}

function LinkIcon({ className }: { className?: string }) {
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
      <path d="M9 15l6-6M8.5 13 6.5 15a3 3 0 1 0 4 4l2-2m1.5-4 2-2a3 3 0 1 0-4-4l-2 2" />
    </svg>
  );
}

/** The app's picture glyph — the same path the Background tab's nav icon uses. */
function ImageIcon({ className }: { className?: string }) {
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
    >
      <path d="M4 5h16v14H4zM4 15l4-4 4 4 3-3 5 5" />
    </svg>
  );
}

/** The add-link catalog: every known platform (pre-fills its URL prefix) plus a
 *  blank custom link. Mirrors the old editor's picker. */
const PICKER_OPTIONS = [
  ...PLATFORMS.map((p) => ({
    key: p.key,
    label: p.label,
    icon: p.icon,
    prefix: p.prefix,
    match: p.match as RegExp | undefined,
    color: p.color,
  })),
  {
    key: "custom",
    label: "Custom link",
    icon: LinkIcon,
    prefix: "https://",
    match: undefined as RegExp | undefined,
    color: undefined as string | undefined,
  },
];

/**
 * The link's real logo in a uniform tile — its custom uploaded logo, else the
 * detected platform's brand icon, else its first letter. Mirrors what the
 * preview renders so the list reads like the page.
 */
/** The Links section's own glyph, for the empty state. Matches the chain icon
 *  the section rail draws (studio-client.tsx). */
function LinkGlyphIcon({ className }: { className?: string }) {
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
    >
      <path d="M9 15l6-6M8.5 13 6.5 15a3 3 0 1 0 4 4l2-2m1.5-4 2-2a3 3 0 1 0-4-4l-2 2" />
    </svg>
  );
}

function LinkGlyph({ link }: { link: LinkItem }) {
  const platform = getPlatform(link.href);
  const Icon = platform?.icon;
  // The tile takes a wash of the platform's own brand colour, so the link list
  // reads as a coloured index of the page rather than a column of grey chips.
  // Hex-with-alpha rather than color-mix so it composites over whatever card
  // fill is behind it. Platforms with no brand colour of their own (x, tiktok,
  // github, email — the ones that ARE monochrome) keep the neutral tile, which
  // is correct: that IS their colour.
  const tint = platform?.color
    ? {
        backgroundColor: `${platform.color}1f`,
        boxShadow: `inset 0 0 0 1px ${platform.color}3d`,
      }
    : undefined;
  return (
    <span
      style={tint}
      className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted"
    >
      {link.logo ? (
        // biome-ignore lint/performance/noImgElement: small inline data-URL logo
        <img src={link.logo} alt="" className="size-4/5 object-contain" />
      ) : Icon ? (
        <BrandIcon icon={Icon} color={platform?.color} className="size-4" />
      ) : (
        <span className="font-semibold text-[11px] text-muted-foreground">
          {(link.label || "?").charAt(0).toUpperCase()}
        </span>
      )}
    </span>
  );
}

/**
 * "Scheduled" / "Ended" on a collapsed link row, so a link that visitors can't
 * currently see is obvious without opening it. Rendered only after mount: the
 * status is time-dependent, and the server's answer could differ from the
 * client's if the window's boundary falls between the two.
 */
function ScheduleBadge({ link }: { link: LinkItem }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  const status = linkScheduleStatus(link);
  if (status === "live") return null;
  return (
    <span
      className={cn(
        "shrink-0 rounded px-1.5 py-0.5 text-[11px]",
        // Amber for "not yet", danger for "no longer". Scheduled used to be grey,
        // which reads as disabled — the opposite of "this is deliberate and will
        // switch itself on".
        status === "ended"
          ? "bg-danger/10 text-danger"
          : "bg-warning/10 text-warning",
      )}
    >
      {status === "ended" ? "Ended" : "Scheduled"}
    </span>
  );
}

/** One bound of the window: a datetime input with a clear button. */
function ScheduleBound({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | undefined;
  onChange: (iso: string | undefined) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1.5">
        <input
          type="datetime-local"
          value={isoToLocalInput(value)}
          onChange={(e) => onChange(localInputToIso(e.target.value))}
          aria-label={label}
          // text-base until md so iOS doesn't zoom the page on focus.
          className="h-9 min-w-0 flex-1 rounded-md border border-input bg-transparent px-3 text-base outline-none transition-colors focus-visible:border-ring/70 focus-visible:ring-2 focus-visible:ring-ring/20 md:text-sm dark:bg-input/30"
        />
        {value ? (
          <button
            type="button"
            onClick={() => onChange(undefined)}
            aria-label={`Clear ${label.toLowerCase()}`}
            className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <CloseIcon className="size-4" />
          </button>
        ) : null}
      </div>
    </label>
  );
}

/**
 * The per-link publish window. Off by default; switching it on reveals an
 * optional start and/or end. Public visitors don't see the link outside the
 * window — the owner always sees it here, so the status line spells out what's
 * actually in effect.
 */
function LinkScheduleControls({
  link,
  onChange,
}: {
  link: LinkItem;
  onChange: (schedule: LinkSchedule | undefined) => void;
}) {
  const start = link.schedule?.start;
  const end = link.schedule?.end;
  const scheduled = Boolean(start || end);
  // The switch can be on before either bound is set, so it needs its own state
  // — `scheduled` alone would snap it back off the moment it was turned on.
  const [on, setOn] = useState(scheduled);
  // ...but local state also survives a Reset, which would leave the switch on
  // over a link whose schedule was just discarded. `revision` bumps whenever the
  // draft is replaced wholesale, so re-derive from the draft then.
  const { revision } = useStudio();
  // biome-ignore lint/correctness/useExhaustiveDependencies: `scheduled` is read on purpose only when `revision` changes — following it every render is exactly the snap-back this state exists to avoid.
  useEffect(() => {
    setOn(scheduled);
  }, [revision]);
  const status = linkScheduleStatus(link);

  // Build the next window from one changed bound, collapsing an all-empty
  // window back to `undefined` so the link stops counting as scheduled.
  const patchBound = (which: "start" | "end", iso: string | undefined) => {
    const next: LinkSchedule = { start, end, [which]: iso };
    onChange(next.start || next.end ? next : undefined);
  };

  const statusLine = !scheduled
    ? "No window set — always visible."
    : status === "scheduled"
      ? `Hidden until ${formatScheduleDate(start)}.`
      : status === "ended"
        ? `Ended ${formatScheduleDate(end)} — hidden from visitors.`
        : end
          ? `Live now — hides ${formatScheduleDate(end)}.`
          : "Live now.";

  return (
    <div className="flex flex-col gap-3 border-border border-t pt-3">
      <ToggleRow
        label="Schedule"
        hint="Visitors only see the link inside this window. You always see it here."
        checked={on}
        onChange={(v) => {
          setOn(v);
          // Turning it off drops the window entirely.
          if (!v) onChange(undefined);
        }}
      />
      {on ? (
        <>
          <ScheduleBound
            label="Show from"
            value={start}
            onChange={(iso) => patchBound("start", iso)}
          />
          <ScheduleBound
            label="Hide after"
            value={end}
            onChange={(iso) => patchBound("end", iso)}
          />
          <p
            className={cn(
              "text-xs",
              status === "live"
                ? "text-success"
                : status === "ended"
                  ? "text-danger"
                  : "text-warning",
            )}
          >
            {statusLine}
          </p>
        </>
      ) : null}
    </div>
  );
}

export function LinksPanel() {
  const {
    data,
    update,
    setData,
    selection,
    select,
    addLink,
    patchLink,
    removeLink,
    moveLink,
    moveLinkTo,
  } = useStudio();
  const horizontal = data.panelOrientation === "horizontal";
  // The page-wide default every link falls back to.
  const linkBox = data.linkBox ?? DEFAULT_LINK_BOX;

  // The add-link platform picker.
  const [pickerOpen, setPickerOpen] = useState(false);
  // Which link's logo upload failed, so the message sits on that link's card.
  const [logoError, setLogoError] = useState<{
    id: string;
    message: string;
  } | null>(null);

  async function pickLogo(id: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setLogoError(null);
    try {
      // Logos live inline in the page's `links` JSON and never render bigger
      // than a button glyph, so they're capped small; PNG for transparency.
      patchLink(id, {
        logo: await readImageDownscaled(file, MAX_IMAGE_SIZE.logo, "image/png"),
      });
    } catch {
      setLogoError({ id, message: "Couldn't read that image. Try another." });
    }
  }

  // A per-link box REPLACES the page default wholesale when the page renders it
  // (never merges), so the first edit materializes the fully-resolved box onto
  // the link — from then on that link stops tracking the default. Clearing the
  // deprecated `color` at the same time migrates legacy links onto `box`.
  function patchLinkBox(link: LinkItem, patch: Partial<BoxStyle>) {
    patchLink(link.id, {
      color: undefined,
      box: { ...resolveLinkBox(link, linkBox), ...patch },
    });
  }

  // Same whole-object precedence for text: seed from the page default so the
  // first edit doesn't silently drop the page-wide font/size.
  function patchLinkText(link: LinkItem, patch: Partial<TextStyle>) {
    patchLink(link.id, {
      textStyle: { ...(link.textStyle ?? data.linkStyle ?? {}), ...patch },
    });
  }

  // Push one link's resolved look onto every link AND make it the page-wide
  // default, so links added later inherit it too.
  function applyStyleToAllLinks(id: string) {
    setData((prev) => {
      const source = prev.links.find((l) => l.id === id);
      if (!source) return prev;
      const box = resolveLinkBox(source, prev.linkBox ?? DEFAULT_LINK_BOX);
      const textStyle = source.textStyle ?? prev.linkStyle;
      return {
        ...prev,
        linkBox: box,
        linkStyle: textStyle,
        links: prev.links.map((l) => ({
          ...l,
          color: undefined,
          box: { ...box },
          textStyle: textStyle ? { ...textStyle } : undefined,
        })),
      };
    });
  }

  // Drag-to-reorder, driven by the grip handle. The list is frozen during a
  // drag (we only commit the move on drop), so a thin insertion line shows where
  // the row will land and the dragged row dims — no jitter from live mutation.
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const rowRefs = useRef<Map<string, HTMLElement>>(new Map());
  const fromIndex = dragId ? data.links.findIndex((l) => l.id === dragId) : -1;

  function startDrag(e: React.PointerEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    const links = data.links;
    const start = links.findIndex((l) => l.id === id);
    setDragId(id);
    setDropIndex(start);
    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";
    // The insertion slot (0..length) for a pointer at `y`.
    const slotAt = (y: number) => {
      for (let i = 0; i < links.length; i++) {
        const el = rowRefs.current.get(links[i].id);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (y < r.top + r.height / 2) return i;
      }
      return links.length;
    };
    const onMove = (ev: PointerEvent) => setDropIndex(slotAt(ev.clientY));
    const onUp = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      const slot = slotAt(ev.clientY);
      // `slot` counts positions in the current array; removing the dragged item
      // first shifts a downward target left by one.
      moveLinkTo(id, slot > start ? slot - 1 : slot);
      setDragId(null);
      setDropIndex(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  // Show the insertion line at slot `s`, except where it wouldn't move anything.
  const showLineAt = (s: number) =>
    dragId !== null &&
    dropIndex === s &&
    s !== fromIndex &&
    s !== fromIndex + 1;
  // The brand gradient, spent on a line that only exists mid-drag: a deliberate
  // gesture, on screen for under a second, and it says exactly one thing
  // ("it lands here"). Cheaper than a permanent chromatic surface.
  const dropLine = <div className="brand-bg mx-1 h-0.5 rounded-full" />;

  return (
    <div className="flex flex-col gap-6">
      <Group label="Layout">
        <Segmented
          options={[
            { value: "vertical", label: "Stacked" },
            { value: "horizontal", label: "Logos" },
          ]}
          value={horizontal ? "horizontal" : "vertical"}
          onChange={(v) => update({ panelOrientation: v })}
        />
        <p className="text-muted-foreground text-xs">
          {horizontal
            ? "Links show as a row of logos — button and text styling don't apply."
            : "Links stack as full-width buttons."}
        </p>
      </Group>

      {/* The look every link starts from. A logo row draws neither the button
          surface nor its label, so these controls only exist when stacked. */}
      {horizontal ? null : (
        <Disclosure
          title="Default link style"
          summary={
            data.linkBox || data.linkStyle ? (
              // "Custom" means this has diverged from the default and is the
              // half worth noticing; it read as the same grey as "Default".
              <span className="text-[var(--sec)]">Custom</span>
            ) : (
              "Default"
            )
          }
        >
          <p className="text-muted-foreground text-xs">
            Applies to every link that hasn't been styled on its own.
          </p>
          <BoxControls
            box={linkBox}
            onChange={(patch) => update({ linkBox: { ...linkBox, ...patch } })}
          />
          <div className="border-border border-t pt-3">
            <TextStyleEditor
              style={data.linkStyle ?? {}}
              onChange={(patch) =>
                update({ linkStyle: { ...data.linkStyle, ...patch } })
              }
              defaultSize={14}
            />
          </div>
        </Disclosure>
      )}

      <Group label="Links">
        <div className="flex flex-col gap-2">
          {data.links.map((link) => {
            const active = selection === `link:${link.id}`;
            const dragging = dragId === link.id;
            // Drives the row's 2px left rail (see the `--plat` style below).
            const platform = getPlatform(link.href);
            // Carries its own look (including a legacy `color`) rather than
            // following the page-wide default.
            const styled = Boolean(link.box || link.color || link.textStyle);
            return (
              <Fragment key={link.id}>
                {showLineAt(data.links.indexOf(link)) ? dropLine : null}
                <div
                  ref={(el) => {
                    if (el) rowRefs.current.set(link.id, el);
                    else rowRefs.current.delete(link.id);
                  }}
                  data-focus={`link:${link.id}`}
                  // `--plat` is this link's platform colour, painted as a 2px
                  // rail down the left edge. Same open/closed classes as
                  // CollapsibleCard (studio-ui.tsx) — this row hand-rolls the
                  // same card, and the two class strings had already been
                  // duplicated once; `.sec-open` is now the single source.
                  style={
                    {
                      // A recognized platform with no brand colour of its own
                      // (x, tiktok, github, threads, snapchat — the brands that
                      // ARE monochrome) still gets a rail, in neutral: rails on
                      // only some rows read as a rendering bug rather than as
                      // information. An unrecognized URL gets none, which is the
                      // honest answer — we don't know what it is.
                      "--plat": platform
                        ? (platform.color ?? "var(--muted-foreground)")
                        : "transparent",
                    } as CSSProperties
                  }
                  className={cn(
                    "relative scroll-mt-3 overflow-hidden rounded-lg border transition-colors duration-200 before:absolute before:inset-y-0 before:left-0 before:w-[2px] before:bg-[var(--plat)]",
                    dragging && "opacity-40",
                    active
                      ? "sec-open"
                      : "border-border hover:border-muted-foreground/40",
                  )}
                >
                  {/* biome-ignore lint/a11y/useKeyWithClickEvents: row selection is mirror-able from the preview; this is a convenience */}
                  {/* biome-ignore lint/a11y/noStaticElementInteractions: clickable list row */}
                  <div
                    onClick={() => select(active ? null : `link:${link.id}`)}
                    className="flex cursor-pointer items-center gap-2.5 px-3 py-2.5 transition-colors hover:bg-muted/40"
                  >
                    <button
                      type="button"
                      aria-label={`Reorder ${link.label || "link"} — drag, or use arrow keys`}
                      onPointerDown={(e) => startDrag(e, link.id)}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => {
                        if (e.key === "ArrowUp") {
                          e.preventDefault();
                          moveLink(link.id, -1);
                        } else if (e.key === "ArrowDown") {
                          e.preventDefault();
                          moveLink(link.id, 1);
                        }
                      }}
                      className="-ml-1 flex size-7 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 active:cursor-grabbing active:text-[var(--sec)]"
                    >
                      <GripIcon className="size-4" />
                    </button>
                    <LinkGlyph link={link} />
                    <span className="min-w-0 flex-1 truncate font-medium text-sm">
                      {link.label || (
                        <span className="text-muted-foreground">Untitled</span>
                      )}
                    </span>
                    <ScheduleBadge link={link} />
                  </div>
                  {/* The shared <Collapse>. This was a fourth hand-rolled copy
                      of the grid-rows 0fr→1fr trick, transitioning only the
                      rows on literal timings — so opening a link card and
                      opening any other disclosure in the app ran at two
                      different curves. */}
                  <Collapse open={active}>
                    <div className="flex flex-col gap-2 border-border border-t p-3">
                      <Input
                        value={link.label}
                        onChange={(e) =>
                          patchLink(link.id, { label: e.target.value })
                        }
                        placeholder="Label"
                      />
                      {isDiscordLink(link.href) ? (
                        <div className="flex items-center gap-2">
                          <div className="flex flex-1 items-center rounded-md border border-border bg-transparent pl-3 focus-within:border-ring">
                            <span className="text-muted-foreground text-sm">
                              discord:
                            </span>
                            <Input
                              value={discordUsername(link.href)}
                              onChange={(e) =>
                                patchLink(link.id, {
                                  href: `discord:${e.target.value.trim()}`,
                                })
                              }
                              placeholder="username"
                              className="border-0 bg-transparent px-1 focus-visible:ring-0"
                            />
                          </div>
                          <InfoTip label="Copies the username on click — no link to open." />
                        </div>
                      ) : (
                        <Input
                          value={link.href}
                          onChange={(e) =>
                            patchLink(link.id, { href: e.target.value })
                          }
                          placeholder="https://…"
                        />
                      )}
                      {!getPlatform(link.href) && !isDiscordLink(link.href) ? (
                        <div className="flex items-center gap-2">
                          <LinkGlyph link={link} />
                          <Button
                            asChild
                            variant="outline"
                            size="sm"
                            className="cursor-pointer"
                          >
                            <label>
                              {link.logo ? "Change logo" : "Upload logo"}
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => pickLogo(link.id, e)}
                                className="hidden"
                              />
                            </label>
                          </Button>
                          {link.logo ? (
                            <button
                              type="button"
                              onClick={() =>
                                patchLink(link.id, { logo: undefined })
                              }
                              className="rounded px-1.5 py-0.5 text-muted-foreground text-xs transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                            >
                              Remove logo
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                      {logoError?.id === link.id ? (
                        <p className="text-danger text-xs">
                          {logoError.message}
                        </p>
                      ) : null}
                      {horizontal ? null : (
                        <Disclosure
                          title="Style"
                          summary={
                            styled ? (
                              <span className="text-[var(--sec)]">Custom</span>
                            ) : (
                              "Default"
                            )
                          }
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-muted-foreground text-xs">
                              {styled
                                ? "Overriding the default link style."
                                : "Following the default link style — editing here overrides it for this link only."}
                            </p>
                            {styled ? (
                              <button
                                type="button"
                                onClick={() =>
                                  patchLink(link.id, {
                                    box: undefined,
                                    color: undefined,
                                    textStyle: undefined,
                                  })
                                }
                                className="shrink-0 rounded px-1.5 py-0.5 text-muted-foreground text-xs transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                              >
                                Use default
                              </button>
                            ) : null}
                          </div>
                          <BoxControls
                            box={resolveLinkBox(link, linkBox)}
                            onChange={(patch) => patchLinkBox(link, patch)}
                          />
                          <div className="flex flex-col gap-3 border-border border-t pt-3">
                            <TextStyleEditor
                              style={link.textStyle ?? data.linkStyle ?? {}}
                              onChange={(patch) => patchLinkText(link, patch)}
                              defaultSize={14}
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => applyStyleToAllLinks(link.id)}
                            >
                              Apply to all links
                            </Button>
                          </div>
                        </Disclosure>
                      )}
                      <LinkScheduleControls
                        link={link}
                        onChange={(schedule) =>
                          patchLink(link.id, { schedule })
                        }
                      />
                      <button
                        type="button"
                        onClick={() => removeLink(link.id)}
                        className="self-start rounded px-1.5 py-0.5 text-danger text-xs transition-colors hover:bg-danger/10 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                      >
                        Remove
                      </button>
                    </div>
                  </Collapse>
                </div>
              </Fragment>
            );
          })}
          {showLineAt(data.links.length) ? dropLine : null}
          {data.links.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-border/70 border-dashed px-4 py-8 text-center">
              <LinkGlyphIcon className="size-6 text-[var(--sec)] opacity-70" />
              <p className="text-muted-foreground text-xs">
                No links yet — add your first one below.
              </p>
            </div>
          ) : null}
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setPickerOpen(true)}
          className="w-full"
        >
          + Add link
        </Button>
      </Group>

      {/* Always mounted — the Modal owns its own open/close animation, and a
          `pickerOpen ? … : null` here would take it away before the exit ran. */}
      <Modal
        open={pickerOpen}
        title="Add a link"
        description="Pick a platform to pre-fill it, or add a custom link."
        onClose={() => setPickerOpen(false)}
      >
        <div className="grid max-h-[55vh] grid-cols-4 gap-2 overflow-y-auto sm:grid-cols-5">
          {PICKER_OPTIONS.map((option) => {
            const count = option.match
              ? data.links.filter((l) => option.match?.test(l.href)).length
              : 0;
            return (
              <button
                key={option.key}
                type="button"
                title={option.label}
                aria-label={option.label}
                onClick={() => {
                  addLink({
                    label: option.key === "custom" ? "New link" : option.label,
                    href: option.prefix,
                  });
                  setPickerOpen(false);
                }}
                className="relative flex aspect-square items-center justify-center rounded-lg border border-border text-foreground transition-colors hover:border-muted-foreground/40 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <BrandIcon
                  icon={option.icon}
                  color={option.color}
                  className="size-5"
                />
                {count > 0 ? (
                  <span className="absolute top-1 right-1 flex size-4 items-center justify-center rounded-full bg-foreground font-medium text-[10px] text-background">
                    {count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </Modal>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Background
// ---------------------------------------------------------------------------

type BgKind = Background["type"];

/** The per-type settings the Studio remembers, straight off `BackgroundMemory`
 *  so the remembered shape and the editable shape can't drift apart. */
type GradientConfig = NonNullable<BackgroundMemory["gradient"]>;
type GridConfig = NonNullable<BackgroundMemory["grid"]>;
type AuroraConfig = NonNullable<BackgroundMemory["aurora"]>;

/**
 * The Aurora swatch, drawn from the shader's own horizon rather than eyeballed.
 * `profile-view`'s aurora is a broad light-top → dark-bottom ramp whose
 * transition line undulates — explicitly not a radial glow. So: fill everything
 * above that wavy line with the glow colour, then blur it, which turns the hard
 * edge into the shader's wide, smooth falloff while keeping the undulation.
 *
 * GAIN scales the wave up: at the shader's true amplitude the undulation is
 * only ~4px in a 48px-tall thumbnail, too small to read as a wave at all.
 */
function auroraPreview(color: string, baseColor: string): string {
  const H = 48;
  const GAIN = 1.6;
  // AURORA_FRAG's `wave`, at t = 0 and without its noise term.
  const horizon = (x: number) =>
    0.45 +
    GAIN *
      (Math.sin(x * 2 * Math.PI * 1.1 + 0.6) * 0.085 +
        Math.sin(x * 2 * Math.PI * 2.3 - 1.2) * 0.042);
  const edge = Array.from({ length: 21 }, (_, i) => i / 20)
    .reverse()
    .map((x) => `L ${(x * 100).toFixed(1)} ${(horizon(x) * H).toFixed(1)}`)
    .join(" ");
  // The lit shape runs well past the top and sides so the blur can only soften
  // the horizon — never darken the top edge or the corners.
  const light = `M -30 -60 H 130 V ${(horizon(1) * H).toFixed(1)} ${edge} V -60 Z`;
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 ${H}' preserveAspectRatio='none'>` +
    `<defs><filter id='b' x='-60%' y='-60%' width='220%' height='220%'>` +
    `<feGaussianBlur stdDeviation='10'/></filter></defs>` +
    `<rect width='100' height='${H}' fill='${baseColor}'/>` +
    `<path d='${light}' fill='${color}' filter='url(#b)'/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") center/100% 100% no-repeat, ${baseColor}`;
}

/** A grid thumbnail. The cell is forced small so several lines show however
 *  large the real cell is. */
function gridPreview(g: GridConfig): string {
  const t = Math.max(0, g.thickness);
  return (
    `linear-gradient(to right, ${g.lineColor} ${t}px, transparent ${t}px) 0 0/12px 12px, ` +
    `linear-gradient(to bottom, ${g.lineColor} ${t}px, transparent ${t}px) 0 0/12px 12px, ` +
    `${g.baseColor}`
  );
}

/** The gradient exactly as `PageBackground` paints it. */
function gradientPreview(g: GradientConfig): string {
  const dir = g.direction === "horizontal" ? "to right" : "to bottom";
  return `linear-gradient(${dir}, ${g.from}, ${g.distribution ?? 50}%, ${g.to})`;
}

const BG_DEFAULTS = {
  custom: "#1e2433",
  gradient: {
    from: "#3b82f6",
    to: "#8b5cf6",
    direction: "vertical",
    distribution: 50,
  },
  grid: {
    baseColor: "#0a0a0a",
    lineColor: "#2a2a2a",
    size: 32,
    thickness: 1,
  },
  aurora: { color: "#e6e6e6", baseColor: "#000000", speed: 5 },
} satisfies {
  custom: string;
  gradient: GradientConfig;
  grid: GridConfig;
  aurora: AuroraConfig;
};

/** Minimum accepted resolution for an imported background image/video. */
const MIN_MEDIA = { w: 640, h: 480 };
/** Cap on an imported file's size — its data URL lives inline in the draft. */
const MAX_MEDIA_BYTES = 8 * 1024 * 1024;

/*
 * Each type's settings resolve "active background → remembered → default". That
 * chain is what makes switching type and back restore the colors you had (and
 * what lets each picker swatch show *your* gradient rather than a generic one).
 */

function resolveCustom(d: PageData): string {
  const bg = d.background;
  if (bg?.type === "custom") return bg.color;
  return d.bgMemory?.custom ?? BG_DEFAULTS.custom;
}

function resolveGradient(d: PageData): GradientConfig {
  const bg = d.background;
  const m = bg?.type === "gradient" ? bg : d.bgMemory?.gradient;
  if (!m) return { ...BG_DEFAULTS.gradient };
  return {
    from: m.from,
    to: m.to,
    direction: m.direction ?? "vertical",
    distribution: m.distribution ?? 50,
  };
}

function resolveGrid(d: PageData): GridConfig {
  const bg = d.background;
  const m = bg?.type === "grid" ? bg : d.bgMemory?.grid;
  if (!m) return { ...BG_DEFAULTS.grid };
  return {
    baseColor: m.baseColor,
    lineColor: m.lineColor,
    size: m.size,
    thickness: m.thickness,
  };
}

function resolveAurora(d: PageData): AuroraConfig {
  const bg = d.background;
  const m = bg?.type === "aurora" ? bg : d.bgMemory?.aurora;
  if (!m) return { ...BG_DEFAULTS.aurora };
  return { color: m.color, baseColor: m.baseColor, speed: m.speed };
}

function resolveMedia(d: PageData): MediaBackground | undefined {
  const bg = d.background;
  if (bg?.type !== "media") return d.bgMemory?.media;
  return {
    kind: bg.kind,
    src: bg.src,
    posX: bg.posX,
    posY: bg.posY,
    zoom: bg.zoom,
    dim: bg.dim,
    blur: bg.blur,
  };
}

/**
 * Fold the active background's own settings into the remembered set. The old
 * editor seeded this once at load for pages saved before `bgMemory` existed;
 * doing it on every switch covers those pages too, so leaving a type never
 * loses the settings that were in use.
 */
function rememberActive(d: PageData): BackgroundMemory | undefined {
  const type = d.background?.type;
  // The theme default carries no settings, so there's nothing to fold in.
  if (!type || type === "default") return d.bgMemory;
  const memory: BackgroundMemory = { ...d.bgMemory };
  if (type === "custom") memory.custom = resolveCustom(d);
  else if (type === "gradient") memory.gradient = resolveGradient(d);
  else if (type === "grid") memory.grid = resolveGrid(d);
  else if (type === "aurora") memory.aurora = resolveAurora(d);
  else if (type === "media") memory.media = resolveMedia(d);
  return memory;
}

/** Read an image/video data URL's intrinsic size; null if it won't decode. */
function readMediaDims(
  src: string,
  kind: "image" | "video",
): Promise<{ w: number; h: number } | null> {
  return new Promise((resolve) => {
    if (kind === "image") {
      const img = new Image();
      img.onerror = () => resolve(null);
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.src = src;
    } else {
      const v = document.createElement("video");
      v.onerror = () => resolve(null);
      v.onloadedmetadata = () => resolve({ w: v.videoWidth, h: v.videoHeight });
      v.src = src;
    }
  });
}

export function BackgroundPanel() {
  const { data, setData } = useStudio();
  const mediaInput = useRef<HTMLInputElement | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const kind: BgKind = data.background?.type ?? "default";
  const media = resolveMedia(data);
  const aurora = resolveAurora(data);

  // Live swatches: each one previews the settings that choosing it would
  // restore, so the picker shows your own colors rather than generic ones.
  const swatches: {
    kind: BgKind;
    label: string;
    preview?: string;
    icon?: ReactNode;
  }[] = [
    { kind: "default", label: "Default", preview: "oklch(0.145 0 0)" },
    { kind: "custom", label: "Color", preview: resolveCustom(data) },
    {
      kind: "gradient",
      label: "Gradient",
      preview: gradientPreview(resolveGradient(data)),
    },
    {
      kind: "aurora",
      label: "Aurora",
      preview: auroraPreview(aurora.color, aurora.baseColor),
    },
    { kind: "grid", label: "Grid", preview: gridPreview(resolveGrid(data)) },
    {
      // Whatever the owner imported — or the picture glyph when there's nothing
      // to show yet. A video frame can't be a CSS background, so it keeps the
      // glyph too.
      kind: "media",
      label: "Image",
      ...(media?.kind === "image"
        ? { preview: `url("${media.src}") center/cover no-repeat` }
        : { icon: <ImageIcon className="size-5" /> }),
    },
  ];

  function openMediaPicker() {
    setMediaError(null);
    mediaInput.current?.click();
  }

  async function pickMedia(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset now, before any await, so re-picking the same file still fires.
    e.target.value = "";
    if (!file) return;
    setMediaError(null);
    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");
    if (!isImage && !isVideo) {
      setMediaError("Please choose an image or video file.");
      return;
    }
    if (file.size > MAX_MEDIA_BYTES) {
      setMediaError("That file is too large. Please keep it under 8 MB.");
      return;
    }
    try {
      const src = await readFileAsDataUrl(file);
      const mediaKind = isVideo ? "video" : "image";
      const dims = await readMediaDims(src, mediaKind);
      if (!dims) {
        setMediaError("Couldn't read that file. Try another.");
        return;
      }
      if (dims.w < MIN_MEDIA.w || dims.h < MIN_MEDIA.h) {
        setMediaError(
          `Resolution too low — minimum ${MIN_MEDIA.w}×${MIN_MEDIA.h}px (got ${dims.w}×${dims.h}).`,
        );
        return;
      }
      setData((prev) => {
        // A replacement inherits the dim/blur already in effect, so swapping the
        // file doesn't reset the look. Framing starts centered.
        const previous = resolveMedia(prev);
        const next: MediaBackground = {
          kind: mediaKind,
          src,
          ...DEFAULT_MEDIA_FRAME,
          dim: previous?.dim,
          blur: previous?.blur,
        };
        return {
          ...prev,
          background: { type: "media", ...next },
          bgMemory: { ...prev.bgMemory, media: next },
        };
      });
    } catch {
      setMediaError("Couldn't process that file. Try another.");
    }
  }

  function choose(next: BgKind) {
    // Nothing imported yet, so there's no background to apply — go get one.
    if (next === "media" && !media) {
      openMediaPicker();
      return;
    }
    setData((prev) => {
      const memory = rememberActive(prev);
      if (next === "custom") {
        const color = memory?.custom ?? BG_DEFAULTS.custom;
        return {
          ...prev,
          background: { type: "custom", color },
          bgMemory: { ...memory, custom: color },
        };
      }
      if (next === "gradient") {
        const g = memory?.gradient ?? { ...BG_DEFAULTS.gradient };
        return {
          ...prev,
          background: { type: "gradient", ...g },
          bgMemory: { ...memory, gradient: g },
        };
      }
      if (next === "grid") {
        const g = memory?.grid ?? { ...BG_DEFAULTS.grid };
        return {
          ...prev,
          background: { type: "grid", ...g },
          bgMemory: { ...memory, grid: g },
        };
      }
      if (next === "aurora") {
        const a = memory?.aurora ?? { ...BG_DEFAULTS.aurora };
        return {
          ...prev,
          background: { type: "aurora", ...a },
          bgMemory: { ...memory, aurora: a },
        };
      }
      if (next === "media") {
        const m = memory?.media;
        if (!m) return prev;
        return {
          ...prev,
          background: { type: "media", ...m },
          bgMemory: { ...memory, media: m },
        };
      }
      return { ...prev, background: { type: "default" }, bgMemory: memory };
    });
  }

  return (
    // Both sections stay open: together they're well under one panel-height, so
    // collapsing them would only hide short content behind a click (and leave
    // the tab looking like two empty bars).
    <div className="flex flex-col gap-6">
      <Group label="Page background" focus="background">
        <div className="grid grid-cols-3 gap-3">
          {swatches.map((s) => (
            <Swatch
              key={s.kind}
              label={s.label}
              preview={s.preview}
              icon={s.icon}
              selected={kind === s.kind}
              onClick={() => choose(s.kind)}
            />
          ))}
        </div>
        <input
          ref={mediaInput}
          type="file"
          accept="image/*,video/*"
          onChange={pickMedia}
          className="hidden"
        />
        {mediaError ? (
          <p className="text-danger text-xs">{mediaError}</p>
        ) : null}
        <BackgroundSubControls onReplace={openMediaPicker} />
      </Group>

      <PanelControls />
    </div>
  );
}

/**
 * Per-type background settings (color pickers, sliders). Every edit writes both
 * the active background and its remembered copy, so switching type and back
 * returns to what you had here rather than to the stock defaults.
 */
function BackgroundSubControls({ onReplace }: { onReplace: () => void }) {
  const { data, setData } = useStudio();
  const bg = data.background;

  const setCustom = (color: string) =>
    setData((prev) => ({
      ...prev,
      background: { type: "custom", color },
      bgMemory: { ...prev.bgMemory, custom: color },
    }));

  const patchGradient = (patch: Partial<GradientConfig>) =>
    setData((prev) => {
      const next = { ...resolveGradient(prev), ...patch };
      return {
        ...prev,
        background: { type: "gradient", ...next },
        bgMemory: { ...prev.bgMemory, gradient: next },
      };
    });

  const patchGrid = (patch: Partial<GridConfig>) =>
    setData((prev) => {
      const next = { ...resolveGrid(prev), ...patch };
      return {
        ...prev,
        background: { type: "grid", ...next },
        bgMemory: { ...prev.bgMemory, grid: next },
      };
    });

  const patchAurora = (patch: Partial<AuroraConfig>) =>
    setData((prev) => {
      const next = { ...resolveAurora(prev), ...patch };
      return {
        ...prev,
        background: { type: "aurora", ...next },
        bgMemory: { ...prev.bgMemory, aurora: next },
      };
    });

  const patchMedia = (patch: Partial<MediaBackground>) =>
    setData((prev) => {
      const current = resolveMedia(prev);
      if (!current) return prev;
      const next = { ...current, ...patch };
      return {
        ...prev,
        background: { type: "media", ...next },
        bgMemory: { ...prev.bgMemory, media: next },
      };
    });

  function removeMedia() {
    // Drop the import entirely — the active background AND the remembered copy
    // — so the Image swatch offers a fresh upload instead of the file just
    // removed.
    setData((prev) => {
      const { media: _removed, ...memory } = prev.bgMemory ?? {};
      return { ...prev, background: { type: "default" }, bgMemory: memory };
    });
  }

  if (!bg || bg.type === "default") return null;

  if (bg.type === "custom") {
    return (
      <Row label="Color">
        <ColorPicker
          value={bg.color}
          onChange={setCustom}
          ariaLabel="Background color"
        />
      </Row>
    );
  }

  if (bg.type === "gradient") {
    const distribution = bg.distribution ?? 50;
    return (
      <div className="flex flex-col gap-3">
        <Row label="From">
          <ColorPicker
            value={bg.from}
            onChange={(c) => patchGradient({ from: c })}
            ariaLabel="Gradient start"
          />
        </Row>
        <Row label="To">
          <ColorPicker
            value={bg.to}
            onChange={(c) => patchGradient({ to: c })}
            ariaLabel="Gradient end"
          />
        </Row>
        <Segmented
          options={[
            { value: "vertical", label: "Vertical" },
            { value: "horizontal", label: "Horizontal" },
          ]}
          value={bg.direction ?? "vertical"}
          onChange={(v) => patchGradient({ direction: v })}
        />
        {/* The blend point, painted into its own track so the thumb sits
            exactly where the two colors meet. */}
        <Slider
          label="Distribution"
          value={distribution}
          min={0}
          max={100}
          step={10}
          onChange={(v) => patchGradient({ distribution: v })}
          format={(v) => `${v}%`}
          track={`linear-gradient(to right, ${bg.from} 0%, ${bg.from} ${distribution}%, ${bg.to} ${distribution}%, ${bg.to} 100%)`}
        />
      </div>
    );
  }

  if (bg.type === "grid") {
    return (
      <div className="flex flex-col gap-3">
        <Row label="Base color">
          <ColorPicker
            value={bg.baseColor}
            onChange={(c) => patchGrid({ baseColor: c })}
            ariaLabel="Grid base color"
          />
        </Row>
        <Row label="Line color">
          <ColorPicker
            value={bg.lineColor}
            onChange={(c) => patchGrid({ lineColor: c })}
            ariaLabel="Grid line color"
          />
        </Row>
        <Slider
          label="Cell size"
          value={bg.size}
          min={16}
          max={160}
          step={8}
          onChange={(v) => patchGrid({ size: v })}
          format={(v) => `${v}px`}
        />
        <Slider
          label="Thickness"
          value={bg.thickness}
          min={1}
          max={8}
          onChange={(v) => patchGrid({ thickness: v })}
          format={(v) => `${v}px`}
        />
      </div>
    );
  }

  if (bg.type === "aurora") {
    return (
      <div className="flex flex-col gap-3">
        <Row label="Glow color">
          <ColorPicker
            value={bg.color}
            onChange={(c) => patchAurora({ color: c })}
            ariaLabel="Aurora glow color"
          />
        </Row>
        <Row label="Base color">
          <ColorPicker
            value={bg.baseColor}
            onChange={(c) => patchAurora({ baseColor: c })}
            ariaLabel="Aurora base color"
          />
        </Row>
        <Slider
          label="Speed"
          value={bg.speed}
          min={0}
          max={10}
          onChange={(v) => patchAurora({ speed: v })}
        />
      </div>
    );
  }

  if (bg.type === "media") {
    return (
      <div className="flex flex-col gap-3">
        <MediaFramer
          src={bg.src}
          kind={bg.kind}
          value={{ posX: bg.posX, posY: bg.posY, zoom: bg.zoom }}
          onChange={(frame) => patchMedia(frame)}
        />
        <Slider
          label="Dim"
          value={bg.dim ?? 0}
          min={0}
          max={100}
          step={5}
          onChange={(v) => patchMedia({ dim: v })}
          format={(v) => `${v}%`}
        />
        <Slider
          label="Blur"
          value={bg.blur ?? 0}
          min={0}
          max={24}
          onChange={(v) => patchMedia({ blur: v })}
          format={(v) => `${v}px`}
        />
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onReplace}
            className="text-muted-foreground"
          >
            Replace
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={removeMedia}
            className={DESTRUCTIVE_GHOST}
          >
            Remove
          </Button>
        </div>
      </div>
    );
  }

  return null;
}

/** The panel behind the whole profile block (transparent / color / glass …). */
function PanelControls() {
  const { data, update } = useStudio();
  const panel = data.panel ?? DEFAULT_PANEL;
  const type = panel.type;

  function choose(next: PanelStyle["type"]) {
    // Carry the current tint forward so switching type doesn't reset to a
    // stranger color — but never the no-tint sentinel, which is only valid on
    // glass (a solid Color panel needs a real hex).
    const tint =
      (panel.type === "color" || panel.type === "glass") &&
      panel.color !== NO_TINT
        ? panel.color
        : "#000000";
    if (next === "color") {
      update({
        panel: {
          type: "color",
          color: tint,
          opacity: panel.type === "color" ? panel.opacity : 40,
        },
      });
    } else if (next === "gradient") {
      update({
        panel:
          panel.type === "gradient"
            ? panel
            : {
                type: "gradient",
                from: "#3b82f6",
                to: "#8b5cf6",
                direction: "vertical",
                opacity: 60,
              },
      });
    } else if (next === "glass") {
      update({
        panel: {
          type: "glass",
          color: "#ffffff",
          opacity: panel.type === "glass" ? panel.opacity : 12,
        },
      });
    } else {
      update({ panel: { type: "transparent" } });
    }
  }

  return (
    // `focus="panel"` keeps the preview bridge working: clicking the panel on
    // the page still scrolls to and flashes these controls.
    <Group label="Panel" focus="panel">
      <Segmented
        options={[
          { value: "transparent", label: "None" },
          { value: "color", label: "Color" },
          { value: "gradient", label: "Gradient" },
          { value: "glass", label: "Glass" },
        ]}
        value={type}
        onChange={choose}
      />
      {panel.type === "color" || panel.type === "glass" ? (
        <>
          <Row label={panel.type === "glass" ? "Tint" : "Color"}>
            {/* Glass can go untinted — a purely refracted pane. */}
            <ColorPicker
              value={panel.color}
              onChange={(c) => update({ panel: { ...panel, color: c } })}
              ariaLabel="Panel color"
              allowNone={panel.type === "glass"}
            />
          </Row>
          {/* An untinted glass panel has no fill, so opacity means nothing. */}
          {panel.type === "glass" && panel.color === NO_TINT ? null : (
            <Slider
              label="Opacity"
              value={panel.opacity}
              min={0}
              max={100}
              step={5}
              onChange={(v) => update({ panel: { ...panel, opacity: v } })}
              format={(v) => `${v}%`}
            />
          )}
        </>
      ) : null}
      {panel.type === "gradient" ? (
        <>
          <Row label="From">
            <ColorPicker
              value={panel.from}
              onChange={(c) => update({ panel: { ...panel, from: c } })}
              ariaLabel="Panel gradient start color"
            />
          </Row>
          <Row label="To">
            <ColorPicker
              value={panel.to}
              onChange={(c) => update({ panel: { ...panel, to: c } })}
              ariaLabel="Panel gradient end color"
            />
          </Row>
          <Segmented
            options={[
              { value: "vertical", label: "Vertical" },
              { value: "horizontal", label: "Horizontal" },
            ]}
            value={panel.direction ?? "vertical"}
            onChange={(v) => update({ panel: { ...panel, direction: v } })}
          />
          <Slider
            label="Opacity"
            value={panel.opacity}
            min={0}
            max={100}
            step={5}
            onChange={(v) => update({ panel: { ...panel, opacity: v } })}
            format={(v) => `${v}%`}
          />
        </>
      ) : null}
    </Group>
  );
}

// ---------------------------------------------------------------------------
// Music & Intro — reuse the app's existing editors verbatim.
// ---------------------------------------------------------------------------

export function MusicPanel() {
  const { data, update } = useStudio();
  // MusicEditor carries its own enable toggle, so it's the single source here.
  return (
    <div data-focus="music" className="scroll-mt-3 flex flex-col gap-4">
      <MusicEditor
        // MusicEditor keeps the pasted Spotify URL and the uploaded file's name
        // in its own state, so remount it when the config appears or disappears
        // — otherwise Remove leaves the link of the deleted song sitting in the
        // field, reading like the removal didn't take.
        key={data.music ? "track" : "empty"}
        value={data.music ?? { ...DEFAULT_MUSIC_CONFIG, enabled: false }}
        onChange={(m) => update({ music: m })}
      />
      {/* Remove is not the same as the toggle above it: switching music off
          keeps the track, its typography and its clip for later, while Remove
          drops the whole config — the only way to get a page back to never
          having had music. */}
      {data.music ? (
        <>
          <hr className="border-border" />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => update({ music: undefined })}
            className={cn("self-start", DESTRUCTIVE_GHOST)}
          >
            Remove music
          </Button>
        </>
      ) : null}
    </div>
  );
}

const INTRO_BACKDROPS: { value: IntroBackdrop; label: string }[] = [
  { value: "blur", label: "Blur" },
  { value: "solid", label: "Solid" },
];

export function IntroPanel() {
  const { data, update } = useStudio();
  // Default OFF when unset so the toggle reflects the real draft — a page with
  // no intro shouldn't look enabled (and "Preview entry" honors it).
  const intro = data.intro ?? { ...DEFAULT_INTRO_CONFIG, enabled: false };
  const patch = (p: Partial<IntroConfig>) =>
    update({ intro: { ...intro, ...p } });

  return (
    // Shaped like the Links tab: the master switch and the one-tap global look
    // sit in the open, and only the two heavy text editors (each carrying a full
    // TextStyleEditor) collapse.
    <div data-focus="intro" className="scroll-mt-3 flex flex-col gap-6">
      <ToggleRow
        label="Click to enter"
        hint="A splash visitors tap to reveal the page."
        checked={intro.enabled}
        onChange={(v) => patch({ enabled: v })}
      />

      <Group label="Appearance">
        <Segmented
          options={INTRO_BACKDROPS}
          value={intro.backdrop}
          onChange={(v) => patch({ backdrop: v })}
        />
      </Group>

      <Group label="Text">
        <div className="flex flex-col gap-2">
          <AccordionCard
            id="intro-text"
            title="Button text"
            summary={intro.text || "Empty"}
          >
            <Input
              value={intro.text}
              onChange={(e) => patch({ text: e.target.value })}
              placeholder="click to enter"
              maxLength={40}
            />
            <TextStyleEditor
              style={{ ...DEFAULT_INTRO_TEXT_STYLE, ...intro.textStyle }}
              onChange={(p) =>
                patch({ textStyle: { ...intro.textStyle, ...p } })
              }
              defaultSize={30}
            />
          </AccordionCard>

          <AccordionCard
            id="intro-subtitle"
            title="Subtitle"
            summary={intro.subtext || "None"}
          >
            <Input
              value={intro.subtext ?? ""}
              onChange={(e) => patch({ subtext: e.target.value || undefined })}
              placeholder="A short line under the button…"
              maxLength={80}
            />
            {/* Same text controls as the button text — subtitle is styled identically. */}
            <TextStyleEditor
              style={{ ...DEFAULT_INTRO_SUBTEXT_STYLE, ...intro.subtextStyle }}
              onChange={(p) =>
                patch({ subtextStyle: { ...intro.subtextStyle, ...p } })
              }
              defaultSize={14}
            />
          </AccordionCard>
        </div>
      </Group>

      {/* As with music: the switch above turns the splash off but keeps its
          text and styling, Remove deletes the config outright. */}
      {data.intro ? (
        <>
          <hr className="border-border" />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => update({ intro: undefined })}
            className={cn("self-start", DESTRUCTIVE_GHOST)}
          >
            Remove intro
          </Button>
        </>
      ) : null}
    </div>
  );
}
