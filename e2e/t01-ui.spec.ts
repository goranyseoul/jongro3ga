import { expect, test } from "@playwright/test";

const SECTIONS = [
  "button", "input", "chip", "card", "sheet", "table", "label", "stat", "timeline",
  "chat", "widgets", "consent", "agentcard", "json", "money",
];

for (const width of [390, 1280]) {
  test(`t01 /demo/ui renders without console errors at ${width}px`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(`console.error: ${m.text()}`);
    });

    await page.setViewportSize({ width, height: 900 });
    const res = await page.goto("/demo/ui");
    expect(res?.status()).toBe(200);

    for (const id of SECTIONS) {
      await expect(page.locator(`#ui-${id}`), `section ${id}`).toBeVisible();
    }

    // Tokens are applied: the body background resolves from --bg, not the browser default.
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toBe("rgb(250, 250, 250)");

    // No horizontal overflow of the page.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);

    // Table is a table from md up and cards below md.
    const tableVisible = await page.locator("#ui-table table").isVisible();
    expect(tableVisible).toBe(width >= 768);

    // Touch targets: every button is at least 44px tall.
    const heights = await page.$$eval("button", (els) => els.map((e) => e.getBoundingClientRect().height).filter((h) => h > 0));
    for (const h of heights) expect(h).toBeGreaterThanOrEqual(43.5);

    // Interactive pieces work: sheet opens and closes.
    await page.getByRole("button", { name: "Open sheet" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: "Close" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    // Widget callback.
    await page.getByRole("button", { name: "Confirm amount" }).click();
    await expect(page.getByTestId("widget-last")).toContainText("amount 2");

    await page.screenshot({ path: `e2e/artifacts/t01-ui-${width}.png`, fullPage: true });
    expect(errors).toEqual([]);
  });
}
