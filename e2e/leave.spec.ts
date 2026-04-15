import { test, expect } from '@playwright/test';
import { getAdminCredentials, getEmployeeCredentials, signIn } from './fixtures/auth';

/**
 * Leave Management E2E test skeleton.
 *
 * Full end-to-end leave tests (application → approval → balance deduction)
 * require seeded employee data with configured leave credits.
 *
 * Tests here cover navigation, UI structure, and permission guard rails.
 * Complete flow tests are deferred to Phase 16.
 */
test.describe('Leave Management', () => {
  test.describe('Employee Self-Service — Leave Application', () => {
    test.beforeEach(async ({ page }) => {
      await signIn(page, getEmployeeCredentials());
    });

    test('leave application page loads for employee', async ({ page }) => {
      await page.goto('/dashboard/leave');
      await expect(page.getByRole('heading', { name: /leave/i })).toBeVisible();
    });

    test('leave balance summary is visible', async ({ page }) => {
      await page.goto('/dashboard/leave');
      await expect(
        page.getByText(/vacation leave|sick leave|vl balance|sl balance/i).first()
      ).toBeVisible();
    });

    test('apply for leave button is visible', async ({ page }) => {
      await page.goto('/dashboard/leave');
      await expect(
        page.getByRole('button', { name: /apply|file leave|new leave/i })
      ).toBeVisible();
    });

    test('leave application form has required fields', async ({ page }) => {
      await page.goto('/dashboard/leave');
      await page.getByRole('button', { name: /apply|file leave|new leave/i }).click();

      await expect(page.getByLabel(/leave type/i)).toBeVisible();
      await expect(page.getByLabel(/start date|from/i)).toBeVisible();
      await expect(page.getByLabel(/end date|to/i)).toBeVisible();
    });

    test('leave application form validates date range', async ({ page }) => {
      await page.goto('/dashboard/leave');
      await page.getByRole('button', { name: /apply|file leave|new leave/i }).click();

      // Attempt to submit with end date before start date
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);

      const startDate = today.toISOString().split('T')[0];
      const endDate = yesterday.toISOString().split('T')[0];

      await page.getByLabel(/start date|from/i).fill(startDate);
      await page.getByLabel(/end date|to/i).fill(endDate);
      await page.getByRole('button', { name: /submit|file/i }).click();

      await expect(
        page.getByText(/invalid date range|end date must be after/i)
      ).toBeVisible({ timeout: 5_000 });
    });

    test('employee can view their own leave history', async ({ page }) => {
      await page.goto('/dashboard/leave/history');
      await expect(page.getByRole('table')).toBeVisible();
    });
  });

  test.describe('Leave Approver — Approval Workflow', () => {
    test.beforeEach(async ({ page }) => {
      // Admin account is assumed to have leave_approver or hr_admin role
      await signIn(page, getAdminCredentials());
    });

    test('pending leave approvals list is accessible', async ({ page }) => {
      await page.goto('/dashboard/leave/approvals');
      await expect(page.getByRole('heading', { name: /leave approvals|pending leaves/i })).toBeVisible();
    });

    test('approver can see applicant details before acting', async ({ page }) => {
      await page.goto('/dashboard/leave/approvals');

      const firstPending = page.getByRole('row').filter({ hasText: /pending/i }).first();
      const hasPending = await firstPending.isVisible();

      if (!hasPending) {
        test.skip();
        return;
      }

      await firstPending.getByRole('link', { name: /view|details/i }).click();
      await expect(page.getByText(/applicant|employee name/i)).toBeVisible();
      await expect(page.getByText(/leave type/i)).toBeVisible();
    });

    test('approval action requires confirmation', async ({ page }) => {
      await page.goto('/dashboard/leave/approvals');

      const firstPending = page.getByRole('row').filter({ hasText: /pending/i }).first();
      const hasPending = await firstPending.isVisible();

      if (!hasPending) {
        test.skip();
        return;
      }

      await firstPending.getByRole('button', { name: /approve/i }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
    });
  });

  // Full flow: apply → approve → verify balance deduction
  // Skip until Phase 16 database seeding is implemented
  test.skip('full leave application and approval flow', async ({ page }) => {
    // Step 1: Employee files leave
    await signIn(page, getEmployeeCredentials());
    await page.goto('/dashboard/leave');
    // ... fill form, submit, verify pending status

    // Step 2: Approver approves
    await signIn(page, getAdminCredentials());
    // ... navigate to approvals, approve, verify
  });
});
