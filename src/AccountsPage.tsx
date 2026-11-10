import { useEffect, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, BadgeCheck, Clock3, FileText, WalletCards } from 'lucide-react'
import type { Account, DemoUser, LedgerEntry } from './api'
import { api } from './api'
import { useContent } from './content-context'
import { dataString, dataStringFrom, errorMessage, ledgerEntryDescription } from './content-schema'
import { formatDateTime, formatMoney } from './format'

interface AccountsPageProps {
  accounts: Account[]
  user: DemoUser
}

function AccountsPage({ accounts, user }: AccountsPageProps) {
  const { model, t } = useContent()
  const [selectedId, setSelectedId] = useState(accounts[0]?.id ?? '')
  const [activity, setActivity] = useState<{
    accountId: string
    entries: LedgerEntry[]
    error: string
  } | null>(null)
  const currentActivity = activity?.accountId === selectedId ? activity : null
  const entries = currentActivity?.entries ?? []
  const loading = Boolean(selectedId) && currentActivity === null
  const error = currentActivity?.error ?? ''
  const selectedAccount = accounts.find((account) => account.id === selectedId) ?? null

  useEffect(() => {
    if (!selectedId) return
    let active = true
    void api
      .transactions(selectedId)
      .then((result) => {
        if (active) setActivity({ accountId: selectedId, entries: result, error: '' })
      })
      .catch((requestError: unknown) => {
        if (active) {
          setActivity({
            accountId: selectedId,
            entries: [],
            error: errorMessage(model, t, requestError),
          })
        }
      })
    return () => {
      active = false
    }
  }, [model, selectedId, t])

  return (
    <section className="page-stack" aria-label={t('accounts.ariaLabel')}>
      <div className="page-intro-row">
        <div>
          <h2 className="section-title">{t('accounts.introTitle')}</h2>
          <p className="section-copy">{t('accounts.intro', { count: accounts.length })}</p>
        </div>
        {user.role !== 'CUSTOMER' && (
          <span className="role-note">
            <BadgeCheck size={15} /> {t('accounts.readOnly', { role: t(`role.${user.role}`) })}
          </span>
        )}
      </div>

      <AccountSelector accounts={accounts} selectedId={selectedId} onSelect={setSelectedId} />

      <AccountLedger
        accountName={
          selectedAccount ? dataStringFrom(model, 'accountNames', selectedAccount.id) : t('accounts.activity')
        }
        entries={entries}
        loading={loading}
        error={error}
      />
    </section>
  )
}

interface AccountSelectorProps {
  accounts: Account[]
  selectedId: string
  onSelect: (accountId: string) => void
}

function AccountSelector({ accounts, selectedId, onSelect }: AccountSelectorProps) {
  const { model, t } = useContent()
  return (
    <div className="account-selector-grid" aria-label={t('accounts.chooseAccount')}>
      {accounts.map((account, index) => (
        <button
          key={account.id}
          type="button"
          className={`account-tile${selectedId === account.id ? ' account-tile-selected' : ''}`}
          aria-pressed={selectedId === account.id}
          onClick={() => onSelect(account.id)}
        >
          <span className={`account-tile-icon account-type-${index % 4}`}>
            <WalletCards size={19} />
          </span>
          <span className="account-tile-name">
            <strong>{dataStringFrom(model, 'accountNames', account.id)}</strong>
            <small>
              {account.maskedAccountNumber}
              {account.ownerDisplayName
                ? ` · ${dataStringFrom(model, 'demoUserNames', dataStringFrom(model, 'accountOwners', account.id))}`
                : ''}
            </small>
          </span>
          <span className="account-tile-balance">
            <strong>{formatMoney(account.balanceMinor, account.currency, model.locale)}</strong>
            <small>{dataStringFrom(model, 'accountTypes', account.type)}</small>
          </span>
        </button>
      ))}
    </div>
  )
}

interface AccountLedgerProps {
  accountName: string
  entries: LedgerEntry[]
  loading: boolean
  error: string
}

function AccountLedger({ accountName, entries, loading, error }: AccountLedgerProps) {
  const { t } = useContent()
  return (
    <section className="panel ledger-panel" aria-labelledby="ledger-heading">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{t('accounts.ledger')}</p>
          <h3 id="ledger-heading">{accountName}</h3>
        </div>
        <span className="panel-icon">
          <Clock3 size={18} />
        </span>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <div className="loading-panel inline-loading">
          <span className="spinner" />
          {t('accounts.loadingLedger')}
        </div>
      ) : entries.length === 0 ? (
        <div className="empty-state compact-empty">
          <span className="empty-state-icon">
            <FileText size={19} />
          </span>
          <strong>{t('accounts.noEntries')}</strong>
          <span>{t('accounts.noActivity')}</span>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table ledger-table">
            <thead>
              <tr>
                <th scope="col">{t('accounts.column.description')}</th>
                <th scope="col">{t('accounts.column.category')}</th>
                <th scope="col">{t('accounts.column.date')}</th>
                <th scope="col">{t('accounts.column.amount')}</th>
                <th scope="col">{t('accounts.column.balance')}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <AccountLedgerRow key={entry.id} entry={entry} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function AccountLedgerRow({ entry }: { entry: LedgerEntry }) {
  const { model, t } = useContent()
  const currency = dataString(model, 'currency.code')
  const incoming = entry.amountMinor > 0
  return (
    <tr>
      <td>
        <span className="ledger-description">
          {incoming ? <ArrowDownLeft size={15} /> : <ArrowUpRight size={15} />}
          {ledgerEntryDescription(model, t, entry)}
        </span>
      </td>
      <td>
        <span className="category-pill">{dataStringFrom(model, 'ledgerCategories', entry.category)}</span>
      </td>
      <td>{formatDateTime(entry.createdAt, model.locale)}</td>
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

export default AccountsPage
