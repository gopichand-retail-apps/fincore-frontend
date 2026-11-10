import { apiModeConfiguration, resolveApiRequest } from './config'
import { z } from 'zod'

export const demoRoleSchema = z.enum(['CUSTOMER', 'OPERATIONS', 'AUDITOR'])

const userSchema = z.object({ id: z.string(), displayName: z.string(), role: demoRoleSchema })

export type DemoUser = z.infer<typeof userSchema>
export type DemoRole = DemoUser['role']

const demoProfileSchema = z.object({
  demoAccount: z.string().regex(/^[A-Za-z0-9._:-]{1,40}$/),
  role: demoRoleSchema,
})
const demoProfilesEnvelopeSchema = z.object({ profiles: z.array(demoProfileSchema).min(1) })
export type DemoProfile = z.infer<typeof demoProfileSchema>

const accountSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  type: z.enum(['CHECKING', 'SAVINGS']),
  maskedAccountNumber: z.string(),
  currency: z.literal('USD'),
  balanceMinor: z.number().int(),
  status: z.enum(['ACTIVE', 'FROZEN']),
  ownerDisplayName: z.string().nullable().optional(),
})

export type Account = z.infer<typeof accountSchema>

const ledgerEntrySchema = z.object({
  id: z.string(),
  accountId: z.string(),
  transferId: z.string().optional(),
  category: z.string(),
  description: z.string(),
  amountMinor: z.number().int(),
  balanceAfterMinor: z.number().int(),
  createdAt: z.string(),
})

export type LedgerEntry = z.infer<typeof ledgerEntrySchema>

const overviewSchema = z.object({
  totalBalanceMinor: z.number().int(),
  monthlyIncomeMinor: z.number().int(),
  monthlySpendMinor: z.number().int(),
  transferCount: z.number().int(),
  activeAccountCount: z.number().int(),
  accounts: z.array(accountSchema),
  recentActivity: z.array(ledgerEntrySchema),
})

export type Overview = z.infer<typeof overviewSchema>

const beneficiarySchema = z.object({
  id: z.string(),
  alias: z.string(),
  destinationAccountId: z.string(),
  destinationAccountName: z.string(),
  maskedAccountNumber: z.string(),
  createdAt: z.string(),
})

export type Beneficiary = z.infer<typeof beneficiarySchema>

const recipientSchema = z.object({
  accountId: z.string(),
  displayName: z.string(),
  accountName: z.string(),
  maskedAccountNumber: z.string(),
})

export type Recipient = z.infer<typeof recipientSchema>

const transferSchema = z.object({
  id: z.string(),
  sourceAccountId: z.string(),
  sourceAccountName: z.string(),
  destinationAccountId: z.string(),
  destinationName: z.string(),
  amountMinor: z.number().int(),
  currency: z.literal('USD'),
  memo: z.string(),
  status: z.literal('COMPLETED'),
  createdAt: z.string(),
  duplicate: z.boolean().optional(),
})

export type Transfer = z.infer<typeof transferSchema>

const insightsSchema = z.object({
  periodIncomeMinor: z.number().int(),
  periodSpendMinor: z.number().int(),
  categories: z.array(
    z.object({
      category: z.string(),
      amountMinor: z.number().int(),
      transactionCount: z.number().int(),
    }),
  ),
})

export type Insights = z.infer<typeof insightsSchema>

const statementSchema = z.object({
  accountId: z.string(),
  accountName: z.string(),
  maskedAccountNumber: z.string(),
  month: z.string(),
  openingBalanceMinor: z.number().int(),
  closingBalanceMinor: z.number().int(),
  entries: z.array(ledgerEntrySchema),
})

export type Statement = z.infer<typeof statementSchema>

const apiErrorSchema = z.object({
  error: z.object({ code: z.string(), message: z.string(), requestId: z.string().optional() }),
})
const csrfSchema = z.object({ token: z.string(), headerName: z.string() })
const authEnvelopeSchema = z.object({ user: userSchema })
const accountEnvelopeSchema = z.object({ accounts: z.array(accountSchema) })
const transferEnvelopeSchema = z.object({ transfers: z.array(transferSchema) })
const beneficiaryEnvelopeSchema = z.object({ beneficiaries: z.array(beneficiarySchema) })
const recipientEnvelopeSchema = z.object({ recipients: z.array(recipientSchema) })
const emptySchema = z.null()

export class ApiFailure extends Error {
  readonly code: string
  readonly status: number
  readonly requestId?: string

  constructor(message: string, code: string, status: number, requestId?: string) {
    super(message)
    this.name = 'ApiFailure'
    this.code = code
    this.status = status
    this.requestId = requestId
  }
}

let csrfState: z.infer<typeof csrfSchema> | null = null

