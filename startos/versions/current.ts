import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const current = VersionInfo.of({
  version: '1.23.8:0',
  releaseNotes: {
    en_US:
      'The package version now follows the upstream Standard Notes home server version. Updated to the StartOS SDK 3 package layout.',
    es_ES:
      'La versión del paquete ahora sigue la versión del servidor doméstico de Standard Notes. Actualizado a la estructura de paquetes del SDK 3 de StartOS.',
    de_DE:
      'Die Paketversion folgt jetzt der Version des Standard Notes Home-Servers. Auf das Paketformat des StartOS SDK 3 aktualisiert.',
    pl_PL:
      'Wersja pakietu odpowiada teraz wersji serwera domowego Standard Notes. Zaktualizowano do układu pakietu StartOS SDK 3.',
    fr_FR:
      'La version du paquet suit désormais celle du serveur domestique Standard Notes. Mise à jour vers la structure de paquet du SDK 3 de StartOS.',
  },
  migrations: {
    up: async () => {},
    down: IMPOSSIBLE,
  },
})
