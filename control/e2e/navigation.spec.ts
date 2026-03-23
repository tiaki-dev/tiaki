import { test, expect } from '@playwright/test'

/**
 * Navigation smoke tests — verifies the sidebar links work and each page renders
 * without a crash. These run first to fail fast if the app won't even load.
 */
test.describe('Navigation', () => {
  test('app loads and shows sidebar', async ({ page }) => {
    await page.goto('/')
    // Sidebar nav items should be visible
    await expect(page.getByRole('link', { name: /containers/i }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: /^updates$/i }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: /policies/i }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: /audit log/i }).first()).toBeVisible()
  })

  test('navigates to Containers page', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: /containers/i }).click()
    await expect(page).toHaveURL(/containers/)
    await expect(page.getByRole('heading', { name: /containers/i })).toBeVisible()
  })

  test('navigates to Updates page', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: /^updates$/i }).first().click()
    await expect(page).toHaveURL(/updates/)
    await expect(page.getByRole('heading', { name: /updates/i })).toBeVisible()
  })

  test('navigates to Policies page', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: /policies/i }).click()
    await expect(page).toHaveURL(/policies/)
    await expect(page.getByRole('heading', { name: /policies/i })).toBeVisible()
  })

  test('navigates to Audit Log page', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: /audit log/i }).click()
    await expect(page).toHaveURL(/audit/)
    await expect(page.getByRole('heading', { name: /audit log/i })).toBeVisible()
  })
})
