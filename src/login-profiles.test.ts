import { describe, expect, it, vi } from 'vitest'
import { demoRoleSchema } from './api'
import { contentModelSchema, dataKeys, dataStringAt } from './content-schema'
import { resolveLoginProfiles } from './login-profiles'
import fincoreModel from '../public/fincore-model.json'

const model = contentModelSchema.parse(fincoreModel)

describe('login profile sources', () => {
  it('uses only API-provided choices in mock and live modes', async () => {
    const demoAccount = dataKeys(model, 'demoProfiles')[0]
    if (!demoAccount) throw new Error('Expected a presentation profile')
    const role = demoRoleSchema.parse(dataStringAt(model, 'demoProfiles', demoAccount, 'role'))
    const loadBackendProfiles = vi.fn(async () => [{ demoAccount, role }])
    const profiles = await resolveLoginProfiles(model, loadBackendProfiles)

    expect(loadBackendProfiles).toHaveBeenCalledOnce()
    expect(profiles).toEqual([
      {
        demoAccount,
        role,
        name: dataStringAt(model, 'demoProfiles', demoAccount, 'name'),
        note: dataStringAt(model, 'demoProfiles', demoAccount, 'note'),
      },
    ])
  })

  it('rejects empty API profile lists', async () => {
    await expect(resolveLoginProfiles(model, async () => [])).rejects.toThrow('DEMO_PROFILES_UNAVAILABLE')
  })

  it('rejects duplicate profile identities returned by the API', async () => {
    const profile = { demoAccount: 'customer-avery', role: 'CUSTOMER' as const }
    await expect(resolveLoginProfiles(model, async () => [profile, profile])).rejects.toThrow(
      'CONTENT_PROFILE_DUPLICATE:customer-avery',
    )
  })

  it('rejects profile IDs or roles that are not represented by the presentation model', async () => {
    await expect(
      resolveLoginProfiles(model, async () => [{ demoAccount: 'unknown', role: 'CUSTOMER' }]),
    ).rejects.toThrow('CONTENT_DATA_INVALID:demoProfiles.unknown.role')
    await expect(
      resolveLoginProfiles(model, async () => [{ demoAccount: 'customer-avery', role: 'AUDITOR' }]),
    ).rejects.toThrow('CONTENT_PROFILE_ROLE_MISMATCH:customer-avery')
  })
})
