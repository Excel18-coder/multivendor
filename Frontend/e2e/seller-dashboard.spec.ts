/**
 * E2E tests – Seller Dashboard (/seller)
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

const MOCK_SELLER = {
  id: "seller-001",
  email: "seller@example.com",
  full_name: "Test Seller",
  user_type: "seller",
  role: "seller",
  created_at: "2024-01-01T00:00:00Z",
};

const MOCK_STORE = {
  id: "store-001",
  name: "Test Store",
  slug: "test-store",
  description: "A test store for E2E testing",
  location: "Nairobi",
  image_url: "/placeholder.svg",
  store_type: "fashion",
  is_active: true,
  is_verified: true,
  subscription_status: "active",
  follower_count: 0,
  whatsapp: "254712345678",
  whatsapp_phone: "254712345678",
  mpesa_api_key: null,
  mpesa_enabled: false,
  mpesa_status: null,
  delivery_fee: 0,
  payment_options: ["POD"],
  avg_rating: 0,
  product_count: 0,
  created_at: "2024-01-01T00:00:00Z",
};

/** Register all mocks needed for the Seller Dashboard. */
async function setupSellerMocks(
  page: any,
  user: typeof MOCK_SELLER | typeof MOCK_BUYER,
  withStore = true
) {
  // Auth injection
  await page.addInitScript((u: typeof MOCK_SELLER) => {
    localStorage.setItem("auth_token", "mock-token");
    localStorage.setItem("auth_user", JSON.stringify(u));
  }, user);

  // LIFO order: catch-all FIRST, specific routes AFTER (highest priority last)

  // Catch-all (lowest priority)
  await page.route("http://localhost:8080/**", (route: any) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({}),
    })
  );

  // Broad utility routes
  await page.route("http://localhost:8080/cart**", (route: any) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items: [] }),
    })
  );

  await page.route("http://localhost:8080/wishlist**", (route: any) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items: [] }),
    })
  );

  await page.route("http://localhost:8080/payment**", (route: any) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ payments: [] }),
    })
  );

  await page.route("http://localhost:8080/products**", (route: any) => {
    if (route.request().method() === "GET")
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ products: [] }),
      });
    else
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ product: {} }),
      });
  });

  // Store sub-routes (registered before /stores/me/store so it takes lower priority)
  await page.route("http://localhost:8080/stores/**", (route: any) => {
    const url = route.request().url();
    const method = route.request().method();

    if (/\/stores\/[^/]+\/complaints/.test(url)) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ complaints: [] }),
      });
    }
    if (/\/stores\/[^/]+\/ratings/.test(url)) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ratings: [], average: 0 }),
      });
    }
    if (/\/stores\/[^/]+\/follow/.test(url)) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ following: false }),
      });
    }
    if (/\/stores\/[^/]+\/products/.test(url)) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ products: [] }),
      });
    }
    if (method === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ stores: [MOCK_STORE] }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ store: MOCK_STORE }),
    });
  });

  // /stores/me/store – highest priority (registered last)
  await page.route("http://localhost:8080/stores/me/store**", (route: any) => {
    const method = route.request().method();
    if (method === "GET") {
      if (withStore) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ store: MOCK_STORE }),
        });
      } else {
        return route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({ error: "not found" }),
        });
      }
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ store: MOCK_STORE }),
    });
  });

  // auth/me – highest priority (registered last)
  await page.route("http://localhost:8080/auth/me**", (route: any) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ user }),
    })
  );
}

// ─── Unauthenticated ──────────────────────────────────────────────────────────

test.describe("Seller Dashboard – unauthenticated", () => {
  test("renders without crash and shows sign-in or redirect", async ({ page }) => {
    await page.route("http://localhost:8080/**", (route) =>
      route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: "unauthorized" }),
      })
    );

    await page.goto("/seller");
    await waitForLoadingToFinish(page);

    const url = page.url();
    const onAuth = url.includes("/auth") || url.includes("/seller-auth");
    const bodyText = await page.locator("body").textContent().catch(() => "");
    const hasPrompt = /please login|you need to login|log in|sign in/i.test(bodyText ?? "");

    expect(onAuth || hasPrompt).toBeTruthy();
  });
});

