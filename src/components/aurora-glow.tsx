import { cn } from "~/lib/utils";

/**
 * The faint, slowly drifting brand glow behind a screen that is one card on a
 * void: the 404, the error boundary, the four auth screens and the contact
 * form. That description is the rule for adding a sixth — a page that is a
 * single card on empty space, not a page of prose (which is why /privacy and
 * /terms do not have it).
 *
 * It was written out twice by hand (not-found.tsx and error.tsx, identical but
 * for one opacity value) and MISSING from the auth screens entirely — even
 * though the note on `.aurora-a` in globals.css has always described it as
 * being behind "the auth / 404 / error screens". So signing in was flat black
 * while mistyping a username got a glow, which is backwards: the 404 is a dead
 * end and the sign-in screen is the front door.
 *
 * The drift itself is `.aurora-a` (globals.css) — a 20s ease-in-out wander. It
 * is CSS-only on purpose, not the WebGL aurora a creator can put on their own
 * page: this renders on the error boundary, which is exactly where a shader is
 * least welcome.
 *
 * `blur-[120px]` over a 520x380 box means the visible glow is far larger than
 * its own element, so the host must be `relative overflow-hidden` or the blur
 * will paint outside it and put a scrollbar on the page.
 */
export function AuroraGlow({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute top-1/2 left-1/2 h-[380px] w-[520px] max-w-[90vw] rounded-full opacity-[0.1] blur-[120px]",
        "aurora-a",
        className,
      )}
      // Literal, not a class: `--brand-grad` is the whole four-step sweep, and
      // there is no Tailwind utility that resolves a gradient from a variable.
      style={{ background: "var(--brand-grad)" }}
    />
  );
}
