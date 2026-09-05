"use client";

import { useEffect, useId, useRef, useState } from "react";
import { cn } from "~/lib/utils";

/** How many digits a TOTP code has. */
const LENGTH = 6;

/**
 * A 6-digit code field.
 *
 * ONE real `<input>` sitting invisibly over six drawn cells, rather than six
 * inputs. Six inputs is the usual way and it is the wrong one: it means
 * hand-rolling paste across fields, backspace-into-the-previous-box, arrow
 * keys, and Android's composition events — and it breaks the browser's own
 * one-time-code autofill, which targets a single field with
 * `autocomplete="one-time-code"`. With one input, all of that is native and the
 * cells are just paint.
 */
export function CodeInput({
  value,
  onChange,
  disabled,
  invalid,
  label,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  /** Accessible name — the cells are decorative. */
  label: string;
  autoFocus?: boolean;
}) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const digits = value.padEnd(LENGTH, " ").slice(0, LENGTH).split("");
  // Which cell the caret is "in". Clamped so a full code highlights the last
  // cell instead of a seventh one that isn't there.
  const caret = Math.min(value.length, LENGTH - 1);

  // Take focus back when the field is re-enabled.
  //
  // A disabled element cannot hold focus, so the browser blurs it the moment a
  // verification starts — and nothing gives it back when the attempt fails. On
  // a field that is deliberately `opacity-0`, that left the user staring at six
  // cleared cells with no caret and no way to tell the thing was still waiting
  // for them. This is why `disabled` can stay (it is a real, visible busy
  // state) instead of having to be dropped.
  const wasDisabled = useRef(false);
  useEffect(() => {
    if (wasDisabled.current && !disabled) inputRef.current?.focus();
    wasDisabled.current = !!disabled;
  }, [disabled]);

  /**
   * Park the real caret at the end of the value.
   *
   * The highlight ring is drawn from `value.length`, but the actual caret goes
   * wherever the click landed inside the invisible input — whose text layout has
   * nothing to do with the six drawn cells. Click the first cell with four
   * digits typed and the caret lands at index 0 or 1 while the ring is on cell
   * 5, so the next keystroke is inserted into the MIDDLE of the code. Forcing
   * the caret to the end is what makes the drawn position honest.
   */
  const caretToEnd = () => {
    const el = inputRef.current;
    if (!el) return;
    const end = el.value.length;
    // Guard: Safari throws if the element isn't focused yet.
    try {
      el.setSelectionRange(end, end);
    } catch {
      // Non-fatal — the caret is simply left where the browser put it.
    }
  };

  return (
    // No click handler here: the real <input> below is `absolute inset-0`, so it
    // already covers every cell and a click anywhere in the row lands on it. A
    // handler would be a second, worse way to do what the field does natively —
    // and an interactive <div> at that.
    <div className="relative w-full">
      <input
        ref={inputRef}
        id={id}
        value={value}
        onChange={(e) =>
          // Digits only, and never more than six — this also strips the spaces
          // and dashes that authenticator apps put in the codes they display.
          onChange(e.target.value.replace(/\D/g, "").slice(0, LENGTH))
        }
        onFocus={() => {
          setFocused(true);
          caretToEnd();
        }}
        onBlur={() => setFocused(false)}
        // Also on click and on select: focus fires once, but a click INSIDE an
        // already-focused field moves the caret without refocusing.
        onClick={caretToEnd}
        onSelect={caretToEnd}
        disabled={disabled}
        inputMode="numeric"
        autoComplete="one-time-code"
        // biome-ignore lint/a11y/noAutofocus: this field is the only thing on the challenge screen
        autoFocus={autoFocus}
        aria-label={label}
        aria-invalid={invalid ? true : undefined}
        // Deliberately NO `maxLength`. The native constraint is applied by the
        // browser to the RAW inserted text, before onChange can strip
        // separators — so pasting "123 456" (exactly how 1Password, Authy and
        // Google Authenticator present a code) got truncated to "123 45" and
        // then stripped to five digits, one short of ever submitting. The slice
        // in onChange is the only length limit, and it counts digits.
        className="absolute inset-0 z-10 h-full w-full cursor-default opacity-0"
      />
      <div aria-hidden className="flex w-full justify-center gap-2">
        {digits.map((digit, i) => (
          <span
            key={`${id}-${
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length positional cells
              i
            }`}
            className={cn(
              // box-shadow is in the list because the focused cell's highlight
              // is a `ring-*`, i.e. a shadow — under plain `transition-colors`
              // the border faded and the ring popped, in the same 150ms.
              "flex h-12 w-10 items-center justify-center rounded-lg border bg-input/30 font-mono font-medium text-foreground text-lg transition-[color,background-color,border-color,box-shadow] duration-[var(--dur-fast)]",
              invalid
                ? "border-danger/60"
                : focused && i === caret && !disabled
                  ? "border-brand-violet/70 ring-[3px] ring-ring/40"
                  : "border-border",
              disabled && "opacity-50",
            )}
          >
            {digit.trim()}
          </span>
        ))}
      </div>
    </div>
  );
}
