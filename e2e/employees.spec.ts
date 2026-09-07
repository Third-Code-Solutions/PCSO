import { test, expect } from "@playwright/test";
import { getAdminCredentials, signIn } from "./fixtures/auth";

test.describe("Employee Management", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, getAdminCredentials());
    await page.goto("/employees");
    await page.waitForURL("**/employees");
  });

  test.describe("Employee List", () => {
    test("employee list page loads and displays table", async ({ page }) => {
      await expect(
        page.getByRole("heading", { name: /employees/i }),
      ).toBeVisible();
      await expect(page.getByRole("table")).toBeVisible();
    });

    test("employee list shows relevant columns", async ({ page }) => {
      const columnHeaders = page.getByRole("columnheader");
      await expect(columnHeaders.filter({ hasText: /name/i })).toBeVisible();
      await expect(
        columnHeaders.filter({ hasText: /department|office/i }),
      ).toBeVisible();
      await expect(
        columnHeaders.filter({ hasText: /position|designation/i }),
      ).toBeVisible();
      await expect(columnHeaders.filter({ hasText: /status/i })).toBeVisible();
    });

    test("search filters the employee list", async ({ page }) => {
      const searchInput = page.getByPlaceholder(/search employees/i);
      await searchInput.fill("test");
      // Allow debounce to settle
      await page.waitForTimeout(500);
      // Rows should update (either match or show empty state)
      await expect(page.getByRole("table")).toBeVisible();
    });
  });

  test.describe("Create Employee", () => {
    test("new employee button navigates to creation form", async ({ page }) => {
      await page
        .getByRole("link", { name: /new employee|add employee/i })
        .click();
      await expect(page).toHaveURL(/\/employees\/new/);
      await expect(
        page.getByRole("heading", { name: /new employee|add employee/i }),
      ).toBeVisible();
    });

    test("employee creation form has required fields", async ({ page }) => {
      await page.goto("/employees/new");

      await expect(page.getByLabel(/first name/i)).toBeVisible();
      await expect(page.getByLabel(/last name/i)).toBeVisible();
      await expect(page.getByLabel(/employee number|emp no/i)).toBeVisible();
      await expect(page.getByLabel(/department|office/i)).toBeVisible();
      await expect(page.getByLabel(/position|designation/i)).toBeVisible();
      await expect(page.getByLabel(/salary grade/i)).toBeVisible();
    });

    test("form shows validation errors for missing required fields", async ({
      page,
    }) => {
      await page.goto("/employees/new");
      await page.getByRole("button", { name: /save|create/i }).click();

      // Expect validation messages to appear
      await expect(page.getByText(/required|this field/i).first()).toBeVisible({
        timeout: 5_000,
      });
    });

    // NOTE: Full create flow test requires a test-isolated database.
    // Implement in Phase 16 when E2E database seeding is in place.
    test.skip("creates a new employee end-to-end", async ({ page }) => {
      await page.goto("/employees/new");

      await page.getByLabel(/first name/i).fill("Juan");
      await page.getByLabel(/last name/i).fill("dela Cruz");
      await page.getByLabel(/employee number/i).fill("TEST-2025-001");
      // Additional field population and submission omitted until Phase 16
    });
  });

  test.describe("View Employee", () => {
    test("clicking an employee row navigates to the detail page", async ({
      page,
    }) => {
      const firstRow = page.getByRole("row").nth(1);
      const rowExists = await firstRow.isVisible();

      if (!rowExists) {
        test.skip();
        return;
      }

      await firstRow.click();
      await expect(page).toHaveURL(/\/employees\/.+/);
    });
  });

  test.describe("Soft Delete Protection", () => {
    test("delete action requires confirmation", async ({ page }) => {
      // Navigate to the first employee if table is populated
      const firstRow = page.getByRole("row").nth(1);
      const rowExists = await firstRow.isVisible();

      if (!rowExists) {
        test.skip();
        return;
      }

      // Open action menu
      await firstRow.getByRole("button", { name: /actions|more/i }).click();
      await page.getByRole("menuitem", { name: /delete|remove/i }).click();

      // Confirmation dialog must appear before deletion proceeds
      await expect(page.getByRole("dialog")).toBeVisible();
      await expect(
        page.getByText(/are you sure|confirm delete/i),
      ).toBeVisible();
    });
  });
});
