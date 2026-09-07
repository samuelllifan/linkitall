import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * The inline style a `.studio-slider` needs: `--fill`, the percentage of the
 * track left of the thumb.
 *
 * WebKit has no pseudo-element for the filled part of a range input — Firefox
 * does (`::-moz-range-progress`), which is why only half of `.studio-slider`
 * reads this — so the fill has to be painted as a hard-stop gradient on the
 * track, and only JS knows where the stop goes. Shared from here rather than
 * inlined at each call site so the three sliders in the editor cannot drift
 * into three slightly different percentages.
 */
export function sliderFill(
  value: number,
  min: number,
  max: number,
): React.CSSProperties {
  // A zero-width range would divide by zero; treat it as empty rather than NaN,
  // which CSS drops and would leave the track unpainted.
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return {
    "--fill": `${Math.max(0, Math.min(100, pct))}%`,
  } as React.CSSProperties;
}
