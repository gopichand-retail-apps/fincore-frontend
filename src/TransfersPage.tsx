import { useState, type FormEvent } from 'react'
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Check, CircleAlert, RotateCw, ShieldCheck } from 'lucide-react'
import type { Account, Beneficiary, DemoUser, Transfer } from './api'
import { api } from './api'
import { useContent } from './content-context'
import { dataString, dataStringFrom, dataStringRecord, errorMessage } from './content-schema'
import { formatDateTime, formatMoney, parseMoneyToMinor } from './format'

interface TransfersPageProps {
  accounts: Account[]
  beneficiaries: Beneficiary[]
  transfers: Transfer[]
  user: DemoUser
  onCompleted: () => void
}

interface DestinationOption {
  id: string
  label: string
  accountName: string
  maskedAccountNumber: string
}

interface TransferFormPanelProps {
  accounts: Account[]
  beneficiaries: Beneficiary[]
  isCustomer: boolean
  onCompleted: () => void
}

interface TransferFieldErrors {
  source: string
  destination: string
  amount: string
}

interface TransferFormViewProps {
  accounts: Account[]
  destinations: DestinationOption[]
  isCustomer: boolean
  canTransfer: boolean
  sourceAccount: Account | undefined
  sourceId: string
  destinationId: string
  amount: string
  memo: string
  busy: boolean
  error: string
  fieldErrors: TransferFieldErrors
  success: Transfer | null
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>
  onSourceChange: (value: string) => void
  onDestinationChange: (value: string) => void
  onAmountChange: (value: string) => void
  onMemoChange: (value: string) => void
}

interface TransferHistoryProps {
  accounts: Account[]
  transfers: Transfer[]
  isCustomer: boolean
}

function TransfersPage({ accounts, beneficiaries, transfers, user, onCompleted }: TransfersPageProps) {
  const { t } = useContent()
  const isCustomer = user.role === 'CUSTOMER'

  return (
    <section className="page-stack" aria-label={t('transfers.ariaLabel')}>
      <div className="page-intro-row">
        <div>
          <h2 className="section-title">{t('transfers.introTitle')}</h2>
          <p className="section-copy">{t('transfers.intro')}</p>
        </div>
        <span className="role-note">
          <ShieldCheck size={15} /> {t('transfers.noRails')}
        </span>
      </div>

      <div className="transfer-layout">
        <TransferFormPanel
          accounts={accounts}
          beneficiaries={beneficiaries}
          isCustomer={isCustomer}
          onCompleted={onCompleted}
        />

        <aside className="transfer-aside">
          <section className="transfer-note">
            <span className="transfer-note-icon">
              <ShieldCheck size={18} />
            </span>
            <h3>{t('transfers.balancedLedger')}</h3>
            <p>{t('transfers.atomicExplanation')}</p>
            <div className="transfer-note-rule">
              <span>{t('transfers.debit')}</span>
              <i />
              <span>{t('transfers.credit')}</span>
            </div>
          </section>
          <TransferHistory accounts={accounts} transfers={transfers} isCustomer={isCustomer} />
        </aside>
      </div>
    </section>
  )
}

function TransferFormPanel({ accounts, beneficiaries, isCustomer, onCompleted }: TransferFormPanelProps) {
  const { model, t } = useContent()
  const [sourceId, setSourceId] = useState(accounts[0]?.id ?? '')
  const [destinationId, setDestinationId] = useState('')
  const [amount, setAmount] = useState('')
  const [memo, setMemo] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({ source: '', destination: '', amount: '' })
  const [success, setSuccess] = useState<Transfer | null>(null)
  const sourceAccount = accounts.find((account) => account.id === sourceId)
  const destinations = buildDestinations(accounts, beneficiaries, sourceId, model)
  const destinationValid = destinations.some((destination) => destination.id === destinationId)
  const currency = dataString(model, 'currency.code')
  const hasNoDestination = accounts.length < 2 && beneficiaries.length === 0
  const canTransfer = isCustomer && !hasNoDestination

  async function submitTransfer(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    const amountMinor = parseMoneyToMinor(amount, model.locale)
    const nextFieldErrors = { source: '', destination: '', amount: '' }
    if (!sourceAccount || sourceAccount.status !== 'ACTIVE') {
      nextFieldErrors.source = t('transfers.sourceUnavailable')
    }
    if (!destinationValid) {
      nextFieldErrors.destination = t('transfers.destinationRequired')
    }
    if (amountMinor === null) {
      nextFieldErrors.amount = t('transfers.amountInvalid', {
        minimum: formatMoney(1, currency, model.locale),
        maximum: formatMoney(25_000_000, currency, model.locale),
      })
    } else if (sourceAccount && amountMinor > sourceAccount.balanceMinor) {
      nextFieldErrors.amount = t('transfers.overBalance')
    }

    if (amountMinor === null || Object.values(nextFieldErrors).some(Boolean)) {
      setFieldErrors(nextFieldErrors)
      setError('')
      setSuccess(null)
      const firstInvalidField = nextFieldErrors.source
        ? 'transfer-source'
        : nextFieldErrors.destination
          ? 'transfer-destination'
          : 'transfer-amount'
      document.getElementById(firstInvalidField)?.focus()
      return
    }

    setFieldErrors({ source: '', destination: '', amount: '' })
    setBusy(true)
    setError('')
    setSuccess(null)
    try {
      const transfer = await api.createTransfer(
        {
          sourceAccountId: sourceId,
          destinationAccountId: destinationId,
          amountMinor,
          memo: memo.trim(),
        },
        crypto.randomUUID(),
      )
      setSuccess(transfer)
      setAmount('')
      setMemo('')
      onCompleted()
    } catch (requestError) {
      setError(errorMessage(model, t, requestError))
    } finally {
      setBusy(false)
    }
  }

  return (
    <TransferFormView
      accounts={accounts}
      destinations={destinations}
      isCustomer={isCustomer}
      canTransfer={canTransfer}
      sourceAccount={sourceAccount}
      sourceId={sourceId}
      destinationId={destinationId}
      amount={amount}
      memo={memo}
      busy={busy}
      error={error}
      fieldErrors={fieldErrors}
      success={success}
      onSubmit={submitTransfer}
      onSourceChange={(value) => {
        setSourceId(value)
        setDestinationId('')
        setFieldErrors({ source: '', destination: '', amount: '' })
        setError('')
      }}
      onDestinationChange={(value) => {
        setDestinationId(value)
        setFieldErrors((current) => ({ ...current, destination: '' }))
        setError('')
      }}
      onAmountChange={(value) => {
        setAmount(value)
        setFieldErrors((current) => ({ ...current, amount: '' }))
        setError('')
      }}
      onMemoChange={setMemo}
    />
  )
}

