import { useEffect, useState } from 'react'
import { ArrowRight, BadgeCheck, Landmark, Shield, UserRound } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { api, type DemoRole, type DemoUser } from './api'
import { useContent } from './content-context'
import { dataString, errorMessage } from './content-schema'
import { resolveLoginProfiles, type LoginProfile } from './login-profiles'

interface SignInPageProps {
  isMock: boolean
  initialError: string
  onSignedIn: (user: DemoUser) => void
}

const demoProfileIcons: Record<DemoRole, LucideIcon> = {
  CUSTOMER: UserRound,
  OPERATIONS: Shield,
  AUDITOR: BadgeCheck,
}

function SignInPage({ isMock, initialError, onSignedIn }: SignInPageProps) {
  const { model, t } = useContent()
  const [profiles, setProfiles] = useState<LoginProfile[]>([])
  const [demoAccount, setDemoAccount] = useState('')
  const [profilesLoading, setProfilesLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(initialError)

  useEffect(() => {
    let active = true

    void resolveLoginProfiles(model, async () => (await api.demoProfiles()).profiles)
      .then((availableProfiles) => {
        if (!active) return
        setProfiles(availableProfiles)
        const defaultProfile = dataString(model, 'defaultProfile')
        setDemoAccount(
          (current) =>
            availableProfiles.find((profile) => profile.demoAccount === current)?.demoAccount ??
            availableProfiles.find((profile) => profile.demoAccount === defaultProfile)?.demoAccount ??
            availableProfiles[0]?.demoAccount ??
            '',
        )
      })
      .catch((requestError: unknown) => {
        if (active) setError(errorMessage(model, t, requestError))
      })
      .finally(() => {
        if (active) setProfilesLoading(false)
      })

    return () => {
      active = false
    }
  }, [model, t])

  async function openProfile(): Promise<void> {
    if (!demoAccount || !profiles.some((profile) => profile.demoAccount === demoAccount)) return
    setBusy(true)
    setError('')
    try {
      const { user } = await api.login(demoAccount)
      onSignedIn(user)
    } catch (requestError) {
      setError(errorMessage(model, t, requestError))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="signin-layout" data-mode={isMock ? 'mock' : 'live'}>
      <aside className="signin-story">
        <div className="brand-lockup">
          <span className="brand-mark">
            <Landmark size={20} strokeWidth={2} />
          </span>
          <span>{t('brand.signature')}</span>
        </div>
        <div className="signin-story-copy">
          <p className="eyebrow eyebrow-on-dark">{t('login.heroEyebrow')}</p>
          <h1>{t('login.heroTitle')}</h1>
          <p>{t('login.heroDescription')}</p>
        </div>
        <div className="signin-ledger-art" aria-hidden="true">
          <div className="ledger-card ledger-card-back">
            <span className="ledger-caption">{t('login.ledgerCaption')}</span>
            <div className="ledger-bars">
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
            </div>
            <span className="ledger-axis">
              <i />
              <i />
              <i />
              <i />
            </span>
          </div>
          <div className="ledger-card ledger-card-front">
            <span className="ledger-chip" />
            <span className="ledger-card-mark">
              <Landmark size={17} />
            </span>
            <span className="ledger-card-label">{t('login.cardLabel')}</span>
            <span className="ledger-card-digits">{t('login.cardDigits')}</span>
          </div>
          <span className="ledger-accent-block" />
        </div>
        <div className="signin-disclaimer">
          <span className="live-dot" />
          {t('login.disclaimer')}
        </div>
      </aside>

      <section className="signin-main" aria-labelledby="signin-title">
        <div className="signin-form-wrap">
          <p className="eyebrow">{t('login.accessEyebrow')}</p>
          <h2 id="signin-title">{t('login.title')}</h2>
          <p className="signin-intro">{t('login.intro')}</p>

          <div
            className="profile-options"
            role="group"
            aria-label={t('login.profileGroup')}
            aria-busy={profilesLoading}
          >
            {profilesLoading ? (
              <p role="status">{t('app.loading')}</p>
            ) : (
              profiles.map((profile) => {
                const ProfileIcon = demoProfileIcons[profile.role]
                const selected = profile.demoAccount === demoAccount
                return (
                  <button
                    key={profile.demoAccount}
                    type="button"
                    className={`profile-option${selected ? ' profile-option-selected' : ''}`}
                    aria-pressed={selected}
                    aria-label={t('login.profileButton', {
                      name: profile.name,
                      role: t(`role.${profile.role}`),
                      note: profile.note,
                    })}
                    onClick={() => setDemoAccount(profile.demoAccount)}
                  >
                    <span className="profile-icon">
                      <ProfileIcon size={18} />
                    </span>
                    <span className="profile-copy">
                      <strong>{profile.name}</strong>
                      <small>
                        {t(`role.${profile.role}`)} · {profile.note}
                      </small>
                    </span>
                    <span className="profile-radio" aria-hidden="true" />
                  </button>
                )
              })
            )}
          </div>

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button
            type="button"
            className="primary-button signin-submit"
            disabled={busy || profilesLoading || !demoAccount || profiles.length === 0}
            onClick={() => void openProfile()}
          >
            <span>{busy ? t('login.opening') : t('login.openProfile')}</span>
            {!busy && <ArrowRight size={17} />}
          </button>
          <p className="privacy-note">{t('login.privacy')}</p>
        </div>
      </section>
    </main>
  )
}

export default SignInPage
