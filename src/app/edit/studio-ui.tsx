"use client";

/**
 * Small, presentational control primitives shared by the Studio panels. These
 * mirror the look of the app's existing editor controls (segmented pills,
 * switches, box controls) so the redesign feels native, not bolted on.
 */

import { type ReactNode, useEffect, useState } from "react";
import { ColorPicker } from "~/components/text-style-editor";
import { InfoTip } from "~/components/ui/info-tip";
import type { BoxStyle } from "~/lib/pages";
import { cn } from "~/lib/utils";
import { type Selection, useStudio } from "./studio-context";

/**
 * A small centered modal shared by the Studio's pop-ups (the add-link platform
 * picker, the per-link logo uploader, the avatar adjuster). Closes on the
 * backdrop, the ✕, or Escape; animates in with the app's `animate-*` keyframes.
 */
export function Modal({
  title,
  description,
  onClose,
  size = "md",
  children,
}: {
  title?: string;
  description?: string;
  onClose: () => void;
  size?: "xs" | "sm" | "md";
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const maxW =
    size === "xs" ? "max-w-xs" : size === "sm" ? "max-w-sm" : "max-w-md";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 animate-fade bg-black/50"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title ?? "Dialog"}
        className={cn(
          "relative w-full animate-pop rounded-xl border border-border bg-background p-4 shadow-xl",
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
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
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
        open
          ? "border-ring bg-muted/40"
          : "border-border hover:border-muted-foreground/40",
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-muted/40"
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
            "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
            open && "rotate-90",
          )}
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
      </button>
      {/* Smooth height animation via the grid-rows 0fr→1fr trick — children stay
          mounted (so the height can transition) but are `inert` when collapsed,
          keeping them out of tab order and pointer events. */}
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden" inert={!open}>
          <div className="flex flex-col gap-3 border-border border-t p-3">
            {children}
          </div>
        </div>
      </div>
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

/** A small on/off switch. */
export function Toggle({
  checked,
  onChange,
  ariaLabel,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
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
      <Toggle checked={checked} onChange={onChange} ariaLabel={label} />
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
      className="grid gap-1 rounded-lg bg-muted p-1"
      style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-md px-2 py-1.5 text-center font-medium text-sm transition-colors",
            value === o.value
              ? "bg-background text-foreground shadow-sm"
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
          ariaLabel="Toggle box background"
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
            ariaLabel="Toggle outline"
          />
        </div>
      </div>
    </div>
  );
}
