import type { Background, BoxStyle, PageData, TextStyle } from "~/lib/pages";

// The example pages demoed in the landing "how it works" section.
//
// One PROFILE per step, so the three steps show three different pages -- but
// within the customise step it is a single profile changing its BACKGROUND,
// because that step's claim is "make it yours", not "here are other people".
// Swapping the whole identity there demonstrated the wrong thing.
//
// Purpose-built rather than borrowed. The alternatives were both worse: the
// signed-in owner's own page changes shape whenever they edit it (and is absent
// for the logged-out visitor this section is written for), and a real featured
// page belongs to somebody who didn't agree to be the product demo -- and would
// silently restyle the section the next time they touched their own page.
//
// All three personas take commissions, because that is stacked's core audience.
//
// THREE INVARIANTS, all load-bearing:
//
//  1. Every variant must produce an IDENTICALLY SIZED profile block -- same
//     number of links, same name font size, same panel type, and a bio short
//     enough to stay on one line. Every variant is mounted at once and they are
//     cross-faded as stacked layers, so any difference in layout shows up as two
//     offset copies of the same text instead of a dissolve.
//
//  2. TWO HUES FOR THE WHOLE SECTION, and no others: violet #a78bfa and orchid
//     #c084fc -- both steps of the brand purple (--brand-violet, --brand-orchid).
//     Each page picks ONE of them and shades it -- violet page, orchid page, and
//     a neutral page that cycles backgrounds -- so three pages that a visitor
//     sees within ten seconds of each other read as one palette instead of three
//     moods. This is why there is no pink, no teal and no amber here even though
//     the editor offers them: a demo has to look composed, and "every colour is
//     available" is a claim the copy can make in words without the artwork
//     having to prove it all at once.
//
//     The second hue was cyan until the brand collapsed to purple. Two hues is
//     still the rule -- what changed is that both are now the brand's, so the
//     showcase sells the product without introducing a colour the product no
//     longer uses anywhere else.
//
//     Within a page, a hue is used at three strengths and never at full: a light
//     tint for the bio, ~10% of the pure hue as the link fill, and its 900-ish
//     shade as the link outline. Text is always near-white. The failure mode
//     being avoided is the obvious one -- a saturated colour on a dark
//     background either vibrates or disappears, and dark link fills on a dark
//     background read as smudges rather than buttons.
//
//     The cycling profile is the OPPOSITE discipline: neutral, because its text
//     and links have to sit on all three of its backgrounds and tinting them to
//     match any one would clash with the other two.
//
//  3. Nothing here uses a feature the editor doesn't ship: no avatar effects, no
//     animated text effects, no templates.
//
// Note every profile's name and bio boxes are switched OFF. The default is a
// flat 8%-white rectangle behind each, which at preview size reads as two grey
// slabs stacked over the artwork. `boxCss` keeps a transparent 1px border when a
// box is disabled, so turning them off costs no height (invariant 1 holds).

/** The section's two hues, both steps of the brand purple. Everything below is
 *  a shade of one of these. */
const VIOLET = "#a78bfa";
const ORCHID = "#c084fc";

