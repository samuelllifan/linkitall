"use client";

/**
 * Small, presentational control primitives shared by the Studio panels. These
 * mirror the look of the app's existing editor controls (segmented pills,
 * switches, box controls) so the redesign feels native, not bolted on.
 */

import { type ReactNode, useEffect, useState } from "react";
import { ColorPicker } from "~/components/text-style-editor";
import { CloseIcon } from "~/components/ui/close-icon";
import { Collapse } from "~/components/ui/collapse";
import { InfoTip } from "~/components/ui/info-tip";
import { Toggle } from "~/components/ui/toggle";
import type { BoxStyle } from "~/lib/pages";
import { usePresence } from "~/lib/use-popover";
import { cn } from "~/lib/utils";
import { type Selection, useStudio } from "./studio-context";

/**
 * A small centered modal for the Studio's pop-ups. Closes on the backdrop, the
 * ✕, or Escape.
 *
 * `open` is a PROP rather than the caller mounting it conditionally, which is
 * what lets it animate out. Mounted behind a `cond ? <Modal/> : null` it went
 * in with `animate-pop` and then simply ceased to exist — the two dialogs in
 * settings fade and scale away, and the Studio's snapped, which is the sort of
 * difference that reads as one of the two being broken. Keep it mounted and let
 * `usePresence` hold it through the exit.
 */
export function Modal({
  open,
  title,
  description,
  onClose,
  size = "md",
  children,
}: {
  open: boolean;
  title?: string;
  description?: string;
  onClose: () => void;
  size?: "xs" | "sm" | "md";
  children: ReactNode;
}) {
  const { value: mounted, visible } = usePresence(open);
  useEffect(() => {
    // Only while it is actually open: a closed-but-still-mounted modal must not
    // swallow the Escape that is meant for whatever is behind it.
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [visible, onClose]);

  const maxW =
    size === "xs" ? "max-w-xs" : size === "sm" ? "max-w-sm" : "max-w-md";

  if (!mounted) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center p-4",
        // Stop the fading-out dialog from swallowing clicks aimed at the page
        // it is uncovering.
        !visible && "pointer-events-none",
      )}
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className={cn(
          "absolute inset-0 bg-black/50",
          visible ? "animate-fade" : "animate-fade-out",
        )}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title ?? "Dialog"}
        className={cn(
          "relative w-full rounded-xl border border-border bg-popover p-4 text-popover-foreground shadow-xl",
          visible ? "animate-pop" : "animate-pop-out",
          maxW,
        )}
      >
        {title ? (
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold text-sm">{title}</h2>
              {description ? (
                <p className="mt-0.5 text-muted-foreground text-xs">
                  {description}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="-mr-1 -mt-1 flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <CloseIcon />
            </button>
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
}

/** An uppercase section heading, e.g. "Name", "Layout". */
export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="font-semibold text-muted-foreground text-xs uppercase tracking-wide">
      {children}
    </p>
  );
}

/** A titled group of controls with consistent spacing. `focus` marks the group
 * as the scroll-to target for a preview selection (see the Studio's focus
 * bridge), so clicking that element in the preview reveals this control. */
export function Group({
  label,
  focus,
  children,
}: {
  label?: string;
  focus?: string;
  children: ReactNode;
}) {
  return (
    <div data-focus={focus} className="scroll-mt-3 flex flex-col gap-3">
      {label ? <SectionLabel>{label}</SectionLabel> : null}
      {children}
    </div>
  );
}

/**
 * The collapsible-card shell shared by {@link AccordionCard} (open state driven
 * by the Studio's selection) and {@link Disclosure} (open state held locally).
 */
function CollapsibleCard({
  focus,
  title,
  summary,
  open,
  onToggle,
  children,
}: {
  focus?: string;
  title: string;
  summary?: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div
      data-focus={focus}
      className={cn(
        "scroll-mt-3 overflow-hidden rounded-lg border transition-colors duration-200",
        // `.sec-open` tints the border AND the fill with the current section's
        // hue (globals.css). The old open state was `border-ring bg-muted/40`,
        // a fill that computed ~3% lighter than the card under it — so which
        // card was open came down to a grey hairline.
        open ? "sec-open" : "border-border hover:border-muted-foreground/40",
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <span className="shrink-0 font-semibold text-sm">{title}</span>
        <span className="min-w-0 flex-1 truncate text-right text-muted-foreground text-xs">
          {open ? null : summary}
        </span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform duration-[var(--dur-enter)] ease-[var(--ease-settle)]",
            open && "rotate-90",
          )}
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
      </button>
      {/* The shared <Collapse>, not a second copy of the grid-rows 0fr→1fr
          trick. This card had its own — same idea, but transitioning only the
          rows (no opacity) on literal timings, so the editor's disclosures and
          settings' opened at two different speeds and two different curves. */}
      <Collapse open={open}>
        <div className="flex flex-col gap-3 border-border border-t p-3">
          {children}
        </div>
      </Collapse>
    </div>
  );
}

/**
 * A collapsible element card whose open state IS the shared `selection` — it's
 * expanded exactly when its element is selected, whether that came from clicking
 * the element in the preview or from clicking this header. This generalizes the
 * per-link accordion in LinksPanel to every editable element, giving the
 * "click a thing → edit just that thing" focus the Studio is built around.
 * `data-focus={id}` lets the Shell's focus bridge scroll it in and flash it.
 */
export function AccordionCard({
  id,
  title,
  summary,
  children,
}: {
  /** The `select()` target this card owns (e.g. "avatar", "panel"). */
  id: Exclude<Selection, null>;
  title: string;
  /** A one-line preview of the current value, shown while collapsed. */
  summary?: ReactNode;
  children: ReactNode;
}) {
  const { selection, select } = useStudio();
  const open = selection === id;
  return (
    <CollapsibleCard
      focus={id}
      title={title}
      summary={summary}
      open={open}
      onToggle={() => select(open ? null : id)}
    >
      {children}
    </CollapsibleCard>
  );
}

/**
 * A collapsible card for controls no preview element selects — the page-wide
 * link defaults, or one link's appearance override. Same shell as
 * {@link AccordionCard}, but it owns its open state, so it can nest inside a
 * card the selection already drives.
 */
export function Disclosure({
  title,
  summary,
  children,
}: {
  title: string;
  summary?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <CollapsibleCard
      title={title}
      summary={summary}
      open={open}
      onToggle={() => setOpen((o) => !o)}
    >
      {children}
    </CollapsibleCard>
  );
}

/** A label on the left and a control on the right. */
export function Row({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

/** The app's switch. Re-exported so the Studio's panels keep importing their
 * controls from one module; the implementation is shared with settings and the
 * music editor (see ui/toggle.tsx — it was three separate switches before). */
export { Toggle };

/** A switch with a label on the left; `hint` hides behind an ⓘ tooltip. */
export function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-1.5">
        <span className="font-medium text-sm">{label}</span>
        {hint ? <InfoTip label={hint} /> : null}
      </div>
      <Toggle checked={checked} onChange={onChange} label={label} />
    </div>
  );
}

/** A segmented pill selector. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div
      className="grid gap-1 rounded-lg border border-border bg-muted/60 p-1"
      style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-md px-2 py-1.5 text-center font-medium text-sm transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
            // A white chip, matching the dashboard's range picker and the
            // editor's own Edit/Preview toggle — the app had four different
            // answers to "this option is selected" and this is the one the
            // majority already used. It also fixes an inverted elevation ramp:
            // the raised chip used to be `bg-background` (0.145) on a `bg-muted`
            // track (0.269), i.e. the selected option was the DARKEST thing in
            // the control while everything else in the app raises by lightening.
            // The section hue is deliberately not spent here — it belongs to the
            // section rail, where it says where you are.
            value === o.value
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** A labelled slider with a live value read-out. */
export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  format,
  track,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  /**
   * A CSS `background` painted onto the track, for a value whose meaning is
   * itself a color (the gradient's blend point). Uses the app's
   * `.gradient-slider` styling so the thumb reads against it.
   */
  track?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="flex justify-between text-muted-foreground">
        <span>{label}</span>
        <span className="tabular-nums">{format ? format(value) : value}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        style={track ? { background: track } : undefined}
        className={cn("w-full", track && "gradient-slider")}
      />
    </label>
  );
}

