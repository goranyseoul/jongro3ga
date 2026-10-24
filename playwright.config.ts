import { defineConfig } from "@playwright/test";

// Click-through checks of the real flows, run against the production build (`npm run build` first).
// They use the installed Chrome (`channel: "chrome"`), so no browser download is needed locally or in CI.
// E2E_BASE_URL points them at a deployed site instead (for example the production alias after a merge).
const PORT = 3100;
const remote = process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.ts",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["github"]] : "list",
  use: { baseURL: remote ?? `http://localhost:${PORT}`, channel: "chrome", trace: "retain-on-failure" },
  webServer: remote
    ? undefined
    : {
        command: `npx next start -p ${PORT}`,
        url: `http://localhost:${PORT}/en`,
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
        // the auth routes need a secret outside demo mode; tests run the demo with an in-memory database
        env: { DEMO_MODE: "true", PGLITE_DIR: "memory" },
      },
});
