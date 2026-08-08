import type { Metadata } from "next";
import Link from "next/link";

// TEMPORARY review page — a summary of the site-wide UX / consistency / bug /
// QOL polish pass. Safe to delete once the changes have been reviewed
// (`rm -rf src/app/changes`). Not linked from anywhere in the app.

export const metadata: Metadata = {
  title: "Changes — stacked",
  robots: { index: false, follow: false },
};

type Cat = "text" | "consistency" | "platform" | "qol";

const CAT_META: Record<Cat, { label: string; className: string }> = {
  text: {
    label: "Unnecessary text",
    className: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  },
  consistency: {
    label: "Consistency",
    className: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  },
  platform: {
    label: "Platform bug",
    className: "bg-red-500/15 text-red-300 border-red-500/30",
  },
  qol: {
    label: "QOL",
    className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  },
};

type Change = {
  cats: Cat[];
  title: string;
  detail: string;
  where: string;
};

const SECTIONS: { surface: string; changes: Change[] }[] = [
  {
    surface: "Landing page",
    changes: [
      {
        cats: ["text"],
        title: "Removed the “preset template” promise",
        detail:
          "The “Customize freely” card advertised starting “from a preset template” — but templates aren’t in the UI right now, so it promised a feature a new visitor can’t find.",
        where: "app/page.tsx",
      },
      {
        cats: ["text"],
        title: "Tightened the “Join us” section",
        detail:
          "“Join us now.” + “Sign up now and make your own, it’s free.” repeated “now” back-to-back. Now: “Join us” / “Make your own — it’s free.”",
        where: "app/page.tsx",
      },
      {
        cats: ["platform"],
        title: "Hero uses dvh, not vh",
        detail:
          "The full-height hero used 100vh, which on iOS Safari sits under the address bar. Switched to 100dvh to match the rest of the app.",
        where: "app/page.tsx",
      },
      {
        cats: ["qol"],
        title: "“Claim Your Page” disabled when empty",
        detail:
          "Submitting the claim field blank used to just dump you on the signup page with nothing pre-filled. The button is now disabled until you type a name.",
        where: "app/page.tsx",
      },
      {
        cats: ["platform", "consistency"],
        title: "Shine text no longer clips descenders",
        detail:
          "The gradient-shine words use background-clip:text, whose paint box was only line-height tall — so the “g” in “grow” was cut off at the bottom. Added vertical breathing room (layout-neutral via matching negative margins).",
        where: "app/page.tsx",
      },
    ],
  },
  {
    surface: "Navigation & footer",
    changes: [
      {
        cats: ["text", "qol"],
        title: "Guest button says “Sign in”, not “Not signed in”",
        detail:
          "The signed-out button stated a status instead of the action. Now it names what tapping it does.",
        where: "components/navbar.tsx",
      },
      {
        cats: ["platform"],
        title: "44px mobile menu button",
        detail:
          "The mobile hamburger was 36px — under the 44px touch-target minimum. Bumped to 44px (icon unchanged).",
        where: "components/navbar.tsx",
      },
      {
        cats: ["consistency"],
        title: "Account button padding aligned",
        detail:
          "The account menu trigger and the guest sign-in link used different right padding; matched them.",
        where: "components/navbar.tsx",
      },
      {
        cats: ["consistency"],
        title: "“What’s New” footer link title-cased",
        detail:
          "The footer read “What’s new” in sentence case while its three siblings (“Privacy Policy”, etc.) are Title Case.",
        where: "components/whats-new-link.tsx",
      },
    ],
  },
  {
    surface: "Page editor (My Page)",
    changes: [
      {
        cats: ["platform", "consistency"],
        title: "No more native alert() on save failure",
        detail:
          "A failed save popped a raw browser alert() — jarring and off-theme. Now it shows an inline message by the save bar, matching the editor’s other errors.",
        where: "app/my-page/my-page-client.tsx",
      },
      {
        cats: ["qol"],
        title: "Blank link URLs explain themselves",
        detail:
          "Saving with an empty link URL only flashed the field red. It now also says “Add a URL to every link before saving.”",
        where: "app/my-page/my-page-client.tsx",
      },
      {
        cats: ["qol"],
        title: "“Saved” confirmation",
        detail:
          "A successful save gave no feedback beyond the bar vanishing. Added a brief “Saved” pill.",
        where: "app/my-page/my-page-client.tsx",
      },
      {
        cats: ["qol", "consistency"],
        title: "Save-confirm dialog: keyboard + neutral Cancel",
        detail:
          "Escape now cancels, Enter confirms, and the Confirm button is focused on open. Cancel was painted destructive-red for a harmless action — made neutral.",
        where: "app/my-page/my-page-client.tsx",
      },
      {
        cats: ["platform"],
        title: "Readable error text",
        detail:
          "Media/logo upload errors used the dark “destructive” red, which is nearly illegible on the near-black background. Switched to the readable red the rest of the app uses.",
        where: "app/my-page/my-page-client.tsx",
      },
      {
        cats: ["platform"],
        title: "Avatar crop won’t stick on touch",
        detail:
          "Added onPointerCancel to the crop drag so an interrupted touch gesture can’t leave the image mid-drag.",
        where: "app/my-page/my-page-client.tsx",
      },
      {
        cats: ["platform"],
        title: "Schedule date fields don’t zoom on iOS",
        detail:
          "The datetime inputs used 14px text, which makes iOS Safari zoom on focus. Now 16px on mobile, 14px on desktop.",
        where: "app/my-page/my-page-client.tsx",
      },
      {
        cats: ["consistency"],
        title: "Per-link “Reset” → “Reset style”",
        detail:
          "A link’s “Reset” button sat near the global “Reset” with a different meaning. Renamed for clarity.",
        where: "app/my-page/my-page-client.tsx",
      },
      {
        cats: ["consistency"],
        title: "URL placeholder uses the … glyph",
        detail:
          "“https://...” used three ASCII dots; the app uses the … character everywhere else.",
        where: "app/my-page/my-page-client.tsx",
      },
    ],
  },
  {
    surface: "Auth (sign in / sign up / reset)",
    changes: [
      {
        cats: ["consistency"],
        title: "One shared password checklist",
        detail:
          "Sign-up showed green checkmarks; the reset-password page reimplemented the same list with plain dots. Extracted one shared component so they’re identical.",
        where: "components/ui/requirement.tsx",
      },
      {
        cats: ["qol"],
        title: "Focus follows the form",
        detail:
          "Switching between Sign in / Sign up / Reset now focuses the first field of the new form. The reset page autofocuses the password field.",
        where: "login/login-client.tsx · auth/reset/page.tsx",
      },
      {
        cats: ["platform"],
        title: "Bigger show/hide-password target",
        detail:
          "The eye toggle’s tap area was well under 44px; widened it (shared across login, settings and reset).",
        where: "components/ui/password-toggle.tsx",
      },
    ],
  },
  {
    surface: "Settings",
    changes: [
      {
        cats: ["consistency"],
        title: "Password policy now matches sign-up",
        detail:
          "Changing your password only required 6 characters here, while sign-up/reset require 8 + a letter + a number. Settings now enforces the same rule and shows the same live checklist, blocking the save until it’s met.",
        where: "app/settings/settings-client.tsx",
      },
      {
        cats: ["qol", "consistency"],
        title: "Save-confirm dialog parity",
        detail:
          "Enter now confirms and the Confirm button is focused on open (the delete dialog already did this). Cancel is no longer painted red.",
        where: "app/settings/settings-client.tsx",
      },
      {
        cats: ["consistency"],
        title: "Reset disabled while saving",
        detail:
          "During an in-flight save, Save was disabled but Reset wasn’t; matched them.",
        where: "app/settings/settings-client.tsx",
      },
      {
        cats: ["text"],
        title: "Shorter email helper text",
        detail: "Trimmed the email-change explanation to the essential.",
        where: "app/settings/settings-client.tsx",
      },
    ],
  },
  {
    surface: "Public page, share & music",
    changes: [
      {
        cats: ["consistency"],
        title: "Discord toast says “Username copied!”",
        detail:
          "Copying a Discord username flashed “Link copied!”, which is wrong — it copies a username.",
        where: "components/profile-view.tsx",
      },
      {
        cats: ["qol"],
        title: "Share modal focus handling",
        detail:
          "Opening Share now focuses the Copy button and restores focus to the share button on close.",
        where: "components/share-button.tsx",
      },
      {
        cats: ["platform"],
        title: "Music pill respects the notch",
        detail:
          "The floating mini-player used fixed 1rem insets; now honors iOS safe-area insets so it clears the home indicator.",
        where: "components/music-player.tsx",
      },
      {
        cats: ["platform"],
        title: "Lighter data use",
        detail:
          'The player prefetched the whole track (preload="auto"); now fetches only metadata unless the track is set to autoplay.',
        where: "components/music-player.tsx",
      },
      {
        cats: ["platform"],
        title: "Slider thumbs visible on touch",
        detail:
          "The seek/volume thumbs were hover-reveal only, so they never appeared on touch devices. Shown on coarse pointers.",
        where: "app/globals.css",
      },
      {
        cats: ["consistency"],
        title: "Matching disabled slider states",
        detail:
          "The progress and volume sliders faded to different opacities when disabled; matched them.",
        where: "components/music-player.tsx",
      },
    ],
  },
  {
    surface: "Editor customization controls",
    changes: [
      {
        cats: ["platform", "consistency"],
        title: "Font/size controls don’t zoom on iOS + get focus rings",
        detail:
          "The font <select> and size input used 14px (iOS zoom) and had no focus ring. Now 16px on mobile with a visible focus ring.",
        where: "components/text-style-editor.tsx",
      },
      {
        cats: ["consistency"],
        title: "Color swatch is keyboard-visible & labelled",
        detail:
          "Added a focus ring and aria-expanded/aria-haspopup to the color-picker trigger.",
        where: "components/text-style-editor.tsx",
      },
    ],
  },
  {
    surface: "Analytics (dashboard & admin)",
    changes: [
      {
        cats: ["platform", "qol"],
        title: "Bigger, labelled dashboard pills",
        detail:
          "The time-range and graph-tab pills were ~30px tall and gave screen readers no pressed state. Added aria-pressed and more height.",
        where: "app/dashboard/dashboard-client.tsx",
      },
      {
        cats: ["consistency"],
        title: "Thousand separators in the pie legend",
        detail:
          "The Devices pie legend printed raw numbers while the Devices card used toLocaleString(); matched them.",
        where: "app/dashboard/charts.tsx",
      },
      {
        cats: ["consistency"],
        title: "Admin charts use the shared palette",
        detail:
          "Two admin bars and the map re-declared hex colors by hand; they now read from the shared CHART_COLORS palette so a palette change can’t desync them.",
        where: "app/admin/admin-view.tsx · location-map.tsx",
      },
      {
        cats: ["consistency"],
        title: "Admin time-range picker matches the dashboard",
        detail:
          "The admin picker was a row of individually-bordered buttons with no pressed state, while the dashboard uses a segmented control. Restyled admin to the same segmented control (Custom is now one more segment) and added aria-pressed. Preset sets still differ where the data does (admin keeps 24h/hourly + custom calendar ranges).",
        where: "app/admin/time-frame-picker.tsx",
      },
    ],
  },
  {
    surface: "Error & contact",
    changes: [
      {
        cats: ["consistency", "qol"],
        title: "Error page matches the 404",
        detail:
          "The error screen lacked the brand mark + eyebrow its 404 sibling has. Added them, plus the error digest reference for support.",
        where: "app/error.tsx",
      },
      {
        cats: ["text"],
        title: "Tighter contact intro",
        detail:
          "“Fill out the form below and…” stated the obvious; trimmed it.",
        where: "app/contact/page.tsx",
      },
      {
        cats: ["qol"],
        title: "A way forward after sending",
        detail:
          "The contact success screen was a dead end; added a “Send another message” action.",
        where: "app/contact/page.tsx",
      },
      {
        cats: ["consistency"],
        title: "OG share-card alt punctuation",
        detail:
          "The root OG image’s alt text dropped the trailing period the metadata taglines use.",
        where: "app/opengraph-image.tsx",
      },
      {
        cats: ["platform"],
        title: "Public page uses dvh",
        detail: "The /<username> page used 100vh; switched to 100dvh (iOS).",
        where: "app/[username]/page.tsx",
      },
    ],
  },
];

