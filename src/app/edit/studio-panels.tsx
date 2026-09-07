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
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { AvatarCropper } from "~/components/avatar-cropper";
import { DEFAULT_MEDIA_FRAME, MediaFramer } from "~/components/media-framer";
import { MusicEditor } from "~/components/music-editor";
import {
  BrandIcon,
  boxCss,
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
  PresenceDot,
  panelCss,
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
  type AvatarEffect,
  type Background,
  type BackgroundMemory,
  type BoxStyle,
  DEFAULT_LINK_RADIUS,
  formatScheduleDate,
  gradientDirectionCss,
  isoToLocalInput,
  type LinkHighlight,
  type LinkItem,
  type LinkKind,
  type LinkSchedule,
  linkScheduleStatus,
  localInputToIso,
  type MediaBackground,
  type PageData,
  type PanelStyle,
  type TextStyle,
} from "~/lib/pages";
import {
  CLEAR_AFTER_OPTIONS,
  type ClearAfter,
  clearAfterToIso,
  DEFAULT_STATUS_BOX,
  DEFAULT_STATUS_CONFIG,
  DEFAULT_STATUS_RADIUS,
  DEFAULT_STATUS_TEXT_STYLE,
  PRESENCE_LABELS,
  type PresenceState,
  type StatusConfig,
  statusExpiryLabel,
} from "~/lib/status";
import {
  applyTheme,
  isThemeActive,
  type PageTheme,
  THEMES,
} from "~/lib/themes";
import { cn } from "~/lib/utils";
import { useStudio } from "./studio-context";
import {
  AccordionCard,
  BoxControls,
  Disclosure,
  Group,
  Modal,
  Row,
  SectionLabel,
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
// Themes
// ---------------------------------------------------------------------------

/**
 * A CSS `background` that stands in for a page background in a thumbnail.
 *
 * The shader backgrounds (aurora, ripple) get their CSS approximations rather
 * than a real WebGL surface: this grid mounts eight of these at 60×86px, and
 * eight live shader canvases behind a control panel is a lot of GPU for a
 * picture of a decision.
 */
function themeBackgroundCss(bg: Background | undefined): string {
  if (!bg || bg.type === "default") return "oklch(0.145 0 0)";
  if (bg.type === "custom") return bg.color;
  if (bg.type === "gradient") return gradientPreview(bg);
  if (bg.type === "grid") return gridPreview(bg);
  if (bg.type === "aurora") return auroraPreview(bg.color, bg.baseColor);
  if (bg.type === "ripple") return ripplePreview(bg);
  return `url("${bg.src}") center/cover no-repeat`;
}

/**
 * A theme's swatch: a miniature of the page it produces.
 *
 * Built from the theme's OWN values through the same `boxCss` / `panelCss` the
 * page renders with, so a swatch can never drift from what applying it does.
 * That matters more here than anywhere else in the editor — this is the one
 * control whose entire job is "show me what I'd get".
 */
export function ThemeSwatch({ theme }: { theme: PageTheme }) {
  const s = theme.style;
  const panel = s.panel ?? DEFAULT_PANEL;
  const linkBox = s.linkBox ?? DEFAULT_LINK_BOX;
  // The thumbnail is ~1/6 scale, so the real radius would round a 5px-tall pill
  // into a circle. Scale it, and cap it at half the miniature button's height.
  const miniBox = {
    ...linkBox,
    radius: Math.min(3, (linkBox.radius ?? 8) / 4),
  };
  return (
    <span
      style={{ background: themeBackgroundCss(s.background) }}
      className="flex h-[86px] w-full flex-col items-center justify-center gap-[5px] overflow-hidden rounded-md px-2.5"
    >
      <span
        style={{
          ...panelCss(panel),
          // `panelCss` returns `{}` for a transparent panel, and the glass
          // panel's backdrop-filter is meaningless over a flat CSS thumbnail —
          // but its rounded plate still reads, which is the part that matters.
          borderRadius: panel.type === "transparent" ? undefined : 6,
        }}
        className="flex w-full flex-col items-center gap-[5px] p-1.5"
      >
        <span
          style={{
            background: s.avatarOutline?.enabled
              ? s.avatarOutline.color
              : "#ffffff59",
          }}
          className="size-3.5 rounded-full"
        />
        <span
          style={{ background: s.nameStyle?.color ?? "#ffffffcc" }}
          className="h-[3px] w-8 rounded-full"
        />
        {[0, 1].map((i) => (
          <span
            key={i}
            style={boxCss(miniBox)}
            className="h-[7px] w-full"
            aria-hidden
          />
        ))}
      </span>
    </span>
  );
}

/**
 * The Themes section: eight curated looks, one click each.
 *
 * This is the shortest path in the app from "empty page" to "page I'd post",
 * which is why it sits first in the rail. Everything it writes is an ordinary
 * edit — it goes through `setData`, so it lands on the undo stack and can be
 * taken back with one ⌘Z rather than needing a "revert theme" of its own.
 */
export function ThemesPanel() {
  const { data, setData } = useStudio();
  const active = THEMES.find((t) => isThemeActive(data, t));

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-xs">
        A starting point for the whole page — background, buttons and type.
        Everything stays editable afterwards, and your links, photo and music
        are never touched.
      </p>
      {/* Three across once the panel has been dragged wide enough — at 680px
          two columns leave each swatch 300px wide and 86px tall, which is a
          letterbox, not a thumbnail. */}
      <div className="@min-[440px]:grid-cols-3 grid grid-cols-2 gap-3">
        {THEMES.map((theme) => {
          const on = active?.key === theme.key;
          return (
            <button
              key={theme.key}
              type="button"
              onClick={() => setData((prev) => applyTheme(prev, theme))}
              aria-pressed={on}
              className="group flex flex-col gap-1.5 text-left focus-visible:outline-none"
            >
              <span
                className={cn(
                  "block overflow-hidden rounded-lg border transition-all duration-200 group-hover:brightness-110 group-active:scale-[0.97]",
                  on
                    ? "border-[var(--sec)] ring-2 ring-[var(--sec)] ring-offset-2 ring-offset-card"
                    : "border-border group-hover:border-muted-foreground/50 group-focus-visible:ring-2 group-focus-visible:ring-ring",
                )}
              >
                <ThemeSwatch theme={theme} />
              </span>
              <span className="flex min-w-0 flex-col leading-tight">
                <span
                  className={cn(
                    "truncate font-medium text-xs transition-colors",
                    on
                      ? "text-foreground"
                      : "text-muted-foreground group-hover:text-foreground",
                  )}
                >
                  {theme.label}
                </span>
                <span className="truncate text-[11px] text-muted-foreground/70">
                  {on ? "Applied" : theme.hint}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-muted-foreground/70 text-[11px]">
        Applying a theme resets links that were styled individually so they
        follow the new look. Undo (⌘Z) puts everything back.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export function ProfilePanel() {
  const { data, update, revision } = useStudio();
  const outline = data.avatarOutline;
  const hidden = data.hidden;
  const [avatarError, setAvatarError] = useState<string | null>(null);

  /**
   * Flip one part on or off. `true` is written out rather than left implicit so
   * the stored object says what the owner chose; the key is dropped again when
   * it goes back to shown, which keeps a page that has never used a switch from
   * carrying `{avatar: false, name: false, bio: false}` around forever.
   */
  function setHidden(part: "avatar" | "name" | "bio", off: boolean) {
    const next: NonNullable<PageData["hidden"]> = { ...data.hidden };
    if (off) next[part] = true;
    else delete next[part];
    update({ hidden: Object.keys(next).length > 0 ? next : undefined });
  }

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
        summary={
          hidden?.avatar ? "Hidden" : data.avatar ? "Photo set" : "Default"
        }
      >
        {/* Same shape as the Music, Intro and Status switches: the controls
            below stay live while this is off, and the line under it says so —
            without one, a switch that leaves a full panel of enabled controls
            behind it reads as broken. */}
        <ToggleRow
          label="Show avatar"
          checked={!hidden?.avatar}
          onChange={(v) => setHidden("avatar", !v)}
        />
        {hidden?.avatar ? (
          <p className="text-muted-foreground text-xs">
            Hidden from your page. Your photo and its settings are kept.
          </p>
        ) : null}
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
        <div className="border-border border-t pt-3">
          <AvatarEffectControls />
        </div>
      </AccordionCard>

      <AccordionCard
        id="name"
        title="Name"
        summary={hidden?.name ? "Hidden" : plainText(data.name) || "Empty"}
      >
        <ToggleRow
          label="Show name"
          checked={!hidden?.name}
          onChange={(v) => setHidden("name", !v)}
        />
        {hidden?.name ? (
          <p className="text-muted-foreground text-xs">
            Hidden from your page. Your text and its styling are kept.
          </p>
        ) : null}
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
        summary={hidden?.bio ? "Hidden" : plainText(data.bio) || "Empty"}
      >
        <ToggleRow
          label="Show bio"
          checked={!hidden?.bio}
          onChange={(v) => setHidden("bio", !v)}
        />
        {hidden?.bio ? (
          <p className="text-muted-foreground text-xs">
            Hidden from your page. Your text and its styling are kept.
          </p>
        ) : null}
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

/** The stock settings each avatar effect starts from when it is first picked. */
const AVATAR_FX_DEFAULTS = {
  particles: {
    type: "particles",
    color: "#a78bfa",
    speed: 5,
    size: 4,
    amount: 5,
  },
  shine: { type: "shine", speed: 5 },
} satisfies Record<string, AvatarEffect>;

/**
 * The animated decoration on the profile picture — the guns.lol-style flourish
 * this app's audience expects, restored from a data model that never went away.
 *
 * Switching type keeps nothing: `particles` and `shine` share only `speed`, and
 * carrying one value across a switch that changes every other control is more
 * confusing than starting from a tuned default.
 */
function AvatarEffectControls() {
  const { data, update } = useStudio();
  const effect = data.avatarEffect ?? { type: "none" };

  const choose = (type: AvatarEffect["type"]) => {
    if (type === effect.type) return;
    update({
      avatarEffect:
        type === "none" ? undefined : { ...AVATAR_FX_DEFAULTS[type] },
    });
  };

  // Narrowed copies, so the per-type controls below can patch just their own
  // fields without re-proving the union to TypeScript at every call site.
  const patch = (p: Partial<Extract<AvatarEffect, { type: "particles" }>>) => {
    if (effect.type !== "particles") return;
    update({ avatarEffect: { ...effect, ...p } });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-1.5">
        <span className="font-medium text-sm">Effect</span>
        <InfoTip label="An animated decoration around your profile picture." />
      </div>
      <Segmented
        options={[
          { value: "none", label: "None" },
          { value: "particles", label: "Particles" },
          { value: "shine", label: "Shine" },
        ]}
        value={effect.type}
        onChange={choose}
      />
      {effect.type === "particles" ? (
        <>
          <Row label="Color">
            <ColorPicker
              value={effect.color}
              onChange={(color) => patch({ color })}
              ariaLabel="Particle color"
            />
          </Row>
          <Slider
            label="Speed"
            value={effect.speed}
            min={1}
            max={10}
            onChange={(speed) => patch({ speed })}
          />
          <Slider
            label="Size"
            value={effect.size}
            min={1}
            max={10}
            onChange={(size) => patch({ size })}
          />
          <Slider
            label="Amount"
            value={effect.amount}
            min={1}
            max={10}
            onChange={(amount) => patch({ amount })}
          />
        </>
      ) : null}
      {effect.type === "shine" ? (
        <Slider
          label="Speed"
          value={effect.speed}
          min={1}
          max={10}
          onChange={(speed) =>
            update({ avatarEffect: { type: "shine", speed } })
          }
        />
      ) : null}
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

/**
 * Whether a link's URL is worth offering an "open it" button for: a complete
 * http(s) URL with something after the scheme. A bare "https://" placeholder or
 * a `discord:` username has nothing to open, and a button that opened a blank
 * tab would be worse than no button.
 */
function isTestableHref(href: string): boolean {
  return /^https?:\/\/[^\s/]+/i.test(href.trim());
}

/** An "open in a new tab" arrow. */
function OpenIcon({ className }: { className?: string }) {
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

/** The heading glyph — the "Header" block in the add picker and its list row. */
function HeadingIcon({ className }: { className?: string }) {
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
      <path d="M6 5v14M18 5v14M6 12h12" />
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
 * The two non-platform rows a creator can add, kept out of the platform grid.
 *
 * They are the two things you reach for when you know the grid does NOT have
 * what you want, so burying them as the 21st and 22nd tile among the brand
 * icons was exactly backwards — you had to scan every logo to rule them out.
 */
const BLOCK_OPTIONS: {
  kind: LinkKind;
  key: string;
  label: string;
  hint: string;
  icon: typeof LinkIcon;
}[] = [
  {
    kind: "link",
    key: "custom",
    label: "Custom link",
    hint: "Any URL",
    icon: LinkIcon,
  },
  {
    kind: "header",
    key: "header",
    label: "Header",
    hint: "Groups the links under it",
    icon: HeadingIcon,
  },
];

/** The per-link attention animations, in the order the picker shows them. */
const HIGHLIGHTS: { value: LinkHighlight; label: string }[] = [
  { value: "none", label: "None" },
  { value: "pulse", label: "Pulse" },
  { value: "bounce", label: "Bounce" },
  { value: "shake", label: "Shake" },
  { value: "glow", label: "Glow" },
];

/**
 * The per-link attention animation. Each chip plays its own effect on hover
 * rather than continuously: five tiles bouncing and shaking at once is noise,
 * and the point of this feature is that ONE link moves.
 */
function HighlightPicker({
  value,
  onChange,
}: {
  value: LinkHighlight;
  onChange: (v: LinkHighlight) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <span className="text-muted-foreground text-sm">Attention</span>
        <InfoTip label="Animates the button so visitors look at it first. Best used on one link." />
      </div>
      <div className="grid grid-cols-5 gap-1 rounded-lg border border-border bg-muted/60 p-1">
        {HIGHLIGHTS.map((h) => {
          const on = value === h.value;
          return (
            <button
              key={h.value}
              type="button"
              onClick={() => onChange(h.value)}
              aria-pressed={on}
              className={cn(
                "rounded-md px-1 py-1.5 text-center font-medium text-[11px] transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                on
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {/* `.link-fx-*` are `animation-play-state: paused` on hover, which
                  is the opposite of what a preview chip wants — so the chip
                  drives them with its own hover rule instead (see
                  `.fx-demo` in globals.css). */}
              <span
                className={cn(
                  "inline-block",
                  h.value !== "none" && `fx-demo fx-demo-${h.value}`,
                )}
              >
                {h.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

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
  // A header isn't a destination, so there is no platform to detect and no
  // logo to show — it gets the heading glyph, in the section hue, which is
  // also what separates it at a glance from the links it groups.
  if (link.kind === "header") {
    return (
      <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-[var(--sec)]/12 text-[var(--sec)]">
        <HeadingIcon className="size-4" />
      </span>
    );
  }
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
    duplicateLink,
    moveLink,
    moveLinkTo,
  } = useStudio();
  const horizontal = data.panelOrientation === "horizontal";
  // The page-wide default every link falls back to.
  const linkBox = data.linkBox ?? DEFAULT_LINK_BOX;

  // The add-link platform picker.
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");

  /**
   * Focus the search field the moment it exists.
   *
   * A callback ref rather than an effect keyed on `pickerOpen`: the Modal holds
   * its content back by one commit (usePresence flips `value` from an effect),
   * so on the tick the flag turns true there is no field to focus yet — an
   * effect there fires into an empty ref and the picker opens unfocused.
   *
   * Skipped on touch, where the software keyboard would immediately cover the
   * grid of platform tiles the picker exists to show.
   */
  const focusSearch = useCallback((el: HTMLInputElement | null) => {
    if (el && window.matchMedia("(pointer: fine)").matches) el.focus();
  }, []);

  // Reset the query on open so the picker never reopens pre-filtered.
  useEffect(() => {
    if (pickerOpen) setPickerQuery("");
  }, [pickerOpen]);

  const closePicker = () => setPickerOpen(false);

  // "Custom link" lives in the Blocks row now, so it is filtered out of the
  // platform grid — except when a search actually matches it, which is how you
  // find it by typing "custom".
  const query = pickerQuery.trim().toLowerCase();
  const filteredPlatforms = PICKER_OPTIONS.filter((o) => {
    if (!query) return o.key !== "custom";
    return o.label.toLowerCase().includes(query) || o.key.includes(query);
  });

  /**
   * The list's one-line census. Scheduled and expired links are the ones worth
   * calling out: they are the only rows a visitor can't see, and until this
   * existed the only way to notice was to open every card.
   *
   * Time-dependent, so it renders as a plain count until mount — a server render
   * that decided a link had expired could disagree with the client's clock and
   * trip hydration.
   */
  const [countsReady, setCountsReady] = useState(false);
  useEffect(() => setCountsReady(true), []);
  const linkCounts = (() => {
    const rows = data.links;
    const headers = rows.filter((l) => l.kind === "header").length;
    const icons = rows.filter((l) => l.kind === "icon").length;
    const links = rows.length - headers - icons;
    const hidden = countsReady
      ? rows.filter(
          (l) => l.kind !== "header" && linkScheduleStatus(l) !== "live",
        ).length
      : 0;
    const parts = [`${links} link${links === 1 ? "" : "s"}`];
    if (icons > 0) parts.push(`${icons} icon${icons === 1 ? "" : "s"}`);
    if (headers > 0) parts.push(`${headers} header${headers === 1 ? "" : "s"}`);
    if (hidden > 0) parts.push(`${hidden} hidden`);
    return { links, icons, headers, hidden, summary: parts.join(" · ") };
  })();

  function addFromPicker(option: (typeof PICKER_OPTIONS)[number]) {
    addLink({
      label: option.key === "custom" ? "New link" : option.label,
      href: option.prefix,
    });
    closePicker();
  }
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
            defaultRadius={DEFAULT_LINK_RADIUS}
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

      <Group>
        {/* A header that answers the two questions a long list raises — how
            many are there, and is any of them invisible to visitors — plus an
            Add that doesn't require scrolling past twenty rows to reach. */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-baseline gap-2">
            <SectionLabel>Links</SectionLabel>
            <span className="truncate text-[11px] text-muted-foreground/70">
              {linkCounts.summary}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="-mr-1 shrink-0 rounded px-1.5 py-0.5 font-medium text-[var(--sec)] text-xs transition-colors hover:bg-[var(--sec)]/10 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            + Add
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {data.links.map((link) => {
            const active = selection === `link:${link.id}`;
            const dragging = dragId === link.id;
            const isHeader = link.kind === "header";
            // An icon link draws no button surface and no label, so the box /
            // text / attention controls have nothing to act on.
            const isIcon = link.kind === "icon";
            // Drives the row's 2px left rail (see the `--plat` style below).
            const platform = isHeader ? undefined : getPlatform(link.href);
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
                      // A header's rail is the section hue: it is not a
                      // platform, and the rail is what makes a group divider
                      // scannable down the left edge of a long list.
                      "--plat": isHeader
                        ? "var(--sec)"
                        : platform
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
                    <span
                      className={cn(
                        "min-w-0 flex-1 truncate font-medium text-sm",
                        // A header reads in the list the way it reads on the
                        // page — quieter and tracked out — so the two match
                        // without having to open the row to find out which it is.
                        isHeader &&
                          "text-muted-foreground text-xs uppercase tracking-wider",
                      )}
                    >
                      {link.label ||
                        (isHeader ? (
                          <span className="text-muted-foreground">
                            Untitled section
                          </span>
                        ) : (
                          <span className="text-muted-foreground">
                            Untitled
                          </span>
                        ))}
                    </span>
                    {isIcon ? (
                      <span
                        title="Shown as a bare icon, sharing a row with the icon links next to it"
                        className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground uppercase tracking-wide"
                      >
                        Icon
                      </span>
                    ) : null}
                    {link.highlight && link.highlight !== "none" ? (
                      <span
                        title={`Attention: ${link.highlight}`}
                        className="shrink-0 rounded bg-[var(--sec)]/12 px-1.5 py-0.5 text-[10px] text-[var(--sec)] uppercase tracking-wide"
                      >
                        {link.highlight}
                      </span>
                    ) : null}
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
                        placeholder={isHeader ? "Section title" : "Label"}
                      />
                      {isHeader ? (
                        <>
                          <p className="text-muted-foreground text-xs">
                            A label for the links below it. Not clickable, and
                            hidden in the Logos layout.
                          </p>
                          <Disclosure
                            title="Style"
                            summary={
                              link.textStyle ? (
                                <span className="text-[var(--sec)]">
                                  Custom
                                </span>
                              ) : (
                                "Default"
                              )
                            }
                          >
                            {/* A header's own style only — it inherits just the
                                font from the page link style (see LinkHeader),
                                so seeding this editor from `data.linkStyle`
                                would show a size and colour the header is not
                                actually using. */}
                            <TextStyleEditor
                              style={{
                                fontFamily: data.linkStyle?.fontFamily,
                                ...link.textStyle,
                              }}
                              onChange={(patch) =>
                                patchLink(link.id, {
                                  textStyle: { ...link.textStyle, ...patch },
                                })
                              }
                              defaultSize={12}
                            />
                          </Disclosure>
                        </>
                      ) : null}
                      {isHeader ? null : isDiscordLink(link.href) ? (
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
                        <div className="flex items-center gap-1.5">
                          <Input
                            value={link.href}
                            onChange={(e) =>
                              patchLink(link.id, { href: e.target.value })
                            }
                            placeholder="https://…"
                          />
                          {/* Check the destination without leaving the editor.
                              Clicks in the PREVIEW are swallowed on purpose —
                              there you are pointing at a link to edit it, not
                              to use it — which left no way at all to find out
                              whether a pasted URL actually goes anywhere. */}
                          {isTestableHref(link.href) ? (
                            <a
                              href={link.href}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Open this link in a new tab"
                              aria-label="Open this link in a new tab"
                              className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                            >
                              <OpenIcon className="size-4" />
                            </a>
                          ) : null}
                        </div>
                      )}
                      {/* Button vs bare icon. In the Logos layout every link is
                          already an icon, so the choice would be a no-op. */}
                      {isHeader || horizontal ? null : (
                        <div className="flex flex-col gap-1.5 pt-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-muted-foreground text-sm">
                              Show as
                            </span>
                            <InfoTip label="Icons sit side by side in a row. Links next to each other in the list share one row." />
                          </div>
                          <Segmented
                            options={[
                              { value: "link", label: "Button" },
                              { value: "icon", label: "Icon" },
                            ]}
                            value={link.kind === "icon" ? "icon" : "link"}
                            onChange={(v) =>
                              patchLink(link.id, {
                                kind: v === "icon" ? "icon" : undefined,
                              })
                            }
                          />
                        </div>
                      )}
                      {!isHeader &&
                      !getPlatform(link.href) &&
                      !isDiscordLink(link.href) ? (
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
                      {horizontal || isHeader || isIcon ? null : (
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
                            defaultRadius={DEFAULT_LINK_RADIUS}
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
                      {/* Every layout draws these, icons included — the
                          animations run on a wrapper, so they need no button.
                          Only a header has nothing to animate. */}
                      {isHeader ? null : (
                        <div className="border-border border-t pt-3">
                          <HighlightPicker
                            value={link.highlight ?? "none"}
                            onChange={(highlight) =>
                              patchLink(link.id, {
                                highlight:
                                  highlight === "none" ? undefined : highlight,
                              })
                            }
                          />
                        </div>
                      )}
                      {isHeader ? null : (
                        <LinkScheduleControls
                          link={link}
                          onChange={(schedule) =>
                            patchLink(link.id, { schedule })
                          }
                        />
                      )}
                      <div className="flex items-center justify-between gap-2 border-border border-t pt-3">
                        <button
                          type="button"
                          onClick={() => duplicateLink(link.id)}
                          className="rounded px-1.5 py-0.5 text-muted-foreground text-xs transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                        >
                          Duplicate
                        </button>
                        <button
                          type="button"
                          onClick={() => removeLink(link.id)}
                          className="rounded px-1.5 py-0.5 text-danger text-xs transition-colors hover:bg-danger/10 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                        >
                          Remove
                        </button>
                      </div>
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
        title="Add to your page"
        description="Pick a platform to pre-fill it, or start from a blank block."
        onClose={closePicker}
      >
        {/* Autofocused, so the picker opens ready to type: twenty-plus brand
            tiles is past the point where scanning beats searching, and the
            fastest path to "Bluesky" is the four letters, not the hunt. */}
        <Input
          ref={focusSearch}
          value={pickerQuery}
          onChange={(e) => setPickerQuery(e.target.value)}
          onKeyDown={(e) => {
            // Enter takes the top hit — the other half of type-to-add.
            if (e.key !== "Enter") return;
            e.preventDefault();
            const first = filteredPlatforms[0];
            if (first) addFromPicker(first);
          }}
          placeholder="Search platforms…"
          aria-label="Search platforms"
          className="mb-3"
        />

        <div className="flex max-h-[55vh] flex-col gap-3 overflow-y-auto">
          {pickerQuery ? null : (
            <div className="flex flex-col gap-1.5">
              <SectionLabel>Blocks</SectionLabel>
              <div className="grid grid-cols-2 gap-2">
                {BLOCK_OPTIONS.map((b) => (
                  <button
                    key={b.key}
                    type="button"
                    onClick={() => {
                      addLink(
                        b.kind === "header"
                          ? { label: "Section", kind: "header" }
                          : { label: "New link", href: "https://" },
                      );
                      closePicker();
                    }}
                    className="flex items-center gap-2.5 rounded-lg border border-border px-3 py-2.5 text-left transition-colors hover:border-[var(--sec)]/50 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-[var(--sec)]/12 text-[var(--sec)]">
                      <b.icon className="size-4" />
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate font-medium text-sm">
                        {b.label}
                      </span>
                      <span className="truncate text-[11px] text-muted-foreground">
                        {b.hint}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            {pickerQuery ? null : <SectionLabel>Platforms</SectionLabel>}
            {filteredPlatforms.length === 0 ? (
              <p className="py-6 text-center text-muted-foreground text-xs">
                No platform matches “{pickerQuery}”. Add it as a custom link
                instead.
              </p>
            ) : (
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                {filteredPlatforms.map((option) => {
                  const count = option.match
                    ? data.links.filter((l) => option.match?.test(l.href))
                        .length
                    : 0;
                  return (
                    <button
                      key={option.key}
                      type="button"
                      title={option.label}
                      aria-label={option.label}
                      onClick={() => addFromPicker(option)}
                      className="relative flex aspect-square items-center justify-center rounded-lg border border-border text-foreground transition-colors hover:border-[var(--sec)]/50 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
            )}
          </div>
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
type RippleConfig = NonNullable<BackgroundMemory["ripple"]>;

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

/**
 * Swatch art for the three shader backgrounds.
 *
 * These are SVG stand-ins, not the shaders. A swatch is 48px of a picker that
 * shows nine of them at once, and putting a live WebGL context behind each
 * would mean three more contexts alongside the Studio's own preview — against a
 * browser cap of about sixteen, for artwork the size of a stamp. Each one is
 * drawn from the SAME settings the shader would use, so the swatch still
 * answers the question the picker asks ("what would choosing this give me?")
 * in the creator's own colours.
 *
 * Every position below is a literal. Nothing here may use Math.random(): these
 * render on the server too, and a random layout mismatches on hydration.
 */

/**
 * Ripple: the shader's construction, run through SVG filter primitives.
 *
 * Two things this deliberately is not. It is not STRETCHED — the art carries
 * intrinsic `width`/`height` and is painted with `cover`, because this swatch is
 * `h-12 w-full` in a 3-column grid and that is about 5:1 in the Studio's
 * single-column layout against about 1.25:1 in the two-pane one. Painting one
 * picture at `100% 100%` squashed it into two different shapes. And it is not
 * DRAWN — hand-drawn strokes have to be blurred heavily before they stop reading
 * as strokes, and that blur is what made the old version mushy.
 *
 * Instead it mirrors RIPPLE_FRAG exactly, one step at a time:
 *
 *   turbulence           the field, as |noise| — the shader's own `d`.
 *                        numOctaves=1 matches the shader's single octave; extra
 *                        octaves fray the contour into smoke at every scale,
 *                        which is exactly why the shader uses one.
 *   narrow table         lights only where d is near zero. That contour IS the
 *                        line.
 *   wide table + blur    the same contour read wide and dim. Light through a
 *                        medium scatters, so the line is never a bare stroke
 *                        on black.
 *
 * Both readings come from the one turbulence field, so they are perfectly
 * concentric — the same reason the shader's core and glow can never disagree
 * about where the line is. Anisotropic `baseFrequency` (y above x) reproduces the shader's
 * vertical squash, so filaments run wide and flat here too.
 */
function ripplePreview(w: RippleConfig): string {
  const W = 96;
  const H = 48;
  // Detail drives the pattern size on the page, so it drives it here too — the
  // picker's promise is that a swatch shows the settings it would restore.
  // 0.70 mirrors the shader's calmness factor on top of Detail (RIPPLE_FRAG),
  // so the swatch thins out by the same amount the page did.
  const f = 0.011 * 0.7 * Math.max(w.scale, 1);
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='${W}' height='${H}' viewBox='0 0 ${W} ${H}'>` +
    `<defs><filter id='c' x='0' y='0' width='100%' height='100%'>` +
    `<feTurbulence type='turbulence' baseFrequency='${f.toFixed(4)} ${(f * 1.6).toFixed(4)}' numOctaves='1' seed='9' result='t'/>` +
    // Move turbulence's red channel into alpha; the colour channels go unused.
    `<feColorMatrix in='t' type='matrix' values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0' result='am'/>` +
    // `turbulence`, NOT `fractalNoise`, and that choice is what makes these two
    // tables exact rather than approximate. Turbulence sums |noise|, so its
    // output IS the shader's `d = abs(n)`: zero along the contour, rising away
    // from it. fractalNoise instead centres on 0.5, which needs a symmetric
    // triangle to find the contour — and since a smooth field piles its values
    // up near the centre, that triangle lit most of the frame however narrow it
    // was made.
    //
    // `feFuncA type='table'` spreads entries evenly across 0..1, so N entries
    // starting at 1 give a ramp reaching zero at 1/(N-1). Eleven entries is
    // `1 - d * 10` and four is `1 - d * 3` — the shader's two lines, transcribed.
    `<feComponentTransfer in='am' result='coreBand'><feFuncA type='table' tableValues='1 0 0 0 0 0 0 0 0 0'/></feComponentTransfer>` +
    `<feComponentTransfer in='coreBand' result='core'><feFuncA type='gamma' amplitude='1' exponent='1.35' offset='0'/></feComponentTransfer>` +
    `<feComponentTransfer in='am' result='glowBand'><feFuncA type='table' tableValues='1 0 0 0'/></feComponentTransfer>` +
    // amplitude below 1 is what dims the halo; blurring alone would only spread it.
    `<feComponentTransfer in='glowBand' result='glowA'><feFuncA type='gamma' amplitude='0.26' exponent='2.2' offset='0'/></feComponentTransfer>` +
    `<feGaussianBlur in='glowA' stdDeviation='1.0' result='glow'/>` +
    `<feFlood flood-color='${w.glowColor}' result='fill'/>` +
    // in2 is the ridge, NOT SourceGraphic: SourceGraphic here is a fully opaque
    // rect, so compositing into it paints a solid block and discards the chain.
    `<feComposite in='fill' in2='glow' operator='in' result='glowLit'/>` +
    `<feComposite in='fill' in2='core' operator='in' result='coreLit'/>` +
    `<feMerge><feMergeNode in='glowLit'/><feMergeNode in='coreLit'/></feMerge>` +
    `</filter>` +
    // Lit from above, as the shader is.
    `<linearGradient id='lit' x1='0' y1='0' x2='0' y2='1'>` +
    `<stop offset='0' stop-color='${w.glowColor}' stop-opacity='0.09'/>` +
    `<stop offset='1' stop-color='${w.glowColor}' stop-opacity='0'/>` +
    `</linearGradient></defs>` +
    `<rect width='${W}' height='${H}' fill='${w.baseColor}'/>` +
    `<rect width='${W}' height='${H}' fill='url(#lit)'/>` +
    `<rect width='${W}' height='${H}' filter='url(#c)' opacity='0.9'/>` +
    `</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") center/cover no-repeat, ${w.baseColor}`;
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
  const dir = gradientDirectionCss(g.direction);
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
  // Neutral by default, the same near-black/soft-white pair Aurora uses. A
  // coloured default made this effect shout; monochrome is the look it is
  // actually best at, and any creator who wants colour is two clicks away.
  ripple: { baseColor: "#0a0a0a", glowColor: "#e6e6e6", scale: 3, speed: 5 },
} satisfies {
  custom: string;
  gradient: GradientConfig;
  grid: GridConfig;
  aurora: AuroraConfig;
  ripple: RippleConfig;
};

/**
 * Ripple's swatch art, built ONCE from the defaults and never from live state.
 *
 * Every other swatch here tracks the creator's own settings, which is the
 * picker's usual promise. This one deliberately does not, for two reasons.
 *
 * It flickered. The art is an SVG data URI containing an feTurbulence filter, so
 * re-deriving it from state meant encoding a new URI and re-rasterizing a
 * turbulence filter on every pointermove of the Detail and Speed sliders — a new
 * image decode per frame, in a 48px box, while the real preview was already
 * re-rendering beside it.
 *
 * And it was answering a question nobody asked. A swatch says "this is what
 * choosing me gives you". Once Ripple is already selected, its own swatch
 * restating the settings you can see full-size in the preview is redundant
 * motion in the corner of the eye.
 *
 * The cost is that a creator who sets Ripple to, say, bright green still sees a
 * monochrome swatch. That is the intended trade: the swatch identifies the
 * background, the preview shows their version of it.
 */
const RIPPLE_SWATCH = ripplePreview(BG_DEFAULTS.ripple);

/** Minimum accepted resolution for an imported background image/video. */
const MIN_MEDIA = { w: 640, h: 480 };
/**
 * Cap on an imported file's size.
 *
 * Until Save runs it lives inline in the draft as a base64 data URL, which is
 * ~4/3 the file — so 20 MB in means ~27 MB of string held in memory and fed to
 * the preview's <video>/<img>. That is affordable; what is not is letting it
 * reach the row. `savePage` lifts it into the page-assets bucket first, and
 * that bucket carries a matching 20 MB ceiling (see the
 * `set_page_assets_size_limit` migration) — the two MUST be raised together.
 * If Storage rejects the upload, `persistAsset` falls back to keeping the data
 * URL inline in the pages jsonb, and a 27 MB row is re-downloaded by every
 * visitor on every page load.
 */
const MAX_MEDIA_MB = 20;
const MAX_MEDIA_BYTES = MAX_MEDIA_MB * 1024 * 1024;

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

function resolveRipple(d: PageData): RippleConfig {
  const bg = d.background;
  const m = bg?.type === "ripple" ? bg : d.bgMemory?.ripple;
  if (!m) return { ...BG_DEFAULTS.ripple };
  return {
    baseColor: m.baseColor,
    glowColor: m.glowColor,
    scale: m.scale,
    speed: m.speed,
  };
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
  else if (type === "ripple") memory.ripple = resolveRipple(d);
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
    { kind: "ripple", label: "Ripple", preview: RIPPLE_SWATCH },
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
      setMediaError(
        `That file is too large. Please keep it under ${MAX_MEDIA_MB} MB.`,
      );
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
      if (next === "ripple") {
        const w = memory?.ripple ?? { ...BG_DEFAULTS.ripple };
        return {
          ...prev,
          background: { type: "ripple", ...w },
          bgMemory: { ...memory, ripple: w },
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

  const patchRipple = (patch: Partial<RippleConfig>) =>
    setData((prev) => {
      const next = { ...resolveRipple(prev), ...patch };
      return {
        ...prev,
        background: { type: "ripple", ...next },
        bgMemory: { ...prev.bgMemory, ripple: next },
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
            { value: "diagonal", label: "Diagonal" },
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

  if (bg.type === "ripple") {
    return (
      <div className="flex flex-col gap-3">
        <Row label="Base color">
          <ColorPicker
            value={bg.baseColor}
            onChange={(c) => patchRipple({ baseColor: c })}
            ariaLabel="Ripple base color"
          />
        </Row>
        <Row label="Glow color">
          <ColorPicker
            value={bg.glowColor}
            onChange={(c) => patchRipple({ glowColor: c })}
            ariaLabel="Ripple glow color"
          />
        </Row>
        {/* Larger scale = a finer, busier net (the value multiplies the noise
            coordinates). Labelled "Detail" rather than "Scale" so the slider
            reads in the direction it moves. */}
        <Slider
          label="Detail"
          value={bg.scale}
          min={1}
          max={9}
          onChange={(v) => patchRipple({ scale: v })}
        />
        <Slider
          label="Speed"
          value={bg.speed}
          min={0}
          max={10}
          onChange={(v) => patchRipple({ speed: v })}
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

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

/** The presence choices, plus the "no dot at all" option, in Discord's order. */
const PRESENCE_CHOICES: { value: PresenceState | "none"; label: string }[] = [
  { value: "online", label: PRESENCE_LABELS.online },
  { value: "idle", label: PRESENCE_LABELS.idle },
  { value: "dnd", label: PRESENCE_LABELS.dnd },
  { value: "offline", label: PRESENCE_LABELS.offline },
  { value: "none", label: "No dot" },
];

/**
 * Emoji worth one tap: around, free, busy, away, and the four things people are
 * most often doing. Typing an emoji means leaving the keyboard for the system
 * picker on every platform, and this is a field people edit several times a
 * week.
 *
 * Deliberately generic — the states anyone has, not one trade's workflow.
 */
const STATUS_EMOJI = ["👋", "✅", "❌", "💤", "🎮", "🎧", "💻", "📩"];

/** The presence picker: the real dot next to each label, so the shapes teach
 *  themselves. Two columns, because "Do not disturb" does not fit in five. */
function PresencePicker({
  value,
  onChange,
}: {
  value: PresenceState | undefined;
  onChange: (v: PresenceState | undefined) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-muted/60 p-1">
      {PRESENCE_CHOICES.map((choice) => {
        const on = (value ?? "none") === choice.value;
        return (
          <button
            key={choice.value}
            type="button"
            aria-pressed={on}
            onClick={() =>
              onChange(
                choice.value === "none"
                  ? undefined
                  : (choice.value as PresenceState),
              )
            }
            className={cn(
              // "No dot" is the odd one out and sits alone on the last row.
              choice.value === "none" && "col-span-2",
              "flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-center font-medium text-xs transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
              on
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {choice.value === "none" ? null : (
              <PresenceDot
                state={choice.value as PresenceState}
                srLabel={false}
              />
            )}
            {choice.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * The Status section: a presence dot, a message, and a "clear after" timer so a
 * status that has stopped being true retires itself.
 */
export function StatusPanel() {
  const { data, update } = useStudio();
  // Default OFF when unset, like Music and Intro: a page that has never had a
  // status must not render its switch as though it does.
  const status = data.status ?? { ...DEFAULT_STATUS_CONFIG, enabled: false };
  const patch = (p: Partial<StatusConfig>) =>
    update({ status: { ...status, ...p } });

  // Which "clear after" chip is lit. An absolute instant can't say which chip
  // produced it — 4pm could be "4 hours" or "today" — so the chip is remembered
  // for this sitting only and the read-out below carries the real answer.
  // "Never" is the one choice the draft itself can state, so it is read from the
  // draft rather than from memory and survives a reload.
  const [picked, setPicked] = useState<ClearAfter | null>(null);
  const selectedClear: ClearAfter | null = status.expiresAt ? picked : "never";
  const expiry = statusExpiryLabel(status);
  const expired = Boolean(status.expiresAt) && expiry.startsWith("Expired");

  // Same resolution the page renders with: no box of its own → the bio box, so
  // the sliders describe what is actually on screen under the current theme.
  // Touching any of them writes an explicit box and pins the pill's look.
  const box = status.box ?? data.bioBox ?? DEFAULT_STATUS_BOX;
  const summary =
    [status.emoji?.trim(), status.text?.trim()].filter(Boolean).join(" ") ||
    "Empty";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <ToggleRow
          label="Status"
          checked={status.enabled}
          onChange={(v) => patch({ enabled: v })}
        />
        {/* Only when off. The controls below stay live under the switch — same
            as Music and Intro — and without a line saying so the switch reads
            broken. Saying where the status appears while it IS on is what the
            preview to the right is for. */}
        {status.enabled ? null : (
          <p className="text-muted-foreground text-xs">
            Off — nothing shows under your name. Your message is kept.
          </p>
        )}
      </div>

      <Group label="Presence">
        <PresencePicker
          value={status.presence}
          onChange={(v) => patch({ presence: v })}
        />
      </Group>

      {/* Owns the pill's surface as well as its words, the way the Name and Bio
          cards own theirs — there is only one thing here to style. */}
      <AccordionCard id="status" title="Message" summary={summary}>
        <div className="flex items-start gap-2">
          <Input
            value={status.emoji ?? ""}
            onChange={(e) => patch({ emoji: e.target.value || undefined })}
            placeholder="👋"
            aria-label="Status emoji"
            maxLength={12}
            className="w-16 shrink-0 text-center"
          />
          <Input
            value={status.text ?? ""}
            onChange={(e) => patch({ text: e.target.value })}
            placeholder="back in an hour"
            aria-label="Status message"
            maxLength={80}
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {STATUS_EMOJI.map((emoji) => {
            const on = status.emoji === emoji;
            return (
              <button
                key={emoji}
                type="button"
                // Clicking the chosen one again clears it, so the palette is
                // also the way back out of it — no separate Clear button.
                onClick={() => patch({ emoji: on ? undefined : emoji })}
                aria-label={`Use ${emoji}`}
                aria-pressed={on}
                className={cn(
                  "flex size-8 items-center justify-center rounded-md border text-base transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                  on
                    ? "border-foreground bg-muted"
                    : "border-border hover:border-muted-foreground/40",
                )}
              >
                {emoji}
              </button>
            );
          })}
        </div>
        <TextStyleEditor
          style={{ ...DEFAULT_STATUS_TEXT_STYLE, ...status.textStyle }}
          onChange={(p) => patch({ textStyle: { ...status.textStyle, ...p } })}
          defaultSize={14}
        />
        <BoxControls
          box={box}
          onChange={(p) => patch({ box: { ...box, ...p } })}
          defaultRadius={DEFAULT_STATUS_RADIUS}
        />
      </AccordionCard>

      <Group label="Clear after">
        <div className="grid grid-cols-5 gap-1 rounded-lg border border-border bg-muted/60 p-1">
          {CLEAR_AFTER_OPTIONS.map((option) => {
            const on = selectedClear === option.value;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  setPicked(option.value);
                  patch({ expiresAt: clearAfterToIso(option.value) });
                }}
                className={cn(
                  "rounded-md px-1 py-1.5 text-center font-medium text-[11px] transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                  on
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        <p
          className={cn(
            "text-xs",
            expired ? "text-danger" : "text-muted-foreground",
          )}
        >
          {status.expiresAt
            ? `${expiry} · ${formatScheduleDate(status.expiresAt)}`
            : "Stays up until you change it."}
        </p>
      </Group>

      {/* As with music and the intro: the switch above keeps the message and
          its styling for later, Remove drops the whole thing. */}
      {data.status ? (
        <>
          <hr className="border-border" />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => update({ status: undefined })}
            className={cn("self-start", DESTRUCTIVE_GHOST)}
          >
            Remove status
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
      <div className="flex flex-col gap-1.5">
        <ToggleRow
          label="Click to enter"
          hint="A splash visitors tap to reveal the page."
          checked={intro.enabled}
          onChange={(v) => patch({ enabled: v })}
        />
        {/* Same reason as the music switch: the controls below stay live while
            this is off, and without a line saying so the switch reads broken.
            It also points at "Preview entry", which is the only way to see a
            splash you have just spent five minutes styling. */}
        <p className="text-muted-foreground text-xs">
          {intro.enabled
            ? "Visitors see this splash first. Use Preview entry above the page to try it."
            : "Off — the page opens straight away. Your splash text is kept."}
        </p>
      </div>

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
