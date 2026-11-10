import { useEffect, useState } from 'react'
import { ArrowDownToLine, FileText } from 'lucide-react'
import type { Account, DemoUser, Statement } from './api'
import { api } from './api'
import { useContent } from './content-context'
import { dataString, dataStringFrom, errorMessage, ledgerEntryDescription } from './content-schema'
import type { ContentModel, Translate } from './content-schema'
import { csvCell, formatDateTime, formatMoney, formatMonth } from './format'

interface StatementsPageProps {
  accounts: Account[]
  user: DemoUser
}

interface StatementResult {
  accountId: string
  month: string
  statement: Statement | null
  error: string
}

function useStatementResult(accountId: string, month: string) {
  const { model, t } = useContent()
  const [result, setResult] = useState<{
    accountId: StatementResult['accountId']
    month: StatementResult['month']
    statement: StatementResult['statement']
    error: StatementResult['error']
  } | null>(null)
  const currentResult = result?.accountId === accountId && result.month === month ? result : null

  useEffect(() => {
    if (!accountId || !month) return
    let active = true
    void api
      .statement(accountId, month)
      .then((result) => {
        if (active) setResult({ accountId, month, statement: result, error: '' })
      })
      .catch((requestError: unknown) => {
        if (active) {
          setResult({
            accountId,
            month,
            statement: null,
            error: errorMessage(model, t, requestError),
          })
        }
      })
    return () => {
      active = false
    }
  }, [accountId, model, month, t])

  return {
    statement: currentResult?.statement ?? null,
    loading: Boolean(accountId && month) && currentResult === null,
    error: currentResult?.error ?? '',
  }
}

function StatementsPage({ accounts, user }: StatementsPageProps) {
  const { model, t } = useContent()
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '')
  const [month, setMonth] = useState(currentMonth())
  const { statement, loading, error } = useStatementResult(accountId, month)
  const selectedAccount = accounts.find((account) => account.id === accountId)

  return (
    <section className="page-stack" aria-label={t('statements.ariaLabel')}>
      <div className="page-intro-row">
        <div>
          <h2 className="section-title">{t('statements.introTitle')}</h2>
          <p className="section-copy">{t('statements.intro')}</p>
        </div>
        {user.role !== 'CUSTOMER' && (
          <span className="role-note">
            <FileText size={15} /> {t('statements.readOnly')}
          </span>
        )}
      </div>

      <section className="panel statement-panel" aria-labelledby="statement-title">
        <div className="statement-toolbar">
          <label className="field-label" htmlFor="statement-account">
            <span>{t('statements.account')}</span>
            <select
              id="statement-account"
              value={accountId}
              onChange={(event) => setAccountId(event.currentTarget.value)}
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {dataStringFrom(model, 'accountNames', account.id)}
                  {account.ownerDisplayName
                    ? ` · ${dataStringFrom(model, 'demoUserNames', dataStringFrom(model, 'accountOwners', account.id))}`
                    : ''}{' '}
                  · {account.maskedAccountNumber}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label" htmlFor="statement-month">
            <span>{t('statements.month')}</span>
            <input
              id="statement-month"
              type="month"
              required
              value={month}
              onChange={(event) => setMonth(event.currentTarget.value)}
            />
          </label>
          <button
            type="button"
            className="secondary-button statement-export"
            disabled={!statement || loading}
            onClick={() => downloadStatementCsv(statement, model, t)}
          >
            <ArrowDownToLine size={16} /> {t('statements.export')}
          </button>
        </div>

        <StatementContent statement={statement} selectedAccount={selectedAccount} loading={loading} error={error} />
      </section>
    </section>
  )
}

interface StatementContentProps {
  statement: Statement | null
  selectedAccount: Account | undefined
  loading: boolean
  error: string
}

function StatementContent({ statement, selectedAccount, loading, error }: StatementContentProps) {
  const { t } = useContent()
  return (
    <>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <div className="loading-panel inline-loading">
          <span className="spinner" />
          {t('statements.loading')}
        </div>
      ) : !statement ? (
        <div className="empty-state compact-empty">
          <span className="empty-state-icon">
            <FileText size={19} />
          </span>
          <strong>{t('statements.selectMonth')}</strong>
          <span>{t('statements.empty')}</span>
        </div>
      ) : (
        <StatementDetails statement={statement} selectedAccount={selectedAccount} />
      )}
    </>
  )
}

