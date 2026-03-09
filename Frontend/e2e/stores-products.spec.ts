/**
 * E2E tests – Stores & Product detail pages
 *
 * All API mocks use the explicit backend origin (http://localhost:8080) so
 * they never accidentally intercept page-navigation requests to localhost:5173.
 * Never uses route.continue() – all routes use route.fulfill().
 */

import { test, expect } from "@playwright/test";
import { waitForLoadingToFinish } from "./helpers";

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_STORE = {
  id: "store-001",
  name: "Test Store",
  slug: "test-store",
  description: "A test store for E2E testing",
  location: "Nairobi",
  image_url: "/placeholder.svg",
  logo_url: "/placeholder.svg",
  store_type: "fashion",
  category: "Fashion",
  is_active: true,
  is_verified: true,
  subscription_status: "active",
  follower_count: 12,
  avg_rating: 4.2,
  product_count: 3,
  whatsapp: "254712345678",
  whatsapp_phone: "254712345678",
  mpesa_enabled: false,
  mpesa_api_key: null,
  mpesa_status: null,
  delivery_fee: 200,
  payment_options: ["POD"],
  rating: 4.2,
  created_at: "2024-01-01T00:00:00Z",
};

const MOCK_PRODUCT = {
  id: "prod-001",
  name: "Test Sneakers",
  price: 3500,
  description: "Comfortable test sneakers",
  in_stock: true,
  image_url: "/placeholder.svg",
  images: ["/placeholder.svg"],
  category: "Fashion",
  tags: ["shoes"],
  discount_percentage: 0,
  created_at: "2024-01-01T00:00:00Z",
  store: MOCK_STORE,
  store_id: "store-001",
  store_name: "Test Store",
  store_slug: "test-store",
};

const MOCK_BUYER = {
  id: "buyer-001",
  email: "buyer@example.com",
  full_name: "Test Buyer",
  user_type: "buyer",
  role: "buyer",
  created_at: "2024-01-01T00:00:00Z",
};

/**
 * Register common API mocks needed for stores & products pages.
 * MUST be called BEFORE page.goto(). Never calls route.continue().
 * Uses explicit http://localhost:8080 prefix to avoid intercepting page loads.
 */
async function setupPublicMocks(page: import("@playwright/test").Page) {
  // LIFO: catch-all first (lowest priority), specific routes last (highest priority)

  // Catch-all (lowest priority)
  await page.route("http://localhost:8080/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({}),
    })
  );

  // Utility routes
  await page.route("http://localhost:8080/categories**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ categories: ["Fashion", "Electronics", "Food"] }),
    })
  );

  await page.route("http://localhost:8080/wishlist**", (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items: [] }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ message: "ok" }),
    });
  });

  await page.route("http://localhost:8080/cart/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ message: "ok" }),
    })
  );

  await page.route("http://localhost:8080/cart**", (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items: [] }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ message: "ok" }),
    });
  });

  // Products list (registered first = lower LIFO priority)
  await page.route("http://localhost:8080/products**", (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ products: [MOCK_PRODUCT], total: 1 }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ message: "ok" }),
    });
  });

  // Individual product lookup (registered last = highest LIFO priority, overrides products**)
  await page.route("http://localhost:8080/products/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ product: MOCK_PRODUCT }),
    })
  );

  // Store sub-routes
  await page.route("http://localhost:8080/stores/**", (route) => {
    const url = route.request().url();
    const method = route.request().method();

    if (/\/stores\/[^/]+\/ratings/.test(url)) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ratings: [], average: 0 }),
      });
    }
    if (/\/stores\/[^/]+\/complaints/.test(url)) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ complaints: [] }),
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
        body: JSON.stringify({ products: [MOCK_PRODUCT] }),
      });
    }
    // GET /stores/:slug
    if (method === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          store: MOCK_STORE,
          product_count: 3,
          follower_count: 12,
          avg_rating: 4.2,
        }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ store: MOCK_STORE }),
    });
  });

  // Unauthenticated seller-owned store endpoint
  await page.route("http://localhost:8080/stores/me/store**", (route) =>
    route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ error: "unauthorized" }),
    })
  );

  // Stores listing
  await page.route("http://localhost:8080/stores**", (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ stores: [MOCK_STORE], total: 1 }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ store: MOCK_STORE }),
    });
  });

  // Auth – unauthenticated by default
  await page.route("http://localhost:8080/auth/me**", (route) =>
    route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ error: "unauthorized" }),
    })
  );
}

// ─── Stores listing ───────────────────────────────────────────────────────────

