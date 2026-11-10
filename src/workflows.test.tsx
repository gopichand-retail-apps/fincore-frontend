// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { PropsWithChildren, ReactElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Account, Beneficiary, DemoProfile, DemoUser, LedgerEntry, Transfer } from './api'
import { ApiFailure, api } from './api'
import App from './App'
import AccountsPage from './AccountsPage'
import BeneficiariesPage from './BeneficiariesPage'
import { ContentContext } from './content-context'
import DashboardPage from './DashboardPage'
import { contentModelSchema, dataStringFrom } from './content-schema'
import InsightsPage from './InsightsPage'
import fincoreModel from '../public/fincore-model.json'
import SignInPage from './SignInPage'
import StatementsPage from './StatementsPage'
import TransfersPage from './TransfersPage'
import { formatMoney } from './format'

const model = contentModelSchema.parse(fincoreModel)

function translate(key: string, values: Record<string, string | number> = {}): string {
  const template = model.messages[key]
  if (template === undefined) throw new Error(`CONTENT_KEY_MISSING:${key}`)
  return template.replace(/\{\{([A-Za-z0-9_]+)\}\}/g, (_match, name: string) => {
    const replacement = values[name]
    if (replacement === undefined) throw new Error(`CONTENT_VALUE_MISSING:${name}`)
    return String(replacement)
  })
}

function TestContent({ children }: PropsWithChildren) {
  return <ContentContext.Provider value={{ model, t: translate }}>{children}</ContentContext.Provider>
}

function renderWithContent(ui: ReactElement) {
  return render(ui, { wrapper: TestContent })
}

const customer: DemoUser = {
  id: 'demo-customer-avery',
  displayName: 'Avery Quinn',
  role: 'CUSTOMER',
}

const operations: DemoUser = {
  id: 'demo-operations',
  displayName: 'Morgan Reed',
  role: 'OPERATIONS',
}

const profiles: DemoProfile[] = [
  { demoAccount: 'customer-avery', role: 'CUSTOMER' },
  { demoAccount: 'customer-riley', role: 'CUSTOMER' },
  { demoAccount: 'operations', role: 'OPERATIONS' },
  { demoAccount: 'auditor', role: 'AUDITOR' },
]

const checking = createAccount('account-avery-checking', { balanceMinor: 100_000 })
const savings = createAccount('account-avery-savings', { balanceMinor: 250_000 })
const customerAccounts = [checking, savings]

const activity = [
  createEntry({
    id: 'entry-income',
    category: 'INCOME',
    description: 'Monthly pay',
    amountMinor: 250_000,
    balanceAfterMinor: 300_000,
  }),
  createEntry({
    id: 'entry-transfer',
    transferId: 'transfer-demo-001',
    category: 'TRANSFER',
    description: 'Transfer to Rainy day savings',
    amountMinor: -2_500,
    balanceAfterMinor: 297_500,
  }),
]

const workspaceOverview = {
  totalBalanceMinor: 350_000,
  monthlyIncomeMinor: 250_000,
  monthlySpendMinor: 30_000,
  transferCount: 1,
  activeAccountCount: 2,
  accounts: customerAccounts,
  recentActivity: activity,
}

const sampleTransfer = createTransfer({
  id: 'transfer-out',
  sourceAccountId: checking.id,
  destinationAccountId: savings.id,
  amountMinor: 2_500,
})

const seedBeneficiary = createBeneficiary({
  id: 'beneficiary-riley-savings',
  alias: 'Riley savings',
  destinationAccountId: 'account-riley-savings',
})

function createAccount(id: string, overrides: Partial<Account> = {}): Account {
  const type = id.includes('savings') ? 'SAVINGS' : 'CHECKING'
  const ownerId = dataStringFrom(model, 'accountOwners', id)
  return {
    id,
    displayName: dataStringFrom(model, 'accountNames', id),
    type,
    maskedAccountNumber: '**** 1042',
    currency: 'USD',
    balanceMinor: 100_000,
    status: 'ACTIVE',
    ownerDisplayName: id.startsWith('account-avery') ? undefined : dataStringFrom(model, 'demoUserNames', ownerId),
    ...overrides,
  }
}

