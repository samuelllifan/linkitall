"use client";

import { useEffect, useRef, useState } from "react";
import { clamp, formatClipTime, parseTime } from "~/lib/music";
import { cn } from "~/lib/utils";

// ---------------------------------------------------------------------------
// File helpers — shared by the audio-source dropdown and the on-card cover edit.
// ---------------------------------------------------------------------------

/** Read a file as a raw data URL (used for uploaded audio). */
export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the file"));
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
}

/** Read an image and return a downscaled JPEG data URL (keeps covers small). */
export function readImageDownscaled(
  file: File,
  maxSize = 512,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the image"));
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
        resolve(canvas.toDataURL("image/jpeg", 0.9));
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}

/** Strip a file extension for use as a default track title. */
export function baseName(name: string): string {
  return name.replace(/\.[^.]+$/, "");
}

// ---------------------------------------------------------------------------
// Clip picker — a draggable selection window + editable time codes. Used inline
// on the player card in edit mode.
// ---------------------------------------------------------------------------

/**
 * Instagram-style clip picker: a draggable selection window over the whole song
 * (`duration`, seconds). Grab the window body to slide the segment through the
 * track keeping its length; drag either edge handle to resize. A 0.5s minimum
 * gap keeps the handles from crossing.
 */
function ClipRange({
  duration,
  start,
  end,
  albumArt,
  onChange,
}: {
  duration: number;
  start: number;
  end: number;
  albumArt?: string;
  onChange: (start: number, end: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const max = Math.max(duration, 1);
  const GAP = 0.5;
  const s = clamp(start, 0, max);
  const e = clamp(end, 0, max);
  const startPct = (s / max) * 100;
  const endPct = (e / max) * 100;

  // A pointer drag on the body ("move") slides the whole window; the edge
  // handles ("start"/"end") resize it. Deltas are computed against the values
  // captured at press time, so re-renders mid-drag don't compound the motion.
  const beginDrag =
    (mode: "move" | "start" | "end") => (ev: React.PointerEvent) => {
      ev.preventDefault();
      ev.stopPropagation();
      const trackW = trackRef.current?.clientWidth || 1;
      const startX = ev.clientX;
      const s0 = s;
      const e0 = e;
      const len = e0 - s0;
      const pxToSec = (dx: number) => (dx / trackW) * max;

      const onMove = (m: PointerEvent) => {
        const d = pxToSec(m.clientX - startX);
        if (mode === "move") {
          let ns = s0 + d;
          let ne = e0 + d;
          if (ns < 0) {
            ns = 0;
            ne = len;
          } else if (ne > max) {
            ne = max;
            ns = max - len;
          }
          onChange(ns, ne);
        } else if (mode === "start") {
          const ns = clamp(s0 + d, 0, e0 - GAP);
          onChange(ns, e0);
        } else {
          const ne = clamp(e0 + d, s0 + GAP, max);
          onChange(s0, ne);
        }
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    };

  return (
    <div
      ref={trackRef}
      className="clip-track"
      style={albumArt ? { backgroundImage: `url(${albumArt})` } : undefined}
    >
      <div
        className="clip-window"
        style={{ left: `${startPct}%`, right: `${100 - endPct}%` }}
        onPointerDown={beginDrag("move")}
        role="slider"
        aria-label="Clip position"
        aria-valuemin={0}
        aria-valuemax={Math.round(max)}
        aria-valuenow={Math.round(s)}
        tabIndex={0}
      >
        <span
          className="clip-handle clip-handle-l"
          onPointerDown={beginDrag("start")}
          aria-hidden="true"
        />
        <span
          className="clip-handle clip-handle-r"
          onPointerDown={beginDrag("end")}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}

/**
 * A compact, editable `m:ss.d` time code shown under one end of the clip slider.
 * Looks like plain text until hovered/focused, when it reveals it's editable.
 */
function TimeCodeInput({
  value,
  onChange,
  onFocus,
  onBlur,
  align,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  align: "left" | "right";
  ariaLabel: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onFocus={onFocus}
      onBlur={onBlur}
      inputMode="numeric"
      aria-label={ariaLabel}
      className={cn(
        "w-16 rounded-md border border-transparent bg-transparent px-1.5 py-1 text-foreground text-xs tabular-nums outline-none transition-colors hover:border-input focus:border-ring focus:bg-background",
        align === "left" ? "text-left" : "text-right",
      )}
    />
  );
}

/**
 * The full clip-trim control: the draggable window plus its two editable time
 * codes, kept in sync. `clipStart`/`clipEnd` are the stored clip (undefined =
 * whole song); `duration` is the playable length. `onChange` receives the new
 * endpoints (numbers, or undefined to clear an end).
 */
export function MusicClipEditor({
  duration,
  albumArt,
  clipStart,
  clipEnd,
  onChange,
}: {
  duration: number;
  albumArt?: string;
  clipStart?: number;
  clipEnd?: number;
  onChange: (
    clipStart: number | undefined,
    clipEnd: number | undefined,
  ) => void;
}) {
  const clipDuration = duration || 30;
  const startVal = clamp(clipStart ?? 0, 0, clipDuration);
  const endVal = clamp(clipEnd ?? clipDuration, 0, clipDuration);
  // Local text so a half-typed "1:" doesn't snap; synced from the values below.
  const [startText, setStartText] = useState("");
  const [endText, setEndText] = useState("");
  const editingRef = useRef(false);

  useEffect(() => {
    if (editingRef.current) return;
    setStartText(formatClipTime(startVal));
    setEndText(formatClipTime(endVal));
  }, [startVal, endVal]);

  const focus = () => {
    editingRef.current = true;
  };
  const blur = () => {
    editingRef.current = false;
    setStartText(formatClipTime(startVal));
    setEndText(formatClipTime(endVal));
  };
  const round1 = (n: number) => Math.round(n * 10) / 10;

  return (
    <div className="flex flex-col gap-2">
      <ClipRange
        duration={clipDuration}
        start={startVal}
        end={endVal}
        albumArt={albumArt}
        onChange={(a, b) => onChange(round1(a), round1(b))}
      />
      <div className="flex items-center justify-between">
        <TimeCodeInput
          value={startText}
          onChange={(t) => {
            setStartText(t);
            onChange(parseTime(t), clipEnd);
          }}
          onFocus={focus}
          onBlur={blur}
          align="left"
          ariaLabel="Clip start time"
        />
        <TimeCodeInput
          value={endText}
          onChange={(t) => {
            setEndText(t);
            onChange(clipStart, parseTime(t));
          }}
          onFocus={focus}
          onBlur={blur}
          align="right"
          ariaLabel="Clip end time"
        />
      </div>
    </div>
  );
}
