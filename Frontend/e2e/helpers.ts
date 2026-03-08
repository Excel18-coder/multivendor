/**
 * Shared test helpers & fixtures for Urban Stores E2E tests.
 *
 * All credentials are read exclusively from environment variables so the
 * suite can run against any environment without code changes:
 *
 *   E2E_USER_EMAIL       – buyer account email
 *   E2E_USER_PASSWORD    – buyer account password
 *   E2E_SELLER_EMAIL     – seller account email
 *   E2E_SELLER_PASSWORD  – seller account password
 */
import { Page, expect } from "@playwright/test";

// ─── Credentials ──────────────────────────────────────────────────────────────

export const TEST_USER = {
  email: process.env.E2E_USER_EMAIL ?? "",
  password: process.env.E2E_USER_PASSWORD ?? "",
  name: process.env.E2E_USER_NAME ?? "E2E Test Buyer",
};

export const TEST_SELLER = {
  email: process.env.E2E_SELLER_EMAIL ?? "",
  password: process.env.E2E_SELLER_PASSWORD ?? "",
  name: process.env.E2E_SELLER_NAME ?? "E2E Test Seller",
};

/** Returns true when buyer credentials have been supplied via env vars. */
export function hasBuyerCredentials(): boolean {
  return Boolean(TEST_USER.email && TEST_USER.password);
}

/** Returns true when seller credentials have been supplied via env vars. */
export function hasSellerCredentials(): boolean {
  return Boolean(TEST_SELLER.email && TEST_SELLER.password);
}

// ─── Auth helpers ─────────────────────────────────────────────────────────────

/**
 * Sign in via the /auth page using real credentials against the live backend.
 * Returns true when sign-in succeeded (navigated away from /auth).
 * Returns false when the backend rejected the credentials or the redirect
 * did not happen within the timeout.
 */
export async function signIn(
  page: Page,
  email: string,
  password: string
): Promise<boolean> {
  await page.goto("/auth");
  await page.waitForSelector("#signin-email", { timeout: 10_000 });
  await page.fill("#signin-email", email);
  await page.fill("#signin-password", password);
  await page
    .locator("form")
    .filter({ has: page.locator("#signin-email") })
    .locator('button[type="submit"]')
    .click();
  try {
    await page.waitForURL(
      (url) => !url.pathname.startsWith("/auth"),
      { timeout: 15_000 }
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Sign in as the configured test seller via /seller-auth.
 * Returns true on success, false otherwise.
 */
export async function signInSeller(page: Page): Promise<boolean> {
  await page.goto("/seller-auth");
  await page.waitForSelector("input[type='email'], #signin-email", {
    timeout: 10_000,
  });
  const emailInput = page.locator("#signin-email, input[type='email']").first();
  const passwordInput = page
    .locator("#signin-password, input[type='password']")
    .first();
  await emailInput.fill(TEST_SELLER.email);
  await passwordInput.fill(TEST_SELLER.password);
  await page.locator('button[type="submit"]').first().click();
  try {
    await page.waitForURL(
      (url) =>
        !url.pathname.startsWith("/seller-auth") &&
        !url.pathname.startsWith("/auth"),
      { timeout: 15_000 }
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Clear all auth state from localStorage.
 */
export async function clearAuthState(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");
  });
}

// ─── Page helpers ─────────────────────────────────────────────────────────────

/**
 * Wait for the page's main loading spinner to disappear.
 */
export async function waitForLoadingToFinish(page: Page): Promise<void> {
  await page.waitForTimeout(300);
  const spinner = page.locator(".animate-spin");
  try {
    await spinner.first().waitFor({ state: "hidden", timeout: 15_000 });
  } catch {
    // No spinner visible – fine
  }
}

/**
 * Assert the header is present on the page.
 * The "Urban Stores" brand text is CSS-hidden on mobile (hidden sm:block) and
 * is therefore not checked here – only the header element itself.
 */
export async function expectHeaderVisible(page: Page): Promise<void> {
  await expect(page.locator("header")).toBeVisible();
  await expect(
    page.locator("header").locator("a, button, img").first()
  ).toBeVisible();
}
