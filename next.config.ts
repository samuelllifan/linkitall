import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The share-card routes read their typefaces off disk (see `~/lib/og-fonts`)
  // with a path assembled at runtime, which Next's file tracer cannot follow —
  // so without this the .ttf files are pruned from the deployed bundle and the
  // cards silently fall back to Satori's default face. The site's own card is
  // prerendered at build time and would survive either way; the profile card is
  // `force-dynamic` and would not.
  outputFileTracingIncludes: {
    "/opengraph-image": ["./src/fonts/**"],
    "/[username]/opengraph-image": ["./src/fonts/**"],
  },
};

export default nextConfig;