/** A background/panel preview swatch in a picker grid. */
export function Swatch({
  label,
  preview,
  icon,
  selected,
  onClick,
}: {
  label: string;
  /** CSS `background` value for the thumbnail. */
  preview?: string;
  /**
   * Rendered centered in the thumbnail instead of a background — for a choice
   * with no fixed look to show (e.g. "pick an image", whose result is whatever
   * the visitor uploads).
   */
  icon?: ReactNode;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col items-center gap-1.5 focus-visible:outline-none"
    >
      <span
        className={cn(
          "flex h-12 w-full items-center justify-center rounded-md border border-border transition-all duration-200 group-hover:brightness-110 group-active:scale-95",
          icon && "bg-muted text-muted-foreground group-hover:text-foreground",
          selected
            ? "ring-2 ring-ring ring-offset-2 ring-offset-card"
            : "group-hover:border-muted-foreground/50 group-focus-visible:ring-2 group-focus-visible:ring-ring",
        )}
        style={preview ? { background: preview } : undefined}
      >
        {icon}
      </span>
      <span
        className={cn(
          "text-xs transition-colors",
          selected
            ? "text-foreground"
            : "text-muted-foreground group-hover:text-foreground",
        )}
      >
        {label}
      </span>
    </button>
  );
}

/**
 * Background fill (color + opacity) and outline controls for a "box" surface —
 * the card behind the name/bio, or a link button. Mirrors the app's existing
 * box editor.
 */
export function BoxControls({
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
          label="Toggle box background"
        />
      </div>
      {on ? (
        <>
          <Row label="Color">
            <ColorPicker
              value={box.color}
              onChange={(c) => onChange({ color: c })}
              ariaLabel="Box color"
            />
          </Row>
          <Slider
            label="Opacity"
            value={box.opacity}
            min={0}
            max={100}
            step={5}
            onChange={(v) => onChange({ opacity: v })}
            format={(v) => `${v}%`}
          />
        </>
      ) : null}
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium">Outline</span>
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
            label="Toggle outline"
          />
        </div>
      </div>
    </div>
  );
}
