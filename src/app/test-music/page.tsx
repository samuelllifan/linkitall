import type { Metadata } from "next";
import { TestMusicClient } from "./test-music-client";

// Throwaway harness for iterating on the page "music player" feature — import a
// song from Spotify or upload an MP3, set the initial volume / autoplay / loop /
// font / accent, and preview the visitor-facing player live. Not linked
// anywhere; visit /test-music directly.
export const metadata: Metadata = {
  title: "Music player · test",
  robots: { index: false, follow: false },
};

export default function TestMusicPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-12">
      <div className="mb-8">
        <h1 className="font-bold text-2xl text-foreground tracking-tight">
          Music player — test bench
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground text-sm leading-relaxed">
          Prototype for playing music on a page. Choose a song (paste a Spotify
          link or upload an audio file), tune the playback and look, and see the
          visitor experience update live on the right.
        </p>
      </div>
      <TestMusicClient />
    </main>
  );
}
