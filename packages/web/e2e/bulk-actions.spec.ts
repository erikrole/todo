// packages/web/e2e/bulk-actions.spec.ts
import { test, expect, type Locator, type Page } from "@playwright/test";

/**
 * Dispatch a modifier-click event to trigger multi-select on a task.
 *
 * Headless Chromium reports `navigator.platform` as "Win32", so
 * `loadSelectionModifier()` defaults to "ctrl" (not "meta"). We dispatch a
 * `ctrlKey:true` click directly to the inner title-row div — the element that
 * carries the onClick handler — to bypass browser-level modifier-click
 * interception (same strategy as the `dispatchKey` helper in
 * keyboard-shortcuts.spec.ts).
 */
async function modifierClick(page: Page, locator: Locator) {
  await locator.evaluate((el) => {
    // Target the first child div (the title row) where the onClick handler lives.
    const target = (el.firstElementChild as HTMLElement) ?? (el as HTMLElement);
    target.dispatchEvent(new MouseEvent("click", { ctrlKey: true, bubbles: true, cancelable: true }));
  });
}

test.describe("Bulk actions", () => {
  test("⌘-click selects a task and shows the action bar", async ({ page }) => {
    await page.goto("/inbox");
    await page.waitForLoadState("networkidle");

    const task = page.locator("[data-task-id]").first();
    await modifierClick(page, task);

    await expect(task).toHaveAttribute("data-selected", "true");
    await expect(page.getByTestId("bulk-action-bar")).toBeVisible();
  });

  test("second ⌘-click deselects the task", async ({ page }) => {
    await page.goto("/inbox");
    await page.waitForLoadState("networkidle");

    const task = page.locator("[data-task-id]").first();
    await modifierClick(page, task);
    await expect(task).toHaveAttribute("data-selected", "true");

    await modifierClick(page, task);
    await expect(task).not.toHaveAttribute("data-selected");
    await expect(page.getByTestId("bulk-action-bar")).not.toBeVisible();
  });

  test("Escape clears selection", async ({ page }) => {
    await page.goto("/inbox");
    await page.waitForLoadState("networkidle");

    const task = page.locator("[data-task-id]").first();
    await modifierClick(page, task);
    await expect(page.getByTestId("bulk-action-bar")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByTestId("bulk-action-bar")).not.toBeVisible();
  });

  test("bulk complete removes tasks from inbox", async ({ page }) => {
    await page.goto("/inbox");
    await page.waitForLoadState("networkidle");

    const ts = Date.now();
    const title1 = `Bulk complete A ${ts}`;
    const title2 = `Bulk complete B ${ts}`;

    await page.keyboard.press("n");
    await page.getByPlaceholder(/new task/i).fill(title1);
    await page.keyboard.press("Enter");
    await expect(page.getByText(title1)).toBeVisible();
    await page.waitForLoadState("networkidle");

    await page.keyboard.press("n");
    await page.getByPlaceholder(/new task/i).fill(title2);
    await page.keyboard.press("Enter");
    await expect(page.getByText(title2)).toBeVisible();
    await page.waitForLoadState("networkidle");

    const task1 = page.locator("[data-task-id]").filter({ hasText: title1 });
    const task2 = page.locator("[data-task-id]").filter({ hasText: title2 });
    await modifierClick(page, task1);
    await modifierClick(page, task2);

    await expect(page.getByTestId("bulk-action-bar")).toBeVisible();
    await page.getByTestId("bulk-action-bar").getByRole("button", { name: "Complete" }).click();

    await expect(page.getByText(title1)).not.toBeVisible({ timeout: 8000 });
    await expect(page.getByText(title2)).not.toBeVisible({ timeout: 8000 });
  });

  test("bulk delete removes tasks from inbox", async ({ page }) => {
    await page.goto("/inbox");
    await page.waitForLoadState("networkidle");

    const title = `Bulk delete ${Date.now()}`;
    await page.keyboard.press("n");
    await page.getByPlaceholder(/new task/i).fill(title);
    await page.keyboard.press("Enter");
    await expect(page.getByText(title)).toBeVisible();
    await page.waitForLoadState("networkidle");

    const task = page.locator("[data-task-id]").filter({ hasText: title });
    await modifierClick(page, task);
    await page.getByTestId("bulk-action-bar").getByRole("button", { name: "Delete" }).click();

    await expect(page.getByText(title)).not.toBeVisible({ timeout: 8000 });
  });
});
