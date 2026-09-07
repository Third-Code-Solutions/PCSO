import { test, expect } from "@playwright/test";
import { getAdminCredentials, signIn } from "./fixtures/auth";

/**
 * Payroll E2E test skeleton.
 *
 * Full end-to-end payroll tests require:
 * - A seeded test database with employees, salary grades, and government rates
 * - Isolated payroll periods that don't collide with existing data
 *
 * Implement complete flows in Phase 16 when E2E database seeding is in place.
 * These tests cover navigation, UI structure, and guard rails.
 */
test.describe("Payroll", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, getAdminCredentials());
  });

  test.describe("Payroll Periods", () => {
    test("payroll list page loads", async ({ page }) => {
      await page.goto("/payroll");
      await expect(
        page.getByRole("heading", { name: /payroll/i }),
      ).toBeVisible();
    });

    test("payroll list shows period columns", async ({ page }) => {
      await page.goto("/payroll");
      const columnHeaders = page.getByRole("columnheader");
      await expect(
        columnHeaders.filter({ hasText: /period|month/i }),
      ).toBeVisible();
      await expect(columnHeaders.filter({ hasText: /status/i })).toBeVisible();
    });

    test("create payroll period button is visible for authorized user", async ({
      page,
    }) => {
      await page.goto("/payroll");
      await expect(
        page.getByRole("button", { name: /create period|new period/i }),
      ).toBeVisible();
    });
  });

  test.describe("Payroll Processing Guard Rails", () => {
    test("processing a payroll period requires confirmation", async ({
      page,
    }) => {
      await page.goto("/payroll");

      const draftRow = page
        .getByRole("row")
        .filter({ hasText: /draft/i })
        .first();
      const hasDraft = await draftRow.isVisible();

      if (!hasDraft) {
        test.skip();
        return;
      }

      await draftRow.getByRole("button", { name: /process/i }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await expect(
        page.getByText(/are you sure|confirm process/i),
      ).toBeVisible();
    });

    test("approved payroll period cannot be edited", async ({ page }) => {
      await page.goto("/payroll");

      const approvedRow = page
        .getByRole("row")
        .filter({ hasText: /approved/i })
        .first();
      const hasApproved = await approvedRow.isVisible();

      if (!hasApproved) {
        test.skip();
        return;
      }

      // Edit controls should not be present for approved periods
      const editButton = approvedRow.getByRole("button", { name: /edit/i });
      await expect(editButton).not.toBeVisible();
    });
  });

  test.describe("Payslip Generation", () => {
    test("payslip page is accessible from an approved period", async ({
      page,
    }) => {
      await page.goto("/payroll");

      const approvedRow = page
        .getByRole("row")
        .filter({ hasText: /approved/i })
        .first();
      const hasApproved = await approvedRow.isVisible();

      if (!hasApproved) {
        test.skip();
        return;
      }

      await approvedRow.getByRole("link", { name: /view|payslips/i }).click();
      await expect(page).toHaveURL(/\/payroll\/.+/);
    });
  });

  // Full flow: create period → compute → approve → generate payslips
  // Skip until Phase 16 database seeding is implemented
  test.skip("full payroll run end-to-end", async ({ page }) => {
    // Step 1: Create payroll period
    await page.goto("/payroll");
    await page.getByRole("button", { name: /create period/i }).click();
    // ... fill period details, submit, verify computation, approve
  });
});
