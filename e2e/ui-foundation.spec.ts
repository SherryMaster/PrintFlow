import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("UI foundation showcase", () => {
  test("[V6] takes a visitor from the public page to the UI showcase", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(page).toHaveTitle("PrintFlow");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(
      page.getByRole("heading", { name: "From first file to final pickup." }),
    ).toBeVisible();
    await expect(page.getByText("PF-2026-0042")).toHaveCount(0);

    const showcaseButton = page.getByRole("button", {
      name: "View UI foundation",
    });
    await expect(showcaseButton).toHaveAttribute("href", "/dev/ui");
    await showcaseButton.click();

    await expect(page).toHaveURL(/\/dev\/ui$/);
    await expect(
      page.getByRole("heading", { name: "Your print is taking shape." }),
    ).toBeVisible();
  });

  test("renders customer and admin patterns on a phone", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dev/ui");
    await expect(
      page.getByRole("heading", { name: "Your print is taking shape." }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Production overview" }),
    ).toBeVisible();
    await expect(
      page.getByRole("list", { name: "Active orders" }).locator("li"),
    ).toHaveCount(3);
    await expect(
      page.getByRole("textbox", { name: "Email address *" }),
    ).toHaveAttribute("aria-invalid", "true");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflow).toBe(false);
  });

  test("has no critical accessibility issues in the customer and admin examples", async ({
    page,
  }) => {
    await page.goto("/dev/ui");
    const report = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
      .analyze();
    expect(report.violations).toEqual([]);
  });
  test("traps dialog focus and restores it to its trigger", async ({
    page,
  }) => {
    await page.goto("/dev/ui", { waitUntil: "networkidle" });
    const trigger = page.getByRole("button", {
      name: "Artwork guidance dialog",
    });
    await trigger.click();
    await expect(
      page.getByRole("dialog", { name: "Artwork guidance" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("dialog", { name: "Artwork guidance" }),
    ).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("opens the drawer by keyboard and keeps focus inside", async ({
    page,
  }) => {
    await page.goto("/dev/ui", { waitUntil: "networkidle" });
    const trigger = page.getByRole("button", { name: "Order details drawer" });
    await trigger.focus();
    await page.keyboard.press("Enter");
    const drawer = page.getByRole("dialog", { name: "Order details" });
    await expect(drawer).toBeVisible();
    await page.keyboard.press("Tab");
    await expect(drawer.getByRole("button", { name: "Close" })).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(drawer.getByRole("button", { name: "Close" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("shows keyboard focus on fields and follows navigation", async ({
    page,
  }) => {
    await page.goto("/dev/ui");
    const name = page.getByRole("textbox", { name: "Your name *" });
    const email = page.getByRole("textbox", { name: "Email address *" });
    await name.focus();
    await page.keyboard.press("Tab");
    await expect(email).toBeFocused();
    expect(
      await email.evaluate((element) => element.matches(":focus-visible")),
    ).toBe(true);
    await page.keyboard.press("Shift+Tab");
    await expect(name).toBeFocused();
    const navigation = page.getByRole("link", { name: "Your order" });
    await navigation.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#customer-preview$/);
  });

  test("keeps the store name when the logo cannot load", async ({ page }) => {
    await page.route("**/*ok-prints.png*", (route) => route.abort());
    await page.goto("/dev/ui", { waitUntil: "networkidle" });
    await expect(
      page.getByText("OkPrints", { exact: true }).first(),
    ).toBeVisible();
  });

  test("contains a long fallback store name on a phone", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.route("**/*ok-prints.png*", (route) => route.abort());
    await page.goto("/dev/ui", { waitUntil: "networkidle" });
    await page.evaluate(() => {
      for (const name of document.querySelectorAll("strong")) {
        if (name.textContent?.trim() === "OkPrints") {
          name.textContent =
            "OkPrints Extraordinarily Long Store Name For Lahore and Surrounding Areas";
        }
      }
    });
    const layout = await page.evaluate(() => {
      const name = [...document.querySelectorAll("strong")].find((element) =>
        element.textContent?.includes("Extraordinarily Long Store Name"),
      );
      return {
        scrollWidth: document.documentElement.scrollWidth,
        nameHeight: name?.getBoundingClientRect().height,
        textOverflow: name ? getComputedStyle(name).textOverflow : null,
      };
    });
    expect(layout.scrollWidth).toBeLessThanOrEqual(390);
    expect(layout.nameHeight).toBeGreaterThan(30);
    expect(layout.textOverflow).not.toBe("ellipsis");
  });

  test("separates a long order reference from its label", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dev/ui");
    const layout = await page.evaluate(() => {
      const reference = [...document.querySelectorAll("strong")].find(
        (element) => element.textContent?.trim() === "PF-2026-0042",
      );
      if (!reference) return null;
      reference.textContent = "PF-2026-0042-LONG-CUSTOM-REFERENCE-1234567890";
      const label = reference.previousElementSibling;
      if (!label) return null;
      return {
        scrollWidth: document.documentElement.scrollWidth,
        gap:
          reference.getBoundingClientRect().left -
          label.getBoundingClientRect().right,
      };
    });
    expect(layout).not.toBeNull();
    expect(layout?.scrollWidth).toBeLessThanOrEqual(390);
    expect(layout?.gap).toBeGreaterThanOrEqual(8);
  });

  test("shows inline recovery after an upload is interrupted", async ({
    page,
  }) => {
    await page.goto("/dev/ui");
    const upload = page.getByRole("region", {
      name: "Upload: large-format-artwork.pdf",
    });
    await expect(upload.getByRole("status")).toHaveText("27% uploaded");
    await page.getByRole("button", { name: "Interrupt upload" }).click();
    await expect(upload.getByRole("status")).toHaveText(
      "Upload interrupted. Try again.",
    );
    await expect(
      page.getByRole("alert").filter({ hasText: "Upload interrupted" }),
    ).toContainText("Retry the upload");
  });

  test("renders the showcase content before JavaScript runs", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      baseURL: "http://localhost:3000",
      javaScriptEnabled: false,
      viewport: { width: 390, height: 844 },
    });
    try {
      const page = await context.newPage();
      await page.goto("/dev/ui");
      await expect(
        page.getByRole("heading", { name: "Your print is taking shape." }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Production overview" }),
      ).toBeVisible();
      await expect(
        page.getByRole("list", { name: "Active orders" }).locator("li"),
      ).toHaveCount(3);
      await expect(page.getByText("PF-2026-0042").first()).toBeVisible();
      await expect(
        page.getByRole("alert").filter({
          hasText: "We could not accept that file",
        }),
      ).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      expect(overflow).toBe(false);
    } finally {
      await context.close();
    }
  });

  test("keeps controls available with reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/dev/ui");
    expect(
      await page.evaluate(
        () => matchMedia("(prefers-reduced-motion: reduce)").matches,
      ),
    ).toBe(true);
    await expect(
      page.getByRole("button", { name: "Artwork guidance dialog" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Interrupt upload" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Production overview" }),
    ).toBeVisible();
  });
});