function createEntry(overrides: Partial<LedgerEntry> = {}): LedgerEntry {
  return {
    id: 'entry-default',
    accountId: checking?.id ?? 'account-avery-checking',
    category: 'INCOME',
    description: 'Monthly pay',
    amountMinor: 1_000,
    balanceAfterMinor: 100_000,
    createdAt: '2026-10-15T12:00:00.000Z',
    ...overrides,
  }
}

function createBeneficiary(overrides: Partial<Beneficiary> = {}): Beneficiary {
  const destinationAccountId = overrides.destinationAccountId ?? 'account-riley-savings'
  return {
    id: 'beneficiary-default',
    alias: 'Riley savings',
    destinationAccountId,
    destinationAccountName: dataStringFrom(model, 'accountNames', destinationAccountId),
    maskedAccountNumber: '**** 6401',
    createdAt: '2026-10-15T12:00:00.000Z',
    ...overrides,
  }
}

function createTransfer(overrides: Partial<Transfer> = {}): Transfer {
  const sourceAccountId = overrides.sourceAccountId ?? checking.id
  const destinationAccountId = overrides.destinationAccountId ?? savings.id
  return {
    id: 'transfer-default',
    sourceAccountId,
    sourceAccountName: dataStringFrom(model, 'accountNames', sourceAccountId),
    destinationAccountId,
    destinationName: dataStringFrom(model, 'accountNames', destinationAccountId),
    amountMinor: 2_500,
    currency: 'USD',
    memo: 'Test transfer',
    status: 'COMPLETED',
    createdAt: '2026-10-15T12:00:00.000Z',
    duplicate: false,
    ...overrides,
  }
}

function emptyOverview() {
  return {
    totalBalanceMinor: 0,
    monthlyIncomeMinor: 0,
    monthlySpendMinor: 0,
    transferCount: 0,
    activeAccountCount: 0,
    accounts: [],
    recentActivity: [],
  }
}

function configureApi(user = customer, initiallySignedIn = false) {
  let savedBeneficiaries = [seedBeneficiary]
  const addedBeneficiary = createBeneficiary({
    id: 'beneficiary-riley-checking',
    alias: 'Riley checking',
    destinationAccountId: 'account-riley-checking',
  })
  const recipients = ['account-riley-checking', 'account-riley-savings'].map((accountId) => ({
    accountId,
    displayName: dataStringFrom(model, 'demoUserNames', dataStringFrom(model, 'accountOwners', accountId)),
    accountName: dataStringFrom(model, 'accountNames', accountId),
    maskedAccountNumber: accountId.endsWith('checking') ? '**** 3176' : '**** 6401',
  }))

  vi.spyOn(api, 'currentUser').mockImplementation(() =>
    initiallySignedIn
      ? Promise.resolve({ user })
      : Promise.reject(new ApiFailure('Unauthenticated', 'AUTH_REQUIRED', 401)),
  )
  vi.spyOn(api, 'demoProfiles').mockResolvedValue({ profiles })
  vi.spyOn(api, 'login').mockResolvedValue({ user })
  vi.spyOn(api, 'logout').mockResolvedValue(null)
  vi.spyOn(api, 'overview').mockResolvedValue(workspaceOverview)
  vi.spyOn(api, 'accounts').mockResolvedValue({ accounts: customerAccounts })
  vi.spyOn(api, 'transfers').mockResolvedValue({ transfers: [sampleTransfer] })
  vi.spyOn(api, 'beneficiaries').mockImplementation(async () => ({
    beneficiaries: [...savedBeneficiaries],
  }))
  vi.spyOn(api, 'recipientDirectory').mockResolvedValue({ recipients })
  vi.spyOn(api, 'transactions').mockResolvedValue(activity)
  vi.spyOn(api, 'createTransfer').mockResolvedValue(sampleTransfer)
  vi.spyOn(api, 'addBeneficiary').mockImplementation(async () => {
    savedBeneficiaries = [...savedBeneficiaries, addedBeneficiary]
    return addedBeneficiary
  })
  vi.spyOn(api, 'removeBeneficiary').mockImplementation(async (beneficiaryId) => {
    savedBeneficiaries = savedBeneficiaries.filter((beneficiary) => beneficiary.id !== beneficiaryId)
    return null
  })
  vi.spyOn(api, 'statement').mockImplementation(async (accountId, month) => ({
    accountId,
    accountName: dataStringFrom(model, 'accountNames', accountId),
    maskedAccountNumber: '**** 1042',
    month,
    openingBalanceMinor: 297_500,
    closingBalanceMinor: 300_000,
    entries: activity,
  }))
  vi.spyOn(api, 'insights').mockResolvedValue({
    periodIncomeMinor: 250_000,
    periodSpendMinor: 30_000,
    categories: [
      { category: 'HOUSING', amountMinor: 20_000, transactionCount: 1 },
      { category: 'DINING', amountMinor: 10_000, transactionCount: 2 },
    ],
  })

  return { addedBeneficiary }
}

