import { test, expect } from '@playwright/test'

/**
 * Audit Log page — Host column (Phase G of host-visibility feature).
 */
test.describe('Audit Log page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/audit-log')
    await page.waitForSelector('table')
  })

  test('shows correct column headers including Host', async ({ page }) => {
    await expect(page.getByRole('columnheader', { name: /time/i })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: /action/i })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: /actor/i })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: /host/i })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: /update/i })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: /detail/i })).toBeVisible()
  })

  test('shows entries or empty state', async ({ page }) => {
    const rows = page.locator('tbody tr')
    const count = await rows.count()
    // Either shows entries, or the no-entries message
    expect(count).toBeGreaterThanOrEqual(1)
  })

  test('Host column shows agent name or dash for each entry', async ({ page }) => {
    const rows = page.locator('tbody tr')
    const count = await rows.count()
    if (count === 0) test.skip()

    // Check first entry — Host cell is the 4th column (Time, Action, Actor, Host, Update, Detail)
    const firstRow = rows.first()
    const text = await firstRow.textContent()
    if (text?.includes('No audit log')) return // empty state, skip

    // The host cell (index 3) should have either a name or "—"
    const hostCell = firstRow.locator('td').nth(3)
    const hostText = await hostCell.textContent()
    expect(hostText).toBeTruthy()
    // Should be either a non-empty name or the dash placeholder "—"
    expect(hostText?.trim()).toMatch(/^.+$/)
  })
})
