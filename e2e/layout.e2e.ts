import { expect, test } from "@playwright/test";

// Nothing may stick out past the screen: a wide table, a long Japanese line or a fixed-width card that
// pushes the page sideways is the most common look regression on phones and tablets. Every page is opened
// at the widths of the 05-screens.md breakpoints and its widest element is measured.

// a phone and a laptop: the two ends are where a table or a card row first breaks
const WIDTHS = [390, 1024];
const LOCALE_PAGES = [
  "",
  "/home",
  "/chat",
  "/signup",
  "/login",
  "/records",
  "/records/new",
  "/settings/data",
  "/legal/patient-rights",
  "/bookings/bkg_5521",
  "/outcomes/bkg_5521",
  "/requests/req_01J9Z8",
];
// Japanese has no spaces to wrap at, so it is the hardest case; the console pages are Korean
const PAGES = [
  ...LOCALE_PAGES.map((path) => `/ja${path}`),
  "/clinic/dashboard",
  "/clinic/inbox",
  "/clinic/menu",
  "/clinic/agent",
  "/ops/a2a-log",
  "/ops/clinics",
  "/ops/proxy-queue",
  "/ops/rules",
  "/demo",
  "/demo/ledger",
  "/demo/wallet",
  "/ui-kit",
];

test.beforeEach(async ({ page, baseURL }) => {
  // the first-visit tour would dim the page
  await page.addInitScript(() => localStorage.setItem("pibook.tour.v1", "1"));
  // customer pages need a session; without it every one of them is the landing and nothing real is measured
  const signedIn = await page.request.post("/api/auth/demo/sign-in", { data: { persona: "Yuki" }, headers: { origin: baseURL ?? "" } });
  expect(signedIn.ok()).toBe(true);
});

for (const width of WIDTHS) {
  test(`no page sticks out sideways at ${width}px`, async ({ page }) => {
    test.setTimeout(150_000);
    await page.setViewportSize({ width, height: 900 });
    const wide: string[] = [];
    for (const path of PAGES) {
      const response = await page.goto(path, { waitUntil: "load" });
      await page.waitForTimeout(250);
      // an error page is narrow and tidy, so a broken page would pass the width check below
      if (!response || response.status() >= 400) {
        wide.push(`${path} answered ${response?.status()}`);
        continue;
      }
      // a redirect means the page behind it (a login, the landing) is what gets measured: report it instead
      if (new URL(page.url()).pathname !== path) {
        wide.push(`${path} redirected to ${new URL(page.url()).pathname}`);
        continue;
      }
      const found = await page.evaluate((viewport) => {
        const offenders = [...document.querySelectorAll("body *")].filter((el) => {
          const box = el.getBoundingClientRect();
          if (box.width === 0 || box.right <= viewport + 1) return false;
          // a scrollable strip, code and fixed layers (the dim, the agent window) may extend or sit outside
          return !el.closest("pre, .overflow-x-auto, [data-allow-wide]") && getComputedStyle(el).position !== "fixed";
        });
        return { scrollWidth: document.documentElement.scrollWidth, count: offenders.length };
      }, width);
      if (found.scrollWidth > width + 1 || found.count > 0) wide.push(`${path} scrollWidth=${found.scrollWidth} outside=${found.count}`);
    }
    expect(wide).toEqual([]);
  });
}
