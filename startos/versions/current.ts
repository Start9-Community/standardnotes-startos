import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const current = VersionInfo.of({
  version: '1.23.8:2',
  releaseNotes: {
    en_US:
      'Security maintenance: the server uses a supported Node.js release with current security fixes. Accounts, notes, files, and settings are unchanged. Requires StartOS 0.4.2 or later.',
    es_ES:
      'Mantenimiento de seguridad: el servidor utiliza una versión de Node.js con soporte y las correcciones de seguridad actuales. Las cuentas, notas, archivos y ajustes no cambian. Requiere StartOS 0.4.2 o posterior.',
    de_DE:
      'Sicherheitswartung: Der Server läuft mit einer unterstützten Node.js-Version mit aktuellen Sicherheitskorrekturen. Konten, Notizen, Dateien und Einstellungen bleiben unverändert. Erfordert StartOS 0.4.2 oder neuer.',
    pl_PL:
      'Aktualizacja zabezpieczeń: serwer korzysta ze wspieranej wersji Node.js z aktualnymi poprawkami bezpieczeństwa. Konta, notatki, pliki i ustawienia pozostają bez zmian. Wymaga StartOS 0.4.2 lub nowszego.',
    fr_FR:
      'Maintenance de sécurité : le serveur utilise une version de Node.js prise en charge avec les correctifs de sécurité actuels. Les comptes, notes, fichiers et paramètres restent inchangés. Nécessite StartOS 0.4.2 ou ultérieur.',
  },
  migrations: {
    up: async () => {},
    down: IMPOSSIBLE,
  },
})
