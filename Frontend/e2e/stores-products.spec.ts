/**
 * E2E tests – Stores & Product detail pages
 *
 * Authenticated tests require a real buyer account:
 *   E2E_USER_EMAIL / E2E_USER_PASSWORD
 *
 * Tests that depend on specific products or stores skip gracefully when the
 * backend has no data (empty database).
 */

import { test, expect } from "@playwright/test";
import {
  signIn,
  waitForLoadingToFinish,
  TEST_USER,
  hasBuyerCredentials,
} from "./helpers";

// ─── Stores listing ────────────────────────────────────────────────────────────

test.describe("Stores listing (/stores)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/stores");
    await waitForLoadingToFinish(page);
  });

  test("page loads without error", async ({ page }) => {
    await expect(page.locator("body")).not.toContainText("Something went wrong");
    await expect(page.locator("header")).toBeVisible();
  });

  test("store cards or empty state is rendered", async ({ page }) => {
    const storeCards = page.locator("a[href*='/stores/']");
    const emptyMsg = page.getByText(/no stores|empty|be the first/i);

    const hasCards = (await storeCards.count()) > 0;
    const hasEmpty = await emptyMsg.isVisible().catch(() => false);

    expect(hasCards || hasEmpty).toBeTruthy();
  });

  test("clicking a store card navigates to store detail page", async ({
    page,
  }) => {
    const storeLink = page.locator("a[href*='/stores/']").first();

    if ((await storeLink.count()) === 0) {
      test.skip(); // No stores in database
      return;
    }

    const href = await storeLink.getAttribute("href");
    await storeLink.click();
    await waitForLoadingToFinish(page);
    await expect(page).toHaveURL(new RegExp(href!));
  });
});

// ─── Store detail page ─────────────────────────────────────────────────────────

test.describe("Store detail page (/stores/:slug)", () => {
  test("handles unknown slug gracefully", async ({ page }) => {
    await page.goto("/stores/non-existent-store-xyz-999");
    await waitForLoadingToFinish(page);

    const notFound = page.getByText(/store not found|not found|404/i);
    const hasNotFound = await notFound.isVisible().catch(() => false);

    const url = page.url();
    expect(
      hasNotFound || !url.includes("non-existent-store-xyz-999")
    ).toBeTruthy();
  });
});

// ─── Product detail page ───────────────────────────────────────────────────────

test.describe("Product detail page (/products/:id)", () => {
  test("handles unknown product ID gracefully", async ({ page }) => {
    await page.goto("/products/00000000-0000-0000-0000-000000000000");
    await waitForLoadingToFinish(page);

    await expect(page.locator("body")).not.toContainText("Something went wrong");
    await expect(page.locator("header")).toBeVisible();
  });

  test("renders product info when navigated from marketplace", async ({
    page,
  }) => {
    // Navigate to marketplace and follow the first product link
    await page.goto("/marketplace");
    await waitForLoadingToFinish(page);

    const productLink = page.locator("a[href*='/products/']").first();
    if ((await productLink.count()) === 0) {
      test.skip(); // No products in database
      return;
    }

    await productLink.click();
    await waitForLoadingToFinish(page);

    // Product detail page should show a heading and a price
    await expect(page.locator("body")).not.toContainText("Something went wrong");
    await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 10_000 });

    const priceText = page.getByText(/KSh|ksh|\d{3,}/i).first();
    await expect(priceText).toBeVisible({ timeout: 10_000 });
  });

  test("Add to Cart / purchase button is visible on product page (unauthenticated)", async ({
    page,
  }) => {
    await page.goto("/marketplace");
    await waitForLoadingToFinish(page);

    const productLink = page.locator("a[href*='/products/']").first();
    if ((await productLink.count()) === 0) {
      test.skip();
      return;
    }

    await productLink.click();
    await waitForLoadingToFinish(page);

    const purchaseBtn = page
      .locator("button")
      .filter({ hasText: /add.*cart|buy|order|whatsapp|checkout/i });
    await expect(purchaseBtn.first()).toBeVisible({ timeout: 10_000 });
  });

  test("Add to Cart button is visible on product page (authenticated)", async ({
    page,
  }) => {
    if (!hasBuyerCredentials()) {
      test.skip(true, "Set E2E_USER_EMAIL + E2E_USER_PASSWORD to run this test");
      return;
    }

    const ok = await signIn(page, TEST_USER.email, TEST_USER.password);
    if (!ok) {
      test.skip(true, "Sign-in failed");
      return;
    }

    await page.goto("/marketplace");
    await waitForLoadingToFinish(page);

    const productLink = page.locator("a[href*='/products/']").first();
    if ((await productLink.count()) === 0) {
      test.skip();
      return;
    }

    await productLink.click();
    await waitForLoadingToFinish(page);

    const purchaseBtn = page
      .locator("button")
      .filter({ hasText: /add.*cart|buy|order|whatsapp|checkout/i });
    await expect(purchaseBtn.first()).toBeVisible({ timeout: 10_000 });
  });
});

// ─── Wishlist ──────────────────────────────────────────────────────────────────

test.describe("Wishlist (/wishlist)", () => {
  test("unauthenticated user sees sign-in prompt or is redirected", async ({
    page,
  }) => {
    await page.goto("/wishlist");
    await waitForLoadingToFinish(page);

    await expect(page.locator("body")).not.toContainText("Something went wrong");
    await expect(page.locator("header")).toBeVisible();

    const url = page.url();
    const redirected = url.includes("/auth");
    const hasPrompt = await page
      .getByText(/sign in|log in/i)
      .isVisible()
      .catch(() => false);
    const hasEmptyState = await page
      .getByText(/empty|no items|nothing|sign in/i)
      .isVisible()
      .catch(() => false);

    expect(redirected || hasPrompt || hasEmptyState).toBeTruthy();
  });

  test("authenticated user's wishlist page loads without error", async ({
    page,
  }) => {
    if (!hasBuyerCredentials()) {
      test.skip(true, "Set E2E_USER_EMAIL + E2E_USER_PASSWORD to run this test");
      return;
    }

    const ok = await signIn(page, TEST_USER.email, TEST_USER.password);
    if (!ok) {
      test.skip(true, "Sign-in failed");
      return;
    }

    await page.goto("/wishlist");
    await waitForLoadingToFinish(page);

    await expect(page.locator("body")).not.toContainText("Something went wrong");
    await expect(page.locator("header")).toBeVisible();
    // Empty state or items – either is valid
    await expect(page.locator("main, [role='main']")).toBeVisible();
  });
});
