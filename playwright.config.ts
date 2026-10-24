import { defineConfig } from "@playwright/test";

const PORT = 3100;

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./test-results",
  timeout: 60_000,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${PORT}` },
  webServer: {
    command: `npm run build && npm run start -- -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 240_000,
    env: {
      DEMO_MODE: "true",
      DEMO_NOW: "2026-11-12T10:00:00+09:00",
      PUBLIC_BASE_URL: `http://localhost:${PORT}`,
      A2A_TOKEN_SECRET: "e2e-only-secret-not-for-production-use",
    },
  },
});
