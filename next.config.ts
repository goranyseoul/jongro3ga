import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  // PGlite reads its own wasm and data files from disk, which breaks once the bundler rewrites those paths
  // ("path argument ... Received an instance of URL" on Node 22): keep it as a plain node_modules import.
  serverExternalPackages: ["@electric-sql/pglite"],
  async rewrites() {
    // A2A discovery: the well-known card is the platform agent's card (03-a2a-protocol.md endpoint table).
    return [{ source: "/.well-known/agent-card.json", destination: "/a2a/platform/agent-card.json" }];
  },
};

export default withNextIntl(nextConfig);
