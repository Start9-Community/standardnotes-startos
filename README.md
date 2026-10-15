<p align="center">
  <img src="icon.png" alt="Standard Notes Server Logo" width="21%">
</p>

# Standard Notes Server on StartOS

> Everything not listed in this document should behave the same as upstream
> Standard Notes Server. If a feature, setting, or behavior is not mentioned here,
> the upstream documentation is accurate and fully applicable — see the
> Documentation section of `instructions.md` for links.

This package runs the Standard Notes **home server**, the all-in-one self-host build of [standardnotes/server](https://github.com/standardnotes/server): one Node process that bundles the sync, auth, files, and revisions services on an embedded SQLite database and on-disk file storage. The Standard Notes desktop, mobile, and web apps connect to it as a custom sync server.

---

## Table of Contents

- [Image and Container Runtime](#image-and-container-runtime)
- [Volume and Data Layout](#volume-and-data-layout)
- [File Models](#file-models)
- [Dependencies](#dependencies)
- [Network Access and Interfaces](#network-access-and-interfaces)
- [Installation and First-Run Flow](#installation-and-first-run-flow)
- [Actions](#actions)
- [Tasks](#tasks)
- [Health Checks](#health-checks)
- [Backups and Restore](#backups-and-restore)
- [Limitations and Differences](#limitations-and-differences)
- [Quick Reference for AI Consumers](#quick-reference-for-ai-consumers)

---

## Image and Container Runtime

Upstream publishes no image of the home server, so the package builds its own from source.

| What          | Value                                                                                                     |
| ------------- | --------------------------------------------------------------------------------------------------------- |
| Image source  | Custom `Dockerfile`: the `server` git submodule (upstream monorepo) built with Yarn on a Node Alpine base |
| Architectures | x86_64                                                                                                    |
| Entrypoint    | Custom `docker_entrypoint.sh`                                                                             |
| Subcontainer  | `standardnotes-server`, running the one daemon, `primary`                                                 |

The entrypoint symlinks the home server's data directory (`packages/home-server/dist/data`) to the `/data` volume, starts a private Redis on `127.0.0.1:6379` with persistence disabled (the files service needs it for short-lived valet tokens even in home-server mode), sets an empty `COOKIE_DOMAIN`, and runs `packages/home-server/dist/bin/server.js`. Upstream's `docker/docker-entrypoint.sh` is not used.

## Volume and Data Layout

All state lives on one volume, `main`, mounted read-write at `/data`.

| Path on `main`                | Contents                                                                           |
| ----------------------------- | ---------------------------------------------------------------------------------- |
| `database/home_server.sqlite` | The SQLite database: accounts, encrypted items, sessions, subscriptions, revisions |
| `uploads/`                    | Uploaded file blobs (end-to-end encrypted)                                         |
| `start9/store.json`           | The package's own settings and generated secrets                                   |

No external MySQL, Redis, or object storage is used. The Redis instance is in-memory only and holds nothing that must survive a restart.

## File Models

The package owns one file, `start9/store.json`. It writes no upstream configuration file and configures the server entirely through environment variables.

`store.json` holds:

- **Five server secrets**: `jwtSecret`, `authJwtSecret`, `encryptionServerKey`, `pseudoKeyParamsKey`, `valetTokenSecret`. Each is generated once at install (64 hex characters) and never rewritten. They sign sessions and encrypt server-side data, so editing or losing them invalidates every session and makes encrypted server data unreadable.
- **`filesServerUrl`** and **`premiumActivationMode`**, written only by the **Configure** action.

Every init merges the schema defaults into the file and keeps existing values. The daemon reads the file reactively, so any change, from the action or by hand, restarts the service with the new values, and a hand edit survives.

The daemon receives `NODE_ENV`, `PORT`, `JWT_SECRET`, `AUTH_JWT_SECRET`, `ENCRYPTION_SERVER_KEY`, `PSEUDO_KEY_PARAMS_KEY` and `VALET_TOKEN_SECRET` on every start, `FILES_SERVER_URL` when `filesServerUrl` is non-empty, and `E2E_TESTING=true` while `premiumActivationMode` is on. The entrypoint adds `REDIS_URL` and `COOKIE_DOMAIN`.

## Dependencies

This service needs nothing from other services.

None.

## Network Access and Interfaces

The package exposes the server's HTTP API on a single interface; StartOS provides TLS for the LAN, Tor, and any domain the user adds.

| Interface id | Type  | Port | Protocol | Purpose                                                              |
| ------------ | ----- | ---- | -------- | -------------------------------------------------------------------- |
| `api`        | `api` | 3000 | HTTP     | Sync, auth, files, and revisions API used by the Standard Notes apps |

There is no web UI. Session cookies are host-only (empty `COOKIE_DOMAIN`), so each address a client uses holds its own session.

## Installation and First-Run Flow

Setup needs no wizard and no credentials from the user; the secrets are generated at install.

On first start the home server creates its SQLite schema; on later starts it runs any new upstream migrations before it listens. Accounts are created from a Standard Notes app, and the server has no admin account. Clients reject the LAN address until the device trusts the StartOS root CA, which is the most common first-run failure.

## Actions

The package has one user-facing action.

**Configure** (`configure`)

- **When to run it:** to enable file uploads (set **Files Server URL** to the public HTTPS address clients use), or to grant premium to an account (turn **Premium Activation Mode** on, grant, then turn it off).
- **What it changes:** `filesServerUrl` and `premiumActivationMode` in `store.json`, delivered as `FILES_SERVER_URL` and `E2E_TESTING`.
- **Cost:** restarts the service, which is unavailable for the roughly 15 seconds the server takes to start.
- **Repeat safety:** safe to repeat; saving the same values only restarts the service.
- **Caution:** while Premium Activation Mode is on, the unauthenticated `POST /e2e/activate-premium` endpoint is reachable by anyone who can reach the API, and the server issues legacy (non-cookie) sessions.

## Tasks

The package never asks the user to do anything.

None. The service is never held on a prompt, and its controls are always available.

## Health Checks

The `primary` daemon has one readiness check, **Server API**.

- **What it probes:** whether anything listens on port 3000.
- **Slow start:** the server takes about 15 seconds to start, longer when upstream migrations run after an update, so failures in that window are expected.
- **A failure that persists** means the Node process exited or never bound the port. The service log shows why; the usual causes are a failed database migration or a damaged `store.json`.

## Backups and Restore

The `main` volume is backed up wholesale (`ofVolumes`): the SQLite database, uploaded files, and `store.json`, secrets included.

A restore brings back accounts, notes, files, subscriptions, and the secrets, so existing app sessions keep working. Nothing needs rebuilding; the in-memory Redis starts empty by design.

## Limitations and Differences

These are the ways the package differs from an upstream self-hosted deployment.

1. **x86_64 only.** No aarch64 build is published.
2. **Home server only.** The upstream multi-service deployment (MySQL, separate Redis, S3-compatible storage, separate files and revisions servers) is not available.
3. **No web app.** The package is the API backend; use upstream's web app or host one separately.
4. **Open registration.** Anyone who can reach the API address can create an account; the package does not expose upstream's `DISABLE_USER_REGISTRATION` setting.
5. **Premium is limited by the apps, not the server.** The official apps honor a subscription only on first-party hosts, `localhost:3123` among them, so premium unlocks only through a local `localhost:3123` proxy on desktop, never on mobile.
6. **Offline premium activation does not work** in home-server mode.
7. **`ADMIN_KEY` is not set.** The startup log warns that `/admin` and `/internal` are unprotected; the home server does not mount those HTTP routes, so the warning has no effect.

---

## Quick Reference for AI Consumers

```yaml
package_id: standardnotes-server
image: built from Dockerfile (standardnotes/server submodule, home-server workspace)
architectures: [x86_64]
subcontainers: [standardnotes-server]
volumes:
  main: /data
file_models:
  - start9/store.json
startos_managed_env_vars:
  - NODE_ENV
  - PORT
  - JWT_SECRET
  - AUTH_JWT_SECRET
  - ENCRYPTION_SERVER_KEY
  - PSEUDO_KEY_PARAMS_KEY
  - VALET_TOKEN_SECRET
  - FILES_SERVER_URL
  - E2E_TESTING
  - REDIS_URL
  - COOKIE_DOMAIN
dependencies: none
interfaces:
  api: { type: api, port: 3000 }
actions:
  - configure
tasks: []
health_checks:
  - primary
```
