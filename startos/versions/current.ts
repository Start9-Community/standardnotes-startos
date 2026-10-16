import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const current = VersionInfo.of({
  version: '1.23.8:0',
  releaseNotes: {
    en_US: 'Initial release of Standard Notes Server for StartOS.',
    es_ES: 'Primera versión de Standard Notes Server para StartOS.',
    de_DE: 'Erste Veröffentlichung von Standard Notes Server für StartOS.',
    pl_PL: 'Pierwsze wydanie Standard Notes Server dla StartOS.',
    fr_FR: 'Première version de Standard Notes Server pour StartOS.',
  },
  migrations: {
    up: async () => {},
    down: IMPOSSIBLE,
  },
})
