import { storeJson } from '../fileModels/store.json'
import { i18n } from '../i18n'
import { sdk } from '../sdk'
import { serverCommand, serverDir, serverEnv, valkeyPort } from '../utils'

const { InputSpec, Value } = sdk

// A private, throwaway server with upstream's activation endpoint enabled.
const activationPort = 3001

const inputSpec = InputSpec.of({
  email: Value.text({
    name: i18n('Account Email'),
    description: i18n('The email address of the account to upgrade.'),
    required: true,
    default: null,
    inputmode: 'email',
  }),
})

export const activatePremium = sdk.Action.withInput(
  'activate-premium',

  async ({ effects }) => ({
    name: i18n('Activate Premium'),
    description: i18n(
      'Grant an account on this server a Standard Notes premium subscription.',
    ),
    warning: null,
    allowedStatuses: 'only-stopped',
    group: null,
    visibility: 'enabled',
  }),

  inputSpec,

  async () => null,

  async ({ effects, input }) => {
    const store = await storeJson.read().once()
    if (!store) throw new Error('no store.json')

    const message = await sdk.SubContainer.withTemp(
      effects,
      { imageId: 'valkey' },
      null,
      'activate-premium-valkey',
      async (valkey) => {
        await valkey.launch([
          'valkey-server',
          '--bind',
          '127.0.0.1',
          '--port',
          `${valkeyPort}`,
          '--save',
          '',
          '--appendonly',
          'no',
        ])
        return sdk.SubContainer.withTemp(
          effects,
          { imageId: 'standardnotes-server' },
          sdk.Mounts.of().mountVolume({
            volumeId: 'main',
            subpath: null,
            mountpoint: '/data',
            readonly: false,
          }),
          'activate-premium',
          async (sub) => {
            await sub.launch(serverCommand, {
              cwd: serverDir,
              env: {
                ...serverEnv(store, ''),
                PORT: `${activationPort}`,
                E2E_TESTING: 'true',
              },
            })
            const base = `http://127.0.0.1:${activationPort}`
            for (let i = 0; i < 120; i++) {
              const up = await fetch(`${base}/healthcheck`).then(
                (r) => r.ok,
                () => false,
              )
              if (up) break
              await new Promise((r) => setTimeout(r, 1000))
            }
            const res = await fetch(`${base}/e2e/activate-premium`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                username: input.email.trim(),
                subscriptionId: 1,
                endsAt: '2100-01-01T00:00:00Z',
                cancelPreviousSubscription: true,
              }),
            })
            const body = await res.json()
            if (!res.ok) throw new Error(body?.error?.message ?? res.statusText)
            return body.message
          },
        )
      },
    )

    return {
      version: '1',
      title: i18n('Premium Activated'),
      message: `${input.email.trim()}: ${message}`,
      result: null,
    }
  },
)
