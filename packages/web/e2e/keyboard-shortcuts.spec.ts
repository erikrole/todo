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

test.describe("Keyboard shortcuts — task navigation", () => {
  test("J focuses the first task, second J moves to the next", async ({ page }) => {
    await page.goto("/inbox");

    // Create two tasks to navigate between
    const t1 = `Nav task A ${Date.now()}`;
    const t2 = `Nav task B ${Date.now()}`;
    await page.getByRole("button", { name: "New task" }).click();
    await page.getByPlaceholder(/new task/i).fill(t1);
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: "New task" }).click();
    await page.getByPlaceholder(/new task/i).fill(t2);
    await page.keyboard.press("Enter");

    // Press J — should focus first task (indigo border)
    await page.keyboard.press("j");
    const firstTask = page.locator(`[data-task-id]`).first();
    await expect(firstTask).toHaveAttribute("data-focused", "true");

    // Press J again — should move to next task
    await page.keyboard.press("j");
    const secondTask = page.locator(`[data-task-id]`).nth(1);
    await expect(secondTask).toHaveAttribute("data-focused", "true");
  });

  test("K moves focus backwards", async ({ page }) => {
    await page.goto("/inbox");

    const title = `Nav K test ${Date.now()}`;
    await page.getByRole("button", { name: "New task" }).click();
    await page.getByPlaceholder(/new task/i).fill(title);
    await page.keyboard.press("Enter");

    await page.keyboard.press("j"); // focus first
    await page.keyboard.press("j"); // move to second (if exists) or stays
    await page.keyboard.press("k"); // move back
    const firstTask = page.locator(`[data-task-id]`).first();
    await expect(firstTask).toHaveAttribute("data-focused", "true");
  });
});

test.describe("Keyboard shortcuts — task actions", () => {
  test("C completes the focused task", async ({ page }) => {
    await page.goto("/inbox");

    const title = `Complete via C ${Date.now()}`;
    await page.getByRole("button", { name: "New task" }).click();
    await page.getByPlaceholder(/new task/i).fill(title);
    await page.keyboard.press("Enter");
    await expect(page.getByText(title)).toBeVisible();

    // Focus the task with J, then complete with C
    await page.keyboard.press("j");
    await page.keyboard.press("c");

    await expect(page.getByText(title)).not.toBeVisible({ timeout: 3000 });
  });

  test("T moves focused task to Today", async ({ page }) => {
    await page.goto("/inbox");

    const title = `Move to Today ${Date.now()}`;
    await page.getByRole("button", { name: "New task" }).click();
    await page.getByPlaceholder(/new task/i).fill(title);
    await page.keyboard.press("Enter");

    await page.keyboard.press("j");
    await page.keyboard.press("t");

    // Task should leave inbox
    await expect(page.getByText(title)).not.toBeVisible({ timeout: 2000 });
  });
});

test.describe("Keyboard shortcuts — new task", () => {
  test("N opens the quick-add input", async ({ page }) => {
    await page.goto("/inbox");
    await page.keyboard.press("n");
    await expect(page.getByPlaceholder(/new task/i)).toBeVisible();
    await expect(page.getByPlaceholder(/new task/i)).toBeFocused();
  });
});

test.describe("Keyboard shortcuts — overlay", () => {
  test("? opens the shortcuts reference overlay", async ({ page }) => {
    await page.goto("/inbox");
    await page.keyboard.press("?");
    await expect(page.getByText("Keyboard Shortcuts")).toBeVisible();
    await expect(page.getByText("Go to Today")).toBeVisible();
  });

  test("Esc closes the overlay", async ({ page }) => {
    await page.goto("/inbox");
    await page.keyboard.press("?");
    await expect(page.getByText("Keyboard Shortcuts")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByText("Keyboard Shortcuts")).not.toBeVisible({ timeout: 1000 });
  });
});

test.describe("Keyboard shortcuts — settings page", () => {
  test("settings page loads and lists shortcuts", async ({ page }) => {
    await page.goto("/settings/shortcuts");
    await expect(page.getByRole("heading", { name: "Keyboard Shortcuts" })).toBeVisible();
    await expect(page.getByText("Go to Today")).toBeVisible();
    await expect(page.getByText("Complete task")).toBeVisible();
  });

  test("toggle disables a shortcut", async ({ page }) => {
    await page.evaluate(() => localStorage.clear());
    await page.goto("/settings/shortcuts");

    // Find the toggle for "Go to Today" and click it (turns off)
    const todayRow = page.locator("tr").filter({ hasText: "Go to Today" });
    const toggle = todayRow.getByRole("switch");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "false");

    // Verify shortcut no longer navigates
    await page.goto("/inbox");
    await page.keyboard.press("Meta+1");
    await expect(page).toHaveURL(/\/inbox/); // stayed on inbox

    // Re-enable for cleanup
    await page.goto("/settings/shortcuts");
    const todayRow2 = page.locator("tr").filter({ hasText: "Go to Today" });
    await todayRow2.getByRole("switch").click();
  });
});