test.describe("Stores listing (/stores)", () => {
  test.beforeEach(async ({ page }) => {
    await setupPublicMocks(page);
    await page.goto("/stores");
    await waitForLoadingToFinish(page);
  });

  test("page loads without error", async ({ page }) => {
    await expect(page.locator("body")).not.toContainText("Something went wrong");
    await expect(page.locator("header")).toBeVisible();
  });

  test("store cards or empty state is rendered", async ({ page }) => {
    // StoreCard renders a "View Store" button (uses navigate(), not <a href>)
    const storeCards = page.locator("button").filter({ hasText: /view store/i });
    const emptyMsg = page.getByText(/no stores|empty|be the first/i);

    const hasCards = (await storeCards.count()) > 0;
    const hasEmpty = await emptyMsg.isVisible().catch(() => false);

    expect(hasCards || hasEmpty).toBeTruthy();
  });

  test("clicking a store card navigates to store detail page", async ({ page }) => {
    // StoreCard uses navigate(), the clickable element is the card div itself
    // Click "View Store" button which calls navigate(`/stores/${slug}`)
    const viewStoreBtn = page.locator("button").filter({ hasText: /view store/i }).first();
    await expect(viewStoreBtn).toBeVisible({ timeout: 10_000 });

    await viewStoreBtn.click();
    await waitForLoadingToFinish(page);
    await expect(page).toHaveURL(/\/stores\//);
  });
});

// ─── Store detail page ────────────────────────────────────────────────────────

test.describe("Store detail page (/stores/:slug)", () => {
  test("handles unknown slug gracefully", async ({ page }) => {
    // LIFO: catch-all first
    await page.route("http://localhost:8080/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({}),
      })
    );
    await page.route("http://localhost:8080/cart**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items: [] }),
      })
    );
    await page.route("http://localhost:8080/wishlist**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items: [] }),
      })
    );
    await page.route("http://localhost:8080/products**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ products: [] }),
      })
    );
    await page.route("http://localhost:8080/stores/**", (route) => {
      const url = route.request().url();
      if (url.includes("non-existent")) {
        return route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({ error: "not found" }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ stores: [] }),
      });
    });
    await page.route("http://localhost:8080/stores**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ stores: [] }),
      })
    );
    await page.route("http://localhost:8080/auth/me**", (route) =>
      route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: "unauthorized" }),
      })
    );

    await page.goto("/stores/non-existent-store-xyz-999");
    await waitForLoadingToFinish(page);

    await expect(page.locator("body")).not.toContainText("Something went wrong");
    await expect(page.locator("header")).toBeVisible();
  });
});

// ─── Product detail page ──────────────────────────────────────────────────────

test.describe("Product detail page (/products/:id)", () => {
  test("handles unknown product ID gracefully", async ({ page }) => {
    // LIFO: catch-all first
    await page.route("http://localhost:8080/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({}),
      })
    );
    await page.route("http://localhost:8080/cart**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items: [] }),
      })
    );
    await page.route("http://localhost:8080/wishlist**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items: [] }),
      })
    );
    await page.route("http://localhost:8080/stores**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ stores: [] }),
      })
    );
    await page.route("http://localhost:8080/products/**", (route) => {
      const url = route.request().url();
      if (url.includes("00000000")) {
        return route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({ error: "not found" }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ products: [] }),
      });
    });
    await page.route("http://localhost:8080/products**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ products: [] }),
      })
    );
    await page.route("http://localhost:8080/auth/me**", (route) =>
      route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: "unauthorized" }),
      })
    );

    await page.goto("/products/00000000-0000-0000-0000-000000000000");
    await waitForLoadingToFinish(page);

    await expect(page.locator("body")).not.toContainText("Something went wrong");
    await expect(page.locator("header")).toBeVisible();
  });

  test("renders product info when navigated from marketplace", async ({ page }) => {
    await setupPublicMocks(page);
    await page.goto("/marketplace");
    await waitForLoadingToFinish(page);

    // ProductCard renders a card div with onClick → navigate, not an <a href>
    // Click directly on the product name heading or the card itself
    const productCard = page.locator("[class*='cursor-pointer']").filter({ hasText: /Test Sneakers|E2E Test/i }).first();
    await expect(productCard).toBeVisible({ timeout: 10_000 });

    await productCard.click();
    await waitForLoadingToFinish(page);

    await expect(page.locator("body")).not.toContainText("Something went wrong");
    await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 10_000 });

    const priceText = page.getByText(/KSh|ksh|\d{3,}/i).first();
    await expect(priceText).toBeVisible({ timeout: 10_000 });
  });

  test("Add to Cart / purchase button is visible on product page (unauthenticated)", async ({
    page,
  }) => {
    await setupPublicMocks(page);
    await page.goto("/marketplace");
    await waitForLoadingToFinish(page);

    // Click the product card (uses navigate() not <a href>)
    const productCard = page.locator("[class*='cursor-pointer']").filter({ hasText: /Test Sneakers|E2E Test/i }).first();
    await expect(productCard).toBeVisible({ timeout: 10_000 });
    await productCard.click();
    await waitForLoadingToFinish(page);

    const purchaseBtn = page
      .locator("button")
      .filter({ hasText: /add.*cart|buy|order|whatsapp|checkout/i });
    await expect(purchaseBtn.first()).toBeVisible({ timeout: 10_000 });
  });

  test("Add to Cart button is visible on product page (authenticated)", async ({ page }) => {
    // addInitScript MUST run before page.goto()
    await page.addInitScript((u) => {
      localStorage.setItem("auth_token", "mock-token");
      localStorage.setItem("auth_user", JSON.stringify(u));
    }, MOCK_BUYER);

    await setupPublicMocks(page);

    // Override auth/me with authenticated response (LIFO: fires first)
    await page.route("http://localhost:8080/auth/me**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ user: MOCK_BUYER }),
      })
    );

    await page.goto("/marketplace");
    await waitForLoadingToFinish(page);

    // Click the product card (uses navigate() not <a href>)
    const productCard = page.locator("[class*='cursor-pointer']").filter({ hasText: /Test Sneakers|E2E Test/i }).first();
    await expect(productCard).toBeVisible({ timeout: 10_000 });
    await productCard.click();
    await waitForLoadingToFinish(page);

    const purchaseBtn = page
      .locator("button")
      .filter({ hasText: /add.*cart|buy|order|whatsapp|checkout/i });
    await expect(purchaseBtn.first()).toBeVisible({ timeout: 10_000 });
  });
});

