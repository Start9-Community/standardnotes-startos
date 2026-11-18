import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const current = VersionInfo.of({
  version: '1.23.8:2',
  releaseNotes: {
    en_US: 'Security: fixes vulnerabilities in the server runtime.',
    es_ES:
      'Seguridad: corrige vulnerabilidades en el entorno de ejecución del servidor.',
    de_DE: 'Sicherheit: behebt Schwachstellen in der Server-Laufzeitumgebung.',
    pl_PL: 'Bezpieczeństwo: usuwa luki w środowisku wykonawczym serwera.',
    fr_FR:
      "Sécurité : corrige des vulnérabilités dans l'environnement d'exécution du serveur.",
  },
  migrations: {
    up: async () => {},
    down: IMPOSSIBLE,
  },
})
