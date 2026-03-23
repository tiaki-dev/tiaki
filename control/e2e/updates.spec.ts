import { test, expect } from '@playwright/test'

/**
 * Updates page — status filter pills + Host filter + container name display.
 */
test.describe('Updates page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/updates')
    await page.waitForSelector('tbody tr')
  })

  test('shows correct column headers including Host', async ({ page }) => {
    await expect(page.getByRole('columnheader', { name: /host/i })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: /container/i })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: /current/i })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: /latest/i })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: /status/i })).toBeVisible()
  })

  test('status filter pills are visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: /^all$/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /pending/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /deployed/i })).toBeVisible()
  })

  test('host filter dropdown is present', async ({ page }) => {
    const filter = page.getByRole('combobox')
    await expect(filter).toBeVisible()
    await expect(filter).toContainText('All hosts')
  })

  test('container column shows name, not raw UUID', async ({ page }) => {
    const rows = page.locator('tbody tr')
    const count = await rows.count()
    if (count === 0 || (await rows.first().textContent())?.includes('No updates')) {
      test.skip()
    }

    // First cell of first data row should be "Host", second should be "Container"
    // The container name cell should NOT look like a UUID (8+ hex chars with no spaces)
    const containerCell = rows.first().locator('td').nth(1)
    const text = await containerCell.textContent()
    // Container names look like "control-postgres-1", not "40065ee00444"
    expect(text).toBeTruthy()
    // A raw UUID/hash starts with 12 hex chars and no hyphens in first 8 chars
    // Real container names have letters and typically hyphens
    expect(text).not.toMatch(/^[0-9a-f]{12,}$/)
  })

  test('clicking Pending filter shows only pending updates', async ({ page }) => {
    await page.getByRole('button', { name: /pending/i }).click()
    await page.waitForTimeout(300) // let query re-fire

    const rows = page.locator('tbody tr')
    const count = await rows.count()
    if (count === 0 || (await rows.first().textContent())?.includes('No updates')) return

    // Every status badge in the table should say "Pending"
    const badges = page.locator('tbody tr td').filter({ hasText: /Pending/i })
    const badgeCount = await badges.count()
    expect(badgeCount).toBe(count)
  })

  test('clicking All filter restores all updates', async ({ page }) => {
    const initial = await page.locator('tbody tr').count()

    await page.getByRole('button', { name: /pending/i }).click()
    await page.waitForTimeout(300)
    await page.getByRole('button', { name: /^all$/i }).click()
    await page.waitForTimeout(300)

    const final = await page.locator('tbody tr').count()
    expect(final).toBe(initial)
  })
})
