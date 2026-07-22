"use client";

import { useTheme } from "next-themes";
import {
  type ComponentType,
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AvatarFx,
  BrandIcon,
  boxCss,
  contrastText,
  DEFAULT_BIO_BOX,
  DEFAULT_BIO_STYLE,
  DEFAULT_LINK_BOX,
  DEFAULT_NAME_BOX,
  DEFAULT_NAME_STYLE,
  DEFAULT_PANEL,
  discordUsername,
  effectiveBoxColor,
  FONTS,
  GlassFilter,
  getPlatform,
  isDiscordLink,
  LinkAnchor,
  LinkIconAnchor,
  PageBackground,
  PLATFORMS,
  panelCss,
  RichText,
  resolveLinkBox,
  sanitizeRichHtml,
  styleToCss,
  textAnimClass,
} from "~/components/profile-view";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  type AvatarEffect,
  type AvatarOutline,
  type Background,
  type BackgroundMemory,
  type BoxStyle,
  type LinkItem,
  type MediaBackground,
  type PageData,
  type PanelStyle,
  savePage,
  type TextStyle,
} from "~/lib/pages";
import { useUnsavedGuard } from "~/lib/unsaved-guard";
import { cn } from "~/lib/utils";

/** Editable gradient background settings. */
type GradientConfig = {
  from: string;
  to: string;
  direction: "vertical" | "horizontal";
  distribution: number;
};

/** Editable galaxy (starfield) background settings. */
type StarfieldConfig = { speed: number };

/** Clamp a number into the inclusive [min, max] range. */
function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/**
 * Normalize a CSS color to a #rrggbb hex string (needed by `<input type=color>`
 * and for comparing against presets). Accepts hex or `rgb()/rgba()`; returns
 * null for anything unparseable so callers can leave their value untouched.
 */
function toHex(color: string | null | undefined): string | null {
  if (!color) return null;
  const s = color.trim();
  if (/^#[0-9a-f]{6}$/i.test(s)) return s.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(s)) {
    return `#${s
      .slice(1)
      .split("")
      .map((c) => c + c)
      .join("")}`.toLowerCase();
  }
  const m = s.match(/^rgba?\(([^)]+)\)$/i);
  if (m) {
    const [r, g, b] = m[1].split(",").map((p) => Number.parseInt(p, 10));
    if ([r, g, b].some((n) => Number.isNaN(n))) return null;
    const h = (n: number) =>
      Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0");
    return `#${h(r)}${h(g)}${h(b)}`;
  }
  return null;
}

/** Profile-picture crop frame size (px). */
const CROP_SIZE = 256;

/** Minimum accepted resolution for an imported background image/video. */
const MIN_MEDIA = { w: 640, h: 480 };
/** Cap on imported background file size (data URLs live inline in the page). */
const MAX_MEDIA_BYTES = 8 * 1024 * 1024;

/** Ghost-button styling for destructive actions (remove / cancel / sign out). */
const DESTRUCTIVE_GHOST =
  "text-red-400 hover:bg-red-400/10 hover:text-red-400 dark:hover:bg-red-400/10";

const FONT_SIZES = [12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 60];
const FONT_SIZE_MIN = 8;
const FONT_SIZE_MAX = 200;

/**
 * A typable font-size control: a number input the user can type any size into
 * (clamped to a sane range), with the common presets offered as datalist
 * suggestions. Local text state lets intermediate typing feel natural; the
 * value is clamped and committed on blur / Enter.
 */
function FontSizeInput({
  value,
  onChange,
  ariaLabel = "Text size",
  listId,
}: {
  value: number;
  onChange: (size: number) => void;
  ariaLabel?: string;
  listId: string;
}) {
  const [text, setText] = useState(String(value));

  // Re-sync when the external value changes (switching fields/links, reset).
  useEffect(() => setText(String(value)), [value]);

  function commit(raw: string) {
    const n = Number.parseInt(raw, 10);
    const clamped = Number.isFinite(n)
      ? Math.max(FONT_SIZE_MIN, Math.min(FONT_SIZE_MAX, n))
      : value;
    setText(String(clamped));
    if (clamped !== value) onChange(clamped);
  }

  return (
    <>
      <input
        type="number"
        inputMode="numeric"
        min={FONT_SIZE_MIN}
        max={FONT_SIZE_MAX}
        value={text}
        aria-label={ariaLabel}
        list={listId}
        onChange={(e) => {
          setText(e.target.value);
          // Live-preview in-range values while typing.
          const n = Number.parseInt(e.target.value, 10);
          if (Number.isFinite(n) && n >= FONT_SIZE_MIN && n <= FONT_SIZE_MAX) {
            onChange(n);
          }
        }}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit((e.target as HTMLInputElement).value);
        }}
        className="h-8 w-14 rounded-md border border-input bg-transparent px-2 text-sm outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <datalist id={listId}>
        {FONT_SIZES.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </>
  );
}

/**
 * Keeps an element mounted through its exit animation. `active` drives whether
 * the element should show; the returned `value` stays set while `visible` flips
 * to false during the exit, so the element can animate out before it unmounts
 * `duration` ms later. `value` also carries the last active payload (e.g. an id)
 * so content stays stable while animating out.
 */
function usePresence<T>(active: T | null | false | undefined, duration = 200) {
  const [value, setValue] = useState<T | null>(active ? (active as T) : null);
  const [visible, setVisible] = useState(Boolean(active));

  useEffect(() => {
    if (active) {
      setValue(active as T);
      setVisible(true);
      return;
    }
    if (value !== null) {
      setVisible(false);
      const t = setTimeout(() => setValue(null), duration);
      return () => clearTimeout(t);
    }
  }, [active, value, duration]);

  return { value, visible };
}

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
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function UploadIcon({ className }: { className?: string }) {
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
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" x2="12" y1="3" y2="15" />
    </svg>
  );
}

/** Six-dot grid handle used to drag-reorder links. */
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

function ImageIcon({ className }: { className?: string }) {
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
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="15" cy="9" r="1.5" fill="currentColor" stroke="none" />
      <path d="m4 16 4-4 3 3 4-4 5 5" />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
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
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function ArrowVerticalIcon({ className }: { className?: string }) {
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
      <path d="M12 3v18" />
      <path d="m8 7 4-4 4 4" />
      <path d="m8 17 4 4 4-4" />
    </svg>
  );
}

function ArrowHorizontalIcon({ className }: { className?: string }) {
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
      <path d="M3 12h18" />
      <path d="m7 8-4 4 4 4" />
      <path d="m17 8 4 4-4 4" />
    </svg>
  );
}

function AlignIcon({
  className,
  variant,
}: {
  className?: string;
  variant: "left" | "center" | "right";
}) {
  const lines: Record<typeof variant, string[]> = {
    left: ["3 6 15 6", "3 12 21 12", "3 18 15 18"],
    center: ["6 6 18 6", "3 12 21 12", "6 18 18 18"],
    right: ["9 6 21 6", "3 12 21 12", "9 18 21 18"],
  };
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      aria-hidden="true"
      className={className}
    >
      {lines[variant].map((pts) => {
        const [x1, y1, x2] = pts.split(" ");
        return <line key={pts} x1={x1} y1={y1} x2={x2} y2={y1} />;
      })}
    </svg>
  );
}

type IconComponent = ComponentType<{ className?: string }>;

interface PickerOption {
  key: string;
  label: string;
  icon: IconComponent;
  prefix: string;
  match?: RegExp;
  color?: string;
}

const PICKER_OPTIONS: PickerOption[] = [
  ...PLATFORMS.map(({ key, label, icon, prefix, match, color }) => ({
    key,
    label,
    icon,
    prefix,
    match,
    color,
  })),
  { key: "custom", label: "Custom link", icon: LinkIcon, prefix: "https://" },
];

// A fresh page for a user who hasn't created one yet: blank bio, no links, and
// no avatar (so the default person placeholder shows). The name is seeded from
// the account username by the caller.
const DEFAULT_DATA: PageData = {
  name: "",
  bio: "",
  links: [],
};

/**
 * Seed background memory from the active background so the first switch away
 * from Custom/Gradient doesn't lose the colors already in use. Pages saved
 * before `bgMemory` existed have no memory of their own; this backfills it.
 */
function seedBgMemory(d: PageData): PageData {
  const memory: BackgroundMemory = { ...d.bgMemory };
  if (memory.custom === undefined && d.background?.type === "custom") {
    memory.custom = d.background.color;
  }
  if (memory.gradient === undefined && d.background?.type === "gradient") {
    memory.gradient = {
      from: d.background.from,
      to: d.background.to,
      direction: d.background.direction,
      distribution: d.background.distribution,
    };
  }
  return { ...d, bgMemory: memory };
}

/**
 * Generate a unique id. `crypto.randomUUID` only exists in secure contexts
 * (https or localhost), so fall back to a random string when the app is
 * served over a plain-http origin like a LAN IP address.
 */
function uid(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * A link's URL counts as "blank" when it's empty or still just the pre-filled
 * scheme (e.g. "https://") — i.e. the user hasn't actually typed a link yet.
 */
function isBlankHref(href: string): boolean {
  const t = href.trim();
  // A bare scheme with nothing after it (an unfinished URL, or a Discord link
  // with no username yet) counts as blank.
  return t === "" || /^https?:\/\/$/i.test(t) || /^discord:$/i.test(t);
}

/**
 * Read an image file and return a downscaled PNG data URL. Downscaling keeps
 * the stored value small since logos are persisted inline in the page JSON.
 */
function readLogo(file: File, maxSize = 128): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the file"));
    reader.onload = () => {
      const src = reader.result as string;
      const img = new Image();
      img.onerror = () => reject(new Error("Could not decode the image"));
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(src);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/png"));
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * A single-line rich-text field backed by contentEditable so individual
 * characters can carry inline formatting (bold/italic/underline/color). The
 * initial HTML is written to the DOM once on mount; thereafter the DOM is the
 * source of truth and edits are pushed up via `onInput` — we never write state
 * back into it, which would fight the caret. Remount (via `key`) to reset it.
 */
function RichTextField({
  initialHtml,
  placeholder,
  style,
  className,
  editorRef,
  onInput,
  onFocus,
  ariaLabel,
}: {
  initialHtml: string;
  placeholder: string;
  style?: CSSProperties;
  className?: string;
  editorRef: React.RefObject<HTMLDivElement | null>;
  onInput: (html: string) => void;
  onFocus: () => void;
  ariaLabel: string;
}) {
  // biome-ignore lint/correctness/useExhaustiveDependencies: seed the editor once on mount; the DOM owns the value afterwards
  useEffect(() => {
    const el = editorRef.current;
    if (el) el.innerHTML = sanitizeRichHtml(initialHtml);
  }, []);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: a contentEditable rich-text field is inherently an interactive text region
    // biome-ignore lint/a11y/useAriaPropsSupportedByRole: aria-label names the editable region for assistive tech
    <div
      ref={editorRef}
      contentEditable
      suppressContentEditableWarning
      aria-label={ariaLabel}
      data-placeholder={placeholder}
      spellCheck={false}
      onFocus={onFocus}
      onInput={(e) => {
        const el = e.currentTarget;
        // Collapse an "empty but has <br>" state to truly empty so the CSS
        // placeholder shows and the stored value is clean.
        if (!el.textContent) el.innerHTML = "";
        onInput(el.innerHTML);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.preventDefault();
      }}
      onPaste={(e) => {
        // Paste as plain text so foreign markup can't leak into the content.
        e.preventDefault();
        const text = e.clipboardData.getData("text/plain").replace(/\n/g, " ");
        document.execCommand("insertText", false, text);
      }}
      style={style}
      className={className}
    />
  );
}

/** A curated spectrum of good-looking preset colors (plus neutrals). */
const COLOR_PRESETS = [
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#eab308",
  "#84cc16",
  "#22c55e",
  "#10b981",
  "#14b8a6",
  "#06b6d4",
  "#0ea5e9",
  "#3b82f6",
  "#6366f1",
  "#8b5cf6",
  "#a855f7",
  "#d946ef",
  "#ec4899",
  "#f43f5e",
  "#78716c",
  "#ffffff",
  "#94a3b8",
  "#000000",
];

/**
 * A color control: a swatch button that opens a small popover with preset
 * colors plus a native picker for anything custom. `align` decides which side
 * the popover hangs from so it stays on-screen in tight spots.
 */
function ColorPicker({
  value,
  onChange,
  ariaLabel,
  align = "right",
}: {
  value: string;
  onChange: (color: string) => void;
  ariaLabel: string;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={ariaLabel}
        className="size-8 rounded-md border border-input p-1"
      >
        <span
          className="block size-full rounded-sm"
          style={{ backgroundColor: value }}
        />
      </button>
      {open ? (
        <div
          className={cn(
            "absolute top-full z-50 mt-1 w-44 animate-pop rounded-md border border-border bg-popover p-2 shadow-lg",
            align === "right"
              ? "right-0 origin-top-right"
              : "left-0 origin-top-left",
          )}
        >
          <div className="grid grid-cols-6 gap-1">
            {COLOR_PRESETS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onChange(c)}
                aria-label={c}
                style={{ backgroundColor: c }}
                className={cn(
                  "size-6 rounded-md border border-black/10",
                  value.toLowerCase() === c.toLowerCase() &&
                    "ring-2 ring-ring ring-offset-1 ring-offset-popover",
                )}
              />
            ))}
          </div>
          <label className="mt-2 flex items-center justify-between gap-2 border-t border-border pt-2 text-xs text-muted-foreground">
            Custom
            <input
              type="color"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              aria-label={`${ariaLabel} custom value`}
              className="size-7 cursor-pointer rounded-md border border-input bg-transparent p-0.5"
            />
          </label>
        </div>
      ) : null}
    </div>
  );
}

