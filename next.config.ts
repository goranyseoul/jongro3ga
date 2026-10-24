import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  async rewrites() {
    // A2A discovery: the well-known card is the platform agent's card (03-a2a-protocol.md endpoint table).
    return [{ source: "/.well-known/agent-card.json", destination: "/a2a/platform/agent-card.json" }];
  },
};

export default withNextIntl(nextConfig);