// ─── Wishlist ─────────────────────────────────────────────────────────────────

test.describe("Wishlist (/wishlist)", () => {
  test("unauthenticated user sees sign-in prompt or is redirected", async ({ page }) => {
    // LIFO: catch-all first
    await page.route("http://localhost:8080/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({}),
      })
    );
    await page.route("http://localhost:8080/cart**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items: [] }),
      })
    );
    await page.route("http://localhost:8080/wishlist**", (route) =>
      route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: "unauthorized" }),
      })
    );
    await page.route("http://localhost:8080/auth/me**", (route) =>
      route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: "unauthorized" }),
      })
    );

    await page.goto("/wishlist");
    await waitForLoadingToFinish(page);

    await expect(page.locator("body")).not.toContainText("Something went wrong");
    await expect(page.locator("header")).toBeVisible();

    const url = page.url();
    const redirected = url.includes("/auth");
    const bodyText = await page.locator("body").textContent().catch(() => "");
    const hasPrompt = /please login|you need to login|log in|sign in/i.test(bodyText ?? "");
    const hasEmptyState = /empty|no items|nothing/i.test(bodyText ?? "");

    expect(redirected || hasPrompt || hasEmptyState).toBeTruthy();
  });

  test("authenticated user's wishlist page loads without error", async ({ page }) => {
    // addInitScript MUST run before routes and goto
    await page.addInitScript((u) => {
      localStorage.setItem("auth_token", "mock-token");
      localStorage.setItem("auth_user", JSON.stringify(u));
    }, MOCK_BUYER);

    // LIFO: catch-all first
    await page.route("http://localhost:8080/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({}),
      })
    );
    await page.route("http://localhost:8080/stores**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ stores: [] }),
      })
    );
    await page.route("http://localhost:8080/products**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ products: [] }),
      })
    );
    await page.route("http://localhost:8080/cart**", (route) => {
      if (route.request().method() === "GET") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ items: [] }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ message: "ok" }),
      });
    });
    await page.route("http://localhost:8080/wishlist**", (route) => {
      if (route.request().method() === "GET") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ items: [] }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ message: "ok" }),
      });
    });
    await page.route("http://localhost:8080/auth/me**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ user: MOCK_BUYER }),
      })
    );

    await page.goto("/wishlist");
    await waitForLoadingToFinish(page);

    await expect(page.locator("body")).not.toContainText("Something went wrong");
    await expect(page.locator("header")).toBeVisible();
    // Wishlist page renders <div class="min-h-screen"> not <main> – check container
    await expect(page.locator("h1, h2, h3").first()).toBeVisible({ timeout: 10_000 });
  });
});
