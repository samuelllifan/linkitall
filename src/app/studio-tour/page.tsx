"use client";

/**
 * TEMPORARY tour of the Studio work.
 *
 * Not linked from anywhere and noindex'd (see layout.tsx alongside), same role
 * as /test-bg and /test-music. It exists so the whole pass can be looked at on
 * one screen instead of hunted for across six editor sections, and every demo
 * on it renders through the REAL component or the REAL global class — so if a
 * feature regresses, this page breaks with it rather than continuing to show a
 * screenshot of how it used to work.
 *
 * Delete this route (and /studio-demo) once the work has been reviewed.
 */

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import {
  boxCss,
  DEFAULT_LINK_BOX,
  LinkHeader,
  PLATFORMS,
} from "~/components/profile-view";
import type { BoxShadow, BoxStyle, LinkItem } from "~/lib/pages";
import { THEMES } from "~/lib/themes";
import { cn } from "~/lib/utils";
import { ThemeSwatch } from "../edit/studio-panels";

// ---------------------------------------------------------------------------
// Page scaffolding
// ---------------------------------------------------------------------------

function Section({
  n,
  title,
  blurb,
  children,
}: {
  n: string;
  title: string;
  blurb: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 border-border border-t pt-8">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2.5">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-[var(--brand-violet)]/12 font-semibold text-[11px] text-[var(--brand-violet)] tabular-nums">
            {n}
          </span>
          <h2 className="font-semibold text-lg tracking-tight">{title}</h2>
        </div>
        <p className="max-w-2xl text-muted-foreground text-sm">{blurb}</p>
      </div>
      {children}
    </section>
  );
}

/** A dark demo stage, so page-content samples sit on something page-like. */
function Stage({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-xl border border-border bg-[#0b0b10] p-5",
        className,
      )}
    >
      {children}
    </div>
  );
}

