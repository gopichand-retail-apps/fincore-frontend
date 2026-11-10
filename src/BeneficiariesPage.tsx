import { useEffect, useState, type FormEvent } from 'react'
import { ArrowRight, Check, CircleAlert, Plus, Trash2, UserRound, UsersRound } from 'lucide-react'
import type { Beneficiary, Recipient } from './api'
import { api } from './api'
import { useContent } from './content-context'
import { dataStringFrom, dataStringRecord, errorMessage } from './content-schema'
import { formatDate } from './format'

interface BeneficiariesPageProps {
  beneficiaries: Beneficiary[]
  onUpdated: () => void
}

function BeneficiariesPage({ beneficiaries, onUpdated }: BeneficiariesPageProps) {
  const { model, t } = useContent()
  const seededAliases = dataStringRecord(model, 'beneficiaryAliases')
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [directoryLoading, setDirectoryLoading] = useState(true)
  const [directoryError, setDirectoryError] = useState('')
  const [destinationId, setDestinationId] = useState('')
  const [alias, setAlias] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    let active = true
    void api
      .recipientDirectory()
      .then(({ recipients: directory }) => {
        if (active) setRecipients(directory)
      })
      .catch((requestError: unknown) => {
        if (active) setDirectoryError(errorMessage(model, t, requestError))
      })
      .finally(() => {
        if (active) setDirectoryLoading(false)
      })
    return () => {
      active = false
    }
  }, [model, t])

  const savedIds = new Set(beneficiaries.map((beneficiary) => beneficiary.destinationAccountId))
  const availableRecipients = recipients.filter((recipient) => !savedIds.has(recipient.accountId))

  async function addBeneficiary(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!destinationId || alias.trim().length < 2) {
      setError(t('beneficiaries.invalid'))
      return
    }
    setBusy(true)
    setError('')
    setSuccess('')
    try {
      const beneficiary = await api.addBeneficiary(destinationId, alias.trim())
      setSuccess(t('beneficiaries.addSuccess', { alias: seededAliases[beneficiary.alias] ?? beneficiary.alias }))
      setDestinationId('')
      setAlias('')
      onUpdated()
    } catch (requestError) {
      setError(errorMessage(model, t, requestError))
    } finally {
      setBusy(false)
    }
  }

  async function removeBeneficiary(beneficiary: Beneficiary): Promise<void> {
    setError('')
    setSuccess('')
    try {
      await api.removeBeneficiary(beneficiary.id)
      setSuccess(t('beneficiaries.removeSuccess', { alias: seededAliases[beneficiary.alias] ?? beneficiary.alias }))
      onUpdated()
    } catch (requestError) {
      setError(errorMessage(model, t, requestError))
    }
  }

  return (
    <section className="page-stack" aria-label={t('beneficiaries.ariaLabel')}>
      <div className="page-intro-row">
        <div>
          <h2 className="section-title">{t('beneficiaries.introTitle')}</h2>
          <p className="section-copy">{t('beneficiaries.intro')}</p>
        </div>
        <span className="role-note">
          <UsersRound size={15} /> {t('beneficiaries.savedCount', { count: beneficiaries.length })}
        </span>
      </div>

      {(error || directoryError) && (
        <p className="form-error" role="alert">
          {error || directoryError}
        </p>
      )}
      {success && (
        <p className="inline-success" role="status">
          <Check size={15} />
          {success}
        </p>
      )}

      <div className="beneficiary-layout">
        <section className="panel beneficiary-list-panel" aria-labelledby="beneficiary-list-title">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">{t('beneficiaries.saved')}</p>
              <h3 id="beneficiary-list-title">{t('beneficiaries.yourRecipients')}</h3>
            </div>
            <span className="panel-icon">
              <UsersRound size={18} />
            </span>
          </div>
          {beneficiaries.length === 0 ? (
            <div className="empty-state compact-empty">
              <span className="empty-state-icon">
                <UserRound size={19} />
              </span>
              <strong>{t('beneficiaries.none')}</strong>
              <span>{t('beneficiaries.noneDescription')}</span>
            </div>
          ) : (
            <ul className="beneficiary-list">
              {beneficiaries.map((beneficiary) => (
                <li key={beneficiary.id}>
                  <span className="beneficiary-avatar">
                    <UserRound size={17} />
                  </span>
                  <span className="beneficiary-copy">
                    <strong>{seededAliases[beneficiary.alias] ?? beneficiary.alias}</strong>
                    <small>
                      {dataStringFrom(model, 'accountNames', beneficiary.destinationAccountId)} ·{' '}
                      {beneficiary.maskedAccountNumber}
                    </small>
                    <small>{t('beneficiaries.added', { date: formatDate(beneficiary.createdAt, model.locale) })}</small>
                  </span>
                  <button
                    type="button"
                    className="icon-button remove-beneficiary"
                    title={t('beneficiaries.remove', { alias: seededAliases[beneficiary.alias] ?? beneficiary.alias })}
                    aria-label={t('beneficiaries.remove', {
                      alias: seededAliases[beneficiary.alias] ?? beneficiary.alias,
                    })}
                    onClick={() => void removeBeneficiary(beneficiary)}
                  >
                    <Trash2 size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel add-beneficiary-panel" aria-labelledby="add-beneficiary-title">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">{t('beneficiaries.new')}</p>
              <h3 id="add-beneficiary-title">{t('beneficiaries.addToList')}</h3>
            </div>
            <span className="panel-icon panel-icon-blue">
              <Plus size={18} />
            </span>
          </div>
          {directoryLoading ? (
            <div className="loading-panel inline-loading">
              <span className="spinner" />
              {t('beneficiaries.loadingDirectory')}
            </div>
          ) : availableRecipients.length === 0 ? (
            <div className="read-only-state small-read-only">
              <span className="empty-state-icon">
                <CircleAlert size={18} />
              </span>
              <strong>{t('beneficiaries.allSaved')}</strong>
              <span>{t('beneficiaries.noMore')}</span>
            </div>
          ) : (
            <form className="transfer-form" onSubmit={(event) => void addBeneficiary(event)}>
              <label className="field-label" htmlFor="beneficiary-account">
                <span>{t('beneficiaries.account')}</span>
                <select
                  id="beneficiary-account"
                  required
                  value={destinationId}
                  onChange={(event) => setDestinationId(event.currentTarget.value)}
                >
                  <option value="" disabled>
                    {t('beneficiaries.choose')}
                  </option>
                  {availableRecipients.map((recipient) => (
                    <option key={recipient.accountId} value={recipient.accountId}>
                      {dataStringFrom(
                        model,
                        'demoUserNames',
                        dataStringFrom(model, 'accountOwners', recipient.accountId),
                      )}{' '}
                      · {dataStringFrom(model, 'accountNames', recipient.accountId)} · {recipient.maskedAccountNumber}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field-label" htmlFor="beneficiary-alias">
                <span>{t('beneficiaries.displayName')}</span>
                <input
                  id="beneficiary-alias"
                  type="text"
                  minLength={2}
                  maxLength={80}
                  required
                  value={alias}
                  onChange={(event) => setAlias(event.currentTarget.value)}
                  placeholder={t('beneficiaries.aliasPlaceholder')}
                />
                <small>{t('beneficiaries.aliasHelp')}</small>
              </label>
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              <button type="submit" className="primary-button" disabled={busy}>
                <Plus size={16} /> {busy ? t('beneficiaries.saving') : t('beneficiaries.save')} <ArrowRight size={15} />
              </button>
            </form>
          )}
        </section>
      </div>
      <p className="permission-note">{t('beneficiaries.permission')}</p>
    </section>
  )
}

export default BeneficiariesPage
