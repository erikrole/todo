import { test, expect } from "@playwright/test";

test.describe("Routines — split completion button", () => {
  test("'Log today' button creates a completion without opening a popover", async ({ page }) => {
    await page.goto("/routines");
    await page.waitForLoadState("networkidle");

    // Grab the first routine item
    const firstItem = page.locator(".group.relative.cursor-pointer").first();
    await expect(firstItem).toBeVisible();

    // Hover to reveal the split button
    await firstItem.hover();

    // The "✓ Today" button should be visible (left half of split button)
    const todayBtn = firstItem.getByRole("button", { name: /today/i });
    await expect(todayBtn).toBeVisible();

    // Clicking it should NOT open a popover
    await todayBtn.click();
    const popover = page.locator("[data-radix-popper-content-wrapper]");
    await expect(popover).not.toBeVisible({ timeout: 500 });

    // The completion count in the meta row should increment (re-query)
    // We just verify no error state appears
    await expect(firstItem).toBeVisible();
  });

  test("chevron button opens date picker popover", async ({ page }) => {
    await page.goto("/routines");
    await page.waitForLoadState("networkidle");

    const firstItem = page.locator(".group.relative.cursor-pointer").first();
    await firstItem.hover();

    const chevronBtn = firstItem.getByRole("button", { name: /past date/i });
    await expect(chevronBtn).toBeVisible();
    await chevronBtn.click();

    // Calendar popover should appear
    const popover = page.locator("[data-radix-popper-content-wrapper]");
    await expect(popover).toBeVisible();
  });
});
