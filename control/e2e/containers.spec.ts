import { test, expect } from '@playwright/test'

/**
 * Containers page — Host column + filter (Phase D of host-visibility feature).
 * Requires at least one agent + container to be registered in the DB.
 */
test.describe('Containers page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/containers')
    // Wait for the table to be ready (either rows or empty-state cell)
    await page.waitForSelector('tbody tr')
  })

  test('shows Host column header', async ({ page }) => {
    await expect(page.getByRole('columnheader', { name: /host/i })).toBeVisible()
  })

  test('shows HostFilter dropdown', async ({ page }) => {
    const filter = page.getByRole('combobox')
    await expect(filter).toBeVisible()
    await expect(filter).toContainText('All hosts')
  })

  test('HostFilter contains registered agents', async ({ page }) => {
    const filter = page.getByRole('combobox')
    // Open the select to see options
    const options = await filter.locator('option').allTextContents()
    expect(options[0]).toMatch(/all hosts/i)
    // There should be at least one more option (the registered dev agent)
    expect(options.length).toBeGreaterThan(1)
  })

  test('filtering by host reduces visible containers', async ({ page }) => {
    const rows = page.locator('tbody tr')
    const initial = await rows.count()

    if (initial <= 1) {
      test.skip() // can't meaningfully test filter with 0–1 rows
    }

    const filter = page.getByRole('combobox')
    const options = await filter.locator('option').all()
    if (options.length < 2) test.skip()

    // Select the first real agent (index 1, since index 0 is "All hosts")
    const agentName = await options[1].textContent()
    await filter.selectOption({ index: 1 })

    // After filtering, every visible row's Host cell should match
    const hostCells = page.locator('tbody tr td:first-child')
    const count = await hostCells.count()
    for (let i = 0; i < count; i++) {
      await expect(hostCells.nth(i)).toHaveText(agentName ?? '')
    }
  })

  test('resetting host filter back to All shows all containers', async ({ page }) => {
    const rows = page.locator('tbody tr')
    const initial = await rows.count()

    const filter = page.getByRole('combobox')
    await filter.selectOption({ index: 1 })
    await filter.selectOption({ value: '' }) // "All hosts"

    const final = await rows.count()
    expect(final).toBe(initial)
  })
})
