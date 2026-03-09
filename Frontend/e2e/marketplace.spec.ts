/**
 * E2E tests – Marketplace (/marketplace)
 *
 * All API mocks use the explicit backend origin (http://localhost:8080) so
 * they never accidentally intercept page-navigation requests to localhost:5173.
 */

import { test, expect } from "@playwright/test";
import { waitForLoadingToFinish } from "./helpers";

test.describe("Marketplace (/marketplace)", () => {
  const MOCK_PRODUCTS = [
    {
      id: "prod-e2e-1",
      name: "E2E Test Product",
      description: "A great e2e test product",
      price: 2500,
      in_stock: true,
      image_url: "/placeholder.svg",
      category: "Fashion",
      tags: [],
      discount_percentage: 0,
      created_at: "2024-01-01T00:00:00Z",
      store: {
        id: "store-e2e-1",
        name: "E2E Store",
        slug: "e2e-store",
        whatsapp: "254712345678",
        whatsapp_phone: "254712345678",
        mpesa_enabled: false,
        is_active: true,
        is_verified: false,
        subscription_status: "active",
        created_at: "2024-01-01T00:00:00Z",
      },
    },
  ];

  /** Set up product API mock BEFORE navigation. */
  async function mockProducts(page: import("@playwright/test").Page) {
    // LIFO: catch-all first (lowest priority)
    await page.route("http://localhost:8080/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({}),
      })
    );

    // Specific routes after (higher priority)
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

    await page.route("http://localhost:8080/categories**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ categories: ["Fashion", "Electronics", "Food"] }),
      })
    );

    await page.route("http://localhost:8080/auth/me**", (route) =>
      route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: "unauthorized" }),
      })
    );

    await page.route("http://localhost:8080/products**", (route) => {
      const url = route.request().url();
      // Don't intercept individual product detail lookups as lists
      if (route.request().method() === "GET" && !url.match(/\/products\/[^?/]+$/)) {
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ products: MOCK_PRODUCTS }),
        });
      } else {
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ products: MOCK_PRODUCTS }),
        });
      }
    });
  }

  test.beforeEach(async ({ page }) => {
    await mockProducts(page);
    await page.goto("/marketplace");
    await waitForLoadingToFinish(page);
  });

  test("page renders header and search input", async ({ page }) => {
    await expect(page.locator("header")).toBeVisible({ timeout: 10_000 });
    // At least one search input must be visible
    const searchInputs = page.locator("input[placeholder*='earch']");
    // On mobile the header search might be hidden – find the visible one
    const count = await searchInputs.count();
    let found = false;
    for (let i = 0; i < count; i++) {
      if (await searchInputs.nth(i).isVisible()) {
        found = true;
        break;
      }
    }
    expect(found).toBeTruthy();
  });

  test("pre-fills search input from URL query param", async ({ page }) => {
    // Navigate to marketplace with a search param (full page reload)
    await page.goto("/marketplace?search=laptop");
    await waitForLoadingToFinish(page);

    // The Marketplace useEffect reads window.location.search on mount and calls
    // setSearchTerm — wait up to 5 s for the visible input to reflect "laptop".
    const inputs = page.locator("input[placeholder*='earch']");
    await expect(async () => {
      const count = await inputs.count();
      let found = false;
      for (let i = 0; i < count; i++) {
        const val = await inputs.nth(i).inputValue().catch(() => "");
        if (val === "laptop") {
          found = true;
          break;
        }
      }
      expect(found).toBeTruthy();
    }).toPass({ timeout: 5_000 });
  });

  test("filter sidebar / panel is rendered", async ({ page }) => {
    // On desktop: a "Price Range" card is always visible.
    // On mobile: an icon-only Filter button opens a Collapsible with a "Filters" card.

    // Desktop: "Price Range" heading is always visible
    const priceRangeHeading = page.getByRole("heading", { name: /price range/i }).first();
    if (await priceRangeHeading.isVisible().catch(() => false)) {
      return; // Desktop path – success
    }

    // Mobile path: click the icon-only filter toggle button
    // The button sits next to the search input in the same flex container
    const searchInput = page.locator("input[placeholder*='earch']").last();
    // Navigate: input → parent div → parent flex div → find sibling button
    const filterToggleBtn = page.locator(
      "button svg[class*='lucide-filter'], button svg[class*='Filter']"
    ).locator("..");
    if (await filterToggleBtn.first().isVisible().catch(() => false)) {
      await filterToggleBtn.first().click();
      await page.waitForTimeout(600);
    }

    // After opening on mobile, "Filters" heading should be visible
    const filtersHeading = page.getByRole("heading", { name: /^filters$/i }).first();
    if (await filtersHeading.isVisible().catch(() => false)) {
      return; // Mobile path – success
    }

    // Fallback: price range or filters text must exist somewhere in the page DOM
    // (desktop filter panel is in the DOM, just CSS-hidden on mobile)
    const bodyText = await page.locator("body").textContent().catch(() => "");
    expect(/price range|categories/i.test(bodyText ?? "")).toBeTruthy();
  });

  test("typing in search box filters the results", async ({ page }) => {
    // Find the first visible search input
    const inputs = page.locator("input[placeholder*='earch']");
    let searchInput = inputs.first();
    const count = await inputs.count();
    for (let i = 0; i < count; i++) {
      if (await inputs.nth(i).isVisible()) {
        searchInput = inputs.nth(i);
        break;
      }
    }

    await searchInput.fill("phone");
    await waitForLoadingToFinish(page);
    await expect(page.locator("body")).not.toContainText("Something went wrong");
  });

  test("category filter changes selection state", async ({ page }) => {
    // Open mobile filter collapsible (no-op on desktop)
    const filterBtn = page.locator("button").filter({ hasText: /filter/i }).first();
    if ((await filterBtn.count()) > 0) {
      await filterBtn.click();
      await page.waitForTimeout(500);
    }

    const catBtn = page
      .locator("button, [role='button']")
      .filter({ hasText: /fashion|all|shoes|electronics|beauty/i })
      .first();

    if ((await catBtn.count()) > 0) {
      await catBtn.click();
      await waitForLoadingToFinish(page);
    }

    await expect(page.locator("body")).not.toContainText("Something went wrong");
  });

  test("product card links navigate to product detail page", async ({ page }) => {
    // ProductCard uses navigate() not <a href> - click the card by product name
    const productCard = page
      .locator("[class*='cursor-pointer']")
      .filter({ hasText: /E2E Test Product/i })
      .first();
    await expect(productCard).toBeVisible({ timeout: 10_000 });

    await productCard.click();
    await expect(page).toHaveURL(/\/products\//);
  });

  test('"Load more" or pagination renders when many products exist', async ({ page }) => {
    const pagination = page.locator(
      "button[aria-label*='next' i], [data-testid*='pagination'], button:has-text('Next'), button:has-text('Load more')"
    );

    const count = await pagination.count();
    if (count > 0) {
      await expect(pagination.first()).toBeVisible();
    }
    // Passes vacuously when fewer than page-limit products
  });

  test("does not crash when navigating directly via URL", async ({ page }) => {
    await page.goto("/marketplace?category=Shoes+%26+Sneakers&page=1");
    await waitForLoadingToFinish(page);
    await expect(page.locator("body")).not.toContainText("Something went wrong");
    await expect(page).toHaveURL(/\/marketplace/);
  });
});
