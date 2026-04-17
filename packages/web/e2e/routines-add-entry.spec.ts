import { test, expect } from "@playwright/test";

test.describe("Routines — add entry from history sheet", () => {
  test("'Add entry' button in history sheet logs a completion", async ({ page }) => {
    await page.goto("/routines");
    await page.waitForLoadState("networkidle");

    // Open history sheet by clicking the first routine
    const firstItem = page.locator(".group.relative.cursor-pointer").first();
    await firstItem.click();

    // Sheet should be open
    const sheet = page.locator("[role=dialog]");
    await expect(sheet).toBeVisible();

    // Add entry button in the header
    const addBtn = sheet.getByRole("button", { name: /add entry/i });
    await expect(addBtn).toBeVisible();
    await addBtn.click();

    // Inline form should appear
    const saveBtn = sheet.getByRole("button", { name: /save/i });
    await expect(saveBtn).toBeVisible();

    // Submit with today's date (default)
    await saveBtn.click();

    // Form should collapse
    await expect(saveBtn).not.toBeVisible({ timeout: 2000 });
  });
});
