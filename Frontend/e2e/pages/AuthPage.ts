/**
 * Page Object Model – Authentication pages (/auth  and  /seller-auth).
 */
import { Page, Locator, expect } from "@playwright/test";

export class AuthPage {
  readonly page: Page;

  // Sign-in form
  readonly signInTab: Locator;
  readonly signInEmail: Locator;
  readonly signInPassword: Locator;
  readonly signInButton: Locator;

  // Sign-up form
  readonly signUpTab: Locator;
  readonly signUpName: Locator;
  readonly signUpEmail: Locator;
  readonly signUpPassword: Locator;
  readonly signUpButton: Locator;

  constructor(page: Page) {
    this.page = page;

    // Radix UI Tabs: the <button role="tab"> has the visible text, not a value= DOM attribute
    this.signInTab = page.getByRole("tab", { name: /sign.?in/i });
    this.signInEmail = page.locator("#signin-email");
    this.signInPassword = page.locator("#signin-password");
    this.signInButton = page
      .locator("form")
      .filter({ has: page.locator("#signin-email") })
      .locator('button[type="submit"]');

    this.signUpTab = page.getByRole("tab", { name: /sign.?up|register|create/i });
    this.signUpName = page.locator("#signup-name");
    this.signUpEmail = page.locator("#signup-email");
    this.signUpPassword = page.locator("#signup-password");
    // Use a more robust selector: the visible submit button inside the sign-up panel
    this.signUpButton = page
      .locator("[role='tabpanel']:visible button[type='submit']")
      .or(
        page
          .locator("form")
          .filter({ has: page.locator("#signup-name") })
          .locator('button[type="submit"]')
      );
  }

  async goto() {
    await this.page.goto("/auth");
    await expect(this.page).toHaveURL(/\/auth/);
  }

  async switchToSignUp() {
    await this.signUpTab.click();
  }

  async switchToSignIn() {
    await this.signInTab.click();
  }

  async fillSignIn(email: string, password: string) {
    await this.signInEmail.fill(email);
    await this.signInPassword.fill(password);
  }

  async fillSignUp(name: string, email: string, password: string) {
    await this.switchToSignUp();
    await this.signUpName.fill(name);
    await this.signUpEmail.fill(email);
    await this.signUpPassword.fill(password);
  }

  async submitSignIn() {
    await this.signInButton.click();
  }

  async submitSignUp() {
    await this.signUpButton.click();
  }
}

// ─── Seller Auth ──────────────────────────────────────────────────────────────

export class SellerAuthPage {
  readonly page: Page;
  readonly signInEmail: Locator;
  readonly signInPassword: Locator;
  readonly signInButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.signInEmail = page.locator("input[type='email']").first();
    this.signInPassword = page.locator("input[type='password']").first();
    this.signInButton = page.locator('button[type="submit"]').first();
  }

  async goto() {
    await this.page.goto("/seller-auth");
    await expect(this.page).toHaveURL(/\/seller-auth/);
  }
}