const JUDGEMENT: { title: string; detail: string; kind: string }[] = [
  {
    kind: "Rejected",
    title: "Blanket “red-400 → destructive token” swap",
    detail:
      "The audit suggested replacing every hand-coded red error color with the design system’s `destructive` token. But that token is a dark red (~red-900) meant as a button fill with light text — as text on the near-black background it fails contrast. Kept the readable red-400 for text (and switched two existing destructive-red messages TO red-400).",
  },
  {
    kind: "Deferred — bigger change",
    title: "iOS audio volume is a no-op",
    detail:
      "On iOS Safari, setting audio.volume does nothing, so the music player’s volume/fade controls silently don’t work there. A proper fix needs the Web Audio API (GainNode) — out of scope for a polish pass.",
  },
  {
    kind: "Kept intentionally",
    title: "A few “redundant” helper texts",
    detail:
      "The panel-orientation hint, the reset-password subtitle, and the admin “· by clicks” label were flagged as redundant, but each adds real information (or matches an established pattern), so I left them.",
  },
];

function Tag({ cat }: { cat: Cat }) {
  const m = CAT_META[cat];
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${m.className}`}
    >
      {m.label}
    </span>
  );
}

export default function ChangesPage() {
  const total = SECTIONS.reduce((n, s) => n + s.changes.length, 0);
  const counts = { text: 0, consistency: 0, platform: 0, qol: 0 } as Record<
    Cat,
    number
  >;
  for (const s of SECTIONS)
    for (const c of s.changes) for (const cat of c.cats) counts[cat]++;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
      <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
        Temporary review page
      </p>
      <h1 className="mt-2 text-balance text-3xl font-bold tracking-tight sm:text-4xl">
        Site-wide polish pass
      </h1>
      <p className="mt-3 max-w-xl leading-relaxed text-muted-foreground">
        {total} changes across the site, targeting the four things you asked
        about: unnecessary text, consistency, platform bugs (Mac / Windows /
        mobile), and quality-of-life. Everything below type-checks and passes
        the linter. Delete this page when you’re done —{" "}
        <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-foreground">
          rm -rf src/app/changes
        </code>
        .
      </p>

      {/* Category counts */}
      <div className="mt-8 flex flex-wrap gap-2">
        {(Object.keys(CAT_META) as Cat[]).map((cat) => (
          <span
            key={cat}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium ${CAT_META[cat].className}`}
          >
            {CAT_META[cat].label}
            <span className="opacity-70">{counts[cat]}</span>
          </span>
        ))}
      </div>

      <div className="mt-12 flex flex-col gap-12">
        {SECTIONS.map((section) => (
          <section key={section.surface}>
            <h2 className="mb-4 border-border border-b pb-2 text-lg font-semibold tracking-tight">
              {section.surface}
            </h2>
            <ul className="flex flex-col gap-4">
              {section.changes.map((c) => (
                <li
                  key={c.title}
                  className="rounded-lg border border-border bg-card p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {c.cats.map((cat) => (
                      <Tag key={cat} cat={cat} />
                    ))}
                    <span className="ml-auto font-mono text-[11px] text-muted-foreground">
                      {c.where}
                    </span>
                  </div>
                  <p className="mt-2 font-medium text-foreground">{c.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {c.detail}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <section>
          <h2 className="mb-2 border-border border-b pb-2 text-lg font-semibold tracking-tight">
            Judgment calls
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Things the audit surfaced that I deliberately did <em>not</em> ship
            as-is, and why.
          </p>
          <ul className="flex flex-col gap-4">
            {JUDGEMENT.map((j) => (
              <li
                key={j.title}
                className="rounded-lg border border-border bg-card p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                    {j.kind}
                  </span>
                </div>
                <p className="mt-2 font-medium text-foreground">{j.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {j.detail}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="mt-12 flex flex-wrap gap-3">
        <Link
          href="/"
          className="text-sm text-foreground underline-offset-4 hover:underline"
        >
          ← Back home
        </Link>
      </div>
    </main>
  );
}
