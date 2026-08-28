import type { Background, PageData } from "~/lib/pages";

// A pool of example stacked pages for the landing "wall of pages". Rendered by
// the real <ProfileView>, so platform icons auto-derive from the link hosts.
// All backgrounds are DARK (light profile text stays legible) and CSS-only
// (no aurora WebGL), and none use music — so a wall of many cards stays cheap.

// Inline gradient-with-initial SVG avatar (no image assets needed).
function avatarSvg(letter: string, from: string, to: string) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='96' height='96'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${from}'/><stop offset='1' stop-color='${to}'/></linearGradient></defs><rect width='96' height='96' fill='url(#g)'/><text x='50%' y='52%' dy='.35em' text-anchor='middle' font-family='Inter, system-ui, sans-serif' font-size='44' font-weight='600' fill='#ffffff'>${letter}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const gradient = (from: string, to: string): Background => ({
  type: "gradient",
  from,
  to,
  direction: "vertical",
});
const grid = (baseColor: string, lineColor: string): Background => ({
  type: "grid",
  baseColor,
  lineColor,
  size: 28,
  thickness: 1,
});

function profile(
  name: string,
  bio: string,
  links: [string, string][],
  background: Background,
  avatar: [string, string, string],
): PageData {
  return {
    name,
    bio,
    avatar: avatarSvg(avatar[0], avatar[1], avatar[2]),
    links: links.map(([label, href], i) => ({
      id: String(i + 1),
      label,
      href,
    })),
    background,
    panelOrientation: "vertical",
  };
}

export const DEMO_PROFILES: PageData[] = [
  profile(
    "Maya Chen",
    "Singer-songwriter. New EP out now.",
    [
      ["Spotify", "https://open.spotify.com/artist/maya"],
      ["YouTube", "https://youtube.com/@mayachen"],
      ["TikTok", "https://tiktok.com/@mayachen"],
      ["Instagram", "https://instagram.com/mayachen"],
    ],
    gradient("#3a1150", "#0a0a12"),
    ["M", "#fb7185", "#a855f7"],
  ),
  profile(
    "Alex Rivera",
    "Design & code. Building small things on the internet.",
    [
      ["GitHub", "https://github.com/alexrivera"],
      ["Website", "https://alex.dev"],
      ["X", "https://x.com/alexrivera"],
      ["Instagram", "https://instagram.com/alexrivera"],
    ],
    grid("#0a0b12", "#1c2233"),
    ["A", "#60a5fa", "#22d3ee"],
  ),
  profile(
    "Jordan Blake",
    "Full-stack dev & streamer. Live most nights.",
    [
      ["Twitch", "https://twitch.tv/jordanblake"],
      ["Discord", "https://discord.gg/jordanblake"],
      ["GitHub", "https://github.com/jordanblake"],
      ["YouTube", "https://youtube.com/@jordanblake"],
    ],
    gradient("#0b3a53", "#07070c"),
    ["J", "#f59e0b", "#fb7185"],
  ),
  profile(
    "Sofia Marín",
    "Photographer. Chasing light in Lisbon.",
    [
      ["Instagram", "https://instagram.com/sofiamarin"],
      ["Website", "https://sofiamarin.photo"],
      ["Pinterest", "https://pinterest.com/sofiamarin"],
      ["X", "https://x.com/sofiamarin"],
    ],
    gradient("#4a1030", "#0a0810"),
    ["S", "#f472b6", "#fb7185"],
  ),
  profile(
    "Kenji Tanaka",
    "Producer / DJ. Late-night beats.",
    [
      ["SoundCloud", "https://soundcloud.com/kenji"],
      ["Spotify", "https://open.spotify.com/artist/kenji"],
      ["YouTube", "https://youtube.com/@kenji"],
      ["Instagram", "https://instagram.com/kenji"],
    ],
    gradient("#1e1b4b", "#08070f"),
    ["K", "#818cf8", "#22d3ee"],
  ),
  profile(
    "Priya Nair",
    "Writer. Essays on tech & the everyday.",
    [
      ["Substack", "https://priya.substack.com"],
      ["X", "https://x.com/priyanair"],
      ["Instagram", "https://instagram.com/priyanair"],
      ["Website", "https://priyanair.com"],
    ],
    grid("#0f0b0a", "#2a1f1a"),
    ["P", "#fbbf24", "#fb7185"],
  ),
  profile(
    "Leo Fischer",
    "3D artist. Rendering little worlds.",
    [
      ["ArtStation", "https://artstation.com/leofischer"],
      ["Instagram", "https://instagram.com/leofischer"],
      ["YouTube", "https://youtube.com/@leofischer"],
      ["X", "https://x.com/leofischer"],
    ],
    gradient("#0b2e3a", "#07070c"),
    ["L", "#22d3ee", "#60a5fa"],
  ),
  profile(
    "Amara Okafor",
    "Chef & creator. Recipes worth sharing.",
    [
      ["Instagram", "https://instagram.com/amaracooks"],
      ["TikTok", "https://tiktok.com/@amaracooks"],
      ["YouTube", "https://youtube.com/@amaracooks"],
      ["Website", "https://amaracooks.com"],
    ],
    gradient("#3a2410", "#0a0a08"),
    ["A", "#f59e0b", "#fbbf24"],
  ),
];
