import { expect, test } from '@playwright/test'

const apiOrigin = 'http://127.0.0.1:5504'
const expectedMode = process.env.FINCORE_E2E_MODE === 'false' ? 'live' : 'mock'

test('loads profiles and completes an API-backed transfer in the selected mode', async ({ page }) => {
  const apiRequests: Array<{ origin: string; method: string; path: string }> = []
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (url.pathname.startsWith('/api/v1/')) {
      apiRequests.push({ origin: url.origin, method: request.method(), path: url.pathname })
    }
  })

  await page.goto('/')
  const profiles = page.locator('.profile-option')
  await expect(profiles).toHaveCount(4)
  await expect(profiles.filter({ hasText: 'Avery Quinn' })).toHaveAttribute('aria-pressed', 'true')

  await page.locator('.signin-submit').click()
  const appShell = page.locator('.app-shell')
  await expect(appShell).toBeVisible()
  await expect(appShell).toHaveAttribute('data-mode', expectedMode)
  await expect(page.locator('.summary-grid')).toBeVisible()
  await expect(page.locator('.account-list')).toBeVisible()

  await page.getByRole('button', { name: 'Transfers' }).click()
  await page.locator('#transfer-destination').selectOption({ index: 1 })
  await page.locator('#transfer-amount').fill('1.00')
  await page.locator('.transfer-submit').click()
  await expect(page.locator('.transfer-success')).toBeVisible()

  expect(apiRequests.length).toBeGreaterThan(0)
  expect(apiRequests.every((request) => request.origin === apiOrigin)).toBe(true)
  expect(apiRequests).toEqual(
    expect.arrayContaining([
      { origin: apiOrigin, method: 'GET', path: '/api/v1/auth/demo-profiles' },
      { origin: apiOrigin, method: 'POST', path: '/api/v1/auth/demo-login' },
      { origin: apiOrigin, method: 'GET', path: '/api/v1/accounts' },
      { origin: apiOrigin, method: 'POST', path: '/api/v1/transfers' },
    ]),
  )
})
