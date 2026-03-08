/**
 * E2E tests – Cart (/cart)
 *
 * Authenticated tests require a real buyer account configured via:
 *   E2E_USER_EMAIL / E2E_USER_PASSWORD
 *
 * Tests gracefully skip when credentials are absent and adapt their
 * assertions to the actual state of the cart (empty or with items).
 */

import { test, expect } from "@playwright/test";
import {
  signIn,
  waitForLoadingToFinish,
  TEST_USER,
  hasBuyerCredentials,
} from "./helpers";

// ─── Unauthenticated ──────────────────────────────────────────────────────────

test.describe("Cart – unauthenticated", () => {
  test("renders without crashing and shows a sign-in prompt or empty state", async ({
    page,
  }) => {
    await page.goto("/cart");
    await waitForLoadingToFinish(page);

    await expect(page.locator("body")).not.toContainText("Something went wrong");
    await expect(page.locator("header")).toBeVisible();

    const url = page.url();
    const isOnAuth = url.includes("/auth");
    const hasSignInText = await page
      .locator("body")
      .getByText(/sign in|log in|please sign/i)
      .isVisible()
      .catch(() => false);
    const hasEmptyState = await page
      .locator("body")
      .getByText(/empty|no items|nothing/i)
      .isVisible()
      .catch(() => false);

    expect(isOnAuth || hasSignInText || hasEmptyState).toBeTruthy();
  });
});

// ─── Authenticated ────────────────────────────────────────────────────────────

test.describe("Cart – authenticated", () => {
  test.beforeEach(async ({ page }) => {
    if (!hasBuyerCredentials()) {
      test.skip(true, "Set E2E_USER_EMAIL + E2E_USER_PASSWORD to run authenticated cart tests");
      return;
    }
    const ok = await signIn(page, TEST_USER.email, TEST_USER.password);
    if (!ok) {
      test.skip(true, "Sign-in failed – verify E2E_USER_EMAIL / E2E_USER_PASSWORD");
    }
  });

  test("cart page loads without error", async ({ page }) => {
    await page.goto("/cart");
    await waitForLoadingToFinish(page);

    await expect(page.locator("body")).not.toContainText("Something went wrong");
    await expect(page.locator("header")).toBeVisible();
  });

  test("cart shows either empty state or item list", async ({ page }) => {
    await page.goto("/cart");
    await waitForLoadingToFinish(page);

    const hasItems =
      (await page.locator("main img[alt], [class*='cart'] img").count()) > 0;
    const hasEmptyMsg = await page
      .getByText(/empty|no items|nothing in your cart|start shopping/i)
      .isVisible()
      .catch(() => false);
    const hasContinueBtn = await page
      .locator("a, button")
      .filter({ hasText: /continue shopping|browse|marketplace/i })
      .first()
      .isVisible()
      .catch(() => false);

    expect(hasItems || hasEmptyMsg || hasContinueBtn).toBeTruthy();
  });

  test('"Continue Shopping" CTA is visible on empty cart', async ({ page }) => {
    await page.goto("/cart");
    await waitForLoadingToFinish(page);

    const isEmpty = await page
      .getByText(/empty|no items|nothing|start shopping/i)
      .isVisible()
      .catch(() => false);

    if (!isEmpty) {
      test.skip();
      return;
    }

    const cta = page
      .locator("a, button")
      .filter({ hasText: /continue shopping|browse|marketplace/i })
      .first();
    await expect(cta).toBeVisible({ timeout: 10_000 });
  });

  test("cart item prices are displayed when cart has products", async ({
    page,
  }) => {
    await page.goto("/cart");
    await waitForLoadingToFinish(page);

    const isEmpty = await page
      .getByText(/empty|no items|nothing/i)
      .isVisible()
      .catch(() => false);
    if (isEmpty) {
      test.skip();
      return;
    }

    // At least one price (KSh prefix or numeric) should appear
    await expect(
      page.getByText(/KSh|ksh|\d{3,}/i).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test("quantity controls are visible when cart has items", async ({ page }) => {
    await page.goto("/cart");
    await waitForLoadingToFinish(page);

    const isEmpty = await page
      .getByText(/empty|no items|nothing/i)
      .isVisible()
      .catch(() => false);
    if (isEmpty) {
      test.skip();
      return;
    }

    // +/− buttons for quantity
    const qtyBtn = page
      .locator(
        "button[aria-label*='quantity' i], button[aria-label*='increase' i], button[aria-label*='decrease' i]"
      )
      .or(
        page
          .locator("main button, [class*='cart'] button")
          .filter({ has: page.locator("svg") })
      )
      .first();
    await expect(qtyBtn).toBeVisible({ timeout: 10_000 });
  });

  test("remove button is visible when cart has items", async ({ page }) => {
    await page.goto("/cart");
    await waitForLoadingToFinish(page);

    const isEmpty = await page
      .getByText(/empty|no items|nothing/i)
      .isVisible()
      .catch(() => false);
    if (isEmpty) {
      test.skip();
      return;
    }

    // Trash / remove button
    const removeBtn = page
      .locator(
        "button[aria-label*='remove' i], button[aria-label*='delete' i]"
      )
      .or(
        page
          .locator("main button")
          .filter({ has: page.locator("svg") })
          .last()
      )
      .first();
    await expect(removeBtn).toBeVisible({ timeout: 10_000 });
  });

  test("checkout option is visible when cart has items", async ({ page }) => {
    await page.goto("/cart");
    await waitForLoadingToFinish(page);

    const isEmpty = await page
      .getByText(/empty|no items|nothing/i)
      .isVisible()
      .catch(() => false);
    if (isEmpty) {
      test.skip();
      return;
    }

    const checkoutBtn = page
      .locator("a, button")
      .filter({ hasText: /checkout|whatsapp|order|pay/i })
      .first();
    await expect(checkoutBtn).toBeVisible({ timeout: 10_000 });
  });
});
