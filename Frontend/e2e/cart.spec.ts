/**
 * E2E tests – Cart (/cart)
 *
 * Authenticated tests use localStorage injection + API mocking so they run
 * without a live backend or real credentials.
 */

import { test, expect } from "@playwright/test";
import { waitForLoadingToFinish } from "./helpers";

// ─── Shared mock data ─────────────────────────────────────────────────────────

const MOCK_BUYER = {
  id: "buyer-001",
  email: "buyer@example.com",
  full_name: "Test Buyer",
  user_type: "buyer",
  role: "buyer",
  created_at: "2024-01-01T00:00:00Z",
};

const MOCK_CART_ITEM = {
  id: "ci-1",
  quantity: 2,
  product: {
    id: "prod-1",
    name: "Test Sneakers",
    price: 3500,
    image_url: "/placeholder.svg",
    in_stock: true,
    tags: [],
    discount_percentage: 0,
    created_at: "2024-01-01T00:00:00Z",
    store: {
      id: "store-1",
      name: "Cool Kicks",
      slug: "cool-kicks",
      whatsapp: "254712345678",
      whatsapp_phone: "254712345678",
      mpesa_api_key: null,
      mpesa_enabled: false,
      mpesa_status: null,
      is_active: true,
      is_verified: false,
      subscription_status: "active",
      created_at: "2024-01-01T00:00:00Z",
    },
  },
};

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
    // Cart.tsx renders "Please Login" / "You need to login" for unauthenticated users
    const hasLoginPrompt = await page
      .locator("body")
      .getByText(/sign in|log in|please sign|please login|login|you need to login/i)
      .isVisible()
      .catch(() => false);
    const hasEmptyState = await page
      .locator("body")
      .getByText(/empty|no items|nothing/i)
      .isVisible()
      .catch(() => false);

    expect(isOnAuth || hasLoginPrompt || hasEmptyState).toBeTruthy();
  });
});

// ─── Authenticated (mocked) ───────────────────────────────────────────────────

test.describe("Cart – authenticated", () => {
  test.beforeEach(async ({ page }) => {
    // Inject auth session before page load
    await page.addInitScript((u) => {
      localStorage.setItem("auth_token", "mock-token");
      localStorage.setItem("auth_user", JSON.stringify(u));
    }, MOCK_BUYER);

    // Mock /auth/me so the app context validates the session
    await page.route("**/auth/me**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ user: MOCK_BUYER }),
      })
    );

    // Mock cart endpoint – returns a cart with one item so item-specific tests pass
    await page.route("**/cart**", (route) => {
      if (route.request().method() === "GET")
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ items: [MOCK_CART_ITEM] }),
        });
      else
        route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    });

    // Mock wishlist so the app context doesn't throw
    await page.route("**/wishlist**", (route) => {
      if (route.request().method() === "GET")
        route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [] }) });
      else route.continue();
    });
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

    // With mocked cart item, the product name should appear
    const hasItem = await page.getByText("Test Sneakers").isVisible().catch(() => false);
    const hasEmptyMsg = await page
      .getByText(/empty|no items|nothing in your cart|start shopping/i)
      .isVisible()
      .catch(() => false);

    expect(hasItem || hasEmptyMsg).toBeTruthy();
  });

  test('"Continue Shopping" CTA is visible on empty cart', async ({ page }) => {
    // Override the cart mock for this test to return an empty cart
    await page.route("**/cart**", (route) => {
      if (route.request().method() === "GET")
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ items: [] }),
        });
      else
        route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    });

    await page.goto("/cart");
    await waitForLoadingToFinish(page);

    const cta = page
      .locator("a, button")
      .filter({ hasText: /continue shopping|browse|marketplace/i })
      .first();
    await expect(cta).toBeVisible({ timeout: 10_000 });
  });

  test("cart item prices are displayed when cart has products", async ({ page }) => {
    await page.goto("/cart");
    await waitForLoadingToFinish(page);

    // MOCK_CART_ITEM price = 3500 → rendered as KSh 3,500 or similar
    await expect(
      page.getByText(/KSh|ksh|3[,.]?500|\d{3,}/i).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test("quantity controls are visible when cart has items", async ({ page }) => {
    await page.goto("/cart");
    await waitForLoadingToFinish(page);

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

    // Trash / remove button
    const removeBtn = page
      .locator("button[aria-label*='remove' i], button[aria-label*='delete' i]")
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

    const checkoutBtn = page
      .locator("a, button")
      .filter({ hasText: /checkout|whatsapp|order|pay/i })
      .first();
    await expect(checkoutBtn).toBeVisible({ timeout: 10_000 });
  });
});