// Inline gradient-with-initial avatar, so the section needs no image assets and
// no network request. Same approach as the hero wall's demo pages.
function avatarSvg(letter: string, from: string, to: string) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='96' height='96'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${from}'/><stop offset='1' stop-color='${to}'/></linearGradient></defs><rect width='96' height='96' fill='url(#g)'/><text x='50%' y='52%' dy='.35em' text-anchor='middle' font-family='Inter, system-ui, sans-serif' font-size='44' font-weight='600' fill='#ffffff'>${letter}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** Every variant's name uses this size. Changing it per variant would move every
 *  box below the name and break the cross-fade (invariant 1). */
const NAME_SIZE = 24;

/** Both boxes off — see the header note. */
const NO_BOX: BoxStyle = {
  color: "#ffffff",
  opacity: 0,
  outline: false,
  outlineColor: "#ffffff",
  enabled: false,
};

/** How a page is dressed: everything except who it belongs to. */
interface Look {
  background: Background;
  /** Bio text colour — a light tint of the page's hue. */
  bio: string;
  /** Fill + outline behind every link button. */
  linkBox: BoxStyle;
  /** Link label colour. Set explicitly so a label can never land dark-on-dark. */
  linkText: string;
  /** Ring around the avatar, when the palette calls for one. */
  ring?: string;
}

/** Who a page belongs to. Shared by every variant of that page. */
interface Persona {
  name: string;
  bio: string;
  /** [initial, gradient from, gradient to] */
  avatar: [string, string, string];
  /** Key into FONTS (profile-view.tsx). */
  font: string;
  links: [string, string][];
}

function build(persona: Persona, look: Look): PageData {
  const name: TextStyle = {
    fontFamily: persona.font,
    fontSize: NAME_SIZE,
    bold: true,
    align: "center",
    color: "#ffffff",
  };
  return {
    name: persona.name,
    bio: persona.bio,
    avatar: avatarSvg(...persona.avatar),
    avatarOutline: look.ring
      ? { enabled: true, color: look.ring }
      : { enabled: false, color: "#ffffff" },
    links: persona.links.map(([label, href], i) => ({
      id: String(i + 1),
      label,
      href,
    })),
    background: look.background,
    // Transparent on every variant: a panel changes the block's size, which
    // would break the cross-fade (invariant 1).
    panel: { type: "transparent" },
    panelOrientation: "vertical",
    nameStyle: name,
    bioStyle: { fontSize: 13, align: "center", color: look.bio },
    nameBox: NO_BOX,
    bioBox: NO_BOX,
    linkBox: look.linkBox,
    linkStyle: { fontSize: 14, align: "center", color: look.linkText },
  };
}

// --- The cycling profile (customise step) --------------------------------
//
// Its three looks differ ONLY in `background`. Everything else is held
// deliberately neutral -- white name, cool-grey bio, a barely-there white link
// fill with a slate outline -- because one styling has to look right on an
// indigo glow, a violet gradient and a near-black grid alike. Tinting the text
// to match any one of them would clash with the other two.
const NEUTRAL = {
  bio: "#cbd5e1",
  linkText: "#ffffff",
  linkBox: {
    color: "#ffffff",
    opacity: 7,
    outline: true,
    outlineColor: "#2b3446",
  } satisfies BoxStyle,
};

const KAZE: Persona = {
  name: "kaze",
  bio: "GMV editor. Commissions open.",
  // The one avatar that spans both of the section's hues, since this is the
  // page the section opens on.
  avatar: ["K", VIOLET, "#c084fc"],
  font: "spaceGrotesk",
  links: [
    ["Portfolio", "https://youtube.com/@kazeedits"],
    ["Commissions", "https://discord.gg/kazeedits"],
    ["Presets & packs", "https://payhip.com/kazeedits"],
    ["Clips", "https://tiktok.com/@kazeedits"],
    ["Contact", "https://x.com/kazeedits"],
  ],
};

// Three backgrounds inside one narrow range -- indigo, violet, near-black. A
// warm or green option would demo the same feature while breaking invariant 2,
// and the neutral profile styling above only works because all three of these
// are cool and dark.
const BACKGROUNDS: { key: string; label: string; background: Background }[] = [
  {
    key: "aurora",
    label: "Aurora",
    // Affordable here in a way it is not in the hero: this section mounts one
    // aurora, not the ten that made the 48-card wall evict its own canvases.
    // A deep indigo, not a bright one. The glow's spread scales with the frame,
    // so a colour that reads as a tasteful bloom on a 340px phone floods an
    // 800px desktop viewport and stops looking dark.
    background: {
      type: "aurora",
      color: "#312e81",
      baseColor: "#04050b",
      speed: 2,
    },
  },
  {
    key: "gradient",
    label: "Gradient",
    background: {
      type: "gradient",
      from: "#2b1065",
      to: "#06050c",
      direction: "vertical",
      distribution: 40,
    },
  },
  {
    key: "grid",
    label: "Grid",
    background: {
      type: "grid",
      baseColor: "#05070c",
      lineColor: "#151e33",
      size: 28,
      thickness: 1,
    },
  },
];

export interface ShowcaseVariant {
  /** Unique across every step, so the stage can key layers off it directly. */
  key: string;
  /** Background name, shown to the visitor on the customise step. */
  label: string;
  data: PageData;
}

export interface ShowcaseStep {
  /** Rendered in the share card. */
  username: string;
  /** More than one only on the customise step, where one profile cycles
   *  through backgrounds. */
  variants: ShowcaseVariant[];
}

export const SHOWCASE_STEPS: ShowcaseStep[] = [
  {
    username: "kazeedits",
    variants: BACKGROUNDS.map((b) => ({
      key: `kaze-${b.key}`,
      label: b.label,
      data: build(KAZE, { ...NEUTRAL, background: b.background }),
    })),
  },
  // The violet page.
  {
    username: "rinmotion",
    variants: [
      {
        key: "rin",
        label: "Gradient",
        data: build(
          {
            name: "rin",
            bio: "Motion design. Open for work.",
            avatar: ["R", VIOLET, "#6d28d9"],
            font: "poppins",
            links: [
              ["Showreel", "https://youtube.com/@rinmotion"],
              ["Hire me", "https://discord.gg/rinmotion"],
              ["Shop", "https://payhip.com/rinmotion"],
              ["Instagram", "https://instagram.com/rinmotion"],
              ["Contact", "https://x.com/rinmotion"],
            ],
          },
          {
            background: {
              type: "gradient",
              from: "#2e1065",
              to: "#08060f",
              direction: "vertical",
              distribution: 38,
            },
            bio: "#c4b5fd",
            linkBox: {
              color: VIOLET,
              opacity: 11,
              outline: true,
              outlineColor: "#4c1d95",
            },
            linkText: "#f5f3ff",
            ring: VIOLET,
          },
        ),
      },
    ],
  },
  // The cyan page.
  {
    username: "valeclips",
    variants: [
      {
        key: "vale",
        label: "Color",
        data: build(
          {
            name: "vale",
            bio: "Editor and streamer. Clips daily.",
            avatar: ["V", ORCHID, "#6b21a8"],
            font: "oswald",
            links: [
              ["Live", "https://twitch.tv/valeclips"],
              ["Uploads", "https://youtube.com/@valeclips"],
              ["Discord", "https://discord.gg/valeclips"],
              ["Clips", "https://tiktok.com/@valeclips"],
              ["Contact", "https://x.com/valeclips"],
            ],
          },
          {
            // A flat colour, not a second aurora: the cycling profile already
            // owns the section's one WebGL context, and a solid near-black is
            // the cleanest of the six background types anyway.
            background: { type: "custom", color: "#06101a" },
            bio: "#a5e8f7",
            linkBox: {
              color: ORCHID,
              opacity: 10,
              outline: true,
              outlineColor: "#155e75",
            },
            linkText: "#ecfeff",
            ring: ORCHID,
          },
        ),
      },
    ],
  },
];

/** Every variant, flattened -- the stage mounts all of them once and cross-fades
 *  between them, so it needs one stable list with unique keys. */
export const SHOWCASE_VARIANTS: ShowcaseVariant[] = SHOWCASE_STEPS.flatMap(
  (s) => s.variants,
);

/** The background names offered on the customise step. */
export const SHOWCASE_BACKGROUNDS = SHOWCASE_STEPS[0].variants;
