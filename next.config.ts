import type { NextConfig } from "next";

// cacheComponents / partialPrefetching from the create-next-app template are intentionally
// not enabled: this app is stateful (memory store, fixed clock, JSON-RPC routes) and relies on
// request-time rendering. See docs/spec/BUILD-LOG.md.
// Turbopack's filesystem cache served stale CSS after app/globals.css edits (the Tailwind loader
// output was reused), so it is disabled for both build and dev. See docs/spec/BUILD-LOG.md.
const nextConfig: NextConfig = {
  experimental: {
    turbopackFileSystemCacheForBuild: false,
    turbopackFileSystemCacheForDev: false,
  },
  turbopack: {
    root: process.cwd(),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async rewrites() {
    return [
      { source: "/.well-known/agent-card.json", destination: "/a2a/platform/agent-card.json" },
    ];
  },
};

export default nextConfig;