function StatementDetails({
  statement,
  selectedAccount,
}: {
  statement: Statement
  selectedAccount: Account | undefined
}) {
  const { model, t } = useContent()
  return (
    <>
      <div className="statement-summary">
        <div>
          <span className="eyebrow">
            {formatMonth(statement.month, model.locale)} · {dataStringFrom(model, 'accountNames', statement.accountId)}
          </span>
          <h3 id="statement-title">{t('statements.title')}</h3>
          <small>{statement.maskedAccountNumber}</small>
        </div>
        <div className="statement-balances">
          <div>
            <span>{t('statements.openingBalance')}</span>
            <strong>
              {formatMoney(statement.openingBalanceMinor, dataString(model, 'currency.code'), model.locale)}
            </strong>
          </div>
          <div>
            <span>{t('statements.closingBalance')}</span>
            <strong>
              {formatMoney(statement.closingBalanceMinor, dataString(model, 'currency.code'), model.locale)}
            </strong>
          </div>
        </div>
      </div>
      <StatementTable statement={statement} />
      <div className="statement-footnote">
        <span>{t('statements.entryCount', { count: statement.entries.length })}</span>
        {selectedAccount && <span>{t('statements.simulatedCurrency', { currency: selectedAccount.currency })}</span>}
      </div>
    </>
  )
}

function StatementTable({ statement }: { statement: Statement }) {
  const { t } = useContent()
  return (
    <div className="table-wrap statement-table-wrap">
      <table className="data-table statement-table">
        <thead>
          <tr>
            <th scope="col">{t('statements.column.date')}</th>
            <th scope="col">{t('statements.column.description')}</th>
            <th scope="col">{t('statements.column.category')}</th>
            <th scope="col">{t('statements.column.amount')}</th>
            <th scope="col">{t('statements.column.balance')}</th>
          </tr>
        </thead>
        <tbody>
          {statement.entries.map((entry) => (
            <StatementRow key={entry.id} entry={entry} />
          ))}
        </tbody>
      </table>
      {statement.entries.length === 0 && <div className="empty-inline">{t('statements.noActivity')}</div>}
    </div>
  )
}

function StatementRow({ entry }: { entry: Statement['entries'][number] }) {
  const { model, t } = useContent()
  const currency = dataString(model, 'currency.code')
  const incoming = entry.amountMinor >= 0
  return (
    <tr>
      <td>{formatDateTime(entry.createdAt, model.locale)}</td>
      <td className="statement-description">{ledgerEntryDescription(model, t, entry)}</td>
      <td>
        <span className="category-pill">{dataStringFrom(model, 'ledgerCategories', entry.category)}</span>
      </td>
      <td>
        <strong className={incoming ? 'ledger-amount ledger-amount-in' : 'ledger-amount'}>
          {incoming ? '+' : '−'}
          {formatMoney(Math.abs(entry.amountMinor), currency, model.locale)}
        </strong>
      </td>
      <td>{formatMoney(entry.balanceAfterMinor, currency, model.locale)}</td>
    </tr>
  )
}

function downloadStatementCsv(statement: Statement | null, model: ContentModel, t: Translate): void {
  if (!statement) return
  const currency = dataString(model, 'currency.code')
  const rows: Array<Array<string | number>> = [
    [
      t('statements.csvTitle'),
      dataStringFrom(model, 'accountNames', statement.accountId),
      statement.maskedAccountNumber,
      statement.month,
    ],
    [],
    [
      t('statements.column.date'),
      t('statements.column.description'),
      t('statements.column.category'),
      `${t('statements.column.amount')} ${currency}`,
      `${t('statements.column.balance')} ${currency}`,
    ],
    ...statement.entries.map((entry) => [
      formatDateTime(entry.createdAt, model.locale),
      ledgerEntryDescription(model, t, entry),
      dataStringFrom(model, 'ledgerCategories', entry.category),
      (entry.amountMinor / 100).toFixed(2),
      (entry.balanceAfterMinor / 100).toFixed(2),
    ]),
  ]
  const csv = rows.map((row) => row.map(csvCell).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `${t('statements.csvFilePrefix')}-${statement.accountId}-${statement.month}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7)
}

export default StatementsPage
