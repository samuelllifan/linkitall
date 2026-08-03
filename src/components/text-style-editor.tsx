"use client";

import { useEffect, useRef, useState } from "react";
import { FONTS, NO_TINT } from "~/components/profile-view";
import { Button } from "~/components/ui/button";
import type { TextStyle } from "~/lib/pages";
import { cn } from "~/lib/utils";

// Shared text-styling controls: the Font / Size / Style / Align / Text-color
// panel used by the link, name, and bio editors — and by the music editor.
// Extracted here (verbatim) so both the page editor and the music editor render
// the exact same toolbar. Purely presentational/controlled — no app state.

const FONT_SIZES = [12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 60];
const FONT_SIZE_MIN = 8;
const FONT_SIZE_MAX = 200;

/**
 * A typable font-size control: a text input the user can type any size into
 * (clamped to a sane range), plus a chevron that opens a preset-size menu.
 *
 * The presets are a custom popover rather than a native `<datalist>`: the
 * native suggestion popup isn't shown for number inputs on Chromium/Windows,
 * and even on a text input the browser anchors it to the top window — inside an
 * embedded preview it renders detached, floating in a seemingly random place.
 * A self-positioned popover is consistent on every platform.
 */
export function FontSizeInput({
  value,
  onChange,
  ariaLabel = "Text size",
}: {
  value: number;
  onChange: (size: number) => void;
  ariaLabel?: string;
}) {
  const [text, setText] = useState(String(value));
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Re-sync when the external value changes (switching fields/links, reset).
  useEffect(() => setText(String(value)), [value]);

  // Close the preset menu on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function commit(raw: string) {
    const n = Number.parseInt(raw, 10);
    const clamped = Number.isFinite(n)
      ? Math.max(FONT_SIZE_MIN, Math.min(FONT_SIZE_MAX, n))
      : value;
    setText(String(clamped));
    if (clamped !== value) onChange(clamped);
  }

  return (
    <div ref={wrapRef} className="relative flex items-center">
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={text}
        aria-label={ariaLabel}
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
        className="h-8 w-14 rounded-md border border-input bg-transparent py-1 pr-5 pl-2 text-sm outline-none"
      />
      <button
        type="button"
        aria-label="Preset sizes"
        aria-haspopup="listbox"
        aria-expanded={open}
        tabIndex={-1}
        onClick={() => setOpen((o) => !o)}
        className="absolute right-1 flex size-4 items-center justify-center text-muted-foreground hover:text-foreground"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="size-3"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open ? (
        <div
          role="listbox"
          aria-label="Preset text sizes"
          className="absolute top-full right-0 z-50 mt-1 max-h-52 w-14 animate-pop overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-lg"
        >
          {FONT_SIZES.map((s) => (
            <button
              key={s}
              type="button"
              role="option"
              aria-selected={s === value}
              onClick={() => {
                commit(String(s));
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center justify-center rounded px-2 py-1 text-sm hover:bg-muted",
                s === value && "bg-muted font-medium",
              )}
            >
              {s}
            </button>
          ))}
        </div>
      ) : null}
    </div>
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

/** "No color" glyph: a circle with a diagonal cross line through it. */
function NoTintGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      aria-hidden="true"
      className={cn("text-muted-foreground", className)}
    >
      <circle cx="12" cy="12" r="9" />
      <line x1="18.5" y1="5.5" x2="5.5" y2="18.5" />
    </svg>
  );
}

/**
 * A color control: a swatch button that opens a small popover with preset
 * colors plus a native picker for anything custom. `align` decides which side
 * the popover hangs from so it stays on-screen in tight spots.
 */
export function ColorPicker({
  value,
  onChange,
  ariaLabel,
  align = "right",
  allowNone = false,
}: {
  value: string;
  onChange: (color: string) => void;
  ariaLabel: string;
  align?: "left" | "right";
  // When true, offer a "no tint" swatch (a circle with a cross) that selects
  // the {@link NO_TINT} sentinel instead of a color.
  allowNone?: boolean;
}) {
  const isNone = allowNone && value === NO_TINT;
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
        {isNone ? (
          <NoTintGlyph className="size-full" />
        ) : (
          <span
            className="block size-full rounded-sm"
            style={{ backgroundColor: value }}
          />
        )}
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
            {allowNone ? (
              <button
                type="button"
                onClick={() => onChange(NO_TINT)}
                aria-label="No tint"
                title="No tint"
                className={cn(
                  "flex size-6 items-center justify-center rounded-md border border-black/10",
                  isNone &&
                    "ring-2 ring-ring ring-offset-1 ring-offset-popover",
                )}
              >
                <NoTintGlyph className="size-5" />
              </button>
            ) : null}
            {COLOR_PRESETS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onChange(c)}
                aria-label={c}
                style={{ backgroundColor: c }}
                className={cn(
                  "size-6 rounded-md border border-black/10",
                  !isNone &&
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
              value={isNone ? "#000000" : value}
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

/** Font / size / bold / italic / underline / align / color controls for text. */
export function TextStyleEditor({
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
