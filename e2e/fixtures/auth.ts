import { type Page } from '@playwright/test';

export interface TestCredentials {
  email: string;
  password: string;
}

export function getAdminCredentials(): TestCredentials {
  const email = process.env.E2E_ADMIN_EMAIL;
  const password = process.env.E2E_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD environment variables must be set for E2E tests.'
    );
  }

  return { email, password };
}

export function getEmployeeCredentials(): TestCredentials {
  const email = process.env.E2E_EMPLOYEE_EMAIL;
  const password = process.env.E2E_EMPLOYEE_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'E2E_EMPLOYEE_EMAIL and E2E_EMPLOYEE_PASSWORD environment variables must be set for E2E tests.'
    );
  }

  return { email, password };
}

/**
 * Signs in a user via the login page and waits for the dashboard to load.
 * Reuse this in beforeEach blocks to establish an authenticated session.
 */
export async function signIn(page: Page, credentials: TestCredentials): Promise<void> {
  await page.goto('/login');
  await page.waitForURL('**/login');

  await page.getByLabel('Email').fill(credentials.email);
  await page.getByLabel('Password').fill(credentials.password);
  await page.getByRole('button', { name: /sign in/i }).click();

  // Wait for redirect to dashboard after successful auth
  await page.waitForURL('**/dashboard', { timeout: 15_000 });
}

/**
 * Signs out the current user via the user menu.
 */
export async function signOut(page: Page): Promise<void> {
  await page.getByRole('button', { name: /user menu|account/i }).click();
  await page.getByRole('menuitem', { name: /sign out|log out/i }).click();
  await page.waitForURL('**/login', { timeout: 10_000 });
}

/**
 * Saves authentication state to a file so it can be reused across tests
 * without repeating the full sign-in flow.
 */
export async function saveAuthState(page: Page, storagePath: string): Promise<void> {
  await page.context().storageState({ path: storagePath });
}
