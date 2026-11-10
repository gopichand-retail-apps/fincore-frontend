import type { ReactNode } from 'react'
import {
  ArrowLeftRight,
  ChartNoAxesCombined,
  FileText,
  LayoutDashboard,
  Landmark,
  LogOut,
  UsersRound,
  WalletCards,
  type LucideIcon,
} from 'lucide-react'
import type { DemoRole, DemoUser } from './api'
import { APP_VERSION } from './app-version'
import { useContent } from './content-context'
import { dataStringRecord } from './content-schema'

export type ViewId = 'overview' | 'accounts' | 'transfers' | 'beneficiaries' | 'statements' | 'insights'

interface AppShellProps {
  activeView: ViewId
  user: DemoUser
  isMock: boolean
  onViewChange: (view: ViewId) => void
  onSignOut: () => void
  children: ReactNode
}

const navigation: Record<DemoRole, Array<{ id: ViewId; label: string; icon: LucideIcon }>> = {
  CUSTOMER: [
    { id: 'overview', label: 'navigation.overview', icon: LayoutDashboard },
    { id: 'accounts', label: 'navigation.accounts', icon: WalletCards },
    { id: 'transfers', label: 'navigation.transfers', icon: ArrowLeftRight },
    { id: 'beneficiaries', label: 'navigation.beneficiaries', icon: UsersRound },
    { id: 'statements', label: 'navigation.statements', icon: FileText },
    { id: 'insights', label: 'navigation.insights', icon: ChartNoAxesCombined },
  ],
  OPERATIONS: [
    { id: 'overview', label: 'navigation.overview', icon: LayoutDashboard },
    { id: 'accounts', label: 'navigation.accounts', icon: WalletCards },
    { id: 'transfers', label: 'navigation.transfers', icon: ArrowLeftRight },
    { id: 'statements', label: 'navigation.statements', icon: FileText },
  ],
  AUDITOR: [
    { id: 'overview', label: 'navigation.overview', icon: LayoutDashboard },
    { id: 'accounts', label: 'navigation.accounts', icon: WalletCards },
    { id: 'transfers', label: 'navigation.transfers', icon: ArrowLeftRight },
    { id: 'statements', label: 'navigation.statements', icon: FileText },
  ],
}

const titles: Record<ViewId, { title: string; eyebrow: string }> = {
  overview: { title: 'page.title.overview', eyebrow: 'page.eyebrow.overview' },
  accounts: { title: 'page.title.accounts', eyebrow: 'page.eyebrow.accounts' },
  transfers: { title: 'page.title.transfers', eyebrow: 'page.eyebrow.transfers' },
  beneficiaries: { title: 'page.title.beneficiaries', eyebrow: 'page.eyebrow.beneficiaries' },
  statements: { title: 'page.title.statements', eyebrow: 'page.eyebrow.statements' },
  insights: { title: 'page.title.insights', eyebrow: 'page.eyebrow.insights' },
}

function initials(displayName: string): string {
  return displayName
    .split(' ')
    .map((part) => part[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function AppShell({ activeView, user, isMock, onViewChange, onSignOut, children }: AppShellProps) {
  const { model, t } = useContent()
  const userNames = dataStringRecord(model, 'demoUserNames')
  const displayName = userNames[user.id]
  if (!displayName) throw new Error(`CONTENT_USER_MISSING:${user.id}`)
  const page = titles[activeView]

  return (
    <div className="app-shell" data-mode={isMock ? 'mock' : 'live'}>
      <aside className="sidebar">
        <div className="brand-lockup sidebar-brand">
          <span className="brand-mark">
            <Landmark size={19} strokeWidth={2} />
          </span>
          <span>{t('brand.signature')}</span>
        </div>
        <div className="institution-switcher">
          <span className="institution-icon">
            <Landmark size={16} />
          </span>
          <span>
            <strong>{t('brand.institution')}</strong>
            <small>{t('brand.institutionType')}</small>
          </span>
          <span className="switcher-dot" aria-hidden="true" />
        </div>
        <p className="nav-caption">{t('navigation.caption')}</p>
        <nav className="sidebar-nav" aria-label={t('app.mainNavigation')}>
          {navigation[user.role].map((item) => {
            const ItemIcon = item.icon
            const active = activeView === item.id
            return (
              <button
                key={item.id}
                type="button"
                className={`nav-item${active ? ' nav-item-active' : ''}`}
                aria-current={active ? 'page' : undefined}
                onClick={() => onViewChange(item.id)}
              >
                <ItemIcon size={18} strokeWidth={1.9} aria-hidden="true" />
                <span>{t(item.label)}</span>
              </button>
            )
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="demo-status">
            <span className="live-dot" />
            {t('app.demoStatus')}
          </div>
          <div className="user-card">
            <span className="user-avatar">{initials(displayName)}</span>
            <span className="user-copy">
              <small>{t('app.releaseVersion', { version: APP_VERSION })}</small>
              <strong>{displayName}</strong>
              <small>{t(`role.${user.role}`)}</small>
            </span>
            <button
              type="button"
              className="signout-button"
              title={t('app.signOut')}
              aria-label={t('app.signOut')}
              onClick={onSignOut}
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      <main className="main-column">
        <header className="topbar">
          <div className="topbar-heading">
            <p className="eyebrow">{t(page.eyebrow)}</p>
            <h1>{t(page.title)}</h1>
          </div>
          <div className="topbar-tools">
            <span className="simulated-chip">
              <span className="live-dot" />
              {t('app.demoChip')}
            </span>
            <span className="topbar-user">{displayName}</span>
          </div>
        </header>
        {children}
      </main>
    </div>
  )
}

export default AppShell
