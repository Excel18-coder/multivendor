import { test, expect } from "@playwright/test";
import { waitForLoadingToFinish } from "./helpers";

const MOCK_PRODUCTS = [
  {
    id: "prod-e2e-1",
    name: "E2E Test Product",
    price: 2500,
    in_stock: true,
    image_url: "/placeholder.svg",
    category: "Fashion",
    tags: [],
    discount_percentage: 0,
    created_at: "2024-01-01T00:00:00Z",
    store: { id: "store-e2e-1", name: "E2E Store", slug: "e2e-store", whatsapp: "254712345678", whatsapp_phone: "254712345678", mpesa_enabled: false, is_active: true, is_verified: false, subscription_status: "active", created_at: "2024-01-01T00:00:00Z" },
  },
];

async function mockProducts(page: import("@playwright/test").Page) {
  await page.route("http://localhost:8080/**", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({}) }));
  await page.route("http://localhost:8080/cart**", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [] }) }));
  await page.route("http://localhost:8080/wishlist**", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [] }) }));
  await page.route("http://localhost:8080/categories**", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ categories: ["Fashion", "Electronics", "Food"] }) }));
  await page.route("http://localhost:8080/auth/me**", route => route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: "unauthorized" }) }));
  await page.route("http://localhost:8080/products**", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ products: MOCK_PRODUCTS }) }));
}

test("diag3 - with MOCK_PRODUCTS pre-fills", async ({ page }) => {
  const consoleMessages: string[] = [];
  page.on('console', msg => consoleMessages.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', err => consoleMessages.push(`[PAGEERROR] ${err.message}`));
  
  await mockProducts(page);
  
  // beforeEach navigation
  await page.goto("/marketplace");
  await waitForLoadingToFinish(page);
  
  // Test navigation  
  await page.goto("/marketplace?search=laptop");
  await waitForLoadingToFinish(page);
  
  await page.waitForTimeout(2000);
  
  const inputCount = await page.locator("input").count();
  const bodyText = await page.locator("body").textContent().catch(() => "ERR");
  
  console.log("Input count (all):", inputCount);
  console.log("Body text snippet:", bodyText?.substring(0, 200));
  for (const m of consoleMessages) {
    console.log("Console:", m);
  }
});
