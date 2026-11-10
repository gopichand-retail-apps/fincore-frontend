import { demoRoleSchema, type DemoProfile } from './api'
import { dataStringAt } from './content-schema'
import type { ContentModel } from './content-schema'

export interface LoginProfile extends DemoProfile {
  name: string
  note: string
}

function backendLoginProfiles(model: ContentModel, profiles: DemoProfile[]): LoginProfile[] {
  const seen = new Set<string>()

  return profiles.map((profile) => {
    if (seen.has(profile.demoAccount)) {
      throw new Error(`CONTENT_PROFILE_DUPLICATE:${profile.demoAccount}`)
    }
    seen.add(profile.demoAccount)

    const modelRole = demoRoleSchema.parse(dataStringAt(model, 'demoProfiles', profile.demoAccount, 'role'))
    if (modelRole !== profile.role) throw new Error(`CONTENT_PROFILE_ROLE_MISMATCH:${profile.demoAccount}`)
    return {
      ...profile,
      name: dataStringAt(model, 'demoProfiles', profile.demoAccount, 'name'),
      note: dataStringAt(model, 'demoProfiles', profile.demoAccount, 'note'),
    }
  })
}

export async function resolveLoginProfiles(
  model: ContentModel,
  loadBackendProfiles: () => Promise<DemoProfile[]>,
): Promise<LoginProfile[]> {
  const profiles = await loadBackendProfiles()
  if (profiles.length === 0) throw new Error('DEMO_PROFILES_UNAVAILABLE')
  return backendLoginProfiles(model, profiles)
}