/** A small on/off switch shared by the box/text editors. */
function Toggle({
  checked,
  onChange,
  ariaLabel,
}: {
  checked: boolean;
  onChange: () => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={onChange}
      className={cn(
        "relative h-6 w-10 shrink-0 rounded-full transition-colors",
        checked ? "bg-foreground" : "bg-muted",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 left-0 size-5 rounded-full bg-background shadow-sm transition-transform",
          checked ? "translate-x-[18px]" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

/** Background on/off + color / opacity / outline controls for a box surface. */
function BoxStyleEditor({
  box,
  onChange,
}: {
  box: BoxStyle;
  onChange: (patch: Partial<BoxStyle>) => void;
}) {
  const on = box.enabled !== false;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium">Background</span>
        <Toggle
          checked={on}
          onChange={() => onChange({ enabled: !on })}
          ariaLabel="Toggle background"
        />
      </div>
      {on ? (
        <>
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground">Color</span>
            <ColorPicker
              value={box.color}
              onChange={(c) => onChange({ color: c })}
              ariaLabel="Box color"
            />
          </div>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="flex justify-between text-muted-foreground">
              <span>Opacity</span>
              <span className="tabular-nums">{box.opacity}%</span>
            </span>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={box.opacity}
              onChange={(e) => onChange({ opacity: Number(e.target.value) })}
              aria-label="Box opacity"
              className="w-full"
            />
          </label>
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground">Outline</span>
            <div className="flex items-center gap-2">
              {box.outline ? (
                <ColorPicker
                  value={box.outlineColor}
                  onChange={(c) => onChange({ outlineColor: c })}
                  ariaLabel="Outline color"
                />
              ) : null}
              <Toggle
                checked={box.outline}
                onChange={() => onChange({ outline: !box.outline })}
                ariaLabel="Toggle outline"
              />
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

/** Font / size / bold / italic / underline / align / color controls for text. */
function TextStyleEditor({
  style,
  onChange,
  defaultSize,
}: {
  style: TextStyle;
  onChange: (patch: Partial<TextStyle>) => void;
  defaultSize: number;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="text-muted-foreground">Font</span>
        <select
          value={style.fontFamily ?? "inter"}
          onChange={(e) => onChange({ fontFamily: e.target.value })}
          aria-label="Text font"
          className="h-8 rounded-md border border-input bg-transparent px-2 text-sm outline-none"
        >
          {Object.entries(FONTS).map(([key, f]) => (
            <option key={key} value={key}>
              {f.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="text-muted-foreground">Size</span>
        <FontSizeInput
          value={style.fontSize ?? defaultSize}
          onChange={(size) => onChange({ fontSize: size })}
          listId="link-font-sizes"
        />
      </div>
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="text-muted-foreground">Style</span>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant={style.bold ? "default" : "ghost"}
            size="icon-sm"
            onClick={() => onChange({ bold: !style.bold })}
            aria-label="Bold"
            aria-pressed={!!style.bold}
            className="font-bold"
          >
            B
          </Button>
          <Button
            type="button"
            variant={style.italic ? "default" : "ghost"}
            size="icon-sm"
            onClick={() => onChange({ italic: !style.italic })}
            aria-label="Italic"
            aria-pressed={!!style.italic}
            className="italic"
          >
            I
          </Button>
          <Button
            type="button"
            variant={style.underline ? "default" : "ghost"}
            size="icon-sm"
            onClick={() => onChange({ underline: !style.underline })}
            aria-label="Underline"
            aria-pressed={!!style.underline}
            className="underline"
          >
            U
          </Button>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="text-muted-foreground">Align</span>
        <div className="flex items-center gap-1">
          {(["left", "center", "right"] as const).map((a) => (
            <Button
              key={a}
              type="button"
              variant={(style.align ?? "center") === a ? "default" : "ghost"}
              size="icon-sm"
              onClick={() => onChange({ align: a })}
              aria-label={`Align ${a}`}
              aria-pressed={(style.align ?? "center") === a}
            >
              <AlignIcon variant={a} className="size-4" />
            </Button>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="text-muted-foreground">Text color</span>
        <div className="flex items-center gap-2">
          {style.color ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onChange({ color: undefined })}
              className="text-muted-foreground"
            >
              Auto
            </Button>
          ) : null}
          <ColorPicker
            value={style.color ?? "#ffffff"}
            onChange={(c) => onChange({ color: c })}
            ariaLabel="Text color"
          />
        </div>
      </div>
    </div>
  );
}

/** Small paintbrush icon for the per-element "customize box" affordance. */
/** A rounded square framing three sparkles (the name/bio box-style affordance). */
function SparklesIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <path d="M15 8.2c0 1.6 1.1 2.7 2.7 2.7-1.6 0-2.7 1.1-2.7 2.7 0-1.6-1.1-2.7-2.7-2.7 1.6 0 2.7-1.1 2.7-2.7Z" />
      <path d="M8.7 6.6c0 1 .7 1.7 1.7 1.7-1 0-1.7.7-1.7 1.7 0-1-.7-1.7-1.7-1.7 1 0 1.7-.7 1.7-1.7Z" />
      <path d="M9 13.4c0 1.2.9 2.1 2.1 2.1-1.2 0-2.1.9-2.1 2.1 0-1.2-.9-2.1-2.1-2.1 1.2 0 2.1-.9 2.1-2.1Z" />
    </svg>
  );
}

/** The universal italic-serif "T" that signals font / text settings. */
function FontIcon({ className }: { className?: string }) {
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
      <path d="M8 5h11" />
      <path d="M14.5 5 11 19" />
      <path d="M8 19h6" />
    </svg>
  );
}

/** Animated text-effect picker (None / Gradient / Rainbow / Shine). */
function TextEffectSelect({
  value,
  onChange,
}: {
  value: TextStyle["animation"];
  onChange: (v: TextStyle["animation"]) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">Effect</span>
      <select
        value={value ?? "none"}
        onChange={(e) => onChange(e.target.value as TextStyle["animation"])}
        aria-label="Text effect"
        className="h-8 rounded-md border border-input bg-transparent px-2 text-sm outline-none"
      >
        <option value="none">None</option>
        <option value="gradient">Gradient</option>
        <option value="rainbow">Rainbow</option>
        <option value="shine">Shine</option>
      </select>
    </div>
  );
}

/**
 * A "customize box" button that opens a popover with the box-style controls,
 * placed on the element it styles (the name/bio card, or a link card). When
 * `onAnimation` is provided, the text-effect picker is shown too.
 */
function BoxStylePopover({
  box,
  onChange,
  label,
  align = "right",
  animation,
  onAnimation,
}: {
  box: BoxStyle;
  onChange: (patch: Partial<BoxStyle>) => void;
  label: string;
  align?: "left" | "right";
  animation?: TextStyle["animation"];
  onAnimation?: (v: TextStyle["animation"]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={label}
        aria-expanded={open}
        className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <SparklesIcon className="size-5" />
      </button>
      {open ? (
        <div
          className={cn(
            "absolute bottom-full z-50 mb-1 w-56 animate-pop rounded-md border border-border bg-popover p-3 shadow-lg",
            align === "right"
              ? "right-0 origin-bottom-right"
              : "left-0 origin-bottom-left",
          )}
        >
          <BoxStyleEditor box={box} onChange={onChange} />
          {onAnimation ? (
            <>
              <div className="my-3 border-t border-border" />
              <TextEffectSelect value={animation} onChange={onAnimation} />
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * The per-link box "customize" popover: the box controls (color / opacity /
 * outline / on-off) plus a button to copy this link's whole look onto every
 * link. Text/font controls live in a separate {@link FontPopover}.
 */
function LinkStylePopover({
  box,
  onBox,
  onApplyAll,
  align = "left",
  animation,
  onAnimation,
}: {
  box: BoxStyle;
  onBox: (patch: Partial<BoxStyle>) => void;
  onApplyAll: () => void;
  align?: "left" | "right";
  animation?: TextStyle["animation"];
  onAnimation?: (v: TextStyle["animation"]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Customize link"
        aria-expanded={open}
        className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <SparklesIcon className="size-5" />
      </button>
      {open ? (
        <div
          className={cn(
            "absolute bottom-full z-50 mb-1 max-h-[70vh] w-60 overflow-y-auto animate-pop rounded-md border border-border bg-popover p-3 shadow-lg",
            align === "right"
              ? "right-0 origin-bottom-right"
              : "left-0 origin-bottom-left",
          )}
        >
          <BoxStyleEditor box={box} onChange={onBox} />
          {onAnimation ? (
            <>
              <div className="my-3 border-t border-border" />
              <TextEffectSelect value={animation} onChange={onAnimation} />
            </>
          ) : null}
          <div className="my-3 border-t border-border" />
          <Button
            variant="outline"
            size="sm"
            onClick={onApplyAll}
            className="w-full"
          >
            Apply to all links
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/** A labelled 1–10 range slider used by the profile-picture effect controls. */
function FxSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="flex justify-between text-muted-foreground">
        <span>{label}</span>
        <span className="tabular-nums">{value}/10</span>
      </span>
      <input
        type="range"
        min={1}
        max={10}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        className="w-full"
      />
    </label>
  );
}

/**
 * The profile-picture customization menu (opened by the sparkles button next to
 * the avatar): an effect picker (None / Particles / Shine) with per-effect
 * controls, plus a togglable outline.
 */
function AvatarFxPopover({
  effect,
  outline,
  onEffect,
  onEffectPatch,
  onOutline,
  onOutlineColor,
}: {
  effect?: AvatarEffect;
  outline?: AvatarOutline;
  onEffect: (type: AvatarEffect["type"]) => void;
  onEffectPatch: (patch: Record<string, unknown>) => void;
  onOutline: () => void;
  onOutlineColor: (color: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const type = effect?.type ?? "none";
  const outlineOn = outline?.enabled ?? false;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Profile picture effects"
        aria-expanded={open}
        className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <SparklesIcon className="size-5" />
      </button>
      {open ? (
        <div
          role="menu"
          aria-label="Profile picture effects"
          className="absolute top-full left-1/2 z-50 mt-2 w-64 -translate-x-1/2 origin-top animate-pop rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-lg"
        >
          <p className="mb-2 text-sm font-medium">Profile picture</p>
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  ["none", "None"],
                  ["particles", "Particles"],
                  ["shine", "Shine"],
                ] as [AvatarEffect["type"], string][]
              ).map(([t, label]) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => onEffect(t)}
                  className={cn(
                    "flex h-9 items-center justify-center rounded-md border text-xs transition-colors",
                    type === t
                      ? "border-ring bg-muted text-foreground"
                      : "border-input text-muted-foreground hover:bg-muted",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {effect?.type === "particles" ? (
              <>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">Color</span>
                  <ColorPicker
                    value={effect.color}
                    onChange={(c) => onEffectPatch({ color: c })}
                    ariaLabel="Particle color"
                  />
                </div>
                <FxSlider
                  label="Speed"
                  value={effect.speed}
                  onChange={(n) => onEffectPatch({ speed: n })}
                />
                <FxSlider
                  label="Size"
                  value={effect.size}
                  onChange={(n) => onEffectPatch({ size: n })}
                />
                <FxSlider
                  label="Amount"
                  value={effect.amount}
                  onChange={(n) => onEffectPatch({ amount: n })}
                />
              </>
            ) : effect?.type === "shine" ? (
              <FxSlider
                label="Speed"
                value={effect.speed}
                onChange={(n) => onEffectPatch({ speed: n })}
              />
            ) : (
              <p className="text-xs text-muted-foreground">
                No effect on the profile picture.
              </p>
            )}

            <div className="my-1 border-t border-border" />
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium">Outline</span>
              <Toggle
                checked={outlineOn}
                onChange={onOutline}
                ariaLabel="Toggle profile photo outline"
              />
            </div>
            {outlineOn ? (
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">Color</span>
                <ColorPicker
                  value={outline?.color ?? "#ffffff"}
                  onChange={onOutlineColor}
                  ariaLabel="Profile photo outline color"
                />
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function LayoutIcon({ className }: { className?: string }) {
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
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18" />
      <path d="M9 21V9" />
    </svg>
  );
}

/** A one-click page look: background + fonts + link box color. */
interface Template {
  key: string;
  label: string;
  background: Background;
  /** Font applied to both name and bio. */
  font: string;
  /** Box color applied to every link (undefined = default theme surface). */
  linkColor?: string;
  /** CSS `background` for the preview swatch. */
  preview: string;
}

const TEMPLATES: Template[] = [
  {
    key: "minimal",
    label: "Minimal",
    background: { type: "default" },
    font: "inter",
    linkColor: undefined,
    preview: "linear-gradient(135deg,#fafafa,#d4d4d8)",
  },
  {
    key: "violet",
    label: "Violet Dream",
    background: {
      type: "gradient",
      from: "#3b82f6",
      to: "#ec4899",
      direction: "vertical",
      distribution: 50,
    },
    font: "poppins",
    linkColor: "#312e81",
    preview: "linear-gradient(135deg,#3b82f6,#8b5cf6,#ec4899)",
  },
  {
    key: "space",
    label: "Deep Space",
    background: { type: "starfield", speed: 4 },
    font: "mono",
    linkColor: "#1e293b",
    preview: "radial-gradient(circle at 35% 30%,#1e293b,#000)",
  },
  {
    key: "sunset",
    label: "Sunset",
    background: {
      type: "gradient",
      from: "#f97316",
      to: "#db2777",
      direction: "vertical",
      distribution: 50,
    },
    font: "poppins",
    linkColor: "#7c2d12",
    preview: "linear-gradient(#f97316,#db2777)",
  },
  {
    key: "ocean",
    label: "Ocean",
    background: {
      type: "gradient",
      from: "#0ea5e9",
      to: "#14b8a6",
      direction: "vertical",
      distribution: 50,
    },
    font: "lora",
    linkColor: "#0c4a6e",
    preview: "linear-gradient(#0ea5e9,#14b8a6)",
  },
  {
    key: "noir",
    label: "Noir",
    background: { type: "custom", color: "#0a0a0a" },
    font: "playfair",
    linkColor: "#262626",
    preview: "#0a0a0a",
  },
];

/** Background memory patch so a template's background restores on type-switch. */
function templateMemory(bg: Background): BackgroundMemory {
  if (bg.type === "custom") return { custom: bg.color };
  if (bg.type === "gradient") {
    return {
      gradient: {
        from: bg.from,
        to: bg.to,
        direction: bg.direction,
        distribution: bg.distribution,
      },
    };
  }
  if (bg.type === "starfield") return { starfield: { speed: bg.speed } };
  return {};
}

export function MyPageClient({
  initialData,
  username,
}: {
  initialData: PageData | null;
  username?: string | null;
}) {
  // Server-provided data, or a blank page seeded with the account username as
  // the name when the user hasn't created one yet.
  const initial = seedBgMemory(
    initialData ?? { ...DEFAULT_DATA, name: username ?? "" },
  );

  // Current theme, used to keep explicit text colors legible on both themes.
  // Gated on mount so the first client render matches the server (no theme).
  const { resolvedTheme } = useTheme();
  const [themeMounted, setThemeMounted] = useState(false);
  useEffect(() => setThemeMounted(true), []);
  const isDark = themeMounted && resolvedTheme === "dark";

  const [editing, setEditing] = useState(false);
  // Bumps only on a real mode switch so the fade animates on toggle, not load.
  const [switched, setSwitched] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  // The id of the link currently having its logo uploaded (null = modal closed).
  const [logoTarget, setLogoTarget] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  // Avatar action menu (Adjust / Change / Remove).
  const [avatarMenu, setAvatarMenu] = useState(false);
  // Background picker dropdown.
  const [bgMenu, setBgMenu] = useState(false);
  const bgMenuRef = useRef<HTMLDivElement | null>(null);
  // Template picker dropdown.
  const [tplMenu, setTplMenu] = useState(false);
  const tplMenuRef = useRef<HTMLDivElement | null>(null);
  // Panel dropdown (background panel behind the whole profile block).
  const [boxMenu, setBoxMenu] = useState(false);
  const boxMenuRef = useRef<HTMLDivElement | null>(null);
  // Text color shown in the toolbar swatch — mirrors the current selection's
  // color (updated on selection change) rather than a fixed default.
  const [textColor, setTextColor] = useState("#ffffff");
  // Imported-media background: hidden file input, validation error, and the
  // crop editor (source + kind while open, plus its live frame/position/zoom).
  const bgFileInputRef = useRef<HTMLInputElement | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [mediaCrop, setMediaCrop] = useState<{
    src: string;
    kind: "image" | "video";
  } | null>(null);
  const [mediaFrame, setMediaFrame] = useState({ w: 300, h: 180 });
  const [mediaPos, setMediaPos] = useState({ x: 50, y: 50 });
  const [mediaZoom, setMediaZoom] = useState(1);
  const mediaDragRef = useRef<{
    x: number;
    y: number;
    px: number;
    py: number;
  } | null>(null);
  // `saved` is what's committed (and shown in view mode); `draft` is the
  // working copy edited in edit mode. They diverge until you Save or Reset.
  const [saved, setSaved] = useState<PageData>(initial);
  const [draft, setDraft] = useState<PageData>(initial);
  // Bumped whenever the editable text needs to be re-seeded from `draft`
  // (entering edit mode, Reset) so the contentEditable fields remount.
  const [editKey, setEditKey] = useState(0);
  // `flashing` is only true while the blocked-save flash animation runs;
  // `flashKey` is bumped to restart the animation on repeated attempts.
  const [flashing, setFlashing] = useState(false);
  const [flashKey, setFlashKey] = useState(0);
  // Link ids whose box should flash because their URL is blank on save.
  // `linkFlashTick` bumps to restart the animation on repeated save attempts.
  const [flashLinkIds, setFlashLinkIds] = useState<string[]>([]);
  const [linkFlashTick, setLinkFlashTick] = useState(0);
  const [saving, setSaving] = useState(false);
  const [confirmingSave, setConfirmingSave] = useState(false);
  // Which text field the formatting toolbar targets.
  const [activeField, setActiveField] = useState<"name" | "bio">("name");
  // Which element's font/text settings extension is open: "name", "bio", or a
  // link id. Only one is open at a time.
  const [fontOpen, setFontOpen] = useState<string | null>(null);
  // Which link's editor is expanded in horizontal edit mode (icon-row layout).
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
  // Inline formatting state of the current selection, mirrored so the toolbar
  // B/I/U buttons can show their pressed state.
  const [inlineFmt, setInlineFmt] = useState({
    bold: false,
    italic: false,
    underline: false,
  });

  // Editable DOM nodes for the two rich-text fields, plus the last selection
  // range inside one of them (restored before running a toolbar command in
  // case focus moved to a toolbar control like the color picker).
  const nameEditorRef = useRef<HTMLDivElement | null>(null);
  const bioEditorRef = useRef<HTMLDivElement | null>(null);
  const savedRangeRef = useRef<Range | null>(null);

  // Fade the fixed Edit button out just before it would overlap the footer,
  // and back in once there's clearance again.
  const [controlsOpacity, setControlsOpacity] = useState(1);
  const buttonsRef = useRef<HTMLDivElement | null>(null);

  // Profile-picture cropping.
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  // When the crop editor was opened from the profile-photo menu, dismissing it
  // (Cancel / overlay / Escape) reopens that menu instead of the bare page.
  const [cropReturnToMenu, setCropReturnToMenu] = useState(false);
  const [cropZoom, setCropZoom] = useState(1);
  const [cropOffset, setCropOffset] = useState({ x: 0, y: 0 });
  const cropImgRef = useRef<HTMLImageElement | null>(null);
  const cropNatRef = useRef<{ w: number; h: number } | null>(null);
  const cropBaseRef = useRef(1);
  const dragRef = useRef<{
    x: number;
    y: number;
    ox: number;
    oy: number;
  } | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  // Drag-to-reorder state for the link list.
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragDelta, setDragDelta] = useState(0);
  const [dragTarget, setDragTarget] = useState<number | null>(null);
  const linkCardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  // Immutable metrics captured at drag start: dragged card index/height, the
  // inter-card gap, and every card's original center (viewport coords). Cards
  // only move via CSS transforms during a drag, so these baselines stay valid.
  const dragMetaRef = useRef<{
    index: number;
    startY: number;
    height: number;
    gap: number;
    centers: number[];
  } | null>(null);

  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(saved),
    [draft, saved],
  );

  // Sync dirty state with the global unsaved guard so navbar links are blocked.
  const guard = useUnsavedGuard();
  const guardDirty = editing && dirty;

  const flash = useCallback(() => {
    setFlashKey((k) => k + 1);
    setFlashing(true);
  }, []);

  useEffect(() => {
    guard.setDirty(guardDirty);
    guard.setOnBlocked(guardDirty ? flash : null);
    return () => {
      guard.setDirty(false);
      guard.setOnBlocked(null);
    };
  }, [guardDirty, guard, flash]);

  // Presence controllers so popups animate out before unmounting.
  const unsavedBar = usePresence(editing && dirty, 250);
  const picker = usePresence(showPicker, 200);
  const logoModal = usePresence(logoTarget, 200);
  const cropModal = usePresence(cropSrc, 200);
  const avatarModal = usePresence(avatarMenu, 200);
  const bgMenuP = usePresence(bgMenu, 200);
  const tplMenuP = usePresence(tplMenu, 200);
  const boxMenuP = usePresence(boxMenu, 200);
  const mediaCropModal = usePresence(mediaCrop, 200);

  // Mirror the current selection's inline formatting into state (for the
  // toolbar's pressed states) and remember the range so a command can restore
  // it if focus moves to a toolbar control.
  useEffect(() => {
    if (!editing) return;
    function onSelectionChange() {
      const sel = window.getSelection();
      const node = sel?.anchorNode ?? null;
      const inName = !!node && nameEditorRef.current?.contains(node);
      const inBio = !!node && bioEditorRef.current?.contains(node);
      if (!inName && !inBio) return;
      if (sel && sel.rangeCount > 0) {
        savedRangeRef.current = sel.getRangeAt(0).cloneRange();
      }
      setInlineFmt({
        bold: document.queryCommandState("bold"),
        italic: document.queryCommandState("italic"),
        underline: document.queryCommandState("underline"),
      });
      // Reflect the selection's actual text color in the toolbar swatch.
      const fore = document.queryCommandValue("foreColor");
      const hex = toHex(fore);
      if (hex) setTextColor(hex);
    }
    document.addEventListener("selectionchange", onSelectionChange);
    return () =>
      document.removeEventListener("selectionchange", onSelectionChange);
  }, [editing]);

  // Close the picker on Escape.
  useEffect(() => {
    if (!showPicker) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowPicker(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showPicker]);

  // Close the avatar menu on Escape.
  useEffect(() => {
    if (!avatarMenu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAvatarMenu(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [avatarMenu]);

  // Close the background dropdown on Escape or an outside click.
  useEffect(() => {
    if (!bgMenu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setBgMenu(false);
    };
    const onDown = (e: MouseEvent) => {
      // Ignore clicks while the crop editor is open — it's a separate overlay
      // above the dropdown; closing the dropdown would hide it on Cancel.
      if (mediaCrop) return;
      if (bgMenuRef.current && !bgMenuRef.current.contains(e.target as Node)) {
        setBgMenu(false);
      }
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [bgMenu, mediaCrop]);

  // Close the template dropdown on Escape or an outside click.
  useEffect(() => {
    if (!tplMenu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setTplMenu(false);
    };
    const onDown = (e: MouseEvent) => {
      if (
        tplMenuRef.current &&
        !tplMenuRef.current.contains(e.target as Node)
      ) {
        setTplMenu(false);
      }
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [tplMenu]);

  // Close the boxes dropdown on Escape or an outside click.
  useEffect(() => {
    if (!boxMenu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setBoxMenu(false);
    };
    const onDown = (e: MouseEvent) => {
      if (
        boxMenuRef.current &&
        !boxMenuRef.current.contains(e.target as Node)
      ) {
        setBoxMenu(false);
      }
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [boxMenu]);

  // Close the media crop editor on Escape (returns to the background dropdown).
  useEffect(() => {
    if (!mediaCrop) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMediaCrop(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mediaCrop]);

  // Close the logo uploader on Escape.
  useEffect(() => {
    if (!logoTarget) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLogoTarget(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [logoTarget]);

  // Close the crop editor on Escape.
  useEffect(() => {
    if (!cropSrc) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setCropSrc(null);
      if (cropReturnToMenu) setAvatarMenu(true);
      setCropReturnToMenu(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cropSrc, cropReturnToMenu]);

  // Fade the corner button out just before the footer would overlap it, and
  // back in once there's clearance. `gap` is the distance from the footer's top
  // edge down to the button's bottom edge; we fade across `bottomOffset` px (the
  // button's own fixed distance from the viewport bottom) so it only happens
  // right before overlap, on any page height. Recomputes on scroll/resize.
  useEffect(() => {
    function measure() {
      const buttons = buttonsRef.current;
      const footer = document.querySelector("footer");
      if (!buttons || !footer) {
        setControlsOpacity(1);
        return;
      }
      const btnBottom = buttons.getBoundingClientRect().bottom;
      const bottomOffset = window.innerHeight - btnBottom;
      const gap = footer.getBoundingClientRect().top - btnBottom;
      const next =
        bottomOffset > 0
          ? Math.round(Math.max(0, Math.min(1, gap / bottomOffset)) * 100) / 100
          : 1;
      setControlsOpacity((prev) => (prev === next ? prev : next));
    }
    measure();
    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    const observer = new ResizeObserver(measure);
    observer.observe(document.documentElement);
    return () => {
      window.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
      observer.disconnect();
    };
  }, []);

  function clone(d: PageData): PageData {
    return JSON.parse(JSON.stringify(d)) as PageData;
  }

  function updateField<K extends keyof PageData>(key: K, value: PageData[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  // Default colors used when a background theme is first chosen.
  const CUSTOM_DEFAULT = "#1e2433";
  const GRADIENT_DEFAULT: GradientConfig = {
    from: "#3b82f6",
    to: "#8b5cf6",
    direction: "vertical",
    distribution: 50,
  };
  const STARFIELD_DEFAULT: StarfieldConfig = { speed: 5 };

  // The last colors picked per background type live in `draft.bgMemory`, so they
  // persist across Custom/Gradient switches AND get saved — surviving a reload
  // or a trip to another page instead of resetting to defaults.
  const bgType = draft.background?.type ?? "default";
  const customColor =
    draft.background?.type === "custom"
      ? draft.background.color
      : (draft.bgMemory?.custom ?? CUSTOM_DEFAULT);
  const grad: GradientConfig =
    draft.background?.type === "gradient"
      ? {
          from: draft.background.from,
          to: draft.background.to,
          direction: draft.background.direction ?? "vertical",
          distribution: draft.background.distribution ?? 50,
        }
      : draft.bgMemory?.gradient
        ? {
            from: draft.bgMemory.gradient.from,
            to: draft.bgMemory.gradient.to,
            direction: draft.bgMemory.gradient.direction ?? "vertical",
            distribution: draft.bgMemory.gradient.distribution ?? 50,
          }
        : { ...GRADIENT_DEFAULT };
  const starfield: StarfieldConfig =
    draft.background?.type === "starfield"
      ? { speed: draft.background.speed }
      : (draft.bgMemory?.starfield ?? STARFIELD_DEFAULT);
  const media: MediaBackground | undefined =
    draft.background?.type === "media"
      ? {
          kind: draft.background.kind,
          src: draft.background.src,
          posX: draft.background.posX,
          posY: draft.background.posY,
          zoom: draft.background.zoom,
        }
      : draft.bgMemory?.media;

  // Switch background type, restoring the last settings remembered for that
  // type. Choosing "media" with nothing imported yet opens the file picker
  // instead of applying an empty background.
  function chooseBackground(type: Background["type"]) {
    if (type === "custom") {
      const color = customColor;
      setDraft((prev) => ({
        ...prev,
        background: { type: "custom", color },
        bgMemory: { ...prev.bgMemory, custom: color },
      }));
    } else if (type === "gradient") {
      const g = grad;
      setDraft((prev) => ({
        ...prev,
        background: { type: "gradient", ...g },
        bgMemory: { ...prev.bgMemory, gradient: g },
      }));
    } else if (type === "starfield") {
      const s = starfield;
      setDraft((prev) => ({
        ...prev,
        background: { type: "starfield", ...s },
        bgMemory: { ...prev.bgMemory, starfield: s },
      }));
    } else if (type === "media") {
      if (media) {
        const m = media;
        setDraft((prev) => ({
          ...prev,
          background: { type: "media", ...m },
          bgMemory: { ...prev.bgMemory, media: m },
        }));
      } else {
        setMediaError(null);
        bgFileInputRef.current?.click();
      }
    } else {
      setDraft((prev) => ({ ...prev, background: { type: "default" } }));
    }
  }

  function updateCustomColor(color: string) {
    setDraft((prev) => ({
      ...prev,
      background: { type: "custom", color },
      bgMemory: { ...prev.bgMemory, custom: color },
    }));
  }

  function updateGradient(patch: Partial<GradientConfig>) {
    const next = { ...grad, ...patch };
    setDraft((prev) => ({
      ...prev,
      background: { type: "gradient", ...next },
      bgMemory: { ...prev.bgMemory, gradient: next },
    }));
  }

  function updateStarfield(patch: Partial<StarfieldConfig>) {
    const next = { ...starfield, ...patch };
    setDraft((prev) => ({
      ...prev,
      background: { type: "starfield", ...next },
      bgMemory: { ...prev.bgMemory, starfield: next },
    }));
  }

  function removeMedia() {
    setDraft((prev) => ({ ...prev, background: { type: "default" } }));
  }

  // Box surfaces. The name box, the bio box, and each link carry their own box
  // style, edited in place from the element itself (not a central menu).
  const nameBox = draft.nameBox ?? DEFAULT_NAME_BOX;
  const bioBox = draft.bioBox ?? draft.nameBox ?? DEFAULT_BIO_BOX;
  const linkBox = draft.linkBox ?? DEFAULT_LINK_BOX;

  function updateNameBox(patch: Partial<BoxStyle>) {
    setDraft((prev) => ({
      ...prev,
      nameBox: { ...(prev.nameBox ?? DEFAULT_NAME_BOX), ...patch },
    }));
  }

  function updateBioBox(patch: Partial<BoxStyle>) {
    setDraft((prev) => ({
      ...prev,
      bioBox: { ...(prev.bioBox ?? prev.nameBox ?? DEFAULT_BIO_BOX), ...patch },
    }));
  }

  function updateLinkBox(id: string, patch: Partial<BoxStyle>) {
    setDraft((prev) => ({
      ...prev,
      links: prev.links.map((l) =>
        l.id === id
          ? {
              ...l,
              color: undefined,
              box: { ...resolveLinkBox(l, linkBox), ...patch },
            }
          : l,
      ),
    }));
  }

  // Link text styling. Each link carries its own `textStyle`; a link with none
  // falls back to the page-wide `linkStyle` default (empty object when unset).
  function linkTextStyle(l: LinkItem): TextStyle {
    return l.textStyle ?? draft.linkStyle ?? {};
  }

  function updateLinkText(id: string, patch: Partial<TextStyle>) {
    setDraft((prev) => ({
      ...prev,
      links: prev.links.map((l) =>
        l.id === id
          ? {
              ...l,
              textStyle: { ...(l.textStyle ?? prev.linkStyle ?? {}), ...patch },
            }
          : l,
      ),
    }));
  }

  // Push one link's box + text style onto every link, and make it the page-wide
  // default so links added later inherit the same look.
  function applyLinkStyleToAll(id: string) {
    setDraft((prev) => {
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

  // Panel behind the whole profile block. Sensible per-type defaults; when
  // switching types we carry the current tint color forward so the choice
  // doesn't reset to a stranger color each time.
  const panel = draft.panel ?? DEFAULT_PANEL;
  const horizontal =
    ((editing ? draft.panelOrientation : saved.panelOrientation) ??
      "vertical") === "horizontal";

  function choosePanel(type: PanelStyle["type"]) {
    setDraft((prev) => {
      const cur = prev.panel ?? DEFAULT_PANEL;
      const tint =
        cur.type === "color" || cur.type === "glass" ? cur.color : "#000000";
      let next: PanelStyle;
      if (type === "color") {
        next = {
          type: "color",
          color: tint,
          opacity: cur.type === "color" ? cur.opacity : 40,
        };
      } else if (type === "gradient") {
        next =
          cur.type === "gradient"
            ? cur
            : {
                type: "gradient",
                from: "#3b82f6",
                to: "#8b5cf6",
                direction: "vertical",
                opacity: 60,
              };
      } else if (type === "glass") {
        next = {
          type: "glass",
          color: "#ffffff",
          opacity: cur.type === "glass" ? cur.opacity : 12,
        };
      } else {
        next = { type: "transparent" };
      }
      return { ...prev, panel: next };
    });
  }

  function updatePanel(patch: Record<string, unknown>) {
    setDraft((prev) => {
      const cur = prev.panel ?? DEFAULT_PANEL;
      return { ...prev, panel: { ...cur, ...patch } as PanelStyle };
    });
  }

  function setPanelOrientation(orientation: "vertical" | "horizontal") {
    setDraft((prev) => ({ ...prev, panelOrientation: orientation }));
  }

  // Profile-picture effect + outline. Switching effect type seeds sensible
  // defaults (and keeps the current settings when returning to a type).
  function chooseAvatarEffect(type: AvatarEffect["type"]) {
    setDraft((prev) => {
      const cur = prev.avatarEffect;
      let next: AvatarEffect;
      if (type === "particles") {
        next =
          cur?.type === "particles"
            ? cur
            : {
                type: "particles",
                color: "#ffffff",
                speed: 5,
                size: 5,
                amount: 5,
              };
      } else if (type === "shine") {
        next = cur?.type === "shine" ? cur : { type: "shine", speed: 5 };
      } else {
        next = { type: "none" };
      }
      return { ...prev, avatarEffect: next };
    });
  }

  function updateAvatarEffect(patch: Record<string, unknown>) {
    setDraft((prev) => {
      const cur = prev.avatarEffect;
      if (!cur || cur.type === "none") return prev;
      return { ...prev, avatarEffect: { ...cur, ...patch } as AvatarEffect };
    });
  }

  function toggleAvatarOutline() {
    setDraft((prev) => {
      const cur = prev.avatarOutline;
      return {
        ...prev,
        avatarOutline: {
          color: cur?.color ?? "#ffffff",
          enabled: !(cur?.enabled ?? false),
        },
      };
    });
  }

  function setAvatarOutlineColor(color: string) {
    setDraft((prev) => ({
      ...prev,
      avatarOutline: { enabled: prev.avatarOutline?.enabled ?? true, color },
    }));
  }

  // Apply a template's look: background, fonts, and link box color. Leaves the
  // name/bio text and other per-field styles (size, bold, alignment) intact.
  function applyTemplate(t: Template) {
    setDraft((prev) => ({
      ...prev,
      background: t.background,
      bgMemory: { ...prev.bgMemory, ...templateMemory(t.background) },
      nameStyle: { ...prev.nameStyle, fontFamily: t.font },
      bioStyle: { ...prev.bioStyle, fontFamily: t.font },
      links: prev.links.map((l) => ({ ...l, color: t.linkColor })),
    }));
    setTplMenu(false);
  }

  // Read a file's bytes as a data URL (used for imported background media).
  function fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Could not read the file"));
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
  }

  // Read the intrinsic dimensions of an image or video data URL.
  function readMediaDims(
    src: string,
    kind: "image" | "video",
  ): Promise<{ w: number; h: number } | null> {
    return new Promise((resolve) => {
      if (kind === "image") {
        const img = new Image();
        img.onerror = () => resolve(null);
        img.onload = () =>
          resolve({ w: img.naturalWidth, h: img.naturalHeight });
        img.src = src;
      } else {
        const v = document.createElement("video");
        v.onerror = () => resolve(null);
        v.onloadedmetadata = () =>
          resolve({ w: v.videoWidth, h: v.videoHeight });
        v.src = src;
      }
    });
  }

  // Validate an imported file, then open the crop editor on it.
  async function handleBgFile(file: File) {
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
      const src = await fileToDataUrl(file);
      const kind = isVideo ? "video" : "image";
      const dims = await readMediaDims(src, kind);
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
      openMediaCrop(src, kind, { posX: 50, posY: 50, zoom: 1 });
    } catch {
      setMediaError("Couldn't process that file. Try another.");
    }
  }

  // Open the crop editor, sizing the frame to the current viewport aspect so
  // what's framed matches what fills the page.
  function openMediaCrop(
    src: string,
    kind: "image" | "video",
    at: { posX: number; posY: number; zoom: number },
  ) {
    const w = 300;
    const ratio = window.innerHeight / window.innerWidth || 0.6;
    setMediaFrame({ w, h: Math.round(w * ratio) });
    setMediaPos({ x: at.posX, y: at.posY });
    setMediaZoom(at.zoom);
    setMediaCrop({ src, kind });
  }

  // Re-open the crop editor to adjust the already-applied media background.
  function adjustMedia() {
    if (!media) return;
    openMediaCrop(media.src, media.kind, {
      posX: media.posX,
      posY: media.posY,
      zoom: media.zoom,
    });
  }

  function applyMediaCrop() {
    if (!mediaCrop) return;
    const next: MediaBackground = {
      kind: mediaCrop.kind,
      src: mediaCrop.src,
      posX: Math.round(mediaPos.x),
      posY: Math.round(mediaPos.y),
      zoom: Math.round(mediaZoom * 100) / 100,
    };
    setDraft((prev) => ({
      ...prev,
      background: { type: "media", ...next },
      bgMemory: { ...prev.bgMemory, media: next },
    }));
    setMediaCrop(null);
  }

  // Cancel the crop without applying — leaves the background dropdown open
  // rather than dropping the user back to the bare page.
  function dismissMediaCrop() {
    setMediaCrop(null);
  }

  function onMediaCropPointerDown(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId);
    mediaDragRef.current = {
      x: e.clientX,
      y: e.clientY,
      px: mediaPos.x,
      py: mediaPos.y,
    };
  }

  function onMediaCropPointerMove(e: React.PointerEvent) {
    const d = mediaDragRef.current;
    if (!d) return;
    // Dragging the media one way reveals the opposite edge, so invert the delta.
    const dx = ((e.clientX - d.x) / mediaFrame.w) * 100;
    const dy = ((e.clientY - d.y) / mediaFrame.h) * 100;
    setMediaPos({
      x: clamp(d.px - dx, 0, 100),
      y: clamp(d.py - dy, 0, 100),
    });
  }

  function onMediaCropPointerUp() {
    mediaDragRef.current = null;
  }

  function updateLink(id: string, patch: Partial<LinkItem>) {
    setDraft((prev) => ({
      ...prev,
      links: prev.links.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    }));
  }

  function addLink(option: PickerOption) {
    setDraft((prev) => ({
      ...prev,
      links: [
        ...prev.links,
        {
          id: uid(),
          label: option.key === "custom" ? "New link" : option.label,
          href: option.prefix,
        },
      ],
    }));
    setShowPicker(false);
  }

  function removeLink(id: string) {
    setDraft((prev) => ({
      ...prev,
      links: prev.links.filter((l) => l.id !== id),
    }));
  }

  async function handleLogoFile(id: string, file: File) {
    setLogoError(null);
    if (!file.type.startsWith("image/")) {
      setLogoError("Please choose an image file.");
      return;
    }
    try {
      const logo = await readLogo(file);
      updateLink(id, { logo });
      setLogoTarget(null);
    } catch {
      setLogoError("Couldn't process that image. Try another file.");
    }
  }

  // Pick a new avatar file → open the crop editor on it.
  async function pickAvatar(file: File) {
    if (!file.type.startsWith("image/")) return;
    try {
      const src = await readLogo(file, 800);
      setCropSrc(src);
    } catch {
      // Ignore — a bad image just leaves the current avatar in place.
    }
  }

  function clampCropOffset(x: number, y: number, eff: number) {
    const nat = cropNatRef.current;
    if (!nat) return { x, y };
    const minX = CROP_SIZE - nat.w * eff;
    const minY = CROP_SIZE - nat.h * eff;
    return {
      x: Math.min(0, Math.max(minX, x)),
      y: Math.min(0, Math.max(minY, y)),
    };
  }

  // Fit the freshly-loaded image to cover the frame and center it.
  function onCropImgLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const img = e.currentTarget;
    const nat = { w: img.naturalWidth, h: img.naturalHeight };
    cropNatRef.current = nat;
    const base = Math.max(CROP_SIZE / nat.w, CROP_SIZE / nat.h);
    cropBaseRef.current = base;
    setCropZoom(1);
    setCropOffset({
      x: (CROP_SIZE - nat.w * base) / 2,
      y: (CROP_SIZE - nat.h * base) / 2,
    });
  }

  // Zoom around the frame's center so the focal point stays put.
  function changeCropZoom(z: number) {
    const nat = cropNatRef.current;
    if (!nat) {
      setCropZoom(z);
      return;
    }
    const oldEff = cropBaseRef.current * cropZoom;
    const newEff = cropBaseRef.current * z;
    const imgX = (CROP_SIZE / 2 - cropOffset.x) / oldEff;
    const imgY = (CROP_SIZE / 2 - cropOffset.y) / oldEff;
    setCropZoom(z);
    setCropOffset(
      clampCropOffset(
        CROP_SIZE / 2 - imgX * newEff,
        CROP_SIZE / 2 - imgY * newEff,
        newEff,
      ),
    );
  }

  function onCropPointerDown(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      x: e.clientX,
      y: e.clientY,
      ox: cropOffset.x,
      oy: cropOffset.y,
    };
  }

  function onCropPointerMove(e: React.PointerEvent) {
    const d = dragRef.current;
    if (!d) return;
    const eff = cropBaseRef.current * cropZoom;
    setCropOffset(
      clampCropOffset(d.ox + (e.clientX - d.x), d.oy + (e.clientY - d.y), eff),
    );
  }

  function onCropPointerUp() {
    dragRef.current = null;
  }

  // Bake the visible circle into a square canvas and store it as the avatar.
  function applyCrop() {
    const img = cropImgRef.current;
    const nat = cropNatRef.current;
    if (!img || !nat) return;
    const eff = cropBaseRef.current * cropZoom;
    const sx = -cropOffset.x / eff;
    const sy = -cropOffset.y / eff;
    const sSize = CROP_SIZE / eff;
    const canvas = document.createElement("canvas");
    canvas.width = CROP_SIZE;
    canvas.height = CROP_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, sx, sy, sSize, sSize, 0, 0, CROP_SIZE, CROP_SIZE);
    setDraft((prev) => ({ ...prev, avatar: canvas.toDataURL("image/png") }));
    setCropReturnToMenu(false);
    setCropSrc(null);
  }

  // Dismiss the crop editor without applying. When it was opened from the
  // profile-photo menu (Adjust / Change photo), reopen that menu instead of
  // dropping the user back onto the bare page.
  function dismissCrop() {
    setCropSrc(null);
    if (cropReturnToMenu) setAvatarMenu(true);
    setCropReturnToMenu(false);
  }

  // ---- Drag-to-reorder handlers -------------------------------------------

  function onLinkDragStart(e: React.PointerEvent, id: string, index: number) {
    e.preventDefault();
    const centers = draft.links.map((l) => {
      const el = linkCardRefs.current.get(l.id);
      const r = el?.getBoundingClientRect();
      return r ? r.top + r.height / 2 : 0;
    });
    const self = linkCardRefs.current.get(id)?.getBoundingClientRect();
    dragMetaRef.current = {
      index,
      startY: e.clientY,
      height: self?.height ?? 0,
      gap: 12,
      centers,
    };
    setDragId(id);
    setDragDelta(0);
    setDragTarget(index);
    // Pointer capture keeps move/up events flowing to the handle even when the
    // cursor leaves it; guard the call since some pointer types can reject it.
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Non-fatal: dragging still works without explicit capture.
    }
  }

  function onLinkDragMove(e: React.PointerEvent) {
    const meta = dragMetaRef.current;
    if (!meta || dragId === null) return;
    const delta = e.clientY - meta.startY;
    setDragDelta(delta);
    const draggedCenter = meta.centers[meta.index] + delta;
    let target = meta.index;
    for (let i = 0; i < meta.centers.length; i++) {
      if (i === meta.index) continue;
      if (i < meta.index && draggedCenter < meta.centers[i]) {
        target = Math.min(target, i);
      } else if (i > meta.index && draggedCenter > meta.centers[i]) {
        target = Math.max(target, i);
      }
    }
    setDragTarget((prev) => (prev === target ? prev : target));
  }

  function onLinkDragEnd() {
    const meta = dragMetaRef.current;
    if (meta && dragTarget !== null && dragTarget !== meta.index) {
      const from = meta.index;
      const to = dragTarget;
      setDraft((prev) => {
        const links = [...prev.links];
        const [moved] = links.splice(from, 1);
        links.splice(to, 0, moved);
        return { ...prev, links };
      });
    }
    dragMetaRef.current = null;
    setDragId(null);
    setDragDelta(0);
    setDragTarget(null);
  }

  // How far a card at original index `i` should shift to make room for the
  // dragged card, given the current drag target.
  function dragShiftFor(id: string, i: number): number {
    const meta = dragMetaRef.current;
    if (dragId === null || dragTarget === null || !meta) return 0;
    if (id === dragId) return dragDelta;
    const from = meta.index;
    const to = dragTarget;
    const step = meta.height + meta.gap;
    if (from < to && i > from && i <= to) return -step;
    if (from > to && i < from && i >= to) return step;
    return 0;
  }

  function save() {
    // Require a URL in every link box — flash the empty ones instead of saving.
    const blankIds = draft.links
      .filter((l) => isBlankHref(l.href))
      .map((l) => l.id);
    if (blankIds.length > 0) {
      setFlashLinkIds(blankIds);
      setLinkFlashTick((t) => t + 1);
      return;
    }

    setConfirmingSave(true);
  }

  async function confirmSave() {
    setConfirmingSave(false);
    setSaving(true);
    try {
      await savePage(draft);
      setSaved(draft);
    } catch (err) {
      console.error("Failed to save page:", err);
      const message =
        err instanceof Error && err.message
          ? err.message
          : "Couldn't save your changes. Please try again.";
      alert(message);
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setDraft(clone(saved));
    setEditKey((k) => k + 1);
  }

  function toggleMode() {
    if (editing) {
      // Don't leave edit mode with unsaved changes — flash the bar instead.
      if (dirty) {
        setFlashKey((k) => k + 1);
        setFlashing(true);
        return;
      }
      setSwitched(true);
      setEditing(false);
    } else {
      setDraft(clone(saved));
      setEditKey((k) => k + 1);
      setSwitched(true);
      setEditing(true);
    }
  }

  // Merge a field's saved style over its defaults for rendering.
  const nameStyle = { ...DEFAULT_NAME_STYLE, ...draft.nameStyle };
  const bioStyle = { ...DEFAULT_BIO_STYLE, ...draft.bioStyle };
  const savedNameStyle = { ...DEFAULT_NAME_STYLE, ...saved.nameStyle };
  const savedBioStyle = { ...DEFAULT_BIO_STYLE, ...saved.bioStyle };
  const savedNameBox = saved.nameBox ?? DEFAULT_NAME_BOX;
  const savedBioBox = saved.bioBox ?? saved.nameBox ?? DEFAULT_BIO_BOX;
  const savedLinkBox = saved.linkBox ?? DEFAULT_LINK_BOX;
  const activeStyle = activeField === "name" ? nameStyle : bioStyle;

  // Patch the currently-targeted field's whole-field style (font/size/align).
  function setActiveStyle(patch: Partial<TextStyle>) {
    const key = activeField === "name" ? "nameStyle" : "bioStyle";
    const base = activeField === "name" ? nameStyle : bioStyle;
    setDraft((prev) => ({ ...prev, [key]: { ...base, ...patch } }));
  }

  // Read the active editor's HTML back into the draft after a DOM mutation.
  function syncActiveField() {
    const el =
      activeField === "name" ? nameEditorRef.current : bioEditorRef.current;
    if (el) updateField(activeField, el.innerHTML);
  }

  // Run `fn` with the last text selection restored, in case focus moved to a
  // toolbar control (e.g. the native color input) and collapsed the selection.
  function withSelection(fn: () => void) {
    const el =
      activeField === "name" ? nameEditorRef.current : bioEditorRef.current;
    const active = document.activeElement;
    const inEditor =
      active === nameEditorRef.current || active === bioEditorRef.current;
    if (!inEditor && el && savedRangeRef.current) {
      el.focus();
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(savedRangeRef.current);
    }
    fn();
  }

  // Apply an inline command (bold/italic/underline) to the current selection.
  function applyInline(command: "bold" | "italic" | "underline") {
    withSelection(() => {
      document.execCommand(command, false);
      setInlineFmt({
        bold: document.queryCommandState("bold"),
        italic: document.queryCommandState("italic"),
        underline: document.queryCommandState("underline"),
      });
      syncActiveField();
    });
  }

  // Color the selected characters.
  function applyColor(color: string) {
    withSelection(() => {
      document.execCommand("foreColor", false, color);
      syncActiveField();
    });
  }

  const formatToolbar = (
    <div
      role="toolbar"
      aria-label="Text formatting"
      className="flex flex-wrap items-center justify-center gap-2"
      onMouseDown={(e) => {
        // Keep the focused field (and its selection) active when clicking
        // buttons; let selects/inputs receive focus normally.
        const tag = (e.target as HTMLElement).tagName;
        if (tag !== "SELECT" && tag !== "INPUT" && tag !== "OPTION") {
          e.preventDefault();
        }
      }}
    >
      {/* Font family + size — one group so they wrap together, never apart. */}
      <div className="flex shrink-0 items-center gap-1">
        <select
          value={activeStyle.fontFamily ?? "inter"}
          onChange={(e) => setActiveStyle({ fontFamily: e.target.value })}
          aria-label="Font"
          className="h-8 max-w-[8rem] rounded-md border border-current/20 bg-transparent px-2 text-sm outline-none"
        >
          {Object.entries(FONTS).map(([key, f]) => (
            <option key={key} value={key}>
              {f.label}
            </option>
          ))}
        </select>
        <FontSizeInput
          value={activeStyle.fontSize ?? 16}
          onChange={(size) => setActiveStyle({ fontSize: size })}
          ariaLabel="Font size"
          listId="text-font-sizes"
        />
      </div>

      {/* Formatting controls — bold/italic/underline, alignment, and color kept
          together as one non-wrapping group so they always share a row (dropping
          to the next line as a whole unit, never splitting the alignment set). */}
      <div className="flex shrink-0 items-center gap-1">
        <Button
          type="button"
          variant={inlineFmt.bold ? "default" : "ghost"}
          size="icon-sm"
          onClick={() => applyInline("bold")}
          aria-label="Bold"
          aria-pressed={inlineFmt.bold}
          className="font-bold"
        >
          B
        </Button>
        <Button
          type="button"
          variant={inlineFmt.italic ? "default" : "ghost"}
          size="icon-sm"
          onClick={() => applyInline("italic")}
          aria-label="Italic"
          aria-pressed={inlineFmt.italic}
          className="italic"
        >
          I
        </Button>
        <Button
          type="button"
          variant={inlineFmt.underline ? "default" : "ghost"}
          size="icon-sm"
          onClick={() => applyInline("underline")}
          aria-label="Underline"
          aria-pressed={inlineFmt.underline}
          className="underline"
        >
          U
        </Button>
        <span className="mx-0.5 h-5 w-px bg-current/20" />
        {(["left", "center", "right"] as const).map((a) => (
          <Button
            key={a}
            type="button"
            variant={activeStyle.align === a ? "default" : "ghost"}
            size="icon-sm"
            onClick={() => setActiveStyle({ align: a })}
            aria-label={`Align ${a}`}
            aria-pressed={activeStyle.align === a}
          >
            <AlignIcon variant={a} className="size-4" />
          </Button>
        ))}
        <span className="mx-0.5 h-5 w-px bg-current/20" />
        <ColorPicker
          value={textColor}
          onChange={(c) => {
            setTextColor(c);
            applyColor(c);
          }}
          ariaLabel="Text color"
        />
      </div>
    </div>
  );

  // A single link's full editor (inputs + logo + sparkles/font + remove). Used
  // stacked in vertical edit mode, and below the icon row in horizontal edit.
  function renderEditLinkCard(link: LinkItem, index: number) {
    // Custom links (no built-in platform icon) can carry a custom logo.
    const isCustom = !getPlatform(link.href);
    const shift = dragShiftFor(link.id, index);
    const isDragging = dragId === link.id;
    return (
      <div
        key={`${link.id}:${linkFlashTick}`}
        ref={(el) => {
          if (el) linkCardRefs.current.set(link.id, el);
          else linkCardRefs.current.delete(link.id);
        }}
        style={{
          transform: shift ? `translateY(${shift}px)` : undefined,
          transition: isDragging ? "none" : "transform 150ms ease",
          zIndex: isDragging ? 30 : undefined,
          // Mirror the live view-page box style so edits preview here.
          ...boxCss(resolveLinkBox(link, linkBox)),
        }}
        className={cn(
          "relative flex items-stretch gap-2 rounded-md p-3",
          isDragging && "shadow-lg",
        )}
      >
        <button
          type="button"
          aria-label="Drag to reorder"
          onPointerDown={(e) => onLinkDragStart(e, link.id, index)}
          onPointerMove={onLinkDragMove}
          onPointerUp={onLinkDragEnd}
          onPointerCancel={onLinkDragEnd}
          className={cn(
            "flex shrink-0 touch-none items-center rounded-md px-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
            isDragging ? "cursor-grabbing" : "cursor-grab",
          )}
        >
          <GripIcon className="size-4" />
        </button>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Input
            value={link.label}
            onChange={(e) => updateLink(link.id, { label: e.target.value })}
            placeholder="Label"
            // Preview the link's font/effect settings live while editing.
            style={styleToCss(linkTextStyle(link), isDark)}
            className={textAnimClass(linkTextStyle(link))}
          />
          {isDiscordLink(link.href) ? (
            // Discord stores a username (copied on click), not a URL.
            <div className="flex items-center gap-2">
              <Input
                value={discordUsername(link.href)}
                onChange={(e) => {
                  updateLink(link.id, { href: `discord:${e.target.value}` });
                  setFlashLinkIds((ids) => ids.filter((id) => id !== link.id));
                }}
                onAnimationEnd={() =>
                  setFlashLinkIds((ids) => ids.filter((id) => id !== link.id))
                }
                placeholder="Discord username"
                aria-label="Discord username"
                className={cn(
                  flashLinkIds.includes(link.id) && "animate-flash",
                )}
              />
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-muted/60 px-2.5 py-1 font-medium text-[11px] text-muted-foreground">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  className="size-3"
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                Copied on click
              </span>
            </div>
          ) : (
            <Input
              value={link.href}
              onChange={(e) => {
                updateLink(link.id, { href: e.target.value });
                // Clear the blank-flash flag as soon as they start typing.
                setFlashLinkIds((ids) => ids.filter((id) => id !== link.id));
              }}
              onAnimationEnd={() =>
                setFlashLinkIds((ids) => ids.filter((id) => id !== link.id))
              }
              placeholder="https://..."
              className={cn(flashLinkIds.includes(link.id) && "animate-flash")}
            />
          )}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              {isCustom ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setLogoError(null);
                    setLogoTarget(link.id);
                  }}
                  className="text-muted-foreground"
                >
                  {link.logo ? (
                    // biome-ignore lint/performance/noImgElement: small inline data-URL logo; next/image adds no value
                    <img
                      src={link.logo}
                      alt=""
                      className="size-4 object-contain"
                    />
                  ) : (
                    <UploadIcon className="size-4" />
                  )}
                  {link.logo ? "Change logo" : "Upload logo"}
                </Button>
              ) : null}
              {/* Per-link box style (sparkles), with "apply to all". */}
              <LinkStylePopover
                box={resolveLinkBox(link, linkBox)}
                onBox={(patch) => updateLinkBox(link.id, patch)}
                onApplyAll={() => applyLinkStyleToAll(link.id)}
                align="left"
                animation={linkTextStyle(link).animation}
                onAnimation={(a) => updateLinkText(link.id, { animation: a })}
              />
              {/* Per-link text/font settings (italic-T). */}
              <button
                type="button"
                onClick={() =>
                  setFontOpen((o) => (o === link.id ? null : link.id))
                }
                aria-label="Text settings"
                aria-expanded={fontOpen === link.id}
                className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <FontIcon className="size-5" />
              </button>
              {link.box || link.color || link.textStyle ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    updateLink(link.id, {
                      color: undefined,
                      box: undefined,
                      textStyle: undefined,
                    })
                  }
                  className="text-muted-foreground"
                >
                  Reset
                </Button>
              ) : null}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => removeLink(link.id)}
              className={DESTRUCTIVE_GHOST}
            >
              Remove
            </Button>
          </div>
          {/* Text settings extension for this link. */}
          {fontOpen === link.id ? (
            <div
              style={{
                color: contrastText(
                  effectiveBoxColor(resolveLinkBox(link, linkBox), isDark),
                ),
              }}
              className="rounded-md border border-current/15 p-3 animate-slide-up"
            >
              <TextStyleEditor
                style={linkTextStyle(link)}
                onChange={(patch) => updateLinkText(link.id, patch)}
                defaultSize={14}
              />
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  // In horizontal edit mode, one link's editor shows below the icon row.
  const horizontalEditIndex = editing
    ? draft.links.findIndex((l) => l.id === editingLinkId)
    : -1;
  const horizontalEditLink =
    horizontalEditIndex >= 0
      ? draft.links[horizontalEditIndex]
      : (draft.links[0] ?? null);

  return (
    <>
      <PageBackground bg={editing ? draft.background : saved.background} />
      <GlassFilter />
      <main className="mx-auto flex min-h-[calc(100vh-3.5rem)] w-full max-w-3xl flex-col items-center justify-center px-6 pt-16 pb-28">
        {/* Keyed by mode so switching edit/view crossfades (but not on load). */}
        <div
          key={editing ? "edit" : "view"}
          style={panelCss(
            (editing ? draft.panel : saved.panel) ?? DEFAULT_PANEL,
          )}
          className={cn(
            "relative mx-auto flex w-full max-w-lg flex-col items-center gap-6",
            ((editing ? draft.panel : saved.panel) ?? DEFAULT_PANEL).type !==
              "transparent" && "rounded-2xl px-6 pt-6",
            // Reserve bottom room in edit mode for the panel-settings button.
            editing
              ? "pb-16"
              : ((editing ? draft.panel : saved.panel) ?? DEFAULT_PANEL)
                    .type !== "transparent"
                ? "pb-6"
                : "",
            switched && "animate-fade",
          )}
        >
          {/* Profile picture */}
          {editing ? (
            <div className="flex flex-col items-center gap-2">
              <AvatarFx
                effect={draft.avatarEffect}
                outline={draft.avatarOutline}
              >
                <button
                  type="button"
                  onClick={() => {
                    if (draft.avatar) {
                      setAvatarMenu(true);
                    } else {
                      // No menu to return to for a first upload.
                      setCropReturnToMenu(false);
                      avatarInputRef.current?.click();
                    }
                  }}
                  aria-label="Edit profile photo"
                  className="group relative size-24 cursor-pointer overflow-hidden rounded-full"
                >
                  {draft.avatar ? (
                    // biome-ignore lint/performance/noImgElement: small inline data-URL avatar; next/image adds no value
                    <img
                      src={draft.avatar}
                      alt=""
                      className="size-24 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex size-24 items-center justify-center rounded-full bg-muted text-3xl font-semibold text-muted-foreground">
                      {draft.name.charAt(0).toUpperCase() || "?"}
                    </div>
                  )}
                  <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                    {draft.avatar ? "Edit" : "Upload"}
                  </span>
                </button>
              </AvatarFx>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) pickAvatar(file);
                  e.target.value = "";
                }}
              />
              <AvatarFxPopover
                effect={draft.avatarEffect}
                outline={draft.avatarOutline}
                onEffect={chooseAvatarEffect}
                onEffectPatch={updateAvatarEffect}
                onOutline={toggleAvatarOutline}
                onOutlineColor={setAvatarOutlineColor}
              />
            </div>
          ) : saved.avatar ? (
            <AvatarFx effect={saved.avatarEffect} outline={saved.avatarOutline}>
              {/* biome-ignore lint/performance/noImgElement: small inline data-URL avatar; next/image adds no value */}
              <img
                src={saved.avatar}
                alt={saved.name}
                className="size-24 rounded-full object-cover"
              />
            </AvatarFx>
          ) : (
            <AvatarFx effect={saved.avatarEffect} outline={saved.avatarOutline}>
              <div className="flex size-24 items-center justify-center rounded-full bg-muted text-3xl font-semibold text-muted-foreground">
                {saved.name.charAt(0).toUpperCase() || "?"}
              </div>
            </AvatarFx>
          )}

          <div className="flex w-full flex-col items-center gap-2">
            {/* Name — its own box. */}
            <div
              style={boxCss(editing ? nameBox : savedNameBox)}
              className={cn(
                "relative flex w-full flex-col items-center rounded-lg px-4 pt-3",
                editing ? "pb-12" : "pb-3",
              )}
            >
              {editing ? (
                <div className="absolute bottom-2 left-2 z-10 flex items-center gap-1">
                  <BoxStylePopover
                    box={nameBox}
                    onChange={updateNameBox}
                    label="Customize name box"
                    align="left"
                    animation={nameStyle.animation}
                    onAnimation={(a) =>
                      setDraft((prev) => ({
                        ...prev,
                        nameStyle: { ...prev.nameStyle, animation: a },
                      }))
                    }
                  />
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setActiveField("name");
                      setFontOpen((o) => (o === "name" ? null : "name"));
                    }}
                    aria-label="Text settings"
                    aria-expanded={fontOpen === "name"}
                    className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <FontIcon className="size-5" />
                  </button>
                </div>
              ) : null}
              {editing ? (
                <div className="w-full overflow-hidden rounded-md border border-input transition-colors focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
                  <RichTextField
                    key={`name-${editKey}`}
                    editorRef={nameEditorRef}
                    initialHtml={draft.name}
                    placeholder="Your name"
                    ariaLabel="Your name"
                    onInput={(html) => updateField("name", html)}
                    onFocus={() => setActiveField("name")}
                    style={styleToCss(nameStyle, isDark)}
                    className={cn(
                      "min-h-9 w-full break-words bg-transparent px-3 py-2 tracking-tight whitespace-pre-wrap outline-none",
                      textAnimClass(nameStyle),
                    )}
                  />
                  {fontOpen === "name" ? (
                    <div
                      style={{
                        color: contrastText(effectiveBoxColor(nameBox, isDark)),
                      }}
                      className="border-t border-current/15 p-2 animate-slide-up"
                    >
                      {formatToolbar}
                    </div>
                  ) : null}
                </div>
              ) : (
                <RichText
                  as="h1"
                  html={saved.name}
                  isDark={isDark}
                  className={cn(
                    "w-full tracking-tight",
                    textAnimClass(savedNameStyle),
                  )}
                  style={styleToCss(savedNameStyle, isDark)}
                />
              )}
            </div>

            {/* Bio — its own box. */}
            <div
              style={boxCss(editing ? bioBox : savedBioBox)}
              className={cn(
                "relative flex w-full flex-col items-center rounded-lg px-4 pt-3",
                editing ? "pb-12" : "pb-3",
              )}
            >
              {editing ? (
                <div className="absolute bottom-2 left-2 z-10 flex items-center gap-1">
                  <BoxStylePopover
                    box={bioBox}
                    onChange={updateBioBox}
                    label="Customize description box"
                    align="left"
                    animation={bioStyle.animation}
                    onAnimation={(a) =>
                      setDraft((prev) => ({
                        ...prev,
                        bioStyle: { ...prev.bioStyle, animation: a },
                      }))
                    }
                  />
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setActiveField("bio");
                      setFontOpen((o) => (o === "bio" ? null : "bio"));
                    }}
                    aria-label="Text settings"
                    aria-expanded={fontOpen === "bio"}
                    className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <FontIcon className="size-5" />
                  </button>
                </div>
              ) : null}
              {editing ? (
                <div className="w-full overflow-hidden rounded-md border border-input transition-colors focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
                  <RichTextField
                    key={`bio-${editKey}`}
                    editorRef={bioEditorRef}
                    initialHtml={draft.bio}
                    placeholder="Short bio"
                    ariaLabel="Short bio"
                    onInput={(html) => updateField("bio", html)}
                    onFocus={() => setActiveField("bio")}
                    style={styleToCss(bioStyle, isDark)}
                    className={cn(
                      "min-h-9 w-full break-words bg-transparent px-3 py-2 whitespace-pre-wrap outline-none",
                      !bioStyle.color &&
                        !bioStyle.animation &&
                        "text-muted-foreground",
                      textAnimClass(bioStyle),
                    )}
                  />
                  {fontOpen === "bio" ? (
                    <div
                      style={{
                        color: contrastText(effectiveBoxColor(bioBox, isDark)),
                      }}
                      className="border-t border-current/15 p-2 animate-slide-up"
                    >
                      {formatToolbar}
                    </div>
                  ) : null}
                </div>
              ) : (
                <RichText
                  as="p"
                  html={saved.bio}
                  isDark={isDark}
                  className={cn(
                    "w-full",
                    !savedBioStyle.color &&
                      !savedBioStyle.animation &&
                      "text-muted-foreground",
                    textAnimClass(savedBioStyle),
                  )}
                  style={styleToCss(savedBioStyle, isDark)}
                />
              )}
            </div>
          </div>

          <div
            className={cn(
              "flex w-full",
              horizontal
                ? "flex-wrap items-center justify-center gap-4"
                : "flex-col gap-3",
            )}
          >
            {editing && horizontal
              ? // Horizontal edit: an icon row like view mode; click to edit.
                draft.links.map((link) => {
                  const platform = getPlatform(link.href);
                  const Icon = platform?.icon;
                  const selected = horizontalEditLink?.id === link.id;
                  return (
                    <button
                      key={link.id}
                      type="button"
                      onClick={() => setEditingLinkId(link.id)}
                      aria-label={`Edit ${link.label || "link"}`}
                      aria-pressed={selected}
                      className={cn(
                        "flex size-11 items-center justify-center rounded-md transition-transform hover:scale-110",
                        selected &&
                          "ring-2 ring-ring ring-offset-2 ring-offset-transparent",
                      )}
                    >
                      {link.logo ? (
                        // biome-ignore lint/performance/noImgElement: small inline data-URL logo; next/image adds no value
                        <img
                          src={link.logo}
                          alt=""
                          className="size-8 object-contain"
                        />
                      ) : Icon ? (
                        <BrandIcon
                          icon={Icon}
                          color={platform?.color}
                          className="size-8"
                        />
                      ) : (
                        <span className="text-lg font-semibold">
                          {link.label.charAt(0).toUpperCase() || "?"}
                        </span>
                      )}
                    </button>
                  );
                })
              : editing
                ? draft.links.map((link, index) =>
                    renderEditLinkCard(link, index),
                  )
                : saved.links.map((link) =>
                    horizontal ? (
                      <LinkIconAnchor
                        key={link.id}
                        link={link}
                        isDark={isDark}
                      />
                    ) : (
                      <LinkAnchor
                        key={link.id}
                        link={link}
                        box={savedLinkBox}
                        textStyle={saved.linkStyle}
                        isDark={isDark}
                      />
                    ),
                  )}

            {editing ? (
              <Button
                variant="outline"
                onClick={() => setShowPicker(true)}
                aria-label="Add link"
                className={horizontal ? "size-11 rounded-md p-0" : "w-full"}
              >
                {horizontal ? "+" : "Add link"}
              </Button>
            ) : null}
          </div>

          {/* Horizontal edit: the selected link's full editor, below the row. */}
          {editing && horizontal ? (
            <div className="w-full">
              {horizontalEditLink ? (
                renderEditLinkCard(
                  horizontalEditLink,
                  horizontalEditIndex >= 0 ? horizontalEditIndex : 0,
                )
              ) : (
                <p className="text-center text-sm text-muted-foreground">
                  Add a link, then tap its icon to edit it.
                </p>
              )}
            </div>
          ) : null}

          {/* Panel settings — bottom-left of the panel, edit mode only */}
          {editing ? (
            <div ref={boxMenuRef} className="absolute bottom-3 left-3 z-40">
              {boxMenuP.value ? (
                <div
                  role="menu"
                  aria-label="Panel background"
                  className={cn(
                    "absolute bottom-full left-0 mb-2 w-72 origin-bottom-left rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-lg",
                    boxMenuP.visible ? "animate-pop" : "animate-pop-out",
                  )}
                >
                  <p className="mb-2 text-sm font-medium">Panel background</p>
                  <div className="flex flex-col gap-3">
                    <div className="grid grid-cols-4 gap-2">
                      {(
                        [
                          ["transparent", "None"],
                          ["color", "Color"],
                          ["gradient", "Gradient"],
                          ["glass", "Glass"],
                        ] as [PanelStyle["type"], string][]
                      ).map(([type, label]) => {
                        const preview =
                          type === "transparent"
                            ? "repeating-conic-gradient(#d4d4d8 0% 25%, transparent 0% 50%) 50% / 10px 10px"
                            : type === "color"
                              ? "#000"
                              : type === "gradient"
                                ? "linear-gradient(135deg,#3b82f6,#8b5cf6)"
                                : "rgba(255,255,255,0.35)";
                        return (
                          <button
                            key={type}
                            type="button"
                            onClick={() => choosePanel(type)}
                            className="flex flex-col items-center gap-1"
                          >
                            <span
                              style={{ background: preview }}
                              className={cn(
                                "size-12 rounded-md border border-border transition-shadow",
                                type === "glass" && "backdrop-blur-sm",
                                panel.type === type &&
                                  "ring-2 ring-ring ring-offset-2 ring-offset-popover",
                              )}
                            />
                            <span
                              className={cn(
                                "text-[11px]",
                                panel.type === type
                                  ? "text-foreground"
                                  : "text-muted-foreground",
                              )}
                            >
                              {label}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {panel.type === "color" || panel.type === "glass" ? (
                      <>
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="text-muted-foreground">
                            {panel.type === "glass" ? "Tint" : "Color"}
                          </span>
                          <ColorPicker
                            value={panel.color}
                            onChange={(c) => updatePanel({ color: c })}
                            ariaLabel="Panel color"
                          />
                        </div>
                        <label className="flex flex-col gap-1.5 text-sm">
                          <span className="flex justify-between text-muted-foreground">
                            <span>Opacity</span>
                            <span className="tabular-nums">
                              {panel.opacity}%
                            </span>
                          </span>
                          <input
                            type="range"
                            min={0}
                            max={100}
                            step={5}
                            value={panel.opacity}
                            onChange={(e) =>
                              updatePanel({ opacity: Number(e.target.value) })
                            }
                            aria-label="Panel opacity"
                            className="w-full"
                          />
                        </label>
                      </>
                    ) : panel.type === "gradient" ? (
                      <>
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="text-muted-foreground">
                            Direction
                          </span>
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                updatePanel({ direction: "vertical" })
                              }
                              aria-label="Top to bottom"
                              aria-pressed={panel.direction !== "horizontal"}
                              className={cn(
                                "flex size-8 items-center justify-center rounded-md border transition-colors",
                                panel.direction !== "horizontal"
                                  ? "border-ring bg-muted text-foreground"
                                  : "border-input text-muted-foreground hover:bg-muted",
                              )}
                            >
                              <ArrowVerticalIcon className="size-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                updatePanel({ direction: "horizontal" })
                              }
                              aria-label="Left to right"
                              aria-pressed={panel.direction === "horizontal"}
                              className={cn(
                                "flex size-8 items-center justify-center rounded-md border transition-colors",
                                panel.direction === "horizontal"
                                  ? "border-ring bg-muted text-foreground"
                                  : "border-input text-muted-foreground hover:bg-muted",
                              )}
                            >
                              <ArrowHorizontalIcon className="size-4" />
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="text-muted-foreground">
                            {panel.direction === "horizontal" ? "Left" : "Top"}
                          </span>
                          <ColorPicker
                            value={panel.from}
                            onChange={(c) => updatePanel({ from: c })}
                            ariaLabel="Panel gradient start color"
                          />
                        </div>
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="text-muted-foreground">
                            {panel.direction === "horizontal"
                              ? "Right"
                              : "Bottom"}
                          </span>
                          <ColorPicker
                            value={panel.to}
                            onChange={(c) => updatePanel({ to: c })}
                            ariaLabel="Panel gradient end color"
                          />
                        </div>
                        <label className="flex flex-col gap-1.5 text-sm">
                          <span className="flex justify-between text-muted-foreground">
                            <span>Opacity</span>
                            <span className="tabular-nums">
                              {panel.opacity}%
                            </span>
                          </span>
                          <input
                            type="range"
                            min={0}
                            max={100}
                            step={5}
                            value={panel.opacity}
                            onChange={(e) =>
                              updatePanel({ opacity: Number(e.target.value) })
                            }
                            aria-label="Panel opacity"
                            className="w-full"
                          />
                        </label>
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        No panel — the page background shows through.
                      </p>
                    )}

                    <div className="my-1 border-t border-border" />
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-muted-foreground">Links</span>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => setPanelOrientation("vertical")}
                          aria-label="Stacked links"
                          aria-pressed={!horizontal}
                          className={cn(
                            "flex h-8 items-center gap-1.5 rounded-md border px-2.5 transition-colors",
                            !horizontal
                              ? "border-ring bg-muted text-foreground"
                              : "border-input text-muted-foreground hover:bg-muted",
                          )}
                        >
                          <ArrowVerticalIcon className="size-4" />
                          Stacked
                        </button>
                        <button
                          type="button"
                          onClick={() => setPanelOrientation("horizontal")}
                          aria-label="Logos in a row"
                          aria-pressed={horizontal}
                          className={cn(
                            "flex h-8 items-center gap-1.5 rounded-md border px-2.5 transition-colors",
                            horizontal
                              ? "border-ring bg-muted text-foreground"
                              : "border-input text-muted-foreground hover:bg-muted",
                          )}
                        >
                          <ArrowHorizontalIcon className="size-4" />
                          Logos
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {horizontal
                        ? "Links show as a row of logos."
                        : "Links stack as full-width buttons."}
                    </p>
                  </div>
                </div>
              ) : null}

              <button
                type="button"
                onClick={() => setBoxMenu((o) => !o)}
                aria-haspopup="menu"
                aria-expanded={boxMenu}
                aria-label="Panel background"
                className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <SparklesIcon className="size-5" />
              </button>
            </div>
          ) : null}
        </div>
      </main>

      {/* Unsaved-changes bar — subtle pill, doesn't cover the page */}
      {unsavedBar.value ? (
        <div
          className={cn(
            "pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center px-4",
            unsavedBar.visible ? "animate-slide-up" : "animate-slide-down",
          )}
        >
          <div
            key={flashKey}
            onAnimationEnd={() => setFlashing(false)}
            className={cn(
              "pointer-events-auto flex items-center gap-4 rounded-lg border border-border bg-background px-4 py-2 shadow-lg",
              flashing && "animate-flash",
            )}
          >
            <span className="text-sm text-muted-foreground">
              You have unsaved changes
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

      {/* Confirm save dialog */}
      {confirmingSave ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0 animate-fade bg-black/50"
            onClick={() => setConfirmingSave(false)}
          />
          <div className="relative w-full max-w-sm animate-pop rounded-lg border border-border bg-background p-6 shadow-lg">
            <h2 className="text-lg font-semibold">Confirm changes</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Are you sure you want to save these changes?
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmingSave(false)}
                className={DESTRUCTIVE_GHOST}
              >
                Cancel
              </Button>
              <Button size="sm" onClick={confirmSave}>
                Confirm
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Fixed mode toggle — stays bottom-right even when scrolling. This
          container's geometry drives the footer-overlap fade (see buttonsRef). */}
      <div
        ref={buttonsRef}
        className="fixed bottom-6 right-6 z-50"
        style={{
          opacity: controlsOpacity,
          pointerEvents: controlsOpacity < 0.05 ? "none" : undefined,
        }}
      >
        <Button
          variant={editing ? "default" : "outline"}
          onClick={toggleMode}
          className="shadow-md"
        >
          {editing ? (
            <EyeIcon className="size-4" />
          ) : (
            <WrenchIcon className="size-4" />
          )}
          {editing ? "View" : "Edit"}
        </Button>
      </div>

      {/* Template picker — top-right, edit mode only */}
      {editing ? (
        <div ref={tplMenuRef} className="fixed top-20 right-6 z-40">
          <Button
            variant="outline"
            onClick={() => setTplMenu((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={tplMenu}
            className="bg-background shadow-md dark:bg-background"
          >
            <LayoutIcon className="size-4" />
            Templates
            <ChevronDownIcon
              className={cn(
                "size-4 text-muted-foreground transition-transform",
                tplMenu && "rotate-180",
              )}
            />
          </Button>

          {tplMenuP.value ? (
            <div
              role="menu"
              aria-label="Templates"
              className={cn(
                "absolute top-full right-0 mt-2 w-72 origin-top-right rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-lg",
                tplMenuP.visible ? "animate-pop" : "animate-pop-out",
              )}
            >
              <div className="grid grid-cols-2 gap-3">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => applyTemplate(t)}
                    className="flex flex-col items-center gap-1.5"
                  >
                    <span
                      style={{ background: t.preview }}
                      className="h-14 w-full rounded-md border border-border transition-shadow hover:ring-2 hover:ring-ring hover:ring-offset-2 hover:ring-offset-popover"
                    />
                    <span className="text-xs text-muted-foreground">
                      {t.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Background picker — top-left, edit mode only */}
      {editing ? (
        <div ref={bgMenuRef} className="fixed top-20 left-6 z-40">
          <Button
            variant="outline"
            onClick={() => setBgMenu((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={bgMenu}
            className="bg-background shadow-md dark:bg-background"
          >
            <ImageIcon className="size-4" />
            Background
            <ChevronDownIcon
              className={cn(
                "size-4 text-muted-foreground transition-transform",
                bgMenu && "rotate-180",
              )}
            />
          </Button>

          {bgMenuP.value ? (
            <div
              role="menu"
              aria-label="Background"
              className={cn(
                "absolute top-full left-0 mt-2 w-72 origin-top-left rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-lg",
                bgMenuP.visible ? "animate-pop" : "animate-pop-out",
              )}
            >
              <div className="grid grid-cols-3 gap-3">
                {/* Default */}
                <button
                  type="button"
                  onClick={() => chooseBackground("default")}
                  className="flex flex-col items-center gap-1.5"
                >
                  <span
                    className={cn(
                      "size-16 rounded-md border border-border bg-background transition-shadow",
                      bgType === "default" &&
                        "ring-2 ring-ring ring-offset-2 ring-offset-popover",
                    )}
                  />
                  <span
                    className={cn(
                      "text-xs",
                      bgType === "default"
                        ? "text-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    Default
                  </span>
                </button>

                {/* Custom */}
                <button
                  type="button"
                  onClick={() => chooseBackground("custom")}
                  className="flex flex-col items-center gap-1.5"
                >
                  <span
                    style={{ backgroundColor: customColor }}
                    className={cn(
                      "size-16 rounded-md border border-border transition-shadow",
                      bgType === "custom" &&
                        "ring-2 ring-ring ring-offset-2 ring-offset-popover",
                    )}
                  />
                  <span
                    className={cn(
                      "text-xs",
                      bgType === "custom"
                        ? "text-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    Custom
                  </span>
                </button>

                {/* Gradient */}
                <button
                  type="button"
                  onClick={() => chooseBackground("gradient")}
                  className="flex flex-col items-center gap-1.5"
                >
                  <span
                    style={{
                      backgroundImage: `linear-gradient(${grad.direction === "horizontal" ? "to right" : "to bottom"}, ${grad.from}, ${grad.distribution}%, ${grad.to})`,
                    }}
                    className={cn(
                      "size-16 rounded-md border border-border transition-shadow",
                      bgType === "gradient" &&
                        "ring-2 ring-ring ring-offset-2 ring-offset-popover",
                    )}
                  />
                  <span
                    className={cn(
                      "text-xs",
                      bgType === "gradient"
                        ? "text-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    Gradient
                  </span>
                </button>

                {/* Space */}
                <button
                  type="button"
                  onClick={() => chooseBackground("starfield")}
                  className="flex flex-col items-center gap-1.5"
                >
                  <span
                    style={{
                      background: `radial-gradient(1px 1px at 25% 40%, #fff, transparent), radial-gradient(1px 1px at 62% 68%, #fff, transparent), radial-gradient(1px 1px at 45% 52%, #fff, transparent), radial-gradient(1px 1px at 80% 82%, #fff, transparent), radial-gradient(1px 1px at 38% 22%, #fff, transparent), radial-gradient(1px 1px at 72% 30%, #fff, transparent), radial-gradient(1px 1px at 15% 75%, #fff, transparent), #000`,
                    }}
                    className={cn(
                      "size-16 rounded-md border border-border transition-shadow",
                      bgType === "starfield" &&
                        "ring-2 ring-ring ring-offset-2 ring-offset-popover",
                    )}
                  />
                  <span
                    className={cn(
                      "text-xs",
                      bgType === "starfield"
                        ? "text-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    Space
                  </span>
                </button>

                {/* Import (image / video) */}
                <button
                  type="button"
                  onClick={() => chooseBackground("media")}
                  className="flex flex-col items-center gap-1.5"
                >
                  <span
                    className={cn(
                      "flex size-16 items-center justify-center overflow-hidden rounded-md border border-border bg-muted text-muted-foreground transition-shadow",
                      bgType === "media" &&
                        "ring-2 ring-ring ring-offset-2 ring-offset-popover",
                    )}
                  >
                    {media ? (
                      media.kind === "video" ? (
                        <video
                          src={media.src}
                          muted
                          className="size-full object-cover"
                        />
                      ) : (
                        // biome-ignore lint/performance/noImgElement: data-URL thumbnail
                        <img
                          src={media.src}
                          alt=""
                          className="size-full object-cover"
                        />
                      )
                    ) : (
                      <ImageIcon className="size-6" />
                    )}
                  </span>
                  <span
                    className={cn(
                      "text-xs",
                      bgType === "media"
                        ? "text-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    Import
                  </span>
                </button>
              </div>

              {/* Hidden file input for importing a background image/video. */}
              <input
                ref={bgFileInputRef}
                type="file"
                accept="image/*,video/*"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleBgFile(file);
                  e.target.value = "";
                }}
              />

              {mediaError ? (
                <p className="mt-3 text-xs text-destructive">{mediaError}</p>
              ) : null}

              {/* Color picker extension */}
              {bgType === "custom" ? (
                <div className="mt-3 animate-slide-up border-t border-border pt-3">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-muted-foreground">Color</span>
                    <ColorPicker
                      value={customColor}
                      onChange={updateCustomColor}
                      ariaLabel="Background color"
                    />
                  </div>
                </div>
              ) : bgType === "gradient" ? (
                <div className="mt-3 flex animate-slide-up flex-col gap-3 border-t border-border pt-3">
                  {/* Direction */}
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-muted-foreground">Direction</span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          updateGradient({ direction: "vertical" })
                        }
                        aria-label="Top to bottom"
                        aria-pressed={grad.direction === "vertical"}
                        className={cn(
                          "flex size-8 items-center justify-center rounded-md border transition-colors",
                          grad.direction === "vertical"
                            ? "border-ring bg-muted text-foreground"
                            : "border-input text-muted-foreground hover:bg-muted",
                        )}
                      >
                        <ArrowVerticalIcon className="size-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updateGradient({ direction: "horizontal" })
                        }
                        aria-label="Left to right"
                        aria-pressed={grad.direction === "horizontal"}
                        className={cn(
                          "flex size-8 items-center justify-center rounded-md border transition-colors",
                          grad.direction === "horizontal"
                            ? "border-ring bg-muted text-foreground"
                            : "border-input text-muted-foreground hover:bg-muted",
                        )}
                      >
                        <ArrowHorizontalIcon className="size-4" />
                      </button>
                    </div>
                  </div>

                  {/* Colors — labels follow the chosen direction. */}
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-muted-foreground">
                      {grad.direction === "vertical" ? "Top" : "Left"}
                    </span>
                    <ColorPicker
                      value={grad.from}
                      onChange={(c) => updateGradient({ from: c })}
                      ariaLabel="Gradient start color"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-muted-foreground">
                      {grad.direction === "vertical" ? "Bottom" : "Right"}
                    </span>
                    <ColorPicker
                      value={grad.to}
                      onChange={(c) => updateGradient({ to: c })}
                      ariaLabel="Gradient end color"
                    />
                  </div>

                  {/* Distribution — the track splits the two colors at the
                      thumb; snaps to 10% steps. */}
                  <span className="text-sm text-muted-foreground">
                    Distribution
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={10}
                    value={grad.distribution}
                    onChange={(e) =>
                      updateGradient({ distribution: Number(e.target.value) })
                    }
                    aria-label="Gradient distribution"
                    className="gradient-slider w-full"
                    style={{
                      background: `linear-gradient(to right, ${grad.from} 0%, ${grad.from} ${grad.distribution}%, ${grad.to} ${grad.distribution}%, ${grad.to} 100%)`,
                    }}
                  />
                </div>
              ) : bgType === "starfield" ? (
                <div className="mt-3 flex animate-slide-up flex-col gap-3 border-t border-border pt-3">
                  {/* Speed */}
                  <label className="flex flex-col gap-1.5 text-sm">
                    <span className="text-muted-foreground">Speed</span>
                    <input
                      type="range"
                      min={0}
                      max={10}
                      step={1}
                      value={starfield.speed}
                      onChange={(e) =>
                        updateStarfield({ speed: Number(e.target.value) })
                      }
                      aria-label="Space speed"
                      className="w-full"
                    />
                  </label>
                </div>
              ) : bgType === "media" ? (
                <div className="mt-3 flex animate-slide-up items-center justify-between gap-1 border-t border-border pt-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={adjustMedia}
                    className="text-muted-foreground"
                  >
                    <WrenchIcon className="size-4" />
                    Adjust
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setMediaError(null);
                      bgFileInputRef.current?.click();
                    }}
                    className="text-muted-foreground"
                  >
                    <UploadIcon className="size-4" />
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
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Profile-photo action menu */}
      {avatarModal.value ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close"
            className={cn(
              "absolute inset-0 bg-black/50",
              avatarModal.visible ? "animate-fade" : "animate-fade-out",
            )}
            onClick={() => setAvatarMenu(false)}
          />
          <div
            className={cn(
              "relative w-full max-w-xs rounded-lg border border-border bg-background p-4 shadow-lg",
              avatarModal.visible ? "animate-pop" : "animate-pop-out",
            )}
            role="dialog"
            aria-modal="true"
            aria-label="Profile photo"
          >
            <h2 className="mb-3 text-sm font-semibold">Profile photo</h2>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  setAvatarMenu(false);
                  setCropReturnToMenu(true);
                  setCropSrc(draft.avatar ?? null);
                }}
                className="flex items-center gap-3 rounded-md border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <EyeIcon className="size-4" />
                Adjust
              </button>
              <button
                type="button"
                onClick={() => {
                  setAvatarMenu(false);
                  // Came from the menu: a cancelled crop returns here.
                  setCropReturnToMenu(true);
                  avatarInputRef.current?.click();
                }}
                className="flex items-center gap-3 rounded-md border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <UploadIcon className="size-4" />
                Change photo
              </button>
              <button
                type="button"
                onClick={() => {
                  setDraft((prev) => ({ ...prev, avatar: undefined }));
                  setAvatarMenu(false);
                }}
                className={cn(
                  "flex items-center gap-3 rounded-md border border-border px-3 py-2 text-sm font-medium transition-colors",
                  DESTRUCTIVE_GHOST,
                )}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  className="size-4"
                >
                  <path d="M3 6h18" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
                Remove
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Add-link picker */}
      {picker.value ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close"
            className={cn(
              "absolute inset-0 bg-black/50",
              picker.visible ? "animate-fade" : "animate-fade-out",
            )}
            onClick={() => setShowPicker(false)}
          />
          <div
            className={cn(
              "relative w-full max-w-md rounded-lg border border-border bg-background p-4 shadow-lg",
              picker.visible ? "animate-pop" : "animate-pop-out",
            )}
            role="dialog"
            aria-modal="true"
            aria-label="Add a link"
          >
            <h2 className="mb-3 text-sm font-semibold">Add a link</h2>
            {/* Compact logo grid: show only the platform icons so the whole
                catalog fits in a tidy rectangle instead of a tall list that
                runs off screen. Names are exposed via title/aria-label, and the
                grid scrolls within the modal on short viewports. */}
            <div className="grid max-h-[60vh] grid-cols-4 gap-2 overflow-y-auto sm:grid-cols-6">
              {PICKER_OPTIONS.map((option) => {
                const Icon = option.icon;
                const count = option.match
                  ? draft.links.filter((l) => option.match?.test(l.href)).length
                  : 0;
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => addLink(option)}
                    title={option.label}
                    aria-label={option.label}
                    className="relative flex aspect-square items-center justify-center rounded-md border border-border transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    <BrandIcon
                      icon={Icon}
                      color={option.color}
                      className="size-5"
                    />
                    {count > 0 ? (
                      <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-foreground text-[10px] font-medium text-background">
                        {count}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      {/* Custom-logo uploader */}
      {logoModal.value ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close"
            className={cn(
              "absolute inset-0 bg-black/50",
              logoModal.visible ? "animate-fade" : "animate-fade-out",
            )}
            onClick={() => setLogoTarget(null)}
          />
          <div
            className={cn(
              "relative w-full max-w-xs rounded-lg border border-border bg-background p-4 shadow-lg",
              logoModal.visible ? "animate-pop" : "animate-pop-out",
            )}
            role="dialog"
            aria-modal="true"
            aria-label="Upload a logo"
          >
            <h2 className="mb-1 text-sm font-semibold">Upload a logo</h2>
            <p className="mb-3 text-xs text-muted-foreground">
              Choose an image to show next to this link.
            </p>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleLogoFile(logoModal.value as string, file);
              }}
              className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:border-border file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground hover:file:bg-accent"
            />
            {logoError ? (
              <p className="mt-2 text-xs text-destructive">{logoError}</p>
            ) : null}
            {draft.links.find((l) => l.id === logoModal.value)?.logo ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  updateLink(logoModal.value as string, { logo: undefined });
                  setLogoTarget(null);
                }}
                className={cn("mt-3", DESTRUCTIVE_GHOST)}
              >
                Remove logo
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Profile-picture crop editor */}
      {cropModal.value ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close"
            className={cn(
              "absolute inset-0 bg-black/50",
              cropModal.visible ? "animate-fade" : "animate-fade-out",
            )}
            onClick={dismissCrop}
          />
          <div
            className={cn(
              "relative w-full max-w-xs rounded-lg border border-border bg-background p-4 shadow-lg",
              cropModal.visible ? "animate-pop" : "animate-pop-out",
            )}
            role="dialog"
            aria-modal="true"
            aria-label="Crop photo"
          >
            <h2 className="mb-1 text-sm font-semibold">Adjust photo</h2>
            <p className="mb-3 text-xs text-muted-foreground">
              Drag to reposition, and use the slider to zoom.
            </p>
            <div
              className="relative mx-auto touch-none select-none overflow-hidden rounded-full border border-border"
              style={{ width: CROP_SIZE, height: CROP_SIZE }}
              onPointerDown={onCropPointerDown}
              onPointerMove={onCropPointerMove}
              onPointerUp={onCropPointerUp}
            >
              {/* biome-ignore lint/performance/noImgElement: in-memory crop source */}
              <img
                ref={cropImgRef}
                src={cropModal.value}
                alt=""
                draggable={false}
                onLoad={onCropImgLoad}
                style={{
                  position: "absolute",
                  left: cropOffset.x,
                  top: cropOffset.y,
                  width: cropNatRef.current
                    ? cropNatRef.current.w * cropBaseRef.current * cropZoom
                    : CROP_SIZE,
                  height: cropNatRef.current
                    ? cropNatRef.current.h * cropBaseRef.current * cropZoom
                    : CROP_SIZE,
                  maxWidth: "none",
                }}
              />
            </div>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={cropZoom}
              onChange={(e) => changeCropZoom(Number(e.target.value))}
              aria-label="Zoom"
              className="mt-4 w-full"
            />
            <div className="mt-3 flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={dismissCrop}
                className={DESTRUCTIVE_GHOST}
              >
                Cancel
              </Button>
              <Button size="sm" onClick={applyCrop}>
                Apply
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Imported-background crop editor. Sits above the background dropdown;
          stopping mousedown propagation keeps that dropdown open behind it so
          Cancel returns there instead of dropping back to the bare page. */}
      {mediaCropModal.value ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close"
            className={cn(
              "absolute inset-0 bg-black/50",
              mediaCropModal.visible ? "animate-fade" : "animate-fade-out",
            )}
            onClick={dismissMediaCrop}
          />
          <div
            className={cn(
              "relative w-full max-w-sm rounded-lg border border-border bg-background p-4 shadow-lg",
              mediaCropModal.visible ? "animate-pop" : "animate-pop-out",
            )}
            role="dialog"
            aria-modal="true"
            aria-label="Adjust background"
          >
            <h2 className="mb-1 text-sm font-semibold">Adjust background</h2>
            <p className="mb-3 text-xs text-muted-foreground">
              Drag to reposition, and use the slider to zoom.
            </p>
            <div
              className="relative mx-auto touch-none overflow-hidden rounded-md border border-border bg-black"
              style={{ width: mediaFrame.w, height: mediaFrame.h }}
              onPointerDown={onMediaCropPointerDown}
              onPointerMove={onMediaCropPointerMove}
              onPointerUp={onMediaCropPointerUp}
              onPointerCancel={onMediaCropPointerUp}
            >
              {mediaCropModal.value.kind === "video" ? (
                <video
                  src={mediaCropModal.value.src}
                  autoPlay
                  muted
                  loop
                  playsInline
                  draggable={false}
                  className="size-full object-cover"
                  style={{
                    objectPosition: `${mediaPos.x}% ${mediaPos.y}%`,
                    transform: `scale(${mediaZoom})`,
                  }}
                />
              ) : (
                // biome-ignore lint/performance/noImgElement: in-memory crop source
                <img
                  src={mediaCropModal.value.src}
                  alt=""
                  draggable={false}
                  className="size-full object-cover"
                  style={{
                    objectPosition: `${mediaPos.x}% ${mediaPos.y}%`,
                    transform: `scale(${mediaZoom})`,
                  }}
                />
              )}
            </div>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={mediaZoom}
              onChange={(e) => setMediaZoom(Number(e.target.value))}
              aria-label="Zoom"
              className="mt-4 w-full"
            />
            <div className="mt-3 flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={dismissMediaCrop}
                className={DESTRUCTIVE_GHOST}
              >
                Cancel
              </Button>
              <Button size="sm" onClick={applyMediaCrop}>
                Apply
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
