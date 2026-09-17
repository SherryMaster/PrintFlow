import { expect, test, type Page } from "@playwright/test";

async function expectPrintFlowShell(page: Page) {
  const response = await page.goto("/");

  expect(response?.ok()).toBe(true);
  await expect(page).toHaveTitle("PrintFlow");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("main")).toBeVisible();
}

test.describe("PrintFlow home page", () => {
  test("loads the application shell on desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });

    await expectPrintFlowShell(page);
  });

  test("loads the application shell on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });

    await expectPrintFlowShell(page);
  });
});
