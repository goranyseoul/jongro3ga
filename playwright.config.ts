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
        // the deployed site runs in demo mode too: console pages open without a login, customers use a demo account
        // PGLITE_DIR=memory: the database of a local build opens in memory like on Vercel (the file mode is broken in a built app)
        env: { DEMO_MODE: "true", PGLITE_DIR: "memory" },
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      },
});
