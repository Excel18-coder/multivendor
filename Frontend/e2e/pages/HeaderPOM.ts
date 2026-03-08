/**
 * Page Object Model – shared Header component.
 */
import { Page, Locator, expect } from "@playwright/test";

export class HeaderPOM {
  readonly page: Page;
  readonly root: Locator;
  readonly logo: Locator;
  readonly searchInput: Locator;
  readonly cartIcon: Locator;
  readonly wishlistIcon: Locator;
  readonly userMenuTrigger: Locator;

  constructor(page: Page) {
    this.page = page;
    this.root = page.locator("header");
    this.logo = this.root.locator('a[href="/"]').first();
    this.searchInput = this.root.locator('input[placeholder*="Search"]');
    this.cartIcon = this.root.locator('a[href="/cart"], button').filter({ hasText: /cart/i }).first();
    this.wishlistIcon = this.root.locator('a[href="/wishlist"]').first();
    this.userMenuTrigger = this.root.locator('button').filter({ has: page.locator("svg") }).last();
  }

  async expectVisible() {
    await expect(this.root).toBeVisible();
    // Brand text is CSS-hidden on mobile (hidden sm:block); check any child element instead
    await expect(this.root.locator("a, button, img").first()).toBeVisible();
  }

  async search(query: string) {
    await this.searchInput.fill(query);
    await this.searchInput.press("Enter");
  }

  async navigateToCart() {
    await this.page.locator('a[href="/cart"]').first().click();
    await expect(this.page).toHaveURL(/\/cart/);
  }
}
