import { expect, test } from "@playwright/test";

test("home page responds", async ({ page }) => {
  const res = await page.goto("/");
  expect(res?.ok()).toBeTruthy();
  await expect(page).toHaveTitle(/MBTI/i);
});

test("test list page loads", async ({ page }) => {
  const res = await page.goto("/testlist.html");
  expect(res?.ok()).toBeTruthy();
});

test("admin page loads (noindex)", async ({ page }) => {
  const res = await page.goto("/admin.html");
  expect(res?.ok()).toBeTruthy();
  await expect(page).toHaveTitle(/관리자/);
});
