import { test, expect } from '@playwright/test';

test.describe('Marketing & Navigation Flow', () => {
  test('should load the homepage and redirect to default locale', async ({ page }) => {
    await page.goto('/');
    // Check that we are on a locale route
    await expect(page).toHaveURL(/\/en/);
    
    // Check main hero title text
    const title = page.locator('h1');
    await expect(title).toBeVisible();
  });

  test('should navigate to assessment page via hero button', async ({ page }) => {
    await page.goto('/en');
    
    // Find CTA button
    const cta = page.locator('a:has-text("Run Free Gap Assessment")');
    await expect(cta).toBeVisible();
    
    await cta.click();
    await expect(page).toHaveURL(/\/en\/assessment/);
  });
});
