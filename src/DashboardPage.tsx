import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  ArrowLeftRight,
  ChartNoAxesCombined,
  CircleDollarSign,
  Clock3,
  FileText,
  ShieldCheck,
  WalletCards,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { DemoUser, Overview } from './api'
import type { ViewId } from './AppShell'
import { useContent } from './content-context'
import { dataString, dataStringFrom, ledgerEntryDescription } from './content-schema'
import { formatDate, formatMoney } from './format'

interface DashboardPageProps {
  overview: Overview
  user: DemoUser
  onNavigate: (view: ViewId) => void
}

interface SummaryMetricProps {
  label: string
  amount: string
  note: string
  icon: LucideIcon
  tone: 'mint' | 'blue' | 'coral' | 'gold'
}

function SummaryMetric({ label, amount, note, icon: Icon, tone }: SummaryMetricProps) {
  return (
    <article className="summary-metric">
      <div className="metric-head">
        <span>{label}</span>
        <i className={`metric-icon metric-icon-${tone}`}>
          <Icon size={18} />
        </i>
      </div>
      <strong className="metric-amount">{amount}</strong>
      <small>{note}</small>
    </article>
  )
}

function DashboardPage({ overview, user, onNavigate }: DashboardPageProps) {
  const { model, t } = useContent()
  const maxAmount = Math.max(overview.monthlyIncomeMinor, overview.monthlySpendMinor, 1)
  const displayName = dataStringFrom(model, 'demoUserNames', user.id).split(' ')[0]
  const currency = dataString(model, 'currency.code')
  const roleNote = t(user.role === 'CUSTOMER' ? 'dashboard.roleNote.customer' : 'dashboard.roleNote.readOnly')

  return (
    <section className="page-stack" aria-label={t('page.title.overview')}>
      <div className="dashboard-welcome">
        <div>
          <h2>{t('dashboard.greeting', { name: displayName })}</h2>
          <p>{roleNote}</p>
        </div>
        {user.role === 'CUSTOMER' && (
          <button type="button" className="primary-button" onClick={() => onNavigate('transfers')}>
            <ArrowLeftRight size={17} /> {t('dashboard.makeTransfer')} <ArrowRight size={15} />
          </button>
        )}
      </div>

      <div className="summary-grid">
        <SummaryMetric
          label={t(user.role === 'CUSTOMER' ? 'dashboard.metric.totalBalance' : 'dashboard.metric.demoFunds')}
          amount={formatMoney(overview.totalBalanceMinor, currency, model.locale)}
          note={t('dashboard.metric.activeAccounts', {
            count: overview.activeAccountCount,
            unit: t(
              overview.activeAccountCount === 1 ? 'dashboard.metric.account.one' : 'dashboard.metric.account.other',
            ),
          })}
          icon={WalletCards}
          tone="mint"
        />
        <SummaryMetric
          label={t('dashboard.metric.income')}
          amount={formatMoney(overview.monthlyIncomeMinor, currency, model.locale)}
          note={t('dashboard.metric.incomeNote')}
          icon={ArrowDownLeft}
          tone="blue"
        />
        <SummaryMetric
          label={t('dashboard.metric.spending')}
          amount={formatMoney(overview.monthlySpendMinor, currency, model.locale)}
          note={t('dashboard.metric.spendingNote')}
          icon={ArrowUpRight}
          tone="coral"
        />
        <SummaryMetric
          label={t('dashboard.metric.transfers')}
          amount={String(overview.transferCount)}
          note={t('dashboard.metric.transfersNote')}
          icon={CircleDollarSign}
          tone="gold"
        />
      </div>

      <div className="dashboard-grid">
        <section className="panel account-panel" aria-labelledby="accounts-heading">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">{t('dashboard.accounts')}</p>
              <h3 id="accounts-heading">{t('dashboard.yourAccounts')}</h3>
            </div>
            <button
              type="button"
              className="panel-action"
              onClick={() => onNavigate('accounts')}
              aria-label={t('dashboard.viewAllAccounts')}
            >
              <ArrowRight size={17} />
            </button>
          </div>
          {overview.accounts.length === 0 ? (
            <div className="empty-inline">{t('dashboard.noAccounts')}</div>
          ) : (
            <div className="account-list">
              {overview.accounts.slice(0, 4).map((account, index) => (
                <button type="button" className="account-row" key={account.id} onClick={() => onNavigate('accounts')}>
                  <span className={`account-type-icon account-type-${index % 4}`}>
                    <WalletCards size={18} />
                  </span>
                  <span className="account-row-copy">
                    <strong>{dataStringFrom(model, 'accountNames', account.id)}</strong>
                    <small>
                      {account.maskedAccountNumber}
                      {account.ownerDisplayName
                        ? ` · ${dataStringFrom(model, 'demoUserNames', dataStringFrom(model, 'accountOwners', account.id))}`
                        : ''}
                    </small>
                  </span>
                  <span className="account-row-balance">
                    <strong>{formatMoney(account.balanceMinor, account.currency, model.locale)}</strong>
                    <small>{dataStringFrom(model, 'accountTypes', account.type)}</small>
                  </span>
                </button>
              ))}
            </div>
          )}
          <button type="button" className="subtle-link" onClick={() => onNavigate('accounts')}>
            {t('dashboard.accountActivity')} <ArrowRight size={15} />
          </button>
        </section>

        <section className="panel flow-panel" aria-labelledby="flow-heading">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">{t('dashboard.monthlyFlow')}</p>
              <h3 id="flow-heading">{t('dashboard.incomeSpending')}</h3>
            </div>
            <span className="panel-icon">
              <ChartNoAxesCombined size={18} />
            </span>
          </div>
          <div
            className="flow-chart"
            role="img"
            aria-label={t('dashboard.chartLabel', {
              income: formatMoney(overview.monthlyIncomeMinor, currency, model.locale),
              spending: formatMoney(overview.monthlySpendMinor, currency, model.locale),
            })}
          >
            <div className="flow-row">
              <span className="flow-label">{t('dashboard.income')}</span>
              <span className="flow-track">
                <i
                  className="flow-bar flow-bar-income"
                  style={{ width: `${(overview.monthlyIncomeMinor / maxAmount) * 100}%` }}
                />
              </span>
              <strong>{formatMoney(overview.monthlyIncomeMinor, currency, model.locale)}</strong>
            </div>
            <div className="flow-row">
              <span className="flow-label">{t('dashboard.spending')}</span>
              <span className="flow-track">
                <i
                  className="flow-bar flow-bar-spend"
                  style={{ width: `${(overview.monthlySpendMinor / maxAmount) * 100}%` }}
                />
              </span>
              <strong>{formatMoney(overview.monthlySpendMinor, currency, model.locale)}</strong>
            </div>
            <div className="flow-baseline">
              <span>{t('dashboard.startMonth')}</span>
              <span>{t('dashboard.today')}</span>
            </div>
          </div>
          <button
            type="button"
            className="subtle-link"
            onClick={() => onNavigate(user.role === 'CUSTOMER' ? 'insights' : 'statements')}
          >
            {t(user.role === 'CUSTOMER' ? 'dashboard.exploreSpending' : 'dashboard.reviewStatements')}{' '}
            <ArrowRight size={15} />
          </button>
        </section>

        <section className="panel activity-panel" aria-labelledby="activity-heading">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">{t('dashboard.recentActivity')}</p>
              <h3 id="activity-heading">{t('dashboard.latestTransactions')}</h3>
            </div>
            <span className="panel-icon panel-icon-blue">
              <Clock3 size={18} />
            </span>
          </div>
          {overview.recentActivity.length === 0 ? (
            <div className="empty-state compact-empty">
              <span className="empty-state-icon">
                <FileText size={19} />
              </span>
              <strong>{t('dashboard.noRecentTransactions')}</strong>
              <span>{t('dashboard.noRecentActivity')}</span>
            </div>
          ) : (
            <ul className="activity-list">
              {overview.recentActivity.slice(0, 6).map((entry) => {
                const incoming = entry.amountMinor > 0
                return (
                  <li key={entry.id}>
                    <span className={`activity-icon${incoming ? ' activity-icon-in' : ''}`}>
                      {incoming ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                    </span>
                    <span className="activity-copy">
                      <strong>{ledgerEntryDescription(model, t, entry)}</strong>
                      <small>
                        {formatDate(entry.createdAt, model.locale)} ·{' '}
                        {dataStringFrom(model, 'ledgerCategories', entry.category)}
                      </small>
                    </span>
                    <strong className={incoming ? 'activity-amount activity-amount-in' : 'activity-amount'}>
                      {incoming ? '+' : '−'}
                      {formatMoney(Math.abs(entry.amountMinor), currency, model.locale)}
                    </strong>
                  </li>
                )
              })}
            </ul>
          )}
          <button type="button" className="subtle-link" onClick={() => onNavigate('accounts')}>
            {t('dashboard.browseActivity')} <ArrowRight size={15} />
          </button>
        </section>

        <aside className="trust-panel">
          <span className="trust-mark">
            <ShieldCheck size={19} />
          </span>
          <div>
            <strong>{t('dashboard.simulationOnly')}</strong>
            <p>{t('dashboard.ledgerSafety')}</p>
          </div>
        </aside>
      </div>
    </section>
  )
}

export default DashboardPage
