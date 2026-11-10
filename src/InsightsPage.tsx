import { useEffect, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, ChartNoAxesCombined, CircleDollarSign, WalletCards } from 'lucide-react'
import type { Account, DemoUser, Insights } from './api'
import { api } from './api'
import { useContent } from './content-context'
import { dataString, dataStringFrom, errorMessage } from './content-schema'
import { formatMoney } from './format'

interface InsightsPageProps {
  accounts: Account[]
  user: DemoUser
}

interface InsightResult {
  accountId: string
  insights: Insights | null
  error: string
}

function useInsightsResult(accountId: string) {
  const { model, t } = useContent()
  const [result, setResult] = useState<InsightResult | null>(null)
  const currentResult = result?.accountId === accountId ? result : null

  useEffect(() => {
    if (!accountId) return
    let active = true
    void api
      .insights(accountId)
      .then((insights) => {
        if (active) setResult({ accountId, insights, error: '' })
      })
      .catch((requestError: unknown) => {
        if (active) {
          setResult({
            accountId,
            insights: null,
            error: errorMessage(model, t, requestError),
          })
        }
      })
    return () => {
      active = false
    }
  }, [accountId, model, t])

  return {
    insights: currentResult?.insights ?? null,
    loading: Boolean(accountId) && currentResult === null,
    error: currentResult?.error ?? '',
  }
}

function InsightsPage({ accounts, user }: InsightsPageProps) {
  const { model, t } = useContent()
  const customerAccounts = user.role === 'CUSTOMER' ? accounts : []
  const [accountId, setAccountId] = useState(customerAccounts[0]?.id ?? '')
  const { insights, loading, error } = useInsightsResult(accountId)
  const selectedAccount = customerAccounts.find((account) => account.id === accountId)
  const largestCategory = Math.max(...(insights?.categories.map((category) => category.amountMinor) ?? []), 1)

  return (
    <section className="page-stack" aria-label={t('insights.ariaLabel')}>
      <div className="page-intro-row">
        <div>
          <h2 className="section-title">{t('insights.title')}</h2>
          <p className="section-copy">{t('insights.description')}</p>
        </div>
        <label className="field-label insights-account-field" htmlFor="insights-account">
          <span>{t('insights.account')}</span>
          <select id="insights-account" value={accountId} onChange={(event) => setAccountId(event.currentTarget.value)}>
            {customerAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                {dataStringFrom(model, 'accountNames', account.id)} · {account.maskedAccountNumber}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!customerAccounts.length && <p className="permission-note">{t('insights.permission')}</p>}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <div className="panel loading-panel">
          <span className="spinner" />
          {t('insights.loading')}
        </div>
      ) : (
        insights && (
          <>
            <InsightsMetrics insights={insights} />
            <div className="insights-layout">
              <CategoryBreakdown categories={insights.categories} largestCategory={largestCategory} />
              <InsightAccountCard account={selectedAccount} />
            </div>
          </>
        )
      )}
    </section>
  )
}

function InsightsMetrics({ insights }: { insights: Insights }) {
  const { model, t } = useContent()
  const currency = dataString(model, 'currency.code')
  return (
    <div className="summary-grid insight-summary-grid">
      <article className="summary-metric">
        <div className="metric-head">
          <span>{t('insights.income')}</span>
          <i className="metric-icon metric-icon-blue">
            <ArrowDownLeft size={18} />
          </i>
        </div>
        <strong className="metric-amount">{formatMoney(insights.periodIncomeMinor, currency, model.locale)}</strong>
        <small>{t('insights.incomeNote')}</small>
      </article>
      <article className="summary-metric">
        <div className="metric-head">
          <span>{t('insights.spending')}</span>
          <i className="metric-icon metric-icon-coral">
            <ArrowUpRight size={18} />
          </i>
        </div>
        <strong className="metric-amount">{formatMoney(insights.periodSpendMinor, currency, model.locale)}</strong>
        <small>{t('insights.spendingNote')}</small>
      </article>
      <article className="summary-metric">
        <div className="metric-head">
          <span>{t('insights.categories')}</span>
          <i className="metric-icon metric-icon-mint">
            <ChartNoAxesCombined size={18} />
          </i>
        </div>
        <strong className="metric-amount">{insights.categories.length}</strong>
        <small>{t('insights.categoriesNote')}</small>
      </article>
    </div>
  )
}

function CategoryBreakdown({
  categories,
  largestCategory,
}: {
  categories: Insights['categories']
  largestCategory: number
}) {
  const { model, t } = useContent()
  const currency = dataString(model, 'currency.code')
  return (
    <section className="panel insight-category-panel" aria-labelledby="insight-category-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{t('insights.mix')}</p>
          <h3 id="insight-category-title">{t('insights.byCategory')}</h3>
        </div>
        <span className="panel-icon">
          <ChartNoAxesCombined size={18} />
        </span>
      </div>
      {categories.length === 0 ? (
        <div className="empty-state compact-empty">
          <span className="empty-state-icon">
            <CircleDollarSign size={19} />
          </span>
          <strong>{t('insights.none')}</strong>
          <span>{t('insights.noneDescription')}</span>
        </div>
      ) : (
        <div className="insight-category-list">
          {categories.map((category) => (
            <div className="insight-category-row" key={category.category}>
              <div className="insight-category-heading">
                <span>
                  <strong>{dataStringFrom(model, 'ledgerCategories', category.category)}</strong>
                  <small>
                    {t('insights.entries.count', {
                      count: category.transactionCount,
                      unit: t(category.transactionCount === 1 ? 'insights.entries.one' : 'insights.entries.other'),
                    })}
                  </small>
                </span>
                <strong>{formatMoney(category.amountMinor, currency, model.locale)}</strong>
              </div>
              <div
                className="category-bar-track"
                aria-label={`${dataStringFrom(model, 'ledgerCategories', category.category)} ${formatMoney(category.amountMinor, currency, model.locale)}`}
              >
                <span style={{ width: `${(category.amountMinor / largestCategory) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function InsightAccountCard({ account }: { account: Account | undefined }) {
  const { model, t } = useContent()
  const currency = dataString(model, 'currency.code')
  return (
    <aside className="insight-account-card">
      <span className="insight-account-icon">
        <WalletCards size={19} />
      </span>
      <p className="eyebrow eyebrow-on-dark">{t('insights.accountInView')}</p>
      <h3>{account ? dataStringFrom(model, 'accountNames', account.id) : t('insights.syntheticAccount')}</h3>
      <span className="insight-account-number">{account?.maskedAccountNumber ?? t('insights.noAccountNumber')}</span>
      <div className="insight-account-balance">
        <span>{t('insights.currentBalance')}</span>
        <strong>{formatMoney(account?.balanceMinor ?? 0, account?.currency ?? currency, model.locale)}</strong>
      </div>
      <small>{t('insights.disclaimer')}</small>
    </aside>
  )
}

export default InsightsPage
