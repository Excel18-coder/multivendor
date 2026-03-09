/**
 * E2E tests – Cart (/cart)
 *
 * All API mocks use the explicit backend origin (http://localhost:8080) so
 * they never accidentally intercept page-navigation requests to localhost:5173.
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
  product_id: "prod-1",
  product_name: "Test Sneakers",
  price: 3500,
  image_url: "/placeholder.svg",
  store_id: "store-1",
  store_name: "Cool Kicks",
  store_slug: "cool-kicks",
  whatsapp_phone: "254712345678",
  mpesa_enabled: false,
  mpesa_status: null,
  in_stock: true,
  product: {
    id: "prod-1",
    name: "Test Sneakers",
    price: 3500,
    image_url: "/placeholder.svg",
    images: ["/placeholder.svg"],
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
    await page.route("http://localhost:8080/**", (route) =>
      route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: "unauthorized" }),
      })
    );

    await page.goto("/cart");
    await waitForLoadingToFinish(page);

    await expect(page.locator("body")).not.toContainText("Something went wrong");
    await expect(page.locator("header")).toBeVisible({ timeout: 10_000 });

    const url = page.url();
    const isOnAuth = url.includes("/auth");

    // Check body text content directly – avoids strict-mode multi-match issues
    const bodyText = await page.locator("body").textContent().catch(() => "");
    const hasLoginPrompt = /please login|you need to login|log in|sign in/i.test(bodyText ?? "");
    const hasEmptyState = /empty|no items|nothing/i.test(bodyText ?? "");

    expect(isOnAuth || hasLoginPrompt || hasEmptyState).toBeTruthy();
  });
});

// ─── Authenticated (mocked) ───────────────────────────────────────────────────

test.describe("Cart – authenticated", () => {
  test.beforeEach(async ({ page }) => {
    // 1. Inject auth before page load
    await page.addInitScript((u) => {
      localStorage.setItem("auth_token", "mock-token");
      localStorage.setItem("auth_user", JSON.stringify(u));
    }, MOCK_BUYER);

    // 2. Catch-all FIRST (LIFO: fires last, lowest priority)
    await page.route("http://localhost:8080/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({}),
      })
    );

    // 3. Specific routes AFTER (LIFO: fire first, highest priority)
    await page.route("http://localhost:8080/wishlist**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items: [] }),
      })
    );

    await page.route("http://localhost:8080/cart/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ message: "ok" }),
      })
    );

    await page.route("http://localhost:8080/cart**", (route) => {
      if (route.request().method() === "GET") {
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ items: [MOCK_CART_ITEM] }),
        });
      } else {
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ message: "ok" }),
        });
      }
    });

    await page.route("http://localhost:8080/auth/me**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ user: MOCK_BUYER }),
      })
    );
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

    const hasItem = await page.getByText("Test Sneakers").isVisible().catch(() => false);
    const hasEmptyMsg = await page
      .getByText(/empty|no items|nothing in your cart|start shopping/i)
      .isVisible()
      .catch(() => false);

    expect(hasItem || hasEmptyMsg).toBeTruthy();
  });

  test('"Continue Shopping" CTA is visible on empty cart', async ({ page }) => {
    // Override cart mock with empty cart (LIFO: fires before beforeEach handler)
    await page.route("http://localhost:8080/cart**", (route) => {
      if (route.request().method() === "GET") {
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ items: [] }),
        });
      } else {
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ message: "ok" }),
        });
      }
    });

    await page.goto("/cart");
    await waitForLoadingToFinish(page);

    // Cart empty state has <Link to="/marketplace"><Button>Continue Shopping</Button></Link>
    const cta = page.getByRole("button", { name: /continue shopping/i }).first();
    await expect(cta).toBeVisible({ timeout: 10_000 });
  });

  test("cart item prices are displayed when cart has products", async ({ page }) => {
    await page.goto("/cart");
    await waitForLoadingToFinish(page);

    await expect(
      page.getByText(/KSh|ksh|3[,.]?500|\d{3,}/i).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test("quantity controls are visible when cart has items", async ({ page }) => {
    await page.goto("/cart");
    await waitForLoadingToFinish(page);

    const qtyBtn = page.locator("button.h-8, button[class*='h-8']").first();
    await expect(qtyBtn).toBeVisible({ timeout: 10_000 });
  });

  test("remove button is visible when cart has items", async ({ page }) => {
    await page.goto("/cart");
    await waitForLoadingToFinish(page);

    const removeBtn = page.locator("button[class*='text-red']").first();
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
