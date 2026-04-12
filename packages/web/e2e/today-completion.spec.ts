import { test, expect } from "@playwright/test";

test.describe("Today view — task completion", () => {
  test("completing a task keeps it visible in the list as completed", async ({ page }) => {
    const taskTitle = `Completion-test-${Date.now()}`;

    await page.goto("/today");
    await page.waitForLoadState("networkidle");

    // Open quick-add with N shortcut
    await page.keyboard.press("n");
    const input = page.getByPlaceholder(/new task/i);
    await expect(input).toBeVisible();

    // Create a task (quick-add in Today view defaults to today's date)
    await input.fill(taskTitle);
    await page.keyboard.press("Enter");

    // Task appears in the list
    const taskText = page.locator(`text=${taskTitle}`).first();
    await expect(taskText).toBeVisible();

    // Click the checkbox to complete it
    const taskRow = page.locator("[data-task-id]").filter({ hasText: taskTitle });
    const checkbox = taskRow.getByRole("button", { name: "Mark complete" });
    await checkbox.click();

    // Task must STILL be visible (unified list — no removal on completion)
    await expect(taskText).toBeVisible({ timeout: 2000 });

    // Checkbox now shows "Mark incomplete" (task is completed)
    await expect(taskRow.getByRole("button", { name: "Mark incomplete" })).toBeVisible();
  });
});
