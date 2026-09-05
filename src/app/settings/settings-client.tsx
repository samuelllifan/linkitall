"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "~/components/ui/button";
import { CodeInput } from "~/components/ui/code-input";
import { Collapse } from "~/components/ui/collapse";
import { GLYPH, Glyph } from "~/components/ui/glyph";
import { GoogleMark } from "~/components/ui/google-mark";
import { InfoTip } from "~/components/ui/info-tip";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { PasswordToggle } from "~/components/ui/password-toggle";
import { Requirement } from "~/components/ui/requirement";
import { Toggle } from "~/components/ui/toggle";
import { UsernameAvailability } from "~/components/ui/username-availability";
import { openWhatsNew } from "~/components/whats-new-dialog";
import { CHANGELOG } from "~/lib/changelog";
import { buildAccountExport, downloadJson } from "~/lib/data-export";
import { setUsername as saveUsername } from "~/lib/profiles";
import { lockBodyScroll, unlockBodyScroll } from "~/lib/scroll-lock";
import { createClient } from "~/lib/supabase/client";
import { useUnsavedGuard } from "~/lib/unsaved-guard";
import { usePresence } from "~/lib/use-popover";
import { useSlidingMarker } from "~/lib/use-sliding-marker";
import { useUsernameAvailability } from "~/lib/use-username-availability";
import { cn } from "~/lib/utils";
import { isEveryOpen, setEveryOpen } from "~/lib/whats-new";

/* -------------------------------------------------------------------------- */
/*  Sections                                                                   */
/* -------------------------------------------------------------------------- */

type SectionId =
  | "account"
  | "security"
  | "page"
  | "privacy"
  | "notifications"
  | "preferences"
  | "help"
  | "danger";

/**
 * Every setting on one page, grouped. Settings used to be four separate
 * mini-pages behind a tab rail, which meant you could not see what the app was
 * offering without clicking through all of it, and a section holding a single
 * toggle looked like a bug. One list answers "what can I change here?" in one
 * scroll; the rail is now a jump list, not a router.
 *
 * Every group holds at least two settings, which is the rule that stops this
 * turning back into a set of near-empty pages.
 *
 * Icons are one path each on the same 24-grid and stroke weight as the Studio's
 * section rail, so the two navigations read as the same control.
 */