async function csrfToken(): Promise<z.infer<typeof csrfSchema>> {
  if (csrfState) return csrfState
  const target = resolveApiRequest('/api/v1/auth/csrf', apiModeConfiguration)
  let response: Response
  try {
    response = await fetch(target.url, {
      credentials: target.credentials,
      headers: {
        'X-Request-ID': crypto.randomUUID(),
        'X-Trace-ID': crypto.randomUUID(),
      },
    })
  } catch {
    throw new ApiFailure('FinCore API is unreachable. Start the backend and retry.', 'API_UNAVAILABLE', 0)
  }
  if (!response.ok)
    throw new ApiFailure('Could not establish a secure demo session.', 'CSRF_UNAVAILABLE', response.status)
  const parsed = csrfSchema.safeParse(await response.json())
  if (!parsed.success)
    throw new ApiFailure('The server returned an unexpected security response.', 'INVALID_RESPONSE', response.status)
  csrfState = parsed.data
  return parsed.data
}

async function request<T>(path: string, schema: z.ZodType<T>, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('X-Request-ID', crypto.randomUUID())
  headers.set('X-Trace-ID', crypto.randomUUID())
  if (init.body !== undefined) headers.set('Content-Type', 'application/json')
  if (init.method && init.method !== 'GET') {
    const token = await csrfToken()
    headers.set(token.headerName, token.token)
  }

  const target = resolveApiRequest(path, apiModeConfiguration)
  let response: Response
  try {
    response = await fetch(target.url, { ...init, headers, credentials: target.credentials })
  } catch {
    throw new ApiFailure('FinCore API is unreachable. Start the backend and retry.', 'API_UNAVAILABLE', 0)
  }

  let payload: unknown = null
  if (response.status !== 204) {
    try {
      payload = await response.json()
    } catch {
      payload = null
    }
  }
  if (!response.ok) {
    const error = apiErrorSchema.safeParse(payload)
    if (error.success) {
      throw new ApiFailure(error.data.error.message, error.data.error.code, response.status, error.data.error.requestId)
    }
    throw new ApiFailure('The request could not be completed.', 'REQUEST_FAILED', response.status)
  }
  const parsed = schema.safeParse(payload)
  if (!parsed.success)
    throw new ApiFailure('The server returned an unexpected response.', 'INVALID_RESPONSE', response.status)
  return parsed.data
}

function postBody(body?: unknown): RequestInit {
  return body === undefined ? { method: 'POST' } : { method: 'POST', body: JSON.stringify(body) }
}

export const api = {
  currentUser: () => request('/api/v1/auth/me', authEnvelopeSchema),
  demoProfiles: () => request('/api/v1/auth/demo-profiles', demoProfilesEnvelopeSchema),
  login: (demoAccount: string) => request('/api/v1/auth/demo-login', authEnvelopeSchema, postBody({ demoAccount })),
  logout: async () => {
    const result = await request('/api/v1/auth/logout', emptySchema, postBody())
    csrfState = null
    return result
  },
  overview: () => request('/api/v1/overview', overviewSchema),
  accounts: () => request('/api/v1/accounts', accountEnvelopeSchema),
  transactions: (accountId: string) =>
    request(`/api/v1/accounts/${encodeURIComponent(accountId)}/transactions?limit=50`, z.array(ledgerEntrySchema)),
  transfers: () => request('/api/v1/transfers', transferEnvelopeSchema),
  createTransfer: (
    body: {
      sourceAccountId: string
      destinationAccountId: string
      amountMinor: number
      memo: string
    },
    idempotencyKey: string,
  ) =>
    request('/api/v1/transfers', transferSchema, {
      ...postBody(body),
      headers: { 'Idempotency-Key': idempotencyKey },
    }),
  beneficiaries: () => request('/api/v1/beneficiaries', beneficiaryEnvelopeSchema),
  recipientDirectory: () => request('/api/v1/beneficiaries/directory', recipientEnvelopeSchema),
  addBeneficiary: (destinationAccountId: string, alias: string) =>
    request('/api/v1/beneficiaries', beneficiarySchema, postBody({ destinationAccountId, alias })),
  removeBeneficiary: (beneficiaryId: string) =>
    request(`/api/v1/beneficiaries/${encodeURIComponent(beneficiaryId)}`, emptySchema, { method: 'DELETE' }),
  statement: (accountId: string, month: string) =>
    request(
      `/api/v1/statements?accountId=${encodeURIComponent(accountId)}&month=${encodeURIComponent(month)}`,
      statementSchema,
    ),
  insights: (accountId: string) =>
    request(`/api/v1/insights?accountId=${encodeURIComponent(accountId)}`, insightsSchema),
}
