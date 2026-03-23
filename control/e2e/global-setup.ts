import { chromium, type FullConfig } from '@playwright/test'
import path from 'node:path'

export const AUTH_STATE_FILE = path.join(__dirname, '.auth-state.json')

/**
 * Global setup for Playwright tests.
 * 1. Seeds the database with a test agent and containers via the API.
 * 2. Stores admin auth state (localStorage token) so all tests start pre-authenticated.
 */
async function globalSetup(_config: FullConfig) {
  const apiBase = 'http://localhost:3001'
  const frontendBase = 'http://localhost:3000'
  const adminToken = process.env['ADMIN_TOKEN'] ?? 'change-me-to-a-random-secret'
  const adminHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${adminToken}`,
  }

  try {
    // Register a test agent
    const registerRes = await fetch(`${apiBase}/trpc/agents.register`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ name: 'e2e-test-agent', type: 'vm' }),
    })
    const registerData = await registerRes.json() as { result?: { data?: { agentId?: string; apiKey?: string } } }
    const { agentId, apiKey } = registerData.result?.data ?? {}
    console.log('[e2e-setup] Test agent registered:', agentId)

    // Submit a test report with containers
    if (apiKey) {
      await fetch(`${apiBase}/trpc/reports.submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          containers: [
            {
              containerId: 'e2e-test-container-1',
              name: 'nginx-test',
              image: 'nginx',
              currentTag: '1.24-alpine',
              currentDigest: null,
              composeFile: null,
              composeService: null,
              namespace: null,
            },
            {
              containerId: 'e2e-test-container-2',
              name: 'redis-test',
              image: 'redis',
              currentTag: '7.0-alpine',
              currentDigest: null,
              composeFile: null,
              composeService: null,
              namespace: null,
            },
          ],
          updates: [],
        }),
      })
      console.log('[e2e-setup] Test containers submitted')
    }

    // Store auth token in browser localStorage so tests start pre-authenticated
    const browser = await chromium.launch()
    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    await page.goto(frontendBase)
    await page.evaluate(
      (token) => localStorage.setItem('tiaki-admin-token', token),
      adminToken,
    )
    await ctx.storageState({ path: AUTH_STATE_FILE })
    await browser.close()
    console.log('[e2e-setup] Auth state saved')
  } catch (error) {
    console.error('[e2e-setup] Failed to seed test data:', error)
    throw error
  }
}

export default globalSetup
