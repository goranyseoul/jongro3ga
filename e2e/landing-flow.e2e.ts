import { expect, test, type Page } from "@playwright/test";
import { LANDING_COPY } from "../app/[locale]/landing-copy";
import { LOCALES, LOCALE_NAME } from "../app/[locale]/locales";

// What these checks guard: tapping something in the conversation must never throw the customer out of it,
// and nothing on the landing may log an error. Anything the page does on its own (a redirect, a failed
// request, a console error) is collected and fails the test, because a click-through is the only place
// where those show up. They found the language chip that reloaded the page and dropped the conversation.

const TOUR_SEEN = "pibook.tour.v1";
const ko = LANDING_COPY.ko;

/** Everything unexpected the page does while a test runs. */
function watch(page: Page): string[] {
  const problems: string[] = [];
  page.on("console", (message) => {
    // a failed download is also logged as this generic line without its address; the response check below
    // reports every failed download with the address, minus the one known font
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource")) {
      problems.push(`console error: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => problems.push(`page error: ${error.message}`));
  page.on("response", (response) => {
    // the licensed landing font is not in the repo (docs/DEPLOY.md): one known 404
    if (response.status() >= 400 && !response.url().includes("/fonts/")) problems.push(`${response.status()} ${response.url()}`);
  });
  page.on("requestfailed", (request) => {
    if (request.failure()?.errorText !== "net::ERR_ABORTED") problems.push(`request failed: ${request.url()}`);
  });
  return problems;
}

const agentWindow = (page: Page, title = ko.agentWindow.title) => page.getByRole("dialog", { name: title });
const tour = (page: Page, region = ko.tour.region) => page.getByRole("dialog", { name: region });

test.describe("first visit", () => {
  test("the tour runs over the landing alone, and does not come back", async ({ page }) => {
    const problems = watch(page);
    await page.goto("/ko");

    await expect(tour(page)).toBeVisible({ timeout: 15_000 });
    // one place to type at a time: no agent window and no launcher until the customer asks something
    await expect(agentWindow(page)).toBeHidden();
    await expect(page.getByRole("button", { name: ko.agentWindow.open })).toBeHidden();

    for (let step = 0; step < ko.tour.steps.length - 1; step++) {
      await tour(page).getByRole("button", { name: ko.tour.next }).click();
    }
    await tour(page).getByRole("button", { name: ko.tour.done }).click();
    await expect(tour(page)).toBeHidden();
    await expect(agentWindow(page)).toBeHidden();
    expect(await page.evaluate((key) => localStorage.getItem(key), TOUR_SEEN)).toBe("1");

    await page.reload();
    await page.waitForTimeout(4000); // longer than the splash, which is when the tour used to start
    await expect(tour(page)).toBeHidden();
    expect(problems).toEqual([]);
  });

  test("skipping with Escape counts as seen", async ({ page }) => {
    await page.goto("/ko");
    await expect(tour(page)).toBeVisible({ timeout: 15_000 });
    await page.keyboard.press("Escape");
    await expect(tour(page)).toBeHidden();
    expect(await page.evaluate((key) => localStorage.getItem(key), TOUR_SEEN)).toBe("1");
  });
});

test.describe("returning visit", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((key) => localStorage.setItem(key, "1"), TOUR_SEEN);
  });

  for (const target of LOCALES.filter((locale) => locale !== "ko")) {
    test(`the language chip for ${target} changes the page language and keeps the conversation`, async ({ page }) => {
      const problems = watch(page);
      await page.goto("/ko");
      await page.getByRole("button", { name: ko.startPlain }).click();
      await agentWindow(page).getByRole("button", { name: LOCALE_NAME[target] }).click();

      // the page moves to the new language on purpose ...
      await expect(page).toHaveURL(new RegExp(`/${target}$`));
      // ... and the window is still open, still in the same conversation, one step further
      const window = agentWindow(page, LANDING_COPY[target].agentWindow.title);
      await expect(window).toBeVisible();
      await expect(window.getByRole("log")).toContainText(LOCALE_NAME[target]);
      await expect(window.getByRole("log").locator("> div")).not.toHaveCount(1, { timeout: 10_000 });
      expect(problems).toEqual([]);
    });
  }

  test("a topic card answers in the window and leaves the page where it is", async ({ page }) => {
    const problems = watch(page);
    await page.goto("/en");
    const before = page.url();
    await page.locator('[data-tour="topics"] button').first().click();

    const window = agentWindow(page, LANDING_COPY.en.agentWindow.title);
    await expect(window).toBeVisible();
    await expect(window.getByRole("log").locator("> div")).not.toHaveCount(1, { timeout: 10_000 });
    expect(page.url()).toBe(before);
    // the part under the hero stays
    await expect(page.locator('[data-tour="topics"]')).toBeVisible();
    expect(problems).toEqual([]);
  });

  test("a line typed in the hero is answered in the window, a second one joins it", async ({ page }) => {
    const problems = watch(page);
    await page.goto("/ko");
    const hero = page.locator('[data-tour="input"] textarea');
    await hero.fill("리쥬란 알아보고 싶어요");
    await hero.press("Enter");

    const log = agentWindow(page).getByRole("log");
    await expect(log).toContainText("리쥬란 알아보고 싶어요");
    await expect(log.locator("> div")).not.toHaveCount(1, { timeout: 10_000 });
    const lines = await log.locator("> div").count();

    await page.locator('[data-tour="topics"] button').first().click();
    await expect(log.locator("> div")).not.toHaveCount(lines, { timeout: 10_000 });
    await expect(log).toContainText("리쥬란 알아보고 싶어요"); // the first line is still there
    expect(problems).toEqual([]);
  });

  test("expanding hands the same conversation the whole screen", async ({ page }) => {
    await page.goto("/ko");
    await page.getByRole("button", { name: ko.startPlain }).click();
    await expect(agentWindow(page).getByRole("log")).toContainText(LOCALE_NAME.ja);
    await agentWindow(page).getByRole("button", { name: ko.agentWindow.expand }).click();
    await expect(agentWindow(page)).toBeHidden();
    await expect(page.getByRole("log")).toContainText(LOCALE_NAME.ja);
    await expect(page).toHaveURL(/\/ko$/);
  });

  test("the sign-up link opens its own page, and signing up starts the conversation", async ({ page }) => {
    const problems = watch(page);
    await page.goto("/en");
    await page.getByRole("link", { name: LANDING_COPY.en.signup.toggle }).click();
    await expect(page).toHaveURL(/\/en\/signup$/);
    const email = page.getByRole("textbox").first();
    await email.fill("visitor@example.com");
    await email.press("Enter");
    await expect(page).toHaveURL(/\/en$/);
    await expect(agentWindow(page, LANDING_COPY.en.agentWindow.title)).toBeVisible();
    expect(problems).toEqual([]);
  });

  test("the wordmark leads back to the landing, or to home once signed up", async ({ page }) => {
    await page.goto("/en");
    await page.getByRole("button", { name: LANDING_COPY.en.startPlain }).click();
    await expect(agentWindow(page, LANDING_COPY.en.agentWindow.title)).toBeVisible();
    await page.getByRole("link", { name: "PibooK" }).first().click();
    await expect(agentWindow(page, LANDING_COPY.en.agentWindow.title)).toBeHidden();
    await expect(page.getByRole("button", { name: LANDING_COPY.en.startPlain })).toBeVisible();

    await page.goto("/en/signup");
    const email = page.getByRole("textbox").first();
    await email.fill("visitor@example.com");
    await email.press("Enter");
    await expect(page).toHaveURL(/\/en$/);
    await page.getByRole("link", { name: "PibooK" }).first().click();
    await expect(page).toHaveURL(/\/en\/home$/);
  });

  test("Escape closes the window and the launcher takes the focus back", async ({ page }) => {
    await page.goto("/ko");
    await page.getByRole("button", { name: ko.startPlain }).click();
    await expect(agentWindow(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(agentWindow(page)).toBeHidden();
    await expect(page.getByRole("button", { name: ko.agentWindow.open })).toBeFocused();
  });

  for (const locale of LOCALES) {
    test(`the ${locale} landing loads without errors`, async ({ page }) => {
      const problems = watch(page);
      await page.goto(`/${locale}`);
      await expect(page.getByRole("button", { name: LANDING_COPY[locale].startPlain })).toBeVisible();
      await page.waitForTimeout(1500);
      expect(problems).toEqual([]);
    });
  }
});
