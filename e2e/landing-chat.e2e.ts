import { expect, test, type Page } from "@playwright/test";
import { COPY } from "../app/[locale]/onboarding/copy";

// The landing is the chat. These cover what customers reported as "it sends me back home":
// changing the language mid-conversation, and the standards count on a clinic card.
// Copy comes from the app so a wording change does not break the tests.

const INTENT = "I'm in Korea from Nov 13 to 15 and want Thermage";
// a clinic the directory returns for Thermage; names are not translated, unlike the button labels
const CLINIC = "Lumen Clinic";

// returning visitor, like the "returning visit" tests in landing-flow.e2e.ts: no first-visit tour over the chat
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("pibook.tour.v1", "1"));
});

async function askOnLanding(page: Page) {
  await page.goto("/en");
  const box = page.getByRole("textbox").first();
  await box.click();
  await box.fill(INTENT);
  await box.press("Enter");
  // the directory answers with clinic cards, then the agent asks for the language
  await expect(page.getByRole("heading", { name: CLINIC })).toBeVisible();
  await expect(page.getByText(COPY.en.say.locale)).toBeVisible();
}

test("choosing another language keeps the conversation and continues in that language", async ({ page }) => {
  await askOnLanding(page);
  await page.getByRole("button", { name: "日本語", exact: true }).last().click();

  await expect(page).toHaveURL(/\/ja$/);
  await expect(page.getByText(INTENT).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: CLINIC })).toBeVisible();
  // the next onboarding step, now asked in Japanese
  await expect(page.getByText(COPY.ja.say.consent)).toBeVisible();
});

test("choosing the current language continues in place", async ({ page }) => {
  await askOnLanding(page);
  await page.getByRole("button", { name: "English", exact: true }).last().click();

  await expect(page).toHaveURL(/\/en$/);
  await expect(page.getByText(INTENT).first()).toBeVisible();
  await expect(page.getByText(COPY.en.say.consent)).toBeVisible();
});

test("a reload after a language switch starts a new conversation", async ({ page }) => {
  await askOnLanding(page);
  await page.getByRole("button", { name: "日本語", exact: true }).last().click();
  await expect(page.getByText(COPY.ja.say.consent)).toBeVisible();

  // the handoff is used once: reloading shows the plain landing again
  await page.reload();
  await expect(page.getByText(INTENT)).toHaveCount(0);
});

test("the standards count opens the same list as See standards", async ({ page }) => {
  await askOnLanding(page);
  const count = page.getByRole("button", { name: /standards checked/i }).first();
  await expect(count).toHaveAttribute("aria-expanded", "false");

  await count.click();
  await expect(count).toHaveAttribute("aria-expanded", "true");
  await expect(page).toHaveURL(/\/en$/);
  await expect(page.getByText(INTENT).first()).toBeVisible();

  await count.click();
  await expect(count).toHaveAttribute("aria-expanded", "false");
});