function navigateTo(view: string): void {
  fireEvent.click(screen.getByRole('button', { name: translate(`navigation.${view}`) }))
}

function submitForm(control: HTMLElement): void {
  const form = control.closest('form')
  if (!form) throw new Error('Expected the control to belong to a form')
  fireEvent.submit(form)
}

function byId(id: string): HTMLElement {
  const element = document.getElementById(id)
  if (!element) throw new Error(`Expected form control: ${id}`)
  return element
}

beforeEach(() => {
  vi.restoreAllMocks()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('FinCore customer workflows', () => {
  it('signs in, navigates the banking workspace, completes transfer and beneficiary workflows, exports a statement, and opens insights', async () => {
    const { addedBeneficiary } = configureApi()
    renderWithContent(<App />)

    await screen.findByRole('button', { name: translate('login.openProfile') })
    const profileGroup = screen.getByRole('group', { name: translate('login.profileGroup') })
    await waitFor(() => expect(profileGroup.getAttribute('aria-busy')).toBe('false'))
    const [firstProfile] = within(profileGroup).getAllByRole('button')
    if (!firstProfile) throw new Error('Expected the customer demo profile')
    fireEvent.click(firstProfile)
    fireEvent.click(screen.getByRole('button', { name: translate('login.openProfile') }))
    expect(api.login).toHaveBeenCalledWith('customer-avery')
    expect(await screen.findByText(translate('dashboard.greeting', { name: 'Avery' }))).toBeTruthy()
    expect(screen.getByRole('heading', { name: translate('page.title.overview') })).toBeTruthy()
    expect(screen.getByText(translate('dashboard.greeting', { name: 'Avery' }))).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: translate('dashboard.makeTransfer') }))
    await screen.findByRole('heading', { name: translate('page.title.transfers') })
    fireEvent.change(byId('transfer-destination'), {
      target: { value: savings.id },
    })
    fireEvent.change(byId('transfer-amount'), {
      target: { value: '25.00' },
    })
    fireEvent.change(byId('transfer-memo'), {
      target: { value: 'Savings transfer' },
    })
    submitForm(byId('transfer-amount'))
    expect(await screen.findByText(translate('transfers.posted'))).toBeTruthy()
    expect(api.createTransfer).toHaveBeenCalledWith(
      {
        sourceAccountId: checking.id,
        destinationAccountId: savings.id,
        amountMinor: 2_500,
        memo: 'Savings transfer',
      },
      expect.any(String),
    )
    await waitFor(() => expect(api.overview).toHaveBeenCalledTimes(2))

    navigateTo('accounts')
    await screen.findByRole('heading', { name: translate('accounts.introTitle') })
    expect(await screen.findByText(translate('ledger.transferSent'))).toBeTruthy()
    fireEvent.click(
      screen.getByRole('button', {
        name: new RegExp(dataStringFrom(model, 'accountNames', savings.id)),
      }),
    )
    await waitFor(() => expect(api.transactions).toHaveBeenCalledWith(savings.id))

    navigateTo('beneficiaries')
    await screen.findByRole('heading', { name: translate('beneficiaries.introTitle') })
    fireEvent.change(byId('beneficiary-account'), {
      target: { value: 'account-riley-checking' },
    })
    fireEvent.change(byId('beneficiary-alias'), {
      target: { value: addedBeneficiary.alias },
    })
    submitForm(byId('beneficiary-alias'))
    expect(
      await screen.findByText(translate('beneficiaries.addSuccess', { alias: addedBeneficiary.alias })),
    ).toBeTruthy()
    await waitFor(() => expect(api.beneficiaries).toHaveBeenCalledTimes(3))
    fireEvent.click(
      await screen.findByRole('button', {
        name: translate('beneficiaries.remove', { alias: addedBeneficiary.alias }),
      }),
    )
    expect(
      await screen.findByText(translate('beneficiaries.removeSuccess', { alias: addedBeneficiary.alias })),
    ).toBeTruthy()

    navigateTo('statements')
    await screen.findByRole('heading', { name: translate('statements.title') })
    const createObjectURL = vi.fn(() => 'blob:statement')
    const revokeObjectURL = vi.fn()
    const clickLink = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })
    fireEvent.click(screen.getByRole('button', { name: translate('statements.export') }))
    expect(createObjectURL).toHaveBeenCalledOnce()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:statement')
    expect(clickLink).toHaveBeenCalledOnce()

    navigateTo('insights')
    await screen.findByRole('heading', { name: translate('insights.title') })
    expect(await screen.findByText(dataStringFrom(model, 'ledgerCategories', 'HOUSING'))).toBeTruthy()
    expect(api.insights).toHaveBeenCalledWith(checking.id)

    fireEvent.click(screen.getByRole('button', { name: translate('app.signOut') }))
    await screen.findByRole('button', { name: translate('login.openProfile') })
    expect(api.logout).toHaveBeenCalledOnce()
  })

  it('shows read-only operations navigation and account insights permissions', async () => {
    configureApi(operations, true)
    vi.spyOn(api, 'overview').mockResolvedValue(emptyOverview())
    renderWithContent(<App />)

    await screen.findByRole('heading', { name: translate('page.title.overview') })
    expect(await screen.findByText(translate('dashboard.noAccounts'))).toBeTruthy()
    expect(await screen.findByText(translate('dashboard.noRecentTransactions'))).toBeTruthy()
    expect(screen.queryByRole('button', { name: translate('navigation.insights') })).toBeNull()
    expect(api.beneficiaries).not.toHaveBeenCalled()

    navigateTo('transfers')
    expect(await screen.findByText(translate('transfers.readOnly'))).toBeTruthy()
    expect(screen.queryByLabelText(new RegExp(translate('transfers.amount')))).toBeNull()

    navigateTo('statements')
    expect(await screen.findByText(translate('statements.readOnly'))).toBeTruthy()
  })

  it('displays API errors, retries a failed workspace refresh, and preserves the session when logout fails', async () => {
    configureApi(customer, true)
    vi.mocked(api.overview)
      .mockResolvedValueOnce(workspaceOverview)
      .mockRejectedValueOnce(new ApiFailure('Unavailable', 'API_UNAVAILABLE', 0))
      .mockResolvedValue(workspaceOverview)
    vi.mocked(api.createTransfer).mockResolvedValue(sampleTransfer)
    vi.mocked(api.logout).mockRejectedValue(new ApiFailure('Unavailable', 'API_UNAVAILABLE', 0))
    renderWithContent(<App />)

    await screen.findByRole('button', { name: translate('dashboard.makeTransfer') })
    fireEvent.click(screen.getByRole('button', { name: translate('dashboard.makeTransfer') }))
    await screen.findByRole('heading', { name: translate('page.title.transfers') })
    fireEvent.change(byId('transfer-destination'), {
      target: { value: savings.id },
    })
    fireEvent.change(byId('transfer-amount'), {
      target: { value: '10' },
    })
    submitForm(byId('transfer-amount'))

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain(translate('errors.API_UNAVAILABLE'))
    expect(await screen.findByRole('status')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: translate('app.retry') }))
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
    await waitFor(() => expect(api.overview).toHaveBeenCalledTimes(3))

    fireEvent.click(screen.getByRole('button', { name: translate('app.signOut') }))
    expect((await screen.findByRole('alert')).textContent).toContain(translate('errors.API_UNAVAILABLE'))
    expect(await screen.findByRole('heading', { name: translate('page.title.transfers') })).toBeTruthy()
  })

  it('surfaces an unavailable session lookup as a safe sign-in message', async () => {
    vi.spyOn(api, 'currentUser').mockRejectedValue(new ApiFailure('Unavailable', 'API_UNAVAILABLE', 0))
    vi.spyOn(api, 'demoProfiles').mockResolvedValue({ profiles })
    renderWithContent(<App />)

    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toContain(translate('errors.API_UNAVAILABLE'))
  })

  it('reports profile loading and authentication failures without accepting unverified profiles', async () => {
    const profileRequest = vi
      .spyOn(api, 'demoProfiles')
      .mockRejectedValue(new ApiFailure('Unavailable', 'API_UNAVAILABLE', 0))
    const onSignedIn = vi.fn()
    renderWithContent(<SignInPage isMock initialError="" onSignedIn={onSignedIn} />)

    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByRole('button', { name: translate('login.openProfile') }).hasAttribute('disabled')).toBe(true)

    cleanup()
    profileRequest.mockResolvedValue({ profiles })
    vi.spyOn(api, 'login').mockRejectedValue(new ApiFailure('Denied', 'ACCESS_DENIED', 403))
    renderWithContent(<SignInPage isMock initialError="" onSignedIn={onSignedIn} />)
    fireEvent.click(await screen.findByRole('button', { name: translate('login.openProfile') }))

    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toContain(translate('errors.requestFailed'))
    expect(onSignedIn).not.toHaveBeenCalled()
  })
})

