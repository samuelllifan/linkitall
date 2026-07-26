import { ProfileView } from "~/components/profile-view";
import type { PageData } from "~/lib/pages";

// Throwaway test profile for iterating on the new "aurora" background — a soft
// luminous glow blooming from the top-center and fading to black, recreated
// from a reference design. Not linked anywhere; visit /test-aurora directly.
export const dynamic = "force-static";

const testData: PageData = {
  name: "lifan",
  bio: "Video Editor | VFX",
  links: [
    { id: "1", label: "TikTok", href: "https://tiktok.com" },
    { id: "2", label: "YouTube", href: "https://youtube.com" },
  ],
  background: {
    type: "aurora",
    // Grayscale to match the reference: a light-gray wash on pure black.
    color: "#e6e6e6",
    baseColor: "#000000",
    speed: 5,
  },
};

export default function TestAuroraPage() {
  return (
    <main className="relative mx-auto flex min-h-[calc(100vh-3.5rem)] w-full flex-col items-center justify-center px-6 pt-16 pb-28">
      <ProfileView data={testData} />
    </main>
  );
}
