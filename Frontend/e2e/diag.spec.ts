import { test, expect } from "@playwright/test";

test("diag", async ({ page }) => {
  await page.route("http://localhost:8080/**", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({}) }));
  await page.route("http://localhost:8080/products**", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ products: [] }) }));
  await page.route("http://localhost:8080/categories**", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ categories: [] }) }));
  await page.route("http://localhost:8080/auth/me**", route => route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: "unauthorized" }) }));
  await page.route("http://localhost:8080/cart**", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [] }) }));
  await page.route("http://localhost:8080/wishlist**", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [] }) }));
  
  await page.goto("http://localhost:5173/marketplace?search=laptop");
  await page.waitForTimeout(3000);
  
  const url = page.url();
  const inputCount = await page.locator("input[placeholder*='earch']").count();
  const vals = [];
  for (let i = 0; i < inputCount; i++) {
    vals.push(await page.locator("input[placeholder*='earch']").nth(i).inputValue().catch(() => "ERR"));
  }
  const windowSearch = await page.evaluate(() => window.location.search);
  
  console.log("URL:", url);
  console.log("window.location.search:", windowSearch);
  console.log("Input count:", inputCount);
  console.log("Input values:", vals);
});