describe('FinCore page states', () => {
  it('renders account activity errors and an empty ledger for a read-only user without accounts', async () => {
    vi.spyOn(api, 'transactions').mockRejectedValue(new ApiFailure('Unavailable', 'API_UNAVAILABLE', 0))
    renderWithContent(<AccountsPage accounts={[]} user={operations} />)

    expect(screen.getByText(translate('accounts.readOnly', { role: translate('role.OPERATIONS') }))).toBeTruthy()
    expect(screen.getByText(translate('accounts.noEntries'))).toBeTruthy()
    expect(api.transactions).not.toHaveBeenCalled()

    cleanup()
    renderWithContent(<AccountsPage accounts={[checking]} user={customer} />)
    expect(await screen.findByRole('alert')).toBeTruthy()
  })

  it('renders the insights permission state without requesting data for a non-customer', () => {
    vi.spyOn(api, 'insights').mockResolvedValue({
      periodIncomeMinor: 0,
      periodSpendMinor: 0,
      categories: [],
    })
    renderWithContent(<InsightsPage accounts={[]} user={operations} />)

    expect(screen.getByText(translate('insights.permission'))).toBeTruthy()
    expect(api.insights).not.toHaveBeenCalled()
  })

  it('renders an empty insight breakdown after a successful response', async () => {
    vi.spyOn(api, 'insights').mockResolvedValue({
      periodIncomeMinor: 0,
      periodSpendMinor: 0,
      categories: [],
    })
    renderWithContent(<InsightsPage accounts={[checking]} user={customer} />)

    expect(await screen.findByText(translate('insights.none'))).toBeTruthy()
    expect(screen.getByText(dataStringFrom(model, 'accountNames', checking.id))).toBeTruthy()
  })

  it('renders statement errors and empty states without exporting incomplete data', async () => {
    vi.spyOn(api, 'statement').mockRejectedValue(new ApiFailure('Unavailable', 'API_UNAVAILABLE', 0))
    renderWithContent(<StatementsPage accounts={customerAccounts} user={customer} />)

    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByText(translate('statements.selectMonth'))).toBeTruthy()
    expect(screen.getByRole('button', { name: translate('statements.export') })).toHaveProperty('disabled', true)
  })

  it('renders statements with no activity and their read-only role label', async () => {
    vi.spyOn(api, 'statement').mockResolvedValue({
      accountId: checking.id,
      accountName: checking.displayName,
      maskedAccountNumber: checking.maskedAccountNumber,
      month: '2026-10',
      openingBalanceMinor: 100_000,
      closingBalanceMinor: 100_000,
      entries: [],
    })
    renderWithContent(<StatementsPage accounts={[checking]} user={operations} />)

    expect(await screen.findByText(translate('statements.noActivity'))).toBeTruthy()
    expect(screen.getByText(translate('statements.readOnly'))).toBeTruthy()
  })

  it('shows directory failures, empty beneficiary lists, and local form validation', async () => {
    vi.spyOn(api, 'recipientDirectory').mockRejectedValue(new ApiFailure('Unavailable', 'API_UNAVAILABLE', 0))
    renderWithContent(<BeneficiariesPage beneficiaries={[]} onUpdated={vi.fn()} />)

    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByText(translate('beneficiaries.none'))).toBeTruthy()
    expect(screen.getByText(translate('beneficiaries.allSaved'))).toBeTruthy()
  })

  it('validates beneficiary aliases and reports add and remove failures', async () => {
    const updated = vi.fn()
    vi.spyOn(api, 'recipientDirectory').mockResolvedValue({
      recipients: [
        {
          accountId: 'account-riley-checking',
          displayName: 'Riley Morgan',
          accountName: dataStringFrom(model, 'accountNames', 'account-riley-checking'),
          maskedAccountNumber: '**** 3176',
        },
      ],
    })
    vi.spyOn(api, 'addBeneficiary').mockRejectedValue(new ApiFailure('Unavailable', 'API_UNAVAILABLE', 0))
    vi.spyOn(api, 'removeBeneficiary').mockRejectedValue(new ApiFailure('Unavailable', 'API_UNAVAILABLE', 0))
    renderWithContent(<BeneficiariesPage beneficiaries={[seedBeneficiary]} onUpdated={updated} />)

    await screen.findByRole('combobox', { name: new RegExp(translate('beneficiaries.account')) })
    fireEvent.change(byId('beneficiary-account'), {
      target: { value: 'account-riley-checking' },
    })
    submitForm(byId('beneficiary-alias'))
    expect(await screen.findAllByText(translate('beneficiaries.invalid'))).not.toHaveLength(0)

    fireEvent.change(byId('beneficiary-alias'), { target: { value: 'Riley checking' } })
    submitForm(byId('beneficiary-alias'))
    expect(await screen.findAllByText(translate('errors.API_UNAVAILABLE'))).not.toHaveLength(0)
    fireEvent.click(
      screen.getByRole('button', {
        name: translate('beneficiaries.remove', { alias: seedBeneficiary.alias }),
      }),
    )
    expect(await screen.findAllByText(translate('errors.API_UNAVAILABLE'))).not.toHaveLength(0)
    expect(updated).not.toHaveBeenCalled()
  })

  it('blocks invalid, unavailable, and over-balance transfers before submitting', async () => {
    const createTransferSpy = vi.spyOn(api, 'createTransfer').mockResolvedValue(sampleTransfer)
    renderWithContent(
      <TransfersPage
        accounts={[createAccount(checking.id, { status: 'FROZEN' }), savings]}
        beneficiaries={[]}
        transfers={[]}
        user={customer}
        onCompleted={vi.fn()}
      />,
    )
    expect(screen.getByText(translate('transfers.none'))).toBeTruthy()

    fireEvent.change(screen.getByLabelText(new RegExp(translate('transfers.toAccount'))), {
      target: { value: savings.id },
    })
    fireEvent.change(byId('transfer-amount'), {
      target: { value: '1.00' },
    })
    submitForm(byId('transfer-amount'))
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByText(translate('transfers.sourceUnavailable'))).toBeTruthy()

    cleanup()
    renderWithContent(
      <TransfersPage
        accounts={customerAccounts}
        beneficiaries={[]}
        transfers={[]}
        user={customer}
        onCompleted={vi.fn()}
      />,
    )
    fireEvent.change(byId('transfer-destination'), {
      target: { value: savings.id },
    })
    fireEvent.change(byId('transfer-amount'), {
      target: { value: 'not-money' },
    })
    submitForm(byId('transfer-amount'))
    expect(byId('transfer-amount').getAttribute('aria-invalid')).toBe('true')
    expect(byId('transfer-amount').getAttribute('aria-describedby')).toContain('transfer-amount-error')
    expect(document.activeElement).toBe(byId('transfer-amount'))
    expect(
      await screen.findByText(
        translate('transfers.amountInvalid', {
          minimum: formatMoney(1, 'USD', model.locale),
          maximum: formatMoney(25_000_000, 'USD', model.locale),
        }),
      ),
    ).toBeTruthy()

    fireEvent.change(byId('transfer-amount'), {
      target: { value: '2500.01' },
    })
    submitForm(byId('transfer-amount'))
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByText(translate('transfers.overBalance'))).toBeTruthy()
    expect(createTransferSpy).not.toHaveBeenCalled()

    cleanup()
    createTransferSpy.mockRejectedValue(new ApiFailure('Unavailable', 'API_UNAVAILABLE', 0))
    renderWithContent(
      <TransfersPage
        accounts={customerAccounts}
        beneficiaries={[]}
        transfers={[sampleTransfer]}
        user={customer}
        onCompleted={vi.fn()}
      />,
    )
    fireEvent.change(byId('transfer-destination'), { target: { value: savings.id } })
    fireEvent.change(byId('transfer-amount'), { target: { value: '10' } })
    submitForm(byId('transfer-amount'))
    expect(await screen.findByText(translate('errors.API_UNAVAILABLE'))).toBeTruthy()
  })

  it('shows no-destination guidance and supports dashboard navigation for read-only roles', () => {
    const onNavigate = vi.fn()
    renderWithContent(
      <DashboardPage
        overview={{ ...emptyOverview(), activeAccountCount: 1 }}
        user={operations}
        onNavigate={onNavigate}
      />,
    )
    expect(screen.getByText(translate('dashboard.roleNote.readOnly'))).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: translate('dashboard.reviewStatements') }))
    expect(onNavigate).toHaveBeenCalledWith('statements')

    cleanup()
    renderWithContent(
      <TransfersPage accounts={[checking]} beneficiaries={[]} transfers={[]} user={customer} onCompleted={vi.fn()} />,
    )
    expect(screen.getByText(translate('transfers.noDestination'))).toBeTruthy()
    expect(screen.queryByLabelText(translate('transfers.amount'))).toBeNull()
  })
})
