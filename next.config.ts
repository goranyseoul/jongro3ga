import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  // The platform Agent Card is also served at the A2A well-known path (03 "바인딩과 엔드포인트").
  async rewrites() {
    return [{ source: "/.well-known/agent-card.json", destination: "/a2a/platform/agent-card.json" }];
  },
};

export default withNextIntl(nextConfig);
