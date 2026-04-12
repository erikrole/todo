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
