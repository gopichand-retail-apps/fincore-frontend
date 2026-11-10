import { useEffect, useState } from 'react'
import { ApiFailure, api, type Account, type Beneficiary, type DemoUser, type Overview, type Transfer } from './api'
import AppShell, { type ViewId } from './AppShell'
import AccountsPage from './AccountsPage'
import BeneficiariesPage from './BeneficiariesPage'
import DashboardPage from './DashboardPage'
import InsightsPage from './InsightsPage'
import SignInPage from './SignInPage'
import StatementsPage from './StatementsPage'
import TransfersPage from './TransfersPage'
import { IS_MOCK } from './config'
import { useContent } from './content-context'
import { errorMessage } from './content-schema'

const emptyOverview: Overview = {
  totalBalanceMinor: 0,
  monthlyIncomeMinor: 0,
  monthlySpendMinor: 0,
  transferCount: 0,
  activeAccountCount: 0,
  accounts: [],
  recentActivity: [],
}
function App() {
  const { model, t } = useContent()
  const isMock = IS_MOCK
  const [user, setUser] = useState<DemoUser | null>(null)
  const [sessionLoading, setSessionLoading] = useState(true)
  const [sessionError, setSessionError] = useState('')
  const [view, setView] = useState<ViewId>('overview')
  const [refreshVersion, setRefreshVersion] = useState(0)
  const [workspaceLoaded, setWorkspaceLoaded] = useState(false)
  const [workspaceLoading, setWorkspaceLoading] = useState(false)
  const [workspaceError, setWorkspaceError] = useState('')
  const [overview, setOverview] = useState<Overview>(emptyOverview)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [transfers, setTransfers] = useState<Transfer[]>([])
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([])

  useEffect(() => {
    let active = true
    void api
      .currentUser()
      .then(({ user: currentUser }) => {
        if (!active) return
        setWorkspaceLoading(true)
        setWorkspaceLoaded(false)
        setWorkspaceError('')
        setUser(currentUser)
      })
      .catch((error: unknown) => {
        if (active && (!(error instanceof ApiFailure) || error.status !== 401)) {
          setSessionError(errorMessage(model, t, error))
        }
      })
      .finally(() => {
        if (active) setSessionLoading(false)
      })

    return () => {
      active = false
    }
  }, [model, t])

  useEffect(() => {
    if (!user) return
    let active = true
    const loadBeneficiaries =
      user.role === 'CUSTOMER'
        ? api.beneficiaries().then(({ beneficiaries: values }) => values)
        : Promise.resolve([] as Beneficiary[])

    void Promise.all([api.overview(), api.accounts(), api.transfers(), loadBeneficiaries])
      .then(([nextOverview, accountResult, transferResult, beneficiaryValues]) => {
        if (!active) return
        setOverview(nextOverview)
        setAccounts(accountResult.accounts)
        setTransfers(transferResult.transfers)
        setBeneficiaries(beneficiaryValues)
      })
      .catch((error: unknown) => {
        if (active) setWorkspaceError(errorMessage(model, t, error))
      })
      .finally(() => {
        if (!active) return
        setWorkspaceLoading(false)
        setWorkspaceLoaded(true)
      })

    return () => {
      active = false
    }
  }, [model, refreshVersion, t, user])

  function refreshWorkspace(): void {
    setWorkspaceLoading(true)
    setWorkspaceError('')
    setRefreshVersion((version) => version + 1)
  }

  async function signOut(): Promise<void> {
    try {
      await api.logout()
      setUser(null)
      setView('overview')
      setWorkspaceLoading(false)
      setWorkspaceLoaded(false)
      setWorkspaceError('')
      setOverview(emptyOverview)
      setAccounts([])
      setTransfers([])
      setBeneficiaries([])
      setSessionError('')
    } catch (error) {
      setWorkspaceError(errorMessage(model, t, error))
    }
  }

  if (sessionLoading) {
    return (
      <main className="boot-screen" data-mode={isMock ? 'mock' : 'live'} aria-label={t('app.loading')}>
        <span className="spinner" />
        <span>{t('app.loading')}</span>
      </main>
    )
  }

  if (!user) {
    return (
      <SignInPage
        isMock={isMock}
        initialError={sessionError}
        onSignedIn={(nextUser) => {
          setUser(nextUser)
          setSessionError('')
          setWorkspaceLoading(true)
          setWorkspaceLoaded(false)
          setWorkspaceError('')
          setView('overview')
        }}
      />
    )
  }

  const activeUser = user

  function renderPage() {
    if (!workspaceLoaded) {
      return (
        <div className="loading-panel">
          <span className="spinner" />
          {t('app.openingProfile')}
        </div>
      )
    }
    if (view === 'overview') {
      return <DashboardPage overview={overview} user={activeUser} onNavigate={setView} />
    }
    if (view === 'accounts') {
      return <AccountsPage accounts={accounts} user={activeUser} />
    }
    if (view === 'transfers') {
      return (
        <TransfersPage
          accounts={accounts}
          beneficiaries={beneficiaries}
          transfers={transfers}
          user={activeUser}
          onCompleted={refreshWorkspace}
        />
      )
    }
    if (view === 'beneficiaries') {
      return <BeneficiariesPage beneficiaries={beneficiaries} onUpdated={refreshWorkspace} />
    }
    if (view === 'statements') {
      return <StatementsPage accounts={accounts} user={activeUser} />
    }
    return <InsightsPage accounts={accounts} user={activeUser} />
  }

  return (
    <AppShell
      activeView={view}
      user={activeUser}
      isMock={isMock}
      onViewChange={setView}
      onSignOut={() => void signOut()}
    >
      <div className="workspace-content page-enter">
        {workspaceError && (
          <div className="page-alert" role="alert">
            <span>{workspaceError}</span>
            <button type="button" className="text-button" onClick={refreshWorkspace}>
              {t('app.retry')}
            </button>
          </div>
        )}
        {workspaceLoading && accounts.length > 0 && (
          <p className="refresh-note" role="status">
            {t('app.updatingAccounts')}
          </p>
        )}
        {renderPage()}
        <footer className="workspace-footer">
          <span>{t('app.footerProfiles')}</span>
          <span>{t('app.footerSimulator')}</span>
        </footer>
      </div>
    </AppShell>
  )
}

export default App
