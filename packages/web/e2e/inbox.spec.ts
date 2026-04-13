import { test, expect } from "@playwright/test";

test.describe("Inbox", () => {
  test("page loads", async ({ page }) => {
    await page.goto("/inbox");
    await expect(page.getByRole("heading", { name: "Inbox" })).toBeVisible();
  });

  test("quick-add creates a task", async ({ page }) => {
    await page.goto("/inbox");
    await page.waitForLoadState("networkidle");

    const title = `Test task ${Date.now()}`;
    await page.keyboard.press("n");
    await page.getByPlaceholder(/new task/i).fill(title);
    await page.keyboard.press("Enter");

    await expect(page.getByText(title)).toBeVisible();
  });

  test("completing a task removes it from inbox", async ({ page }) => {
    await page.goto("/inbox");
    await page.waitForLoadState("networkidle");

    // Create a fresh task so we have a known, unique target
    const title = `Complete me ${Date.now()}`;
    await page.keyboard.press("n");
    await page.getByPlaceholder(/new task/i).fill(title);
    await page.keyboard.press("Enter");
    await expect(page.getByText(title)).toBeVisible();
    await page.waitForLoadState("networkidle"); // ensure task-creation refetch completes first

    // Click the "Mark complete" button scoped to this task's row
    await page
      .locator("[data-task-id]")
      .filter({ hasText: title })
      .getByLabel("Mark complete")
      .click();

    // Task stays briefly in optimistic state (muted), then disappears after refetch
    await expect(page.getByText(title)).not.toBeVisible({ timeout: 8000 });
  });
});