function TransferFormView({
  accounts,
  destinations,
  isCustomer,
  canTransfer,
  sourceAccount,
  sourceId,
  destinationId,
  amount,
  memo,
  busy,
  error,
  fieldErrors,
  success,
  onSubmit,
  onSourceChange,
  onDestinationChange,
  onAmountChange,
  onMemoChange,
}: TransferFormViewProps) {
  const { model, t } = useContent()

  return (
    <section className="panel transfer-panel" aria-labelledby="transfer-form-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{t('transfers.formEyebrow')}</p>
          <h3 id="transfer-form-title">{t('transfers.formTitle')}</h3>
        </div>
        <span className="panel-icon">
          <ArrowLeftRight size={18} />
        </span>
      </div>

      {canTransfer ? (
        <form className="transfer-form" noValidate onSubmit={(event) => void onSubmit(event)}>
          <label className="field-label" htmlFor="transfer-source">
            <span>{t('transfers.fromAccount')}</span>
            <select
              id="transfer-source"
              aria-describedby={fieldErrors.source ? 'transfer-source-error' : undefined}
              aria-invalid={Boolean(fieldErrors.source)}
              value={sourceId}
              onChange={(event) => onSourceChange(event.currentTarget.value)}
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id} disabled={account.status !== 'ACTIVE'}>
                  {dataStringFrom(model, 'accountNames', account.id)} · {account.maskedAccountNumber} ·{' '}
                  {formatMoney(account.balanceMinor, account.currency, model.locale)}
                </option>
              ))}
            </select>
            {sourceAccount && (
              <small>
                {t('transfers.available', {
                  amount: formatMoney(sourceAccount.balanceMinor, sourceAccount.currency, model.locale),
                })}
              </small>
            )}
            {fieldErrors.source && (
              <small className="form-error" id="transfer-source-error" role="alert">
                {fieldErrors.source}
              </small>
            )}
          </label>

          <label className="field-label" htmlFor="transfer-destination">
            <span>{t('transfers.toAccount')}</span>
            <select
              id="transfer-destination"
              aria-describedby={fieldErrors.destination ? 'transfer-destination-error' : undefined}
              aria-invalid={Boolean(fieldErrors.destination)}
              value={destinationId}
              onChange={(event) => onDestinationChange(event.currentTarget.value)}
            >
              <option value="" disabled>
                {t('transfers.chooseDestination')}
              </option>
              {destinations.map((destination) => (
                <option key={destination.id} value={destination.id}>
                  {destination.label} · {destination.maskedAccountNumber}
                </option>
              ))}
            </select>
            {destinations.length === 0 && <small>{t('transfers.addBeneficiary')}</small>}
            {fieldErrors.destination && (
              <small className="form-error" id="transfer-destination-error" role="alert">
                {fieldErrors.destination}
              </small>
            )}
          </label>

          <label className="field-label" htmlFor="transfer-amount">
            <span>{t('transfers.amount')}</span>
            <span className="input-with-suffix">
              <input
                id="transfer-amount"
                aria-describedby={
                  fieldErrors.amount ? 'transfer-amount-help transfer-amount-error' : 'transfer-amount-help'
                }
                aria-invalid={Boolean(fieldErrors.amount)}
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder={t('transfers.amountPlaceholder')}
                maxLength={12}
                required
                value={amount}
                onChange={(event) => onAmountChange(event.currentTarget.value)}
              />
              <span>{t('transfers.currency')}</span>
            </span>
            <small id="transfer-amount-help">{t('transfers.amountHelp')}</small>
            {fieldErrors.amount && (
              <small className="form-error" id="transfer-amount-error" role="alert">
                {fieldErrors.amount}
              </small>
            )}
          </label>

          <label className="field-label" htmlFor="transfer-memo">
            <span>
              {t('transfers.memo')} <small>{t('transfers.optional')}</small>
            </span>
            <input
              id="transfer-memo"
              type="text"
              maxLength={120}
              placeholder={t('transfers.memoPlaceholder')}
              value={memo}
              onChange={(event) => onMemoChange(event.currentTarget.value)}
            />
          </label>

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {success && (
            <div className="transfer-success" role="status">
              <span>
                <Check size={16} />
              </span>
              <div>
                <strong>{t('transfers.posted')}</strong>
                <small>
                  {formatMoney(success.amountMinor, success.currency, model.locale)} ·{' '}
                  {dataStringFrom(model, 'accountNames', success.destinationAccountId)}
                </small>
              </div>
            </div>
          )}
          <button type="submit" className="primary-button transfer-submit" disabled={busy || destinations.length === 0}>
            {busy ? <RotateCw className="button-spin" size={16} /> : <ArrowLeftRight size={16} />}
            {busy ? t('transfers.posting') : t('transfers.reviewAndSend')}
          </button>
        </form>
      ) : (
        <TransferAccessState isCustomer={isCustomer} />
      )}
    </section>
  )
}

