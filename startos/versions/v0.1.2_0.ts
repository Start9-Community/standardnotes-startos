import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const v0_1_2_0 = VersionInfo.of({
  version: '0.1.2:0',
  releaseNotes: {
    en_US:
      'Update Standard Notes server to upstream b7d2f366 (October 2026), bringing in upstream security fixes for authorization, subscription invites, WebAuthn and PKCE, plus database index migrations that run automatically on first start.',
  },
  migrations: {
    up: async ({ effects }) => {},
    down: IMPOSSIBLE,
  },
})
