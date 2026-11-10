import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiFailure, api } from './api'

const user = {
  id: 'demo-customer-avery',
  displayName: 'Avery Quinn',
  role: 'CUSTOMER',
}

const account = {
  id: 'account-avery-checking',
  displayName: 'Everyday checking',
  type: 'CHECKING',
  maskedAccountNumber: '**** 1042',
  currency: 'USD',
  balanceMinor: 125_000,
  status: 'ACTIVE',
  ownerDisplayName: null,
}

const ledgerEntry = {
  id: 'entry-monthly-pay',
  accountId: account.id,
  category: 'INCOME',
  description: 'Monthly pay',
  amountMinor: 250_000,
  balanceAfterMinor: account.balanceMinor,
  createdAt: '2026-10-15T12:00:00.000Z',
}

const transfer = {
  id: 'transfer-demo-001',
  sourceAccountId: account.id,
  sourceAccountName: 'Everyday checking',
  destinationAccountId: 'account-avery-savings',
  destinationName: 'Rainy day savings',
  amountMinor: 12_500,
  currency: 'USD',
  memo: 'Savings transfer',
  status: 'COMPLETED',
  createdAt: '2026-10-15T12:00:00.000Z',
  duplicate: false,
}

const beneficiary = {
  id: 'beneficiary-demo-001',
  alias: 'Riley savings',
  destinationAccountId: 'account-riley-savings',
  destinationAccountName: 'Weekend savings',
  maskedAccountNumber: '**** 6401',
  createdAt: '2026-10-15T12:00:00.000Z',
}

