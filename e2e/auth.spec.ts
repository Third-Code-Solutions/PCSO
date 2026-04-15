import { test, expect } from '@playwright/test';
import { getAdminCredentials, getEmployeeCredentials, signIn, signOut } from './fixtures/auth';

test.describe('Authentication', () => {
  test.describe('Login', () => {
    test('login page renders correctly', async ({ page }) => {
      await page.goto('/login');

      await expect(page).toHaveTitle(/senate hris|login/i);
      await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
      await expect(page.getByLabel('Email')).toBeVisible();
      await expect(page.getByLabel('Password')).toBeVisible();
      await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
    });

    test('shows validation errors for empty submission', async ({ page }) => {
      await page.goto('/login');
      await page.getByRole('button', { name: /sign in/i }).click();

      // Expect native HTML5 or custom validation to surface
      await expect(page.getByLabel('Email')).toBeFocused();
    });

    test('shows error message for invalid credentials', async ({ page }) => {
      await page.goto('/login');

      await page.getByLabel('Email').fill('nobody@example.com');
      await page.getByLabel('Password').fill('wrong-password-123');
      await page.getByRole('button', { name: /sign in/i }).click();

      await expect(
        page.getByText(/invalid credentials|incorrect email or password/i)
      ).toBeVisible({ timeout: 8_000 });
    });

    test('admin can sign in and reach dashboard', async ({ page }) => {
      const creds = getAdminCredentials();
      await signIn(page, creds);

      await expect(page).toHaveURL(/\/dashboard/);
      await expect(page.getByRole('navigation')).toBeVisible();
    });

    test('employee can sign in and reach dashboard', async ({ page }) => {
      const creds = getEmployeeCredentials();
      await signIn(page, creds);

      await expect(page).toHaveURL(/\/dashboard/);
    });

    test('unauthenticated user is redirected to login from protected route', async ({ page }) => {
      // Navigate directly to a protected route without authenticating
      await page.goto('/dashboard/employees');
      await expect(page).toHaveURL(/\/login/);
    });
  });

  test.describe('Logout', () => {
    test.beforeEach(async ({ page }) => {
      await signIn(page, getAdminCredentials());
    });

    test('admin can sign out and is redirected to login', async ({ page }) => {
      await signOut(page);

      await expect(page).toHaveURL(/\/login/);
    });

    test('after sign-out, protected routes redirect back to login', async ({ page }) => {
      await signOut(page);

      await page.goto('/dashboard/employees');
      await expect(page).toHaveURL(/\/login/);
    });
  });

  test.describe('Access Control', () => {
    test('employee cannot access admin-only pages', async ({ page }) => {
      await signIn(page, getEmployeeCredentials());

      // Attempt to navigate to admin-only configuration pages
      await page.goto('/dashboard/admin');

      // Expect either a redirect or a 403/forbidden UI
      const url = page.url();
      const hasAccessDenied = await page.getByText(/access denied|forbidden|not authorized/i).isVisible();
      const wasRedirected = !url.includes('/admin');

      expect(hasAccessDenied || wasRedirected).toBeTruthy();
    });
  });
});
