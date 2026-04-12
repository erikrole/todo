import { test, expect } from "@playwright/test";

test.describe("Keyboard shortcuts — navigation", () => {
  test("Cmd+2 navigates to Inbox", async ({ page }) => {
    await page.goto("/today");
    await page.keyboard.press("Meta+2");
    await expect(page).toHaveURL(/\/inbox/);
  });

  test("Cmd+1 navigates to Today", async ({ page }) => {
    await page.goto("/inbox");
    await page.keyboard.press("Meta+1");
    await expect(page).toHaveURL(/\/today/);
  });

  test("Cmd+3 navigates to Upcoming", async ({ page }) => {
    await page.goto("/inbox");
    await page.keyboard.press("Meta+3");
    await expect(page).toHaveURL(/\/upcoming/);
  });
});