const statement = {
  accountId: account.id,
  accountName: account.displayName,
  maskedAccountNumber: account.maskedAccountNumber,
  month: '2026-10',
  openingBalanceMinor: 100_000,
  closingBalanceMinor: 125_000,
  entries: [ledgerEntry],
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function requestUrl(input: RequestInfo | URL): URL {
  if (input instanceof URL) return input
  return new URL(typeof input === 'string' ? input : input.url, 'http://localhost')
}

const successfulResponses: Record<string, () => Response> = {
  'GET /api/v1/auth/csrf': () => jsonResponse({ token: 'csrf-token', headerName: 'X-CSRF-TOKEN' }),
  'GET /api/v1/auth/me': () => jsonResponse({ user }),
  'POST /api/v1/auth/demo-login': () => jsonResponse({ user }),
  'GET /api/v1/auth/demo-profiles': () =>
    jsonResponse({
      profiles: [
        { demoAccount: 'customer-avery', role: 'CUSTOMER' },
        { demoAccount: 'operations', role: 'OPERATIONS' },
      ],
    }),
  'POST /api/v1/auth/logout': () => new Response(null, { status: 204 }),
  'GET /api/v1/overview': () =>
    jsonResponse({
      totalBalanceMinor: account.balanceMinor,
      monthlyIncomeMinor: 250_000,
      monthlySpendMinor: 0,
      transferCount: 0,
      activeAccountCount: 1,
      accounts: [account],
      recentActivity: [ledgerEntry],
    }),
  'GET /api/v1/accounts': () => jsonResponse({ accounts: [account] }),
  'GET /api/v1/accounts/account-avery-checking/transactions': () => jsonResponse([ledgerEntry]),
  'GET /api/v1/transfers': () => jsonResponse({ transfers: [transfer] }),
  'POST /api/v1/transfers': () => jsonResponse(transfer),
  'GET /api/v1/beneficiaries/directory': () =>
    jsonResponse({
      recipients: [
        {
          accountId: beneficiary.destinationAccountId,
          displayName: 'Riley Morgan',
          accountName: beneficiary.destinationAccountName,
          maskedAccountNumber: beneficiary.maskedAccountNumber,
        },
      ],
    }),
  'GET /api/v1/beneficiaries': () => jsonResponse({ beneficiaries: [beneficiary] }),
  'POST /api/v1/beneficiaries': () => jsonResponse(beneficiary),
  'DELETE /api/v1/beneficiaries/beneficiary-demo-001': () => new Response(null, { status: 204 }),
  'GET /api/v1/statements': () => jsonResponse(statement),
  'GET /api/v1/insights': () =>
    jsonResponse({
      periodIncomeMinor: 250_000,
      periodSpendMinor: 25_000,
      categories: [{ category: 'HOUSING', amountMinor: 25_000, transactionCount: 1 }],
    }),
}

function successfulResponse(input: RequestInfo | URL, init?: RequestInit): Response {
  const method = init?.method ?? 'GET'
  const route = `${method} ${requestUrl(input).pathname}`
  const response = successfulResponses[route]
  return response ? response() : jsonResponse({ error: { code: 'NOT_FOUND', message: 'Not found' } }, 404)
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(async () => {
  vi.restoreAllMocks()
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const path = requestUrl(input).pathname
      return path.endsWith('/csrf')
        ? jsonResponse({ token: 'csrf-token', headerName: 'X-CSRF-TOKEN' })
        : new Response(null, { status: 204 })
    }),
  )
  await api.logout()
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('typed API client', () => {
  it('covers the session, account, transfer, beneficiary, statement, and insights endpoints', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) =>
      successfulResponse(input, init),
    )

    expect(await api.currentUser()).toEqual({ user })
    expect((await api.demoProfiles()).profiles).toHaveLength(2)
    expect(await api.login('customer-avery')).toEqual({ user })
    expect(await api.overview()).toMatchObject({ totalBalanceMinor: account.balanceMinor })
    expect((await api.accounts()).accounts[0]?.ownerDisplayName).toBeNull()
    expect(await api.transactions(account.id)).toEqual([ledgerEntry])
    expect((await api.transfers()).transfers).toEqual([transfer])
    expect(
      await api.createTransfer(
        {
          sourceAccountId: account.id,
          destinationAccountId: 'account-avery-savings',
          amountMinor: 12_500,
          memo: 'Savings transfer',
        },
        'fincore-test-key-001',
      ),
    ).toMatchObject({ id: transfer.id })
    expect((await api.beneficiaries()).beneficiaries).toEqual([beneficiary])
    expect((await api.recipientDirectory()).recipients).toHaveLength(1)
    expect(await api.addBeneficiary(beneficiary.destinationAccountId, beneficiary.alias)).toEqual(beneficiary)
    expect(await api.removeBeneficiary(beneficiary.id)).toBeNull()
    expect(await api.statement(account.id, statement.month)).toEqual(statement)
    expect(await api.insights(account.id)).toMatchObject({ periodSpendMinor: 25_000 })
    expect(await api.logout()).toBeNull()
    await api.addBeneficiary(beneficiary.destinationAccountId, beneficiary.alias)
    expect(fetchMock.mock.calls.filter(([input]) => requestUrl(input).pathname.endsWith('/csrf'))).toHaveLength(2)
  })

  it('converts network and CSRF failures into stable API errors', async () => {
    fetchMock.mockRejectedValueOnce(new Error('private network details'))
    await expect(api.currentUser()).rejects.toMatchObject({ code: 'API_UNAVAILABLE', status: 0 })

    fetchMock.mockResolvedValueOnce(new Response(null, { status: 503 }))
    await expect(api.login('customer-avery')).rejects.toMatchObject({
      code: 'CSRF_UNAVAILABLE',
      status: 503,
    })

    fetchMock.mockResolvedValueOnce(jsonResponse({ token: 123, headerName: 'X-CSRF-TOKEN' }))
    await expect(api.login('customer-avery')).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
      status: 200,
    })
  })

  it('uses server error codes when valid and a safe fallback for malformed errors and responses', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: { code: 'ACCESS_DENIED', message: 'Access denied', requestId: 'request-1' } }, 403),
    )
    await expect(api.currentUser()).rejects.toMatchObject({
      name: 'ApiFailure',
      code: 'ACCESS_DENIED',
      status: 403,
      requestId: 'request-1',
    })

    fetchMock.mockResolvedValueOnce(jsonResponse({ error: { code: 10, message: 'unsafe' } }, 400))
    await expect(api.currentUser()).rejects.toMatchObject({ code: 'REQUEST_FAILED', status: 400 })

    fetchMock.mockResolvedValueOnce(jsonResponse({ user: { id: 'invalid' } }))
    await expect(api.currentUser()).rejects.toMatchObject({ code: 'INVALID_RESPONSE', status: 200 })

    fetchMock.mockResolvedValueOnce(new Response('not-json', { status: 200 }))
    await expect(api.currentUser()).rejects.toMatchObject({ code: 'INVALID_RESPONSE', status: 200 })
  })

  it('reports an unreachable endpoint without exposing the underlying error message', async () => {
    fetchMock.mockRejectedValueOnce(new Error('private network detail'))

    await expect(api.currentUser()).rejects.toMatchObject({
      code: 'API_UNAVAILABLE',
      message: 'FinCore API is unreachable. Start the backend and retry.',
    })
  })

  it('validates the API failure object shape', () => {
    const failure = new ApiFailure('Denied', 'ACCESS_DENIED', 403, 'request-1')

    expect(failure).toMatchObject({
      name: 'ApiFailure',
      message: 'Denied',
      code: 'ACCESS_DENIED',
      status: 403,
      requestId: 'request-1',
    })
  })
})