const SECTIONS: {
  id: SectionId;
  label: string;
  icon: string;
  /** Paints the group label and its rail icon in the app's one red. */
  danger?: boolean;
}[] = [
  {
    id: "account",
    label: "Account",
    icon: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM5 20a7 7 0 0 1 14 0",
  },
  {
    id: "security",
    label: "Security",
    icon: "M12 3l7 3v6c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6l7-3Z",
  },
  {
    id: "page",
    label: "Page",
    icon: "M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6ZM3 9h18M6.5 6.5h.01",
  },
  {
    id: "privacy",
    label: "Privacy",
    icon: "M2.1 12.3a1 1 0 0 1 0-.7 10.8 10.8 0 0 1 19.8 0 1 1 0 0 1 0 .7 10.8 10.8 0 0 1-19.8 0M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  },
  {
    id: "notifications",
    label: "Notifications",
    icon: "M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0",
  },
  {
    id: "preferences",
    label: "Preferences",
    icon: "M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3M14 2v4M8 10v4M16 18v4",
  },
  {
    id: "help",
    label: "Help",
    icon: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM9.1 9.5a3 3 0 0 1 5.8 1c0 2-2.9 3-2.9 3M12 17h.01",
  },
  {
    id: "danger",
    label: "Danger zone",
    icon: "m10.3 3.6-8 14A2 2 0 0 0 4 20.6h16a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0ZM12 9v4M12 17h.01",
    danger: true,
  },
];

const SECTION_IDS = new Set<string>(SECTIONS.map((s) => s.id));

/** The groups, keyed, so the list below reads as `BY_ID.privacy` at its site. */
const BY_ID = Object.fromEntries(SECTIONS.map((s) => [s.id, s])) as Record<
  SectionId,
  (typeof SECTIONS)[number]
>;

/**
 * Groups that exist only once the page/account-settings migration has landed.
 * Used both to drop them from the list and to drop them from the rail, so the
 * two can never disagree about what is on the page.
 *
 * ONLY Notifications, because only Notifications is made entirely of new
 * columns. Page and Privacy each also hold a setting that predates this
 * migration — search-engine visibility (`search_indexable`, shipped in
 * 20260729192825) and the data export (which reads `select("*")` and names no
 * new column at all) — so gating the whole GROUP on `migrated` would have taken
 * a working, already-shipped setting away from every user until the migration
 * was pushed. The individual panels are gated instead.
 */
const MIGRATED_ONLY: ReadonlySet<SectionId> = new Set(["notifications"]);

/**
 * Hashes that used to name a section, kept working. `#accessibility` is the one
 * the What's New dialog's "Don't show again" link pointed at before that toggle
 * moved into Preferences — where it always belonged, since it is a preference
 * and not an accessibility accommodation.
 */
const HASH_ALIASES: Record<string, SectionId> = {
  accessibility: "preferences",
};

/** How long the scroll-spy stands down after a rail click, in ms. */
const JUMP_LOCK_MS = 800;

/* -------------------------------------------------------------------------- */
/*  Small shared pieces                                                        */
/* -------------------------------------------------------------------------- */

/** A bottom toast. `ms` is how long it holds before self-dismissing; null = stays. */
type Toast = { text: string; error: boolean; ms: number | null };

/** What the panels call to raise one. */
type ShowToast = (text: string, error: boolean, ms?: number | null) => void;

// Pragmatic client-side check; Supabase re-validates authoritatively on save.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The tick in the "Saved" toast — same mark and weight as the editor's. */
function ToastCheck() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="size-4 shrink-0 text-success"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

/**
 * A state chip: "On", "Not set", "Always on".
 *
 * `tone` is the whole point of it — the colour has to mean the same thing here
 * as everywhere else in the app, so a chip is green when something protective
 * is ACTIVE and neutral when it is simply a fact. Never red: red is the button
 * you are about to press, not a status line.
 */
function Chip({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "on";
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-medium text-xs",
        tone === "on"
          ? "border-success/35 bg-success/10 text-success"
          : "border-border bg-muted/40 text-muted-foreground",
      )}
    >
      {tone === "on" ? (
        <span aria-hidden className="size-1.5 rounded-full bg-success" />
      ) : null}
      {children}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*  Panels                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * The card a single setting lives in. Same shell as the Dashboard's panels
 * (`elev-card rounded-xl border bg-card`), so the two authenticated pages are
 * built from one surface instead of two.
 *
 * On `description` vs `info`: the line under the title is reserved for things a
 * reader would be worse off not knowing before they act — a username change
 * breaking existing links, deletion being permanent. Anything that is merely
 * useful goes behind the ⓘ, and anything a reader would assume anyway ("Used to
 * sign in", "Ends every active session" under a control called "Sign out
 * everywhere") is not written at all. Restating the title in smaller grey type
 * is the single easiest way to make a settings page look unfinished.
 *
 * `tone="danger"` swaps the brand tint for the app's one red. It is a tint,
 * never a fill: the destructive ACTION is the button inside — the card only has
 * to say "read this one first".
 */
function Panel({
  icon,
  title,
  titleId,
  description,
  info,
  aside,
  tone = "brand",
  delay = 0,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  /**
   * When the panel's control has no visible <Label> of its own, the heading IS
   * its name: pass an id here and `aria-labelledby` it from the control. The
   * accessible name then matches the visible text, which a hand-written
   * `aria-label` is free to drift from.
   */
  titleId?: string;
  /** One clause, and only when it changes what the reader would do. */
  description?: React.ReactNode;
  /** The detail, behind the ⓘ. Hover, focus, or tap to read it. */
  info?: React.ReactNode;
  /** A status chip parked at the far end of the title row. */
  aside?: React.ReactNode;
  tone?: "brand" | "danger";
  /** Stagger, in ms, for the card's arrival. See `.animate-rise`. */
  delay?: number;
  children?: React.ReactNode;
}) {
  const danger = tone === "danger";
  return (
    <div
      className={cn(
        "animate-rise elev-card rounded-xl border p-5 transition-colors",
        danger
          ? "border-danger/30 bg-danger/[0.045]"
          : "border-border bg-card hover:border-brand-violet/25",
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start gap-3.5">
        <span
          aria-hidden
          className={cn(
            "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border",
            danger
              ? "border-danger/25 bg-danger/10 text-danger"
              : "border-brand-violet/25 bg-brand-violet/10 text-brand-violet",
          )}
        >
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-1.5">
              <h3 id={titleId} className="font-medium text-foreground text-sm">
                {title}
              </h3>
              {info ? <InfoTip label={info} /> : null}
            </div>
            {aside}
          </div>
          {description ? (
            <p className="mt-1 max-w-md text-muted-foreground text-xs leading-relaxed">
              {description}
            </p>
          ) : null}
          {children ? <div className="mt-4">{children}</div> : null}
        </div>
      </div>
    </div>
  );
}

/**
 * A {@link Panel} whose control is a switch, sitting on the title row rather
 * than under the copy -- a toggle IS its heading, so putting it below would
 * leave the row it belongs to looking unfinished. The whole title is the
 * `<label>`, so the tap target is the sentence, not just the 44px switch.
 */
function SwitchPanel({
  icon,
  id,
  title,
  info,
  checked,
  onChange,
  delay = 0,
}: {
  icon: React.ReactNode;
  id: string;
  title: string;
  info?: React.ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
  delay?: number;
}) {
  return (
    <div
      className="animate-rise elev-card rounded-xl border border-border bg-card p-5 transition-colors hover:border-brand-violet/25"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center gap-3.5">
        <span
          aria-hidden
          className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-brand-violet/25 bg-brand-violet/10 text-brand-violet"
        >
          {icon}
        </span>
        <div className="flex min-w-0 flex-1 items-center justify-between gap-4">
          {/* The ⓘ sits OUTSIDE the <label>, not inside it: a click anywhere in
              a label activates its control, so an in-label tip would flip the
              switch on the way to reading it. */}
          <div className="flex min-w-0 items-center gap-1.5">
            <Label htmlFor={id} className="cursor-pointer leading-snug">
              {title}
            </Label>
            {info ? <InfoTip label={info} /> : null}
          </div>
          <Toggle id={id} checked={checked} onChange={onChange} label={title} />
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Dialog shell                                                               */
/* -------------------------------------------------------------------------- */

/**
 * The modal every settings flow uses. There were three hand-rolled copies of
 * this markup by the time page passwords and 2FA arrived, all with the same
 * overlay, the same pop-in and the same "don't swallow clicks on the way out"
 * guard — which is one dialog, written three times.
 */
function Dialog({
  open,
  visible,
  titleId,
  title,
  onClose,
  children,
}: {
  open: boolean;
  visible: boolean;
  titleId: string;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  // Escape-to-close and the background-scroll lock belong HERE, not in the page.
  // They used to live in SettingsClient, keyed off its own two dialogs — which
  // silently left the other two (two-factor set-up, page password) without
  // either, because those own their open state inside child components. A
  // dialog should not have to be adopted by its parent to behave like one.
  //
  // Through a ref so the effect does not resubscribe on every render: every
  // call site passes an inline arrow, and `onClose` is a new function each time.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // The lock is ref-counted (~/lib/scroll-lock), so overlapping dialogs are safe.
  useEffect(() => {
    if (!open) return;
    lockBodyScroll();
    return () => {
      unlockBodyScroll();
    };
  }, [open]);

  if (!open) return null;
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
        className={cn(
          "absolute inset-0 bg-black/50",
          visible ? "animate-fade" : "animate-fade-out",
        )}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "relative max-h-[calc(100dvh-2rem)] w-full max-w-sm overflow-y-auto rounded-xl border border-border bg-popover p-6 text-popover-foreground shadow-xl",
          visible ? "animate-pop" : "animate-pop-out",
        )}
      >
        <h2 id={titleId} className="font-semibold text-lg">
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Section rail                                                               */
/* -------------------------------------------------------------------------- */

/**
 * The jump list beside (or above) the settings.
 *
 * It carries the navbar's marker: ONE object that slides between entries,
 * wearing the brand gradient as a 2px line along whichever edge the list runs
 * along — the bottom on phones, where the rail is a horizontal scroller, and
 * the left from `sm` up, where it is a column. Same element, same
 * `.nav-marker` timing, same reason: an active state that MOVES is something
 * the eye can follow, where eight chips fading in and out is something it can
 * only notice afterwards.
 *
 * The measuring, the first-paint placement and the row/column re-measure all
 * live in {@link useSlidingMarker}, shared with the other two.
 */
function SectionRail({
  sections,
  active,
  onJump,
}: {
  sections: typeof SECTIONS;
  active: SectionId;
  onJump: (id: SectionId) => void;
}) {
  const {
    ref: railRef,
    marker,
    placed,
  } = useSlidingMarker<HTMLElement>(active, "[data-rail-active]");

  // Keep the active entry in view on phones, where the rail is a scroller
  // narrower than its contents — otherwise scrolling down to "Danger zone"
  // moves a marker that is off the right-hand edge of a bar you cannot see.
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on section change
  useEffect(() => {
    const rail = railRef.current;
    if (!rail || rail.scrollWidth <= rail.clientWidth) return;
    rail.querySelector<HTMLElement>("[data-rail-active]")?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [active]);

  return (
    <nav
      ref={railRef}
      aria-label="Settings sections"
      // Sticky in both layouts, so the list is reachable from anywhere on the
      // page: pinned under the floating navbar on phones (where it is a
      // full-bleed bar with its own backdrop, hence the negative margins), and
      // parked beside the content from `sm` up.
      //
      // `rail-fade` fades the right edge on phones to say the strip scrolls;
      // the scrollbar itself is hidden on THIS strip only, scoped with arbitrary
      // variants rather than a global rule so the page's own
      // `scrollbar-gutter: stable` (the Windows fix in globals.css) is untouched.
      className={cn(
        "rail-fade -mx-6 sticky top-[var(--nav-space)] z-30 flex shrink-0 gap-1 overflow-x-auto border-border/60 border-b bg-background/90 px-6 py-2 backdrop-blur-md [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        "sm:top-[var(--chrome-top)] sm:mx-0 sm:w-44 sm:flex-col sm:self-start sm:overflow-visible sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none",
      )}
    >
      {/* One marker for the whole rail, positioned against the rail itself —
        which is why the rail is the offset parent. `relative` is implied by
        `sticky`, so there is nothing extra to add for that. */}
      <span
        aria-hidden
        style={{
          transform: `translate(${marker.x}px, ${marker.y}px)`,
          width: marker.w,
          height: marker.h,
        }}
        className={cn(
          "pointer-events-none absolute top-0 left-0 rounded-lg bg-foreground/[0.07]",
          placed && (marker.snap ? "nav-marker-fade" : "nav-marker"),
          marker.on ? "opacity-100" : "opacity-0",
        )}
      >
        {/* The brand-gradient line rides along inside the marker, on whichever
          edge the list runs along. `background-size` is overridden to the
          element's own box: `.brand-bg` paints at 200%, so a short dash would
          otherwise only ever show the gradient's first stop and read as a flat
          tick in the wrong colour. */}
        <span className="brand-bg absolute inset-x-2 bottom-[3px] h-[2px] rounded-full [background-size:100%_100%] sm:inset-x-auto sm:inset-y-1.5 sm:left-[3px] sm:h-auto sm:w-[2px]" />
      </span>

      {sections.map((section) => {
        const on = active === section.id;
        return (
          <button
            key={section.id}
            type="button"
            data-rail-active={on ? "" : undefined}
            aria-current={on ? "true" : undefined}
            onClick={() => onJump(section.id)}
            className={cn(
              "relative flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-[color,scale] duration-150 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 active:scale-[0.98] active:duration-75",
              on
                ? "font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Glyph
              d={section.icon}
              className={cn(
                "size-[18px] shrink-0 transition-colors",
                // Active sections wear the brand hue — except the danger zone,
                // which wears the app's one red wherever it appears, so the
                // colour keeps meaning the same thing.
                on && (section.danger ? "text-danger" : "text-brand-violet"),
              )}
            />
            <span className="whitespace-nowrap">{section.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

/** One group of settings in the list, and the target its rail entry jumps to. */
function Group({
  section,
  children,
}: {
  section: (typeof SECTIONS)[number];
  children: React.ReactNode;
}) {
  const headingId = `${section.id}-heading`;
  return (
    <section
      id={section.id}
      aria-labelledby={headingId}
      // Breathing room ONLY — not the navbar's height.
      //
      // globals.css already sets `scroll-padding-top: var(--nav-space)` on the
      // document, and scroll-padding (on the scroller) ADDS to scroll-margin (on
      // the target). Naming --nav-space here as well counted the floating bar
      // twice and parked every jump 176px down the screen. So: 1rem of air on
      // desktop, and on phones the ~3rem sticky section rail plus the same 1rem,
      // since that rail is the thing between the navbar and the content there.
      className="scroll-mt-16 sm:scroll-mt-4"
    >
      <div className="flex items-center gap-3">
        <h2
          id={headingId}
          className={cn(
            "font-semibold text-xs uppercase tracking-[0.08em]",
            section.danger ? "text-danger" : "text-muted-foreground",
          )}
        >
          {section.label}
        </h2>
        <span
          aria-hidden
          className={cn(
            "h-px flex-1",
            section.danger ? "bg-danger/25" : "bg-border/60",
          )}
        />
      </div>
      <div className="mt-3 flex flex-col gap-4">{children}</div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Profile settings                                                           */
/* -------------------------------------------------------------------------- */

/**
 * The switches that live as columns on `profiles`, and therefore travel through
 * the unsaved-changes bar together. Anything that is an ACTION rather than a
 * field — setting a page password, enrolling a factor, exporting — happens
 * immediately instead, because "save" is a strange thing to ask of a button
 * whose whole job was to do something.
 */
interface ProfileSettings {
  searchIndexable: boolean;
  pageLive: boolean;
  sensitiveContent: boolean;
  countOwnVisits: boolean;
  timezone: string | null;
  emailProductUpdates: boolean;
  emailTips: boolean;
}

const SETTING_KEYS = [
  "searchIndexable",
  "pageLive",
  "sensitiveContent",
  "countOwnVisits",
  "timezone",
  "emailProductUpdates",
  "emailTips",
] as const;

/** State key → database column. One place, so a rename can't half-happen. */
const SETTING_COLUMNS: Record<keyof ProfileSettings, string> = {
  searchIndexable: "search_indexable",
  pageLive: "page_live",
  sensitiveContent: "sensitive_content",
  countOwnVisits: "count_own_visits",
  timezone: "timezone",
  emailProductUpdates: "email_product_updates",
  emailTips: "email_tips",
};

/** How each change reads in the confirm dialog. */
function settingLabel(
  key: keyof ProfileSettings,
  settings: ProfileSettings,
): string {
  switch (key) {
    case "searchIndexable":
      return settings.searchIndexable
        ? "Show page in search engines"
        : "Hide page from search engines";
    case "pageLive":
      return settings.pageLive ? "Put page back online" : "Take page offline";
    case "sensitiveContent":
      return settings.sensitiveContent
        ? "Add sensitive content warning"
        : "Remove sensitive content warning";
    case "countOwnVisits":
      return settings.countOwnVisits
        ? "Count my own visits"
        : "Stop counting my own visits";
    case "timezone":
      return `Timezone → ${settings.timezone ?? "Automatic"}`;
    case "emailProductUpdates":
      return settings.emailProductUpdates
        ? "Email me product updates"
        : "Stop product update emails";
    case "emailTips":
      return settings.emailTips ? "Email me tips" : "Stop tips emails";
  }
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                       */
/* -------------------------------------------------------------------------- */

export function SettingsClient({
  userId,
  userEmail,
  username,
  providers,
  migrated,
  searchIndexable,
  pageLive,
  sensitiveContent,
  countOwnVisits,
  pagePasswordSet,
  timezone,
  emailProductUpdates,
  emailTips,
}: {
  userId: string;
  userEmail: string;
  username: string | null;
  /** Auth providers this account can sign in with ("email", "google", …). */
  providers: string[];
  /**
   * Whether the database has the page/account settings columns yet. When false
   * the groups that depend on them are simply not rendered — switches that
   * cannot be saved would be worse than none, and this self-heals the moment
   * the migration is pushed.
   */
  migrated: boolean;
  searchIndexable: boolean;
  pageLive: boolean;
  sensitiveContent: boolean;
  countOwnVisits: boolean;
  pagePasswordSet: boolean;
  timezone: string | null;
  emailProductUpdates: boolean;
  emailTips: boolean;
}) {
  const router = useRouter();

  /**
   * An account with no `email` identity signed up with Google and has never set
   * a password. Two things follow: the Password panel is offering to CREATE one
   * rather than change it, and — the part that used to be an outright bug —
   * deletion cannot be confirmed by re-entering a password that does not exist.
   */
  const hasPassword = providers.includes("email");
  const hasGoogle = providers.includes("google");

  // Editable fields — state lives here so the unsaved bar can track dirty.
  const [usernameInput, setUsernameInput] = useState(username ?? "");
  const [usernameFocused, setUsernameFocused] = useState(false);
  const [emailInput, setEmailInput] = useState(userEmail);
  // Baseline for the email diff. Unlike username, an email change only takes
  // effect after the user confirms it by link, so the server prop keeps showing
  // the old address; tracking a local baseline lets the "dirty" state clear on
  // save instead of getting stuck.
  const [baselineEmail, setBaselineEmail] = useState(userEmail);
  // Empty, with a "New password" placeholder. It used to hold a fake row of
  // bullets that was cleared on focus, which needed a line of helper text under
  // the field to explain that the bullets were not your password and an
  // `editingPassword` flag to track whether they had been cleared yet. A field
  // that is simply empty needs neither.
  const [password, setPassword] = useState("");
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  // Turns a checklist red only after a save is attempted with an unmet
  // requirement (mirrors the sign-up form).
  const [pwAttempted, setPwAttempted] = useState(false);
  const [unameAttempted, setUnameAttempted] = useState(false);

  const [settings, setSettings] = useState<ProfileSettings>({
    searchIndexable,
    pageLive,
    sensitiveContent,
    countOwnVisits,
    timezone,
    emailProductUpdates,
    emailTips,
  });
  const [baseline, setBaseline] = useState<ProfileSettings>({
    searchIndexable,
    pageLive,
    sensitiveContent,
    countOwnVisits,
    timezone,
    emailProductUpdates,
    emailTips,
  });
  const set = useCallback(
    <K extends keyof ProfileSettings>(key: K, value: ProfileSettings[K]) =>
      setSettings((s) => ({ ...s, [key]: value })),
    [],
  );

  // Save flow. The outcome shows as a bottom toast (green tick on success, red
  // on failure) rather than inline text, matching the editor's "Saved" pill.
  const [saving, setSaving] = useState(false);
  // `msg` deliberately outlives `msgOpen`: the pill keeps its text while it
  // animates out, instead of emptying for the length of the exit.
  const [msg, setMsg] = useState<Toast | null>(null);
  const [msgOpen, setMsgOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);

  // Immediate actions, each outside the save flow.
  const [signingOutAll, setSigningOutAll] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [linking, setLinking] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [showDeletePassword, setShowDeletePassword] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // "Show What's New on every visit" — a per-device preference stored in
  // localStorage (see ~/lib/whats-new). Read on mount so it never runs on the
  // server, and applied immediately on toggle (no save round-trip).
  const [whatsNewEveryOpen, setWhatsNewEveryOpenState] = useState(false);
  useEffect(() => {
    setWhatsNewEveryOpenState(isEveryOpen());
  }, []);
  const toggleWhatsNewEveryOpen = useCallback((v: boolean) => {
    setEveryOpen(v);
    setWhatsNewEveryOpenState(v);
  }, []);

  /* ---- Derived validity ------------------------------------------------- */

  const usernameTrimmed = usernameInput.trim();
  const usernameChanged = usernameTrimmed !== (username ?? "");
  // The same two rules the sign-up form shows, worded identically so one policy
  // never reads as two.
  const usernameReqs = [
    {
      label: "Between 1 and 30 characters",
      met: usernameTrimmed.length >= 1 && usernameTrimmed.length <= 30,
    },
    {
      label: "Only letters, numbers, and underscores",
      met: /^[A-Za-z0-9_]+$/.test(usernameTrimmed),
    },
  ];
  const usernameOk = usernameReqs.every((r) => r.met);
  // Case-INSENSITIVE, unlike `usernameChanged`. Taken-ness is tested as
  // `lower(username) = lower(candidate)` server-side, so your own row matches
  // your own name in any casing: without this guard, renaming "lifan" to
  // "Lifan" — or simply focusing the field — would report your current username
  // as already taken. A case-only rename is legal (the unique index is on
  // lower(username) and it is the same row), it just has nothing to check.
  const usernameIsMine =
    usernameTrimmed.toLowerCase() === (username ?? "").toLowerCase();
  // The app's shared availability check — the same one sign-up and the promo
  // card ask, so a name never gets three different answers.
  const { avail } = useUsernameAvailability(
    usernameInput,
    usernameOk && !usernameIsMine,
  );

  const emailTrimmed = emailInput.trim();
  const emailChanged =
    emailTrimmed.toLowerCase() !== baselineEmail.toLowerCase();
  // Password rules match the sign-up / reset forms so the policy is consistent
  // across the app.
  const passwordReqs = [
    { label: "At least 8 characters", met: password.length >= 8 },
    { label: "Contains a letter", met: /[A-Za-z]/.test(password) },
    { label: "Contains a number", met: /[0-9]/.test(password) },
  ];
  const passwordOk = passwordReqs.every((r) => r.met);
  const passwordChanged = password.length > 0;

  const changedSettings = SETTING_KEYS.filter(
    (key) => settings[key] !== baseline[key],
  );

  const dirty =
    usernameChanged ||
    emailChanged ||
    passwordChanged ||
    changedSettings.length > 0;

  // What the confirm dialog lists. A bare "are you sure?" is a speed bump; a
  // dialog that names each change is a last chance to catch the one you didn't
  // mean to make — which is the only reason to interrupt a save at all.
  const pendingChanges: string[] = [];
  if (usernameChanged) {
    pendingChanges.push(`Username → stacked.page/${usernameTrimmed}`);
  }
  if (emailChanged) pendingChanges.push(`Email → ${emailTrimmed}`);
  if (passwordChanged) {
    pendingChanges.push(hasPassword ? "New password" : "Set a password");
  }
  for (const key of changedSettings) {
    pendingChanges.push(settingLabel(key, settings));
  }

  /* ---- Scroll spy + jump rail ------------------------------------------- */

  // Groups whose settings the database can't store yet are not rendered, so
  // they must not appear in the rail — or be probed by the scroll-spy — either.
  const sections = SECTIONS.filter((s) => migrated || !MIGRATED_ONLY.has(s.id));

  const [activeSection, setActiveSection] = useState<SectionId>("account");
  // While a smooth jump is in flight the spy stands down, or the sections it
  // scrolls PAST would each claim the rail on the way and the marker would run
  // the whole list before landing.
  const jumpLockRef = useRef(false);
  const jumpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The spy reads this rather than closing over `sections`, so the effect can
  // stay mounted for the life of the page.
  const sectionIdsRef = useRef<SectionId[]>(sections.map((s) => s.id));
  sectionIdsRef.current = sections.map((s) => s.id);

  useEffect(() => {
    let raf = 0;
    const pick = () => {
      raf = 0;
      if (jumpLockRef.current) return;
      const ids = sectionIdsRef.current;
      if (ids.length === 0) return;
      const doc = document.documentElement;
      // At the bottom of the page the last group is the answer even when it is
      // too short to ever reach the probe line — otherwise the final entry in
      // the rail is one you can never scroll to.
      if (window.innerHeight + window.scrollY >= doc.scrollHeight - 4) {
        setActiveSection(ids[ids.length - 1]);
        return;
      }
      // The probe line: a group owns the rail once its heading has crossed the
      // upper third of the viewport. Floored so it stays clear of the navbar on
      // short windows.
      const line = Math.max(window.innerHeight * 0.3, 140);
      let current: SectionId = ids[0];
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= line) current = id;
      }
      setActiveSection(current);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(pick);
    };
    pick();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const jumpTo = useCallback((id: SectionId, smooth = true) => {
    const el = document.getElementById(id);
    if (!el) return;
    setActiveSection(id);
    jumpLockRef.current = true;
    if (jumpTimerRef.current) clearTimeout(jumpTimerRef.current);
    jumpTimerRef.current = setTimeout(() => {
      jumpLockRef.current = false;
    }, JUMP_LOCK_MS);
    // "instant", not "auto": globals.css sets `scroll-behavior: smooth` on the
    // document, and "auto" means "defer to the CSS" — so the mount-time hash
    // jump would animate down from the top of the page instead of simply
    // starting at the section the link named.
    el.scrollIntoView({
      behavior: smooth ? "smooth" : "instant",
      block: "start",
    });
  }, []);

  useEffect(() => {
    return () => {
      if (jumpTimerRef.current) clearTimeout(jumpTimerRef.current);
    };
  }, []);

  // Deep links: `/settings#privacy`, and the What's New dialog's "Don't show
  // again" (which sets the hash directly when already on this page, hence the
  // `hashchange` listener as well as the mount pass).
  useEffect(() => {
    const applyHash = (smooth: boolean) => {
      const raw = window.location.hash.slice(1);
      const id = SECTION_IDS.has(raw)
        ? (raw as SectionId)
        : HASH_ALIASES[raw as keyof typeof HASH_ALIASES];
      if (id) jumpTo(id, smooth);
    };
    applyHash(false);
    const onHash = () => applyHash(true);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [jumpTo]);

  /* ---- Toasts, dialogs, the unsaved bar ---------------------------------- */

  const bar = usePresence(dirty);
  const toast = usePresence(msgOpen);
  // Dialogs fade/pop out rather than disappearing mid-frame, matching the
  // What's New dialog. Held open for EXIT_MS so `animate-fade-out` /
  // `animate-pop-out` can finish (see usePresence).
  const confirmDlg = usePresence(confirming);
  const deleteDlg = usePresence(deleteOpen);

  const showToast = useCallback<ShowToast>((text, error, ms = null) => {
    setMsg({ text, error, ms });
    setMsgOpen(true);
  }, []);

  // Success toasts retire themselves; failures stay until the next action, so a
  // save error can never vanish before it has been read.
  useEffect(() => {
    if (!msgOpen || !msg?.ms) return;
    const t = setTimeout(() => setMsgOpen(false), msg.ms);
    return () => clearTimeout(t);
  }, [msgOpen, msg]);

  // Flash animation for the bar.
  const [flashing, setFlashing] = useState(false);
  const [flashKey, setFlashKey] = useState(0);

  // Sync dirty state with the global unsaved guard so navbar links are blocked.
  const guard = useUnsavedGuard();

  const flash = useCallback(() => {
    setFlashKey((k) => k + 1);
    setFlashing(true);
  }, []);

  useEffect(() => {
    guard.setDirty(dirty);
    guard.setOnBlocked(dirty ? flash : null);
    return () => {
      guard.setDirty(false);
      guard.setOnBlocked(null);
    };
  }, [dirty, guard, flash]);

  function reset() {
    setUsernameInput(username ?? "");
    setEmailInput(baselineEmail);
    setPassword("");
    setShowPassword(false);
    setPwAttempted(false);
    setUnameAttempted(false);
    setSettings(baseline);
    setMsgOpen(false);
    setConfirming(false);
  }

  function handleSave() {
    // Block the save if a checklist isn't satisfied — surface it in red instead
    // of opening the confirm dialog, and scroll to the group that is holding it
    // up. A name we already know is taken or reserved stops here rather than
    // making the round-trip and coming back as an error toast. `checking` is
    // deliberately allowed through: set_username re-validates authoritatively,
    // so a slow check shouldn't block the save.
    if (usernameChanged && (!usernameOk || avail.state === "unavailable")) {
      setUnameAttempted(true);
      jumpTo("account");
      return;
    }
    if (passwordChanged && !passwordOk) {
      setPwAttempted(true);
      jumpTo("security");
      return;
    }
    setConfirming(true);
  }

  // The confirm field in the delete dialog — focused on open so the user can
  // start typing straight away.
  const deleteInputRef = useRef<HTMLInputElement | null>(null);
  // The Save button in the confirm dialog — focused on open so Enter/Space
  // confirms straight away.
  const confirmBtnRef = useRef<HTMLButtonElement | null>(null);

  // A ref holding the latest confirmSave so the keydown listener below can call
  // it without listing an ever-changing closure as a dependency.
  const confirmSaveActionRef = useRef(confirmSave);
  confirmSaveActionRef.current = confirmSave;

  // Enter confirms the save dialog. Escape-to-close and the background-scroll
  // lock are NOT here any more — they moved into <Dialog>, so all four dialogs
  // on this page get them rather than just these two.
  useEffect(() => {
    if (!confirming) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Enter") return;
      // Prevent the default so the auto-focused Save button isn't ALSO natively
      // activated by the same Enter — that double-fired confirmSave.
      e.preventDefault();
      confirmSaveActionRef.current();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [confirming]);

  // Keyed on the dialog's MOUNTED state (`usePresence().value`), not on the
  // open flag. `usePresence` flips `value` from inside an effect, so on the
  // render where `deleteOpen`/`confirming` becomes true the dialog has not
  // mounted yet and the ref is still null — focusing there is a no-op, which is
  // exactly what it silently was. Waiting for the mount is what makes it real.
  useEffect(() => {
    if (deleteDlg.value) deleteInputRef.current?.focus();
  }, [deleteDlg.value]);
  useEffect(() => {
    if (confirmDlg.value) confirmBtnRef.current?.focus();
  }, [confirmDlg.value]);

  async function confirmSave() {
    if (saving) return;
    setSaving(true);
    setMsgOpen(false);
    setConfirming(false);

    try {
      const supabase = createClient();
      if (usernameChanged) {
        await saveUsername(usernameInput);
      }
      if (emailChanged) {
        if (!EMAIL_PATTERN.test(emailTrimmed)) {
          throw new Error("Enter a valid email address.");
        }
        const { error } = await supabase.auth.updateUser({
          email: emailTrimmed,
        });
        if (error) throw new Error(error.message);
      }
      if (passwordChanged) {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw new Error(error.message);
      }
      if (changedSettings.length > 0) {
        const patch: Record<string, unknown> = {};
        for (const key of changedSettings) {
          patch[SETTING_COLUMNS[key]] = settings[key];
        }
        const { error } = await supabase
          .from("profiles")
          .update(patch)
          .eq("id", userId);
        if (error) throw new Error(error.message);
        setBaseline(settings);
      }
      showToast(
        emailChanged
          ? "Saved. Check your new email inbox for a link to confirm the change."
          : "Changes saved.",
        false,
        // The email variant carries an instruction, so it holds long enough to
        // read; the bare confirmation just blinks past like the editor's.
        emailChanged ? 6000 : 2200,
      );
      setPassword("");
      setShowPassword(false);
      setPwAttempted(false);
      setUnameAttempted(false);
      if (emailChanged) setBaselineEmail(emailTrimmed);
      router.refresh();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Couldn't save changes.",
        true,
      );
      // The steps run in sequence and are not a transaction, so a failure at
      // step 3 can leave steps 1-2 already committed. Re-read, or the page goes
      // on rendering the pre-save props — showing the OLD username underneath a
      // rename that actually succeeded.
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function signOutEverywhere() {
    setSigningOutAll(true);
    setMsgOpen(false);
    try {
      const { error } = await createClient().auth.signOut({ scope: "global" });
      if (error) throw new Error(error.message);
      router.push("/");
      router.refresh();
    } catch (err) {
      // Recover the button and surface the failure instead of hanging on
      // "Signing out…" forever when the network / session call rejects.
      showToast(
        err instanceof Error
          ? err.message
          : "Couldn't sign out. Please try again.",
        true,
      );
      setSigningOutAll(false);
    }
  }

  async function exportData() {
    if (exporting) return;
    setExporting(true);
    setMsgOpen(false);
    try {
      const data = await buildAccountExport();
      downloadJson(`stacked-${username ?? "account"}.json`, data);
      showToast("Your data is downloading.", false, 2600);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Couldn't build your export.",
        true,
      );
    } finally {
      setExporting(false);
    }
  }

  async function connectGoogle() {
    if (linking) return;
    setLinking(true);
    setMsgOpen(false);
    try {
      const { error } = await createClient().auth.linkIdentity({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/settings` },
      });
      if (error) throw new Error(error.message);
      // On success the browser leaves for Google, so nothing after this runs.
    } catch (err) {
      showToast(
        err instanceof Error
          ? err.message
          : "Couldn't connect Google right now.",
        true,
      );
      setLinking(false);
    }
  }

  async function disconnectGoogle() {
    if (linking) return;
    setLinking(true);
    setMsgOpen(false);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.getUserIdentities();
      if (error) throw new Error(error.message);
      const identity = data.identities.find((i) => i.provider === "google");
      if (!identity) throw new Error("Google isn't connected.");
      const { error: unlinkError } =
        await supabase.auth.unlinkIdentity(identity);
      if (unlinkError) throw new Error(unlinkError.message);
      showToast("Google disconnected.", false, 2600);
      router.refresh();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Couldn't disconnect Google.",
        true,
      );
    } finally {
      setLinking(false);
    }
  }

  /* ---- Delete account ---------------------------------------------------- */

  /**
   * What the delete dialog asks for. A password-backed account re-authenticates
   * (the strongest confirmation available); a Google-only account has no
   * password to re-enter, so it types its own username instead — the pattern
   * GitHub uses, and a real fix rather than a workaround: before this, deletion
   * for those accounts always failed with "Incorrect password" for a password
   * that had never existed.
   */
  const deleteByPassword = hasPassword;
  const deleteTarget = username ?? "DELETE";
  const deleteReady = deleteByPassword
    ? deletePassword.length > 0
    : deleteConfirmName.trim().toLowerCase() === deleteTarget.toLowerCase();

  function openDelete() {
    setDeletePassword("");
    setDeleteConfirmName("");
    setShowDeletePassword(false);
    setDeleteError(null);
    setDeleteOpen(true);
  }

  async function confirmDelete() {
    if (!deleteReady || deleting) return;
    setDeleting(true);
    setDeleteError(null);
    setMsgOpen(false);
    try {
      const supabase = createClient();
      if (deleteByPassword) {
        // Re-authenticate with the typed password before the irreversible
        // delete. A successful sign-in on the current session just confirms the
        // password; a failure means it was wrong.
        const { error: authError } = await supabase.auth.signInWithPassword({
          email: userEmail,
          password: deletePassword,
        });
        if (authError) {
          setDeleteError("Incorrect password. Please try again.");
          setDeleting(false);
          return;
        }
      }
      const { error } = await supabase.rpc("delete_own_account");
      if (error) throw new Error(error.message);
      // Clear the now-invalid local session, then leave the app.
      await supabase.auth.signOut();
      router.push("/");
      router.refresh();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Couldn't delete account.",
        true,
      );
      setDeleting(false);
      setDeleteOpen(false);
    }
  }

  /* ---- Render ------------------------------------------------------------ */

  const version = CHANGELOG[0]?.title ?? null;

  return (
    // `.brand-accent` scopes the brand purple to this page: every Input, Button
    // and rail entry picks up the violet focus ring through the `ring-ring/*`
    // utilities they already carry, and a switched-on Toggle wears the hue via
    // `.sec-on` — the same mechanism the Studio uses. See globals.css.
    <main className="brand-accent mx-auto w-full max-w-4xl flex-1 px-6 pt-10 pb-28">
      <header>
        <h1 className="font-semibold text-2xl tracking-tight">Settings</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          {username ? (
            <>
              Your account and how{" "}
              <span className="font-mono text-foreground">
                stacked.page/{username}
              </span>{" "}
              behaves.
            </>
          ) : (
            "Your account and how your page behaves."
          )}
        </p>
      </header>

      <div className="mt-8 flex flex-col gap-6 sm:flex-row sm:gap-10">
        <SectionRail
          sections={sections}
          active={activeSection}
          onJump={jumpTo}
        />

        <div className="flex min-w-0 flex-1 flex-col gap-10">
          {/* ---- Account ---- */}
          <Group section={BY_ID.account}>
            <Panel
              icon={<Glyph d={GLYPH.at} />}
              title="Username"
              titleId="settings-username-title"
              description="This is your page's address."
              delay={0}
            >
              {/* The same claim field as the landing hero and the promo card,
                  prefix and cycling purple ring included -- this and those are
                  the one place in the app where you name your page, so they are
                  one control.

                  `--claim-fill` is the field's opaque interior (globals.css).
                  Its default is `--card`, which is exactly the surface this
                  Panel is made of, so on the landing page the field reads as
                  inset and here it would vanish into the card. Matching the
                  neighbouring `<Input>`'s computed fill — `bg-input/30` over
                  `--card` — keeps the two looking like one family of control.

                  A <label> rather than a <div>: the `stacked.page/` prefix is
                  inside the field's box, so clicking it has to put the caret in
                  the input — as a plain span it swallowed the click and the
                  field stayed empty of focus. */}
              <label
                htmlFor="settings-username"
                className="claim-field flex h-9 max-w-xs cursor-text items-center rounded-lg pl-3"
                style={
                  {
                    "--claim-fill":
                      "color-mix(in oklab, var(--input) 30%, var(--card))",
                  } as React.CSSProperties
                }
              >
                <span
                  className="no-zoom shrink-0 select-none font-mono text-muted-foreground text-sm"
                  style={{ "--no-zoom-fs": "0.875rem" } as React.CSSProperties}
                >
                  stacked.page/
                </span>
                <input
                  id="settings-username"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  onFocus={() => setUsernameFocused(true)}
                  onBlur={() => setUsernameFocused(false)}
                  autoComplete="off"
                  spellCheck={false}
                  // See home-hero.tsx's claim field: mobile keyboards
                  // capitalize the first letter, and usernames are
                  // case-preserving, so this is the difference between "kaze"
                  // and "Kaze".
                  autoCapitalize="none"
                  autoCorrect="off"
                  maxLength={30}
                  aria-labelledby="settings-username-title"
                  // No `aria-describedby`: the availability read-out is absent
                  // whenever there is nothing to report (the common case — your
                  // own unchanged name), and pointing at an id that is not in
                  // the document describes nothing. It carries `aria-live`, so
                  // a verdict is announced when it actually arrives.
                  className="no-zoom min-w-0 flex-1 bg-transparent py-2 pr-3 font-mono text-foreground text-sm outline-none"
                  style={{ "--no-zoom-fs": "0.875rem" } as React.CSSProperties}
                />
              </label>

              {/* Same live checklist and same availability dot as the sign-up
                  form. The checklist shows while the field is focused OR while
                  the typed name differs from the saved one, so it stays up
                  after you tab away with an unfinished name instead of hiding
                  the reason the save will fail. */}
              <Collapse open={usernameFocused || usernameChanged}>
                <div className="mt-2">
                  <ul className="flex flex-col gap-1">
                    {usernameReqs.map((r) => (
                      <Requirement
                        key={r.label}
                        met={r.met}
                        attempted={unameAttempted}
                      >
                        {r.label}
                      </Requirement>
                    ))}
                  </ul>
                  <UsernameAvailability avail={avail} show={usernameOk} />
                </div>
              </Collapse>
            </Panel>

            <Panel
              icon={<Glyph d={GLYPH.mail} />}
              title="Email"
              titleId="settings-email-title"
              info="We'll send a confirmation link to the new address. Your email stays the same until you open it."
              delay={45}
            >
              <Input
                id="settings-email"
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                aria-labelledby="settings-email-title"
                autoComplete="email"
                spellCheck={false}
                className="max-w-xs"
              />
            </Panel>

            <Panel
              icon={<Glyph d={GLYPH.link} />}
              title="Connected accounts"
              info="Connecting Google lets you sign in with one tap. You can't disconnect your only way of signing in."
              delay={90}
            >
              <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-input/20 px-3 py-2.5">
                <span className="flex min-w-0 items-center gap-2.5">
                  <GoogleMark className="size-4 shrink-0" />
                  <span className="truncate text-sm">Google</span>
                </span>
                {hasGoogle ? (
                  <span className="flex shrink-0 items-center gap-2">
                    <Chip tone="on">Connected</Chip>
                    {/* Never offered when Google is the only identity — Supabase
                        refuses to unlink the last one, and a button whose only
                        outcome is an error is worse than no button. */}
                    {hasPassword ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={disconnectGoogle}
                        disabled={linking}
                      >
                        Disconnect
                      </Button>
                    ) : null}
                  </span>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={connectGoogle}
                    disabled={linking}
                  >
                    {linking ? "Connecting…" : "Connect"}
                  </Button>
                )}
              </div>
            </Panel>
          </Group>

          {/* ---- Security ---- */}
          <Group section={BY_ID.security}>
            <Panel
              icon={<Glyph d={GLYPH.lock} />}
              title="Password"
              titleId="settings-password-title"
              description={
                hasPassword
                  ? undefined
                  : "You sign in with Google. Set a password to also sign in with your email."
              }
              delay={135}
            >
              <div className="relative max-w-xs">
                <Input
                  id="settings-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  placeholder={
                    hasPassword ? "New password" : "Create a password"
                  }
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-labelledby="settings-password-title"
                  autoComplete="new-password"
                  minLength={8}
                  className="pr-10"
                />
                <PasswordToggle
                  visible={showPassword}
                  onToggle={() => setShowPassword((v: boolean) => !v)}
                />
              </div>
              {/* The rules only exist while you're writing one, so they are the
                  only thing under the field — there is no permanent hint to
                  trade places with any more. */}
              <Collapse open={passwordFocused || passwordChanged}>
                <ul className="mt-2 flex flex-col gap-1">
                  {passwordReqs.map((r) => (
                    <Requirement
                      key={r.label}
                      met={r.met}
                      attempted={pwAttempted}
                    >
                      {r.label}
                    </Requirement>
                  ))}
                </ul>
              </Collapse>
            </Panel>

            <TwoFactorPanel onToast={showToast} delay={180} />

            <Panel
              icon={<Glyph d={GLYPH.devices} />}
              title="Active sessions"
              info="Signs you out of every browser and device, including this one. Useful if you've lost a device or signed in somewhere you don't trust."
              delay={225}
            >
              <Button
                variant="danger-outline"
                size="sm"
                className="w-fit"
                onClick={signOutEverywhere}
                disabled={signingOutAll}
              >
                {signingOutAll ? "Signing out…" : "Sign out everywhere"}
              </Button>
            </Panel>
          </Group>

          {/* ---- Page ---- */}
          <Group section={BY_ID.page}>
            {migrated ? (
              <SwitchPanel
                icon={<Glyph d={GLYPH.window} />}
                id="settings-page-live"
                title="My page is live"
                info="Turn this off to take your page offline without deleting it. Visitors see a short 'not available' notice, your username stays yours, and you can still see and edit the page."
                checked={settings.pageLive}
                onChange={(v) => set("pageLive", v)}
                delay={270}
              />
            ) : null}

            {migrated ? (
              <PagePasswordPanel
                initiallySet={pagePasswordSet}
                onToast={showToast}
                delay={315}
              />
            ) : null}

            {migrated ? (
              <SwitchPanel
                icon={<Glyph d={GLYPH.eyeOff} />}
                id="settings-sensitive"
                title="Sensitive content warning"
                info="Visitors confirm they want to continue before your page loads. It's a courtesy warning, not an age check — nothing is verified."
                checked={settings.sensitiveContent}
                onChange={(v) => set("sensitiveContent", v)}
                delay={360}
              />
            ) : null}

            {/* Not gated: `search_indexable` has existed since 20260729192825. */}
            <SwitchPanel
              icon={<Glyph d={GLYPH.globe} />}
              id="settings-indexable"
              title="Show my page in search engines"
              info="When off, your page asks search engines not to index it. Anyone with your link can still open it."
              checked={settings.searchIndexable}
              onChange={(v) => set("searchIndexable", v)}
              delay={405}
            />
          </Group>

          {/* ---- Privacy ---- */}
          <Group section={BY_ID.privacy}>
            {migrated ? (
              <SwitchPanel
                icon={<Glyph d={GLYPH.chart} />}
                id="settings-count-own"
                title="Count my own visits"
                info="Off by default, so refreshing your own page doesn't inflate your numbers. It can only recognise you while you're signed in on that browser — opening your page signed out still counts."
                checked={settings.countOwnVisits}
                onChange={(v) => set("countOwnVisits", v)}
                delay={450}
              />
            ) : null}

            {/* Not gated: the export names no migration-only column. */}
            <Panel
              icon={<Glyph d={GLYPH.download} />}
              title="Download my data"
              info="A JSON file with your account, your page and its links, and your analytics events."
              delay={495}
            >
              <Button
                variant="outline"
                size="sm"
                className="w-fit"
                onClick={exportData}
                disabled={exporting}
              >
                {exporting ? "Preparing…" : "Download JSON"}
              </Button>
            </Panel>
          </Group>

          {/* ---- Notifications ---- */}
          {migrated ? (
            <Group section={BY_ID.notifications}>
              <SwitchPanel
                icon={<Glyph d={GLYPH.bell} />}
                id="settings-email-updates"
                title="Product updates"
                info="The same release notes as the What's New dialog, by email when something notable ships."
                checked={settings.emailProductUpdates}
                onChange={(v) => set("emailProductUpdates", v)}
                delay={540}
              />

              <SwitchPanel
                icon={<Glyph d={GLYPH.spark} />}
                id="settings-email-tips"
                title="Tips for growing your page"
                info="Occasional, and never more than once a month."
                checked={settings.emailTips}
                onChange={(v) => set("emailTips", v)}
                delay={585}
              />

              <Panel
                icon={<Glyph d={GLYPH.shieldCheck} />}
                title="Security emails"
                aside={<Chip>Always on</Chip>}
                info="Password changes, new sign-ins, and email address changes. These can't be turned off — they're how you find out if someone else gets into your account."
                delay={630}
              />
            </Group>
          ) : null}

          {/* ---- Preferences ---- */}
          <Group section={BY_ID.preferences}>
            {migrated ? (
              <TimezonePanel
                value={settings.timezone}
                onChange={(v) => set("timezone", v)}
                delay={675}
              />
            ) : null}

            <SwitchPanel
              icon={<Glyph d={GLYPH.megaphone} />}
              id="settings-whatsnew"
              title="Show What's New on every visit"
              info={
                <>
                  Normally it appears once per release. You can always reopen it
                  from the "What's New" link in the footer.
                </>
              }
              checked={whatsNewEveryOpen}
              onChange={toggleWhatsNewEveryOpen}
              delay={720}
            />
          </Group>

          {/* ---- Help ---- */}
          <Group section={BY_ID.help}>
            <Panel
              icon={<Glyph d={GLYPH.chat} />}
              title="Contact support"
              info="Bugs, questions, account trouble, or anything you'd like the app to do. We read everything."
              delay={765}
            >
              <Button variant="outline" size="sm" className="w-fit" asChild>
                <Link href="/contact">Get in touch</Link>
              </Button>
            </Panel>

            <Panel
              icon={<Glyph d={GLYPH.tag} />}
              title="Version"
              aside={version ? <Chip>{version}</Chip> : undefined}
              delay={810}
            >
              {/* `outline`, matching "Get in touch" directly above it. Both are
                  the same kind of low-stakes "take me to it" action, and two
                  adjacent panels in one group answering that with two different
                  button weights reads as an accident. */}
              <Button
                variant="outline"
                size="sm"
                className="w-fit"
                onClick={openWhatsNew}
              >
                See what's new
              </Button>
            </Panel>
          </Group>

          {/* ---- Danger zone ---- */}
          <Group section={BY_ID.danger}>
            <Panel
              icon={<Glyph d={GLYPH.trash} />}
              title="Delete account"
              description="Permanently deletes your account, your page, its links, and all of its analytics. This can't be undone."
              info={
                deleteByPassword
                  ? "You'll be asked for your password to confirm."
                  : "You'll be asked to type your username to confirm."
              }
              tone="danger"
              delay={855}
            >
              <Button
                variant="danger-outline"
                size="sm"
                className="w-fit"
                onClick={openDelete}
              >
                Delete account
              </Button>
            </Panel>
          </Group>
        </div>
      </div>

      {/* Bottom pill stack — the save toast sits above the unsaved-changes bar
          so the two never land on top of each other when a save fails and the
          bar stays put. Same position, motion, and shape as the editor's. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(1.5rem+env(safe-area-inset-bottom))] z-40 flex flex-col items-center gap-2 px-4">
        {toast.value && msg ? (
          <div
            className={cn(
              "pointer-events-auto flex max-w-sm items-center gap-2 rounded-lg border bg-background px-4 py-2 text-center font-medium text-sm shadow-lg",
              msg.error
                ? "border-danger/35 text-danger"
                : "border-success/35 text-foreground",
              toast.visible ? "animate-slide-up" : "animate-slide-down",
            )}
          >
            {msg.error ? null : <ToastCheck />}
            {msg.text}
          </div>
        ) : null}

        {bar.value ? (
          // The slide and the flash have to live on separate elements: both are
          // `animation`, so one would cancel the other on a single node.
          <div
            className={bar.visible ? "animate-slide-up" : "animate-slide-down"}
          >
            <div
              key={flashKey}
              onAnimationEnd={() => setFlashing(false)}
              className={cn(
                "pointer-events-auto flex items-center gap-4 rounded-lg border border-warning/35 bg-background px-4 py-2 shadow-lg",
                flashing && "animate-flash",
              )}
            >
              <span className="flex items-center gap-2 whitespace-nowrap text-muted-foreground text-sm">
                <span
                  aria-hidden
                  className={cn(
                    "size-1.5 shrink-0 rounded-full bg-warning",
                    saving && "animate-pulse",
                  )}
                />
                {/* The full sentence plus both buttons overflows a 375px phone. */}
                <span className="sm:hidden">Unsaved changes</span>
                <span className="hidden sm:inline">
                  You have unsaved changes
                </span>
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={reset}
                  disabled={saving}
                >
                  Reset
                </Button>
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  {saving ? "Saving…" : "Save"}
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Confirm dialog */}
      <Dialog
        open={confirmDlg.value}
        visible={confirmDlg.visible}
        titleId="confirm-dialog-title"
        title="Save changes"
        onClose={() => setConfirming(false)}
      >
        <ul className="mt-3 flex flex-col gap-1.5">
          {pendingChanges.map((change) => (
            <li
              key={change}
              className="flex items-start gap-2 text-muted-foreground text-sm"
            >
              <span
                aria-hidden
                className="mt-[7px] size-1.5 shrink-0 rounded-full bg-brand-violet"
              />
              <span className="min-w-0 break-words">{change}</span>
            </li>
          ))}
        </ul>
        <div className="mt-5 flex justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfirming(false)}
          >
            Cancel
          </Button>
          <Button ref={confirmBtnRef} size="sm" onClick={confirmSave}>
            Save
          </Button>
        </div>
      </Dialog>

      {/* Delete-account dialog */}
      <Dialog
        open={deleteDlg.value}
        visible={deleteDlg.visible}
        titleId="delete-dialog-title"
        title="Delete account"
        onClose={() => !deleting && setDeleteOpen(false)}
      >
        <p className="mt-2 text-muted-foreground text-sm">
          This permanently deletes your account and page. This can't be undone.{" "}
          {deleteByPassword ? (
            "Enter your password to confirm."
          ) : (
            <>
              Type{" "}
              <span className="font-mono text-foreground">{deleteTarget}</span>{" "}
              to confirm.
            </>
          )}
        </p>
        <div className="relative mt-3">
          {deleteByPassword ? (
            <>
              <Input
                ref={deleteInputRef}
                type={showDeletePassword ? "text" : "password"}
                value={deletePassword}
                onChange={(e) => {
                  setDeletePassword(e.target.value);
                  if (deleteError) setDeleteError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && deleteReady && !deleting) {
                    confirmDelete();
                  }
                }}
                autoComplete="current-password"
                spellCheck={false}
                className="pr-10"
                aria-label="Enter your password to confirm account deletion"
                aria-invalid={deleteError ? true : undefined}
              />
              <PasswordToggle
                visible={showDeletePassword}
                onToggle={() => setShowDeletePassword((v) => !v)}
              />
            </>
          ) : (
            <Input
              ref={deleteInputRef}
              value={deleteConfirmName}
              onChange={(e) => {
                setDeleteConfirmName(e.target.value);
                if (deleteError) setDeleteError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && deleteReady && !deleting) {
                  confirmDelete();
                }
              }}
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder={deleteTarget}
              className="font-mono"
              aria-label={`Type ${deleteTarget} to confirm account deletion`}
            />
          )}
        </div>
        {deleteError ? (
          <p className="mt-2 animate-slide-up text-danger text-sm">
            {deleteError}
          </p>
        ) : null}
        <div className="mt-4 flex justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDeleteOpen(false)}
            disabled={deleting}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={confirmDelete}
            disabled={!deleteReady || deleting}
          >
            {deleting ? "Deleting…" : "Delete account"}
          </Button>
        </div>
      </Dialog>
    </main>
  );
}

/* -------------------------------------------------------------------------- */
/*  Two-factor authentication                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Enrol, and un-enrol, an authenticator app.
 *
 * Owns its own state rather than lifting it, because none of it is a "field":
 * enrolling is a three-step conversation with Supabase (enrol → challenge →
 * verify) whose intermediate factor is real server state, and putting that
 * behind the page's Save button would leave a half-enrolled factor sitting on
 * the account until somebody pressed it.
 */
function TwoFactorPanel({
  onToast,
  delay,
}: {
  onToast: ShowToast;
  delay: number;
}) {
  const router = useRouter();
  // `null` is "we don't know yet" — see refresh(). It must never render as OFF.
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [disabling, setDisabling] = useState(false);
  const [confirmOff, setConfirmOff] = useState(false);
  const dlg = usePresence(open);
  const offDlg = usePresence(confirmOff);

  const refresh = useCallback(async () => {
    try {
      const { data, error: listError } =
        await createClient().auth.mfa.listFactors();
      if (listError) throw new Error(listError.message);
      setEnabled((data?.totp ?? []).some((f) => f.status === "verified"));
    } catch {
      // Unknown rather than false — an unanswerable check must not render as
      // "two-factor is off", which would be a lie about the account's security.
      setEnabled(null);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /**
   * Drop a factor this dialog created but never verified.
   *
   * Every abandoned set-up leaves an `unverified` factor on the account, and
   * Supabase counts those against the factor limit — so without this, opening
   * and closing this dialog a few times eventually makes enrolment fail with a
   * limit error and no visible cause.
   */
  const discardPending = useCallback(async (id: string | null) => {
    if (!id) return;
    try {
      await createClient().auth.mfa.unenroll({ factorId: id });
    } catch {
      // Best effort; a stray unverified factor is swept on the next open.
    }
  }, []);

  async function startEnroll() {
    setBusy(true);
    setError(null);
    setCode("");
    try {
      const supabase = createClient();
      // Clear out anything left behind by a previous abandoned attempt before
      // asking for a new factor.
      const { data: existing } = await supabase.auth.mfa.listFactors();
      for (const factor of existing?.all ?? []) {
        if (factor.status === "unverified") {
          await supabase.auth.mfa.unenroll({ factorId: factor.id });
        }
      }

      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
      });
      if (enrollError) throw new Error(enrollError.message);
      const raw = data.totp.qr_code;
      // Supabase has returned this both as a data URI and as bare SVG markup
      // across versions. Normalise, rather than trusting one of the two.
      setQr(
        raw.startsWith("data:")
          ? raw
          : `data:image/svg+xml;utf8,${encodeURIComponent(raw)}`,
      );
      setSecret(data.totp.secret);
      setFactorId(data.id);
      setOpen(true);
    } catch (err) {
      onToast(
        err instanceof Error ? err.message : "Couldn't start set-up.",
        true,
      );
    } finally {
      setBusy(false);
    }
  }

  async function verify(value: string) {
    if (!factorId || busy || value.length !== 6) return;
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: challenge, error: challengeError } =
        await supabase.auth.mfa.challenge({ factorId });
      if (challengeError) throw new Error(challengeError.message);
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code: value,
      });
      if (verifyError) {
        setError("That code isn't right. Try the current one.");
        setCode("");
        return;
      }
      setOpen(false);
      setFactorId(null);
      setEnabled(true);
      onToast("Two-factor authentication is on.", false, 3000);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't verify that.");
    } finally {
      setBusy(false);
    }
  }

  // Six digits is the whole code, so there is nothing left to press a button
  // for. Matches the sign-in challenge screen — including going through a ref,
  // so the effect's only real dependency is the code and not every render that
  // touches state `verify` closes over.
  const verifyRef = useRef(verify);
  verifyRef.current = verify;
  useEffect(() => {
    if (code.length === 6) verifyRef.current(code);
  }, [code]);

  function cancel() {
    setOpen(false);
    setError(null);
    setCode("");
    discardPending(factorId);
    setFactorId(null);
  }

  async function disable() {
    if (disabling) return;
    setDisabling(true);
    try {
      const supabase = createClient();
      const { data, error: listError } = await supabase.auth.mfa.listFactors();
      if (listError) throw new Error(listError.message);
      for (const factor of data?.all ?? []) {
        const { error: unenrollError } = await supabase.auth.mfa.unenroll({
          factorId: factor.id,
        });
        if (unenrollError) throw new Error(unenrollError.message);
      }
      // Load-bearing, not tidiness. `unenroll` does not rewrite the stored
      // session, and the route gate reads its factor list from exactly that
      // stored copy (see ~/lib/mfa.server). Without this refresh the cookie
      // still says "this account has a verified factor", so the very next
      // authenticated page bounces to /auth/mfa — which then finds nothing to
      // challenge and bounces back. Turning 2FA off would lock you out.
      await supabase.auth.refreshSession();
      setEnabled(false);
      setConfirmOff(false);
      onToast("Two-factor authentication is off.", false, 3000);
      router.refresh();
    } catch (err) {
      onToast(
        err instanceof Error ? err.message : "Couldn't turn that off.",
        true,
      );
    } finally {
      setDisabling(false);
    }
  }

  return (
    <>
      <Panel
        icon={<Glyph d={GLYPH.shieldCheck} />}
        title="Two-factor authentication"
        aside={enabled ? <Chip tone="on">On</Chip> : undefined}
        description={
          enabled
            ? "Keep your authenticator app backed up. Without it — and without a code — you'll need support to get back in."
            : undefined
        }
        info="After your password, signing in also asks for a 6-digit code from an authenticator app like 1Password, Authy, or Google Authenticator."
        delay={delay}
      >
        {enabled ? (
          // Confirmed, not immediate. This button lands exactly where "Set up"
          // was a moment earlier, and one stray click on it silently strips the
          // account's second factor — a heavier consequence than anything else
          // on this page that DOES ask (a page password opens a dialog; account
          // deletion wants your password typed out).
          <Button
            variant="danger-outline"
            size="sm"
            className="w-fit"
            onClick={() => setConfirmOff(true)}
            disabled={disabling}
          >
            Turn off
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="w-fit"
            onClick={startEnroll}
            disabled={busy || enabled === null}
          >
            {busy ? "Starting…" : "Set up"}
          </Button>
        )}
      </Panel>

      {/* `!busy` on the close path, matching the Cancel button's own guard. The
          backdrop is wired straight to onClose, so without this a click on it
          mid-verification ran cancel() -> unenroll on a factor whose verify was
          still in flight: the DELETE could land AFTER the verify succeeded,
          leaving the panel reporting 2FA as On over an account with no factor. */}
      <Dialog
        open={dlg.value}
        visible={dlg.visible}
        titleId="mfa-dialog-title"
        title="Set up two-factor"
        onClose={() => !busy && cancel()}
      >
        <p className="mt-2 text-muted-foreground text-sm">
          Scan this with your authenticator app, then enter the code it shows.
        </p>
        {qr ? (
          // A white plate under the code: QR readers need the light modules to
          // actually be light, and Supabase's SVG paints them transparent —
          // straight onto a near-black popover that is a code no phone can read.
          <div className="mt-4 flex justify-center">
            {/* biome-ignore lint/performance/noImgElement: a data: URI, not a remote asset */}
            <img
              src={qr}
              alt="Two-factor set-up QR code"
              className="size-44 rounded-lg bg-white p-2"
            />
          </div>
        ) : null}
        {secret ? (
          <div className="mt-3 flex flex-col gap-1">
            <p className="text-muted-foreground text-xs">
              Or enter this key by hand:
            </p>
            <code className="select-all break-all rounded-md border border-border bg-input/30 px-2.5 py-2 font-mono text-foreground text-xs">
              {secret}
            </code>
          </div>
        ) : null}
        <div className="mt-4">
          <CodeInput
            value={code}
            onChange={(v) => {
              setCode(v);
              if (error) setError(null);
            }}
            disabled={busy}
            invalid={!!error}
            label="Code from your authenticator app"
          />
        </div>
        {error ? (
          <p
            aria-live="polite"
            className="mt-2 animate-slide-up text-danger text-sm"
          >
            {error}
          </p>
        ) : null}
        <div className="mt-4 flex justify-end">
          <Button variant="ghost" size="sm" onClick={cancel} disabled={busy}>
            Cancel
          </Button>
        </div>
      </Dialog>

      <Dialog
        open={offDlg.value}
        visible={offDlg.visible}
        titleId="mfa-off-dialog-title"
        title="Turn off two-factor?"
        onClose={() => !disabling && setConfirmOff(false)}
      >
        <p className="mt-2 text-muted-foreground text-sm">
          Signing in will only need your password again. You can turn it back on
          whenever you like.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfirmOff(false)}
            disabled={disabling}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={disable}
            disabled={disabling}
          >
            {disabling ? "Turning off…" : "Turn off"}
          </Button>
        </div>
      </Dialog>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*  Page password                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Set, change, or remove the password visitors need to open the page.
 *
 * Immediate rather than part of the save bar, for the same reason as 2FA: the
 * value is hashed server-side by `set_page_password` and is never a field this
 * page holds, so there is nothing for Save to have been holding on to.
 */
function PagePasswordPanel({
  initiallySet,
  onToast,
  delay,
}: {
  initiallySet: boolean;
  onToast: ShowToast;
  delay: number;
}) {
  const router = useRouter();
  const [isSet, setIsSet] = useState(initiallySet);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dlg = usePresence(open);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Matches the bound `set_page_password` enforces, so the failure is shown
  // here rather than arriving as a database error.
  const ok = value.trim().length >= 6;

  async function save() {
    if (!ok || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { error: rpcError } = await createClient().rpc(
        "set_page_password",
        { new_password: value.trim() },
      );
      if (rpcError) throw new Error(rpcError.message);
      setIsSet(true);
      setOpen(false);
      setValue("");
      onToast("Your page is now password-protected.", false, 3000);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Couldn't set that password.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (busy) return;
    setBusy(true);
    try {
      const { error: rpcError } = await createClient().rpc(
        "set_page_password",
        { new_password: null },
      );
      if (rpcError) throw new Error(rpcError.message);
      setIsSet(false);
      onToast("Page password removed.", false, 3000);
      router.refresh();
    } catch (err) {
      onToast(
        err instanceof Error ? err.message : "Couldn't remove the password.",
        true,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Panel
        icon={<Glyph d={GLYPH.lock} />}
        title="Page password"
        aside={isSet ? <Chip tone="on">On</Chip> : <Chip>Not set</Chip>}
        info="Visitors enter this before they can see your page. It's one shared password — anyone you give it to can open the page. Changing it locks out everyone who used the old one."
        delay={delay}
      >
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="w-fit"
            onClick={() => {
              setValue("");
              setError(null);
              setOpen(true);
            }}
            disabled={busy}
          >
            {isSet ? "Change password" : "Set a password"}
          </Button>
          {isSet ? (
            <Button
              variant="danger-outline"
              size="sm"
              className="w-fit"
              onClick={remove}
              disabled={busy}
            >
              Remove
            </Button>
          ) : null}
        </div>
      </Panel>

      <Dialog
        open={dlg.value}
        visible={dlg.visible}
        titleId="page-password-dialog-title"
        title={isSet ? "Change page password" : "Set page password"}
        onClose={() => !busy && setOpen(false)}
      >
        <p className="mt-2 text-muted-foreground text-sm">
          Visitors will need this to open your page. Share it wherever you share
          the link.
        </p>
        <div className="relative mt-3">
          <Input
            ref={inputRef}
            type={show ? "text" : "password"}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && ok && !busy) save();
            }}
            placeholder="At least 6 characters"
            autoComplete="off"
            spellCheck={false}
            maxLength={128}
            aria-label="Page password"
            aria-invalid={error ? true : undefined}
            className="pr-10"
          />
          <PasswordToggle visible={show} onToggle={() => setShow((v) => !v)} />
        </div>
        {error ? (
          <p
            aria-live="polite"
            className="mt-2 animate-slide-up text-danger text-sm"
          >
            {error}
          </p>
        ) : null}
        <div className="mt-4 flex justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setOpen(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button size="sm" onClick={save} disabled={!ok || busy}>
            {busy ? "Saving…" : "Save password"}
          </Button>
        </div>
      </Dialog>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*  Timezone                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Which clock the dashboard's charts are drawn against.
 *
 * The zone list comes from `Intl.supportedValuesOf("timeZone")` at render time
 * rather than a bundled table — the browser already ships the IANA database,
 * and a hand-kept list of 400 zone names would be stale by the next release.
 * Null means "follow this browser", which is what the dashboard did before this
 * setting existed and is still the right answer for most people.
 */
function TimezonePanel({
  value,
  onChange,
  delay,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  delay: number;
}) {
  const [zones, setZones] = useState<string[]>([]);
  const [detected, setDetected] = useState<string | null>(null);

  useEffect(() => {
    try {
      setDetected(Intl.DateTimeFormat().resolvedOptions().timeZone ?? null);
    } catch {
      setDetected(null);
    }
    try {
      // Not in every engine (older Safari); the select then holds whatever is
      // already saved plus Automatic, which still lets you get back to default.
      const supported = (
        Intl as unknown as { supportedValuesOf?: (k: string) => string[] }
      ).supportedValuesOf?.("timeZone");
      setZones(supported ?? []);
    } catch {
      setZones([]);
    }
  }, []);

  // A saved zone this browser doesn't list must still appear, or opening
  // settings on a different device would silently offer to change it.
  const options = value && !zones.includes(value) ? [value, ...zones] : zones;

  return (
    <Panel
      icon={<Glyph d={GLYPH.clock} />}
      title="Timezone"
      titleId="settings-timezone-title"
      info="Used for your dashboard's charts — which days and hours your visits are grouped into."
      delay={delay}
    >
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        aria-labelledby="settings-timezone-title"
        className="h-9 w-full max-w-xs rounded-lg border border-border bg-input/30 px-3 text-foreground text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <option value="">Automatic{detected ? ` (${detected})` : ""}</option>
        {options.map((zone) => (
          <option key={zone} value={zone}>
            {zone}
          </option>
        ))}
      </select>
    </Panel>
  );
}