function TransferAccessState({ isCustomer }: { isCustomer: boolean }) {
  const { t } = useContent()
  const Icon = isCustomer ? CircleAlert : ShieldCheck

  return (
    <div className="read-only-state">
      <span className="empty-state-icon">
        <Icon size={19} />
      </span>
      <strong>{isCustomer ? t('transfers.noDestination') : t('transfers.readOnly')}</strong>
      <span>{isCustomer ? t('transfers.addBeneficiaryFirst') : t('transfers.customerOnly')}</span>
    </div>
  )
}

function TransferHistory({ accounts, transfers, isCustomer }: TransferHistoryProps) {
  const { model, t } = useContent()

  return (
    <section className="panel transfer-history" aria-labelledby="transfer-history-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{t('transfers.latestActivity')}</p>
          <h3 id="transfer-history-title">{t('transfers.recent')}</h3>
        </div>
        <span className="panel-icon panel-icon-blue">
          <ArrowLeftRight size={17} />
        </span>
      </div>
      {transfers.length === 0 ? (
        <div className="empty-state compact-empty">
          <span className="empty-state-icon">
            <ArrowLeftRight size={18} />
          </span>
          <strong>{t('transfers.none')}</strong>
          <span>{t('transfers.noneDescription')}</span>
        </div>
      ) : (
        <ul className="activity-list">
          {transfers.slice(0, 6).map((transfer) => {
            const outgoing = isCustomer && accounts.some((account) => account.id === transfer.sourceAccountId)
            return (
              <li key={transfer.id}>
                <span className={`activity-icon${outgoing ? '' : ' activity-icon-in'}`}>
                  {outgoing ? <ArrowUpRight size={16} /> : <ArrowDownLeft size={16} />}
                </span>
                <span className="activity-copy">
                  <strong>
                    {dataStringFrom(
                      model,
                      'accountNames',
                      outgoing ? transfer.destinationAccountId : transfer.sourceAccountId,
                    )}
                  </strong>
                  <small>
                    {formatDateTime(transfer.createdAt, model.locale)} ·{' '}
                    {dataStringFrom(model, 'transferStatuses', transfer.status)}
                  </small>
                </span>
                <strong className={outgoing ? 'activity-amount' : 'activity-amount activity-amount-in'}>
                  {outgoing ? '−' : '+'}
                  {formatMoney(transfer.amountMinor, transfer.currency, model.locale)}
                </strong>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function buildDestinations(
  accounts: Account[],
  beneficiaries: Beneficiary[],
  sourceId: string,
  model: ReturnType<typeof useContent>['model'],
): DestinationOption[] {
  const destinations = new Map<string, DestinationOption>()
  const beneficiaryAliases = dataStringRecord(model, 'beneficiaryAliases')
  for (const account of accounts) {
    if (account.id === sourceId || account.status !== 'ACTIVE') continue
    destinations.set(account.id, {
      id: account.id,
      label: dataStringFrom(model, 'accountNames', account.id),
      accountName: dataStringFrom(model, 'accountNames', account.id),
      maskedAccountNumber: account.maskedAccountNumber,
    })
  }
  for (const beneficiary of beneficiaries) {
    destinations.set(beneficiary.destinationAccountId, {
      id: beneficiary.destinationAccountId,
      label: beneficiaryAliases[beneficiary.alias] ?? beneficiary.alias,
      accountName: dataStringFrom(model, 'accountNames', beneficiary.destinationAccountId),
      maskedAccountNumber: beneficiary.maskedAccountNumber,
    })
  }
  return [...destinations.values()].sort((left, right) => left.label.localeCompare(right.label))
}

export default TransfersPage