// ─── Buyer (non-seller) access ────────────────────────────────────────────────

test.describe("Seller Dashboard – buyer role", () => {
  test.beforeEach(async ({ page }) => {
    await setupSellerMocks(page, MOCK_BUYER, false);
  });

  test("buyer visiting /seller is redirected or sees access-denied", async ({ page }) => {
    await page.goto("/seller");
    // SellerDashboard calls navigate("/auth") immediately for non-sellers
    await page.waitForTimeout(2_000);

    await expect(page.locator("body")).not.toContainText("Something went wrong");

    const url = page.url();
    const redirected =
      url.includes("/auth") ||
      url.includes("/seller-auth") ||
      url.endsWith("/");
    const hasPrompt = await page
      .getByText(/please login|you need to login|login|sign in|not authorized/i)
      .isVisible()
      .catch(() => false);

    expect(redirected || hasPrompt).toBeTruthy();
  });
});

// ─── Seller authenticated ─────────────────────────────────────────────────────

test.describe("Seller Dashboard – seller authenticated", () => {
  test.beforeEach(async ({ page }) => {
    await setupSellerMocks(page, MOCK_SELLER, true);
  });

  test("page loads without error", async ({ page }) => {
    await page.goto("/seller");
    await waitForLoadingToFinish(page);

    await expect(page.locator("body")).not.toContainText("Something went wrong");
    await expect(page.locator("header")).toBeVisible();
  });

  test("seller sees dashboard tabs when store exists", async ({ page }) => {
    await page.goto("/seller");
    await waitForLoadingToFinish(page);

    const hasDashboardTabs = (await page.locator('[role="tab"]').count()) >= 2;
    const hasCreateStore = await page
      .locator("h1, h2, h3, [class*='CardTitle']")
      .filter({ hasText: /create.*store|set up.*store|store name/i })
      .isVisible()
      .catch(() => false);

    expect(hasDashboardTabs || hasCreateStore).toBeTruthy();
  });

  test("dashboard tabs are visible when store exists", async ({ page }) => {
    await page.goto("/seller");
    await waitForLoadingToFinish(page);

    const tabs = page.locator('[role="tab"]');
    await expect(tabs.first()).toBeVisible({ timeout: 12_000 });
    expect(await tabs.count()).toBeGreaterThanOrEqual(2);
  });

  test("Add Product button is visible when seller has a store", async ({ page }) => {
    await page.goto("/seller");
    await waitForLoadingToFinish(page);

    const productsTab = page.locator('[role="tab"]').filter({ hasText: /products/i });
    if ((await productsTab.count()) > 0) {
      await productsTab.click();
      await page.waitForTimeout(500);
    }

    const addBtn = page.locator("button").filter({ hasText: /add product/i }).first();
    await expect(addBtn).toBeVisible({ timeout: 12_000 });
  });

  test("clicking Add Product reveals the product form", async ({ page }) => {
    await page.goto("/seller");
    await waitForLoadingToFinish(page);

    const productsTab = page.locator('[role="tab"]').filter({ hasText: /products/i });
    if ((await productsTab.count()) > 0) {
      await productsTab.click();
      await page.waitForTimeout(500);
    }

    const addBtn = page.locator("button").filter({ hasText: /add product/i }).first();
    await expect(addBtn).toBeVisible({ timeout: 12_000 });
    await addBtn.click();

    const formInput = page
      .locator(
        "input[placeholder*='name' i], input[placeholder*='product' i], input[name='name'], input[id*='name']"
      )
      .first();
    await expect(formInput).toBeVisible({ timeout: 8_000 });
  });

  test("/seller-dashboard alias route loads without error", async ({ page }) => {
    await page.goto("/seller-dashboard");
    await waitForLoadingToFinish(page);
    await expect(page.locator("body")).not.toContainText("Something went wrong");
    await expect(page.locator("header")).toBeVisible();
  });
});
