import { test, expect } from "@playwright/test";

test.describe("Inbox", () => {
  test("page loads", async ({ page }) => {
    await page.goto("/inbox");
    await expect(page.getByRole("heading", { name: "Inbox" })).toBeVisible();
  });

  test("quick-add creates a task", async ({ page }) => {
    await page.goto("/inbox");
    await expect(page.getByRole("heading", { name: "Inbox" })).toBeVisible();

    const title = `Test task ${Date.now()}`;
    await page.keyboard.press("n");
    await page.getByPlaceholder(/new task/i).fill(title);
    await page.keyboard.press("Enter");

    await expect(page.getByText(title)).toBeVisible();
  });

  test("completing a task removes it from inbox", async ({ page }) => {
    await page.goto("/inbox");
    await expect(page.getByRole("heading", { name: "Inbox" })).toBeVisible();

    // Create a fresh task so we have a known, unique target
    const title = `Complete me ${Date.now()}`;
    await page.keyboard.press("n");
    await page.getByPlaceholder(/new task/i).fill(title);
    await page.keyboard.press("Enter");
    await expect(page.getByText(title)).toBeVisible();

    // Click the "Mark complete" button scoped to this task's row
    await page
      .locator("div")
      .filter({ hasText: title })
      .first()
      .getByLabel("Mark complete")
      .click();

    // Task animates out: checkbox fires after 350ms, framer exit is 200ms
    await expect(page.getByText(title)).not.toBeVisible({ timeout: 3000 });
  });
});
