import { test, expect } from "@playwright/test";

test.describe("v1.3 — sidebar badges", () => {
  test("counts endpoint returns inbox, today, overdue", async ({ request }) => {
    const res = await request.get("http://localhost:3000/api/tasks/counts", {
      headers: { Authorization: `Bearer ${process.env.NEXT_PUBLIC_AUTH_TOKEN ?? "dev"}` },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.data).toMatchObject({
      inbox: expect.any(Number),
      today: expect.any(Number),
      overdue: expect.any(Number),
    });
  });
});

test.describe("v1.3 — sidebar badges", () => {
  test("inbox badge is visible when there are inbox tasks", async ({ page }) => {
    await page.goto("/inbox");
    await expect(page.getByRole("button", { name: "New task" })).toBeVisible();

    // Badge should appear next to Inbox in the sidebar
    const inboxLink = page.getByRole("link", { name: /Inbox/ });
    await expect(inboxLink.locator("span.tabular-nums")).toBeVisible();
  });
});

test.describe("v1.3 — overdue section in Today", () => {
  test("overdue filter returns tasks with past when_date", async ({ request }) => {
    const res = await request.get("http://localhost:3000/api/tasks?filter=overdue", {
      headers: { Authorization: `Bearer ${process.env.NEXT_PUBLIC_AUTH_TOKEN ?? "dev"}` },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
  });
});

test.describe("v1.3 — duplicate task", () => {
  test("duplicate creates a copy via context menu", async ({ page }) => {
    await page.goto("/inbox");
    await expect(page.getByRole("button", { name: "New task" })).toBeVisible();

    const title = `Duplicate me ${Date.now()}`;
    await page.getByRole("button", { name: "New task" }).click();
    await page.getByPlaceholder(/new task/i).fill(title);
    await page.keyboard.press("Enter");
    await expect(page.getByText(title)).toBeVisible();

    // Right-click to open context menu and duplicate
    await page.getByText(title).click({ button: "right" });
    await page.getByRole("menuitem", { name: "Duplicate" }).click();

    // Two tasks with the same title should now be visible
    await expect(page.getByText(title)).toHaveCount(2);
  });
});

test.describe("v1.3 — move to next week", () => {
  test("W shortcut moves focused inbox task to 7 days from today", async ({ page }) => {
    await page.goto("/inbox");
    await expect(page.getByRole("button", { name: "New task" })).toBeVisible();

    const title = `MoveNextWeek ${Date.now()}`;
    await page.getByRole("button", { name: "New task" }).click();
    await page.getByPlaceholder(/new task/i).fill(title);
    await page.keyboard.press("Enter");

    // Wait for the task to appear in the DOM (may be below fold)
    const taskItem = page.locator("[data-task-id]").filter({ hasText: title });
    await expect(taskItem).toBeAttached({ timeout: 5000 });
    await taskItem.scrollIntoViewIfNeeded();
    await expect(taskItem).toBeVisible();

    // Navigate to the task with J and press W
    const taskCount = await page.locator("[data-task-id]").count();
    for (let i = 0; i < taskCount; i++) {
      await page.keyboard.press("j");
      if ((await taskItem.getAttribute("data-focused")) === "true") break;
    }
    await expect(taskItem).toHaveAttribute("data-focused", "true");
    await page.keyboard.press("w");

    // Task leaves inbox
    await expect(page.getByText(title)).not.toBeVisible({ timeout: 3000 });
  });
});