function Caption({ children }: { children: ReactNode }) {
  return (
    <p className="text-center text-[11px] text-muted-foreground/70">
      {children}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Live samples
// ---------------------------------------------------------------------------

/** A stand-in link button, painted by the real `boxCss`. */
function SampleButton({
  box,
  label,
  className,
  style,
}: {
  box: Partial<BoxStyle>;
  label: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div className={cn("w-full", className)} style={style}>
      <div
        style={{
          ...boxCss({ ...DEFAULT_LINK_BOX, ...box }),
          color: "#ffffff",
        }}
        className="flex w-full items-center justify-center px-4 py-3 text-center font-medium text-sm"
      >
        {label}
      </div>
    </div>
  );
}

const SHAPES: { label: string; radius: number }[] = [
  { label: "Square", radius: 0 },
  { label: "Rounded", radius: 12 },
  { label: "Pill", radius: 28 },
];

const SHADOWS: { label: string; shadow: BoxShadow }[] = [
  { label: "None", shadow: "none" },
  { label: "Soft", shadow: "soft" },
  { label: "Hard", shadow: "hard" },
  { label: "Glow", shadow: "glow" },
];

const HIGHLIGHTS: { label: string; cls: string }[] = [
  { label: "Pulse", cls: "link-fx-pulse" },
  { label: "Bounce", cls: "link-fx-bounce" },
  { label: "Shake", cls: "link-fx-shake" },
  { label: "Glow", cls: "link-fx-glow" },
];

const TEXT_FX: { label: string; cls: string }[] = [
  { label: "Gradient", cls: "text-anim-gradient" },
  { label: "Rainbow", cls: "text-anim-rainbow" },
  { label: "Shine", cls: "text-anim-shine" },
];

/** A few real platform marks, for the icon-row sample. */
const SAMPLE_ICONS = ["tiktok", "instagram", "x", "twitch"]
  .map((k) => PLATFORMS.find((p) => p.key === k))
  .filter((p): p is NonNullable<typeof p> => Boolean(p));

const HEADER_SAMPLE: LinkItem = {
  id: "sample-header",
  label: "Commissions",
  href: "",
  kind: "header",
};

/** The smaller changes, listed rather than demoed. */
const POLISH: { title: string; body: string }[] = [
  {
    title: "Copy your link from the header",
    body: "The page address in the Studio header was inert text. It's now a button that copies the URL, with an open-in-new-tab beside it — the two things anyone ever does with it.",
  },
  {
    title: "Searchable add-link picker",
    body: "Twenty-odd brand tiles is past the point where scanning beats typing. The picker opens focused on a search field, Enter takes the top hit, and “Custom link” and “Header” moved into their own labelled row instead of hiding as the 21st and 22nd logo.",
  },
  {
    title: "Publish dialog you can turn off",
    body: "“Are you sure?” on every single save trains people to click through it without reading. It now says what publishing actually does, and carries a “don't ask again on this device”.",
  },
  {
    title: "Duplicate a link",
    body: "Copies the row — styling, schedule and all — directly below the original rather than at the bottom of the list.",
  },
  {
    title: "A census on the links list",
    body: "“3 links · 4 icons · 2 headers · 1 hidden”, plus an Add button that doesn't need you to scroll past twenty rows to reach. A scheduled or expired link used to be invisible until you opened its card.",
  },
  {
    title: "Keyboard shortcuts, written down",
    body: "⌘S, ⌘Z, ⇧⌘Z and Escape all worked already and were documented nowhere. Press ? in the Studio, or use the new header button.",
  },
  {
    title: "Fonts shown in their own face",
    body: "The font menu listed twelve typefaces in the same typeface. Each option now renders in itself.",
  },
  {
    title: "Switches that admit what they do",
    body: "Music and Intro both left every setting live and editable underneath an off switch, which reads as a broken toggle. Both now say so. Importing a song also turns music on — picking a track IS asking for music.",
  },
  {
    title: "A canvas, not a grey rectangle",
    body: "The preview pane was a flat fill next to the most colourful thing on screen. It's now a dot grid with a soft brand bloom, and the device frame has room to sit on it.",
  },
  {
    title: "Themes are undoable",
    body: "Applying a theme is an ordinary edit, so one ⌘Z takes it back — no separate “revert” to find.",
  },
];

export default function StudioTourPage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-5 py-12 sm:px-8">
      {/* Hero */}
      <header className="flex flex-col gap-4">
        <span className="w-fit rounded-full border border-[var(--brand-violet)]/30 bg-[var(--brand-violet)]/10 px-2.5 py-1 font-medium text-[11px] text-[var(--brand-violet)] uppercase tracking-wider">
          Temporary review page
        </span>
        <h1 className="font-semibold text-3xl tracking-tight sm:text-4xl">
          The Studio, <span className="brand-text">rebuilt a bit</span>
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Eight things the editor couldn't do before — themes, button corners,
          button shadows, attention animations, section headers, icon rows, text
          effects, photo effects — and ten it did awkwardly. Every sample below
          is rendered by the real component or the real stylesheet; nothing here
          is a mockup.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/studio-demo"
            className="brand-ring brand-ring-hover inline-flex h-10 items-center rounded-lg border border-transparent bg-foreground px-5 font-medium text-background text-sm transition-opacity hover:opacity-90"
          >
            Open the live Studio →
          </Link>
          <Link
            href="/edit"
            className="inline-flex h-10 items-center rounded-lg border border-border px-5 font-medium text-sm transition-colors hover:bg-muted"
          >
            Your real page
          </Link>
        </div>
        <p className="text-[11px] text-muted-foreground/70">
          The live Studio runs on a seeded sandbox page — every control works
          and Save writes nothing, so it's safe to click through all of it.
        </p>
      </header>

      <Section
        n="1"
        title="Themes"
        blurb="Eight curated looks, one click each. A theme owns the background, the panel, the box surfaces and the type — and deliberately nothing else, so your name, bio, photo, links, music and intro survive clicking through all eight to see what fits. These are the real swatches from the Themes tab, each built from its own values through the same boxCss the page renders with."
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {THEMES.map((t) => (
            <div key={t.key} className="flex flex-col gap-1.5">
              <div className="overflow-hidden rounded-lg border border-border">
                <ThemeSwatch theme={t} />
              </div>
              <div className="flex flex-col leading-tight">
                <span className="font-medium text-xs">{t.label}</span>
                <span className="text-[11px] text-muted-foreground/70">
                  {t.hint}
                </span>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section
        n="2"
        title="Button shape and shadow"
        blurb="Buttons were a colour, an opacity and an outline. They now also have corners — three named presets over a px slider — and a drop shadow: a diffuse lift, a hard offset block, or a neon bloom that samples the button's own colour."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Stage>
            <Caption>Corners — Square / Rounded / Pill</Caption>
            {SHAPES.map((s) => (
              <SampleButton
                key={s.label}
                label={s.label}
                box={{ color: "#a78bfa", opacity: 100, radius: s.radius }}
              />
            ))}
          </Stage>
          {/* A LIGHT stage, unlike every other sample here. Soft and Hard are
              black shadows, and a black shadow on a near-black page is a shadow
              you cannot see — which is the honest reason those two exist for
              light and mid-tone pages and Glow exists for dark ones. Showing
              all four on black would have shown two. */}
          <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-[#eceaf3] p-5">
            <p className="text-center text-[11px] text-[#5b5570]">
              Shadow — None / Soft / Hard / Glow
            </p>
            {SHADOWS.map((s) => (
              <SampleButton
                key={s.label}
                label={s.label}
                // Glow samples the button's OWN colour, so it needs one worth
                // blooming; the other three are about depth, not hue.
                box={
                  s.shadow === "glow"
                    ? {
                        color: "#8b5cf6",
                        opacity: 100,
                        outline: false,
                        radius: 10,
                        shadow: s.shadow,
                      }
                    : {
                        color: "#1a1626",
                        opacity: 100,
                        outline: false,
                        radius: 10,
                        shadow: s.shadow,
                      }
                }
              />
            ))}
            <p className="text-center text-[11px] text-[#5b5570]">
              Glow takes its colour from the button (or its outline, when the
              fill is off — the Neon theme's trick).
            </p>
          </div>
        </div>
      </Section>

      <Section
        n="3"
        title="Attention animations"
        blurb="For the one link you want read first. All four run on a wrapper around the button rather than the button itself — it already owns transform for its hover lift — and all four pause on hover, so a bouncing target holds still long enough to actually be clicked. Hover one below to see it stop."
      >
        <Stage>
          {HIGHLIGHTS.map((h) => (
            <div key={h.label} className={cn("w-full", h.cls)}>
              <SampleButton
                label={h.label}
                box={{
                  color: "#0e0e16",
                  opacity: 100,
                  outline: true,
                  outlineColor: "#2a2a3a",
                  radius: 10,
                }}
              />
            </div>
          ))}
        </Stage>
      </Section>

      <Section
        n="4"
        title="Headers and icon rows"
        blurb="Two new row types in the links list. A header labels the links under it and disappears on its own if its whole group ends up hidden. An icon link draws as its bare logo, and consecutive icon links share one centered strip — so a row of socials can sit above your buttons, below them, or between two groups, exactly where you drag it. Linktree makes that an all-or-nothing page setting; here it's per row."
      >
        <Stage className="items-stretch">
          <LinkHeader link={HEADER_SAMPLE} isDark />
          <SampleButton
            label="Rates & turnaround"
            box={{
              color: "#0e0e16",
              opacity: 100,
              outline: true,
              outlineColor: "#2a2a3a",
              radius: 10,
            }}
          />
          <SampleButton
            label="Book a slot"
            box={{
              color: "#0e0e16",
              opacity: 100,
              outline: true,
              outlineColor: "#2a2a3a",
              radius: 10,
            }}
          />
          <LinkHeader
            link={{ ...HEADER_SAMPLE, id: "s2", label: "Elsewhere" }}
            isDark
          />
          <div className="flex flex-wrap items-center justify-center gap-4 py-1">
            {SAMPLE_ICONS.map((p) => (
              <span
                key={p.key}
                title={p.label}
                style={{ color: p.color ?? "#ffffff" }}
                className="inline-flex"
              >
                <p.icon className="size-6" />
              </span>
            ))}
          </div>
        </Stage>
      </Section>

      <Section
        n="5"
        title="Text and avatar effects, back"
        blurb="The animated text effects and the profile-picture decorations were pulled out in July with their data models and keyframes left intact. Both are wired up again. The Gradient effect now runs the brand purple ramp rather than the retired six-hue spectrum — it's the one most pages will actually wear, so it should look like stacked; Rainbow is still there for anyone who wants the whole wheel."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Stage className="justify-center gap-4">
            <Caption>Text effects (name, bio, links, headers, intro)</Caption>
            {TEXT_FX.map((t) => (
              <span
                key={t.label}
                className={cn("font-semibold text-2xl", t.cls)}
                style={{ "--text-c": "#ffffff" } as CSSProperties}
              >
                {t.label}
              </span>
            ))}
          </Stage>
          <Stage className="justify-center gap-4">
            <Caption>Avatar — outline, shine, particles</Caption>
            <div className="flex items-center gap-6 py-2">
              <div
                className="relative flex size-16 items-center justify-center rounded-full bg-gradient-to-br from-[#c084fc] to-[#6366f1] font-semibold text-2xl text-white"
                style={{ boxShadow: "0 0 0 3px #a78bfa" }}
              >
                N
                <span
                  aria-hidden
                  className="avatar-shine overflow-hidden rounded-full"
                  style={{ "--s-dur": "2.6s" } as CSSProperties}
                />
              </div>
              <span className="text-muted-foreground text-xs">
                Speed, size, amount and colour are sliders in Profile → Avatar →
                Effect.
              </span>
            </div>
          </Stage>
        </div>
      </Section>

      <Section
        n="6"
        title="Everything else"
        blurb="The parts that were already there and were awkward."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {POLISH.map((p) => (
            <div
              key={p.title}
              className="flex flex-col gap-1 rounded-lg border border-border bg-card p-4"
            >
              <h3 className="font-medium text-sm">{p.title}</h3>
              <p className="text-muted-foreground text-xs leading-relaxed">
                {p.body}
              </p>
            </div>
          ))}
        </div>
      </Section>

      <Section
        n="7"
        title="Still safe for live pages"
        blurb="Everything new is an optional field on the existing shapes, so a page saved before tonight reads exactly as it did."
      >
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4 text-muted-foreground text-xs leading-relaxed">
          <p>
            <span className="text-foreground">LinkItem</span> gained{" "}
            <code className="text-[var(--brand-violet)]">kind</code> and{" "}
            <code className="text-[var(--brand-violet)]">highlight</code>;{" "}
            <span className="text-foreground">BoxStyle</span> gained{" "}
            <code className="text-[var(--brand-violet)]">radius</code> and{" "}
            <code className="text-[var(--brand-violet)]">shadow</code>. All four
            are optional, and <code className="text-foreground">undefined</code>{" "}
            means exactly what the page did before: a plain link, no animation,
            an 8px corner, no shadow.
          </p>
          <p>
            No migration, no schema change — they ride in the existing{" "}
            <code>links</code> and <code>styles</code> JSON.
          </p>
        </div>
      </Section>

      <footer className="flex flex-col gap-3 border-border border-t pt-8 pb-4">
        <p className="text-muted-foreground text-sm">
          Delete <code className="text-foreground">src/app/studio-tour</code>{" "}
          and <code className="text-foreground">src/app/studio-demo</code> when
          you're done reviewing — and drop{" "}
          <code className="text-foreground">/studio-demo</code> from{" "}
          <code className="text-foreground">FULL_HEIGHT_ROUTES</code> in
          footer-slot.tsx.
        </p>
        <Link
          href="/studio-demo"
          className="w-fit font-medium text-[var(--brand-violet)] text-sm hover:underline"
        >
          Open the live Studio →
        </Link>
      </footer>
    </main>
  );
}
