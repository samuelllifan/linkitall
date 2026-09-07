import type { Metadata } from "next";
import type { PageData } from "~/lib/pages";
import { StudioClient } from "../edit/studio-client";

/**
 * TEMPORARY tour route for the Studio.
 *
 * The real editor lives behind auth at /edit and loads the signed-in owner's
 * row, which makes it impossible to show someone the editor without first
 * giving them an account. This mounts the same <StudioClient> in `demo` mode —
 * every control is live, Save runs the whole flow but writes nothing — over a
 * seeded page so there is something to edit on arrival.
 *
 * Not linked from anywhere and noindex'd, same as /test-bg and /test-music.
 */

export const metadata: Metadata = {
  title: "Studio demo",
  robots: { index: false, follow: false },
};

/** A gradient-with-initial avatar, so the demo needs no image assets. */
function avatarSvg(letter: string, from: string, to: string) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='96' height='96'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${from}'/><stop offset='1' stop-color='${to}'/></linearGradient></defs><rect width='96' height='96' fill='url(#g)'/><text x='50%' y='52%' dy='.35em' text-anchor='middle' font-family='Inter, system-ui, sans-serif' font-size='42' font-weight='700' fill='#ffffff'>${letter}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/**
 * A page that already uses every new capability, so the tour opens on something
 * worth looking at rather than on a blank draft: a section header, a link with
 * an attention animation, a row of bare social icons, pill buttons with a soft
 * shadow, a gradient-animated name and a shining avatar.
 */
const DEMO_PAGE: PageData = {
  name: "nova",
  bio: "GMV editor — commissions open.<br>AMVs, edits, montages.",
  avatar: avatarSvg("N", "#c084fc", "#6366f1"),
  nameStyle: {
    fontFamily: "inter",
    fontSize: 28,
    bold: true,
    align: "center",
    animation: "gradient",
  },
  bioStyle: { fontFamily: "inter", fontSize: 14, align: "center" },
  avatarOutline: { enabled: true, color: "#a78bfa" },
  avatarEffect: { type: "shine", speed: 4 },
  links: [
    { id: "h1", label: "Work", href: "", kind: "header" },
    {
      id: "l1",
      label: "Portfolio",
      href: "https://youtube.com/@novaedits",
    },
    {
      id: "l2",
      label: "Commissions — 2 slots open",
      href: "discord:novaedits",
      highlight: "glow",
    },
    { id: "h2", label: "Elsewhere", href: "", kind: "header" },
    {
      id: "i1",
      label: "TikTok",
      href: "https://tiktok.com/@novaedits",
      kind: "icon",
    },
    {
      id: "i2",
      label: "Instagram",
      href: "https://instagram.com/novaedits",
      kind: "icon",
    },
    { id: "i3", label: "X", href: "https://x.com/novaedits", kind: "icon" },
    {
      id: "i4",
      label: "Twitch",
      href: "https://twitch.tv/novaedits",
      kind: "icon",
    },
    { id: "l4", label: "Tip jar", href: "https://paypal.me/novaedits" },
  ],
  linkBox: {
    color: "#a78bfa",
    opacity: 100,
    outline: false,
    outlineColor: "#a78bfa",
    radius: 28,
    shadow: "soft",
  },
  linkStyle: {
    fontFamily: "inter",
    fontSize: 14,
    bold: true,
    align: "center",
    color: "#1c0f33",
  },
  background: {
    type: "gradient",
    from: "#2a1152",
    to: "#08060f",
    direction: "vertical",
    distribution: 55,
  },
  panel: { type: "glass", color: "#ffffff", opacity: 8 },
  panelOrientation: "vertical",
};

export default function StudioDemoPage() {
  return <StudioClient initialData={DEMO_PAGE} username="nova" demo />;
}
