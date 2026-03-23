import { test, expect, type Page } from '@playwright/test'

/**
 * Policies page — Host column, global vs per-host label, create form with host selector.
 */

/** Delete all rows matching the given policy name (handles leftover rows from prior runs). */
async function deleteAllPoliciesByName(page: Page, name: string) {
  const rows = page.locator('tr').filter({ hasText: name })
  let count = await rows.count()
  while (count > 0) {
    await rows.first().getByTitle(/delete/i).click()
    await expect(rows).toHaveCount(count - 1, { timeout: 5000 })
    count = await rows.count()
  }
}

test.describe('Policies page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/policies')
    await page.waitForLoadState('networkidle')
  })

  test('shows Host column header', async ({ page }) => {
    await expect(page.getByRole('columnheader', { name: /host/i })).toBeVisible()
  })

  test('New Policy button opens create modal', async ({ page }) => {
    await page.getByRole('button', { name: /new policy/i }).click()
    await expect(page.getByRole('heading', { name: /new policy/i })).toBeVisible()
  })

  test('create modal has Host selector with Global option', async ({ page }) => {
    await page.getByRole('button', { name: /new policy/i }).click()

    const hostSelect = page.locator('select').filter({ hasText: /global/i })
    await expect(hostSelect).toBeVisible()
    await expect(hostSelect.locator('option').first()).toContainText(/global/i)
  })

  test('create modal host selector lists registered agents', async ({ page }) => {
    await page.getByRole('button', { name: /new policy/i }).click()

    const hostSelect = page.locator('select').filter({ hasText: /global/i })
    const options = await hostSelect.locator('option').allTextContents()
    // Index 0 = "Global (all hosts)", further options = registered agents
    expect(options[0]).toMatch(/global/i)
    expect(options.length).toBeGreaterThan(1) // at least one real agent
  })

  test('can create a global policy', async ({ page }) => {
    // Clean up any leftover test policies from prior runs
    await deleteAllPoliciesByName(page, 'E2E-test-global')

    await page.getByRole('button', { name: /new policy/i }).click()

    await page.locator('input[required]:not([placeholder])').fill('E2E-test-global')
    // Host: leave as "Global (all hosts)"
    await page.getByPlaceholder(/nginx/i).fill('e2e-test-image:*')
    await page.getByRole('button', { name: /^create$/i }).click()

    // Modal should close and new policy should appear in the table
    await expect(page.getByRole('heading', { name: /new policy/i })).not.toBeVisible()
    await expect(page.getByRole('cell', { name: 'E2E-test-global' }).first()).toBeVisible()
    await expect(page.getByRole('cell', { name: /global/i }).first()).toBeVisible()
  })

  test('can create a per-host policy', async ({ page }) => {
    // Clean up any leftover test policies from prior runs
    await deleteAllPoliciesByName(page, 'E2E-test-per-host')

    await page.getByRole('button', { name: /new policy/i }).click()

    // Select first real agent from host dropdown
    const hostSelect = page.locator('select').filter({ hasText: /global/i })
    const options = await hostSelect.locator('option').all()
    if (options.length < 2) test.skip()
    const agentName = await options[1].textContent()
    await hostSelect.selectOption({ index: 1 })

    await page.locator('input[required]:not([placeholder])').fill('E2E-test-per-host')
    await page.getByPlaceholder(/nginx/i).fill('e2e-test-perhost:*')
    await page.getByRole('button', { name: /^create$/i }).click()

    await expect(page.getByRole('heading', { name: /new policy/i })).not.toBeVisible()
    await expect(page.getByRole('cell', { name: 'E2E-test-per-host' }).first()).toBeVisible()
    // The Host column for this policy should show the agent name, not "Global"
    await expect(page.getByRole('cell', { name: agentName ?? '' }).first()).toBeVisible()
  })

  test('can delete a test policy', async ({ page }) => {
    // Clean up the global test policy created above (if it exists)
    const rows = page.locator('tr').filter({ hasText: 'E2E-test-global' })
    if (await rows.count() === 0) test.skip()

    // Wait for the delete mutation to complete
    const responsePromise = page.waitForResponse(resp =>
      resp.url().includes('policies.delete') && resp.status() === 200
    )

    await rows.first().getByTitle(/delete/i).click()
    await responsePromise

    // Wait for refetch to complete and UI to update
    await page.waitForResponse(resp =>
      resp.url().includes('policies.list') && resp.status() === 200
    )

    // Now the policy should be gone
    await expect(page.locator('tr').filter({ hasText: 'E2E-test-global' })).toHaveCount(0)
  })

  test('can delete per-host test policy', async ({ page }) => {
    const rows = page.locator('tr').filter({ hasText: 'E2E-test-per-host' })
    if (await rows.count() === 0) test.skip()

    // Wait for the delete mutation to complete
    const responsePromise = page.waitForResponse(resp =>
      resp.url().includes('policies.delete') && resp.status() === 200
    )

    await rows.first().getByTitle(/delete/i).click()
    await responsePromise

    // Wait for refetch to complete and UI to update
    await page.waitForResponse(resp =>
      resp.url().includes('policies.list') && resp.status() === 200
    )

    // Now the policy should be gone
    await expect(page.locator('tr').filter({ hasText: 'E2E-test-per-host' })).toHaveCount(0)
  })
})
