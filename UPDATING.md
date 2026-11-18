# Updating the upstream version

Upstream is the [standardnotes/server](https://github.com/standardnotes/server) monorepo, pinned as the `server` git submodule and built by the `Dockerfile`. The package runs its `@standardnotes/home-server` workspace, so the package version follows that workspace's version.

## Determining the upstream version

Upstream releases by tagging each workspace separately (`@standardnotes/home-server@<version>`) and often lands security fixes on `main` between releases, so read both the tags and `main`:

```sh
git -C server fetch origin --tags
git -C server tag --sort=-creatordate | grep '^@standardnotes/home-server@' | head -3
git -C server log --oneline HEAD..origin/main
git -C server show origin/main:packages/home-server/package.json | jq -r .version
```

The current pin is the submodule commit (`git submodule status`).

## Applying the bump

1. Check out the target in the submodule (`git -C server checkout <tag-or-commit>`) and stage it (`git add server`).
2. Set `version` in `startos/versions/current.ts` to the `packages/home-server/package.json` version at that commit, with revision `0`.
3. Review what the bump brings in, since the package configures the server itself rather than through upstream's entrypoint:
   - `git -C server diff <old>..<new> -- .env.sample packages/*/.env.sample docker/docker-entrypoint.sh` for new environment variables. A new required variable must be added to `serverEnv` in `startos/utils.ts`; one upstream's entrypoint defaults must be defaulted there too.
   - `git -C server diff --stat <old>..<new> -- 'packages/*/migrations/sqlite/'` for new SQLite migrations. They run automatically when the server starts, so a slow or destructive one belongs in the release notes.
   - `packages/home-server/src/Server/HomeServer.ts` for changes to the data directory the `Dockerfile` symlinks to `/data` (it ignores `DB_SQLITE_DATABASE_PATH` and `FILE_UPLOAD_PATH` from the environment) and to the environment overrides it passes the auth service, which `activate-premium.js` repeats.
   - `packages/auth/src/Bootstrap/Service.ts` and `ActivatePremiumFeatures` for changes to the `activatePremiumFeatures` method `activate-premium.js` calls.

## The Node runtime

The root `Dockerfile` owns the Node image pin, including its multi-architecture digest. Keep dependency installation, compilation, and execution on the same runtime; never copy native dependencies from a different Node image or a local Yarn install. `.dockerignore` excludes local unplugged modules and Yarn install state. The submodule's `Dockerfile` is not used.

Use a security-patched, supported Node LTS release. Node 20 reached end-of-life on 2026-04-30; do not revert to it to satisfy upstream's `>=18 <21` engine declarations. The package validates Node 22 separately without changing those declarations. Check the [Node release schedule](https://github.com/nodejs/Release/blob/main/schedule.json) and [security releases](https://nodejs.org/en/blog/vulnerability) when refreshing the pin, and verify the image supplies both amd64 and arm64.

For a runtime update, build the root `Dockerfile` with its unchanged `yarn install --immutable` and `CI=true yarn build` steps. Run the resulting home server with the environment and command from `startos/utils.ts`, a disposable `/data` volume, and the manifest's Valkey image. Check fresh registration, disabled registration, authenticated item sync, the stopped-server `activate-premium.js` action, and restart. Also open a volume created by the previous runtime: its existing session and synced item must remain usable, and SQLite `PRAGMA integrity_check` must return `ok`. A Node version print or native-module import alone does not establish compatibility. Full multi-architecture package builds remain in CI.

## The web app

The web app is pinned separately, in `web/Dockerfile`, to a `standardnotes/web` image by commit tag and digest. Upstream publishes that image for every push to `main` of `standardnotes/app` except its `chore(release): publish` commits, so a release is the image of the release commit's parent: the same code, but the bundle reports the previous version.

```sh
C=$(gh api repos/standardnotes/app/git/ref/tags/@standardnotes/web@<version> --jq .object.sha)
P=$(gh api repos/standardnotes/app/git/tags/$C --jq .object.sha | xargs -I{} gh api repos/standardnotes/app/commits/{} --jq '.parents[0].sha')
curl -s "https://hub.docker.com/v2/repositories/standardnotes/web/tags/$P" | jq -r .digest
```

Pin `$P` and that digest. The build fails if `index.html` no longer carries the `window.defaultSyncServer` and `window.websocketUrl` lines it rewrites. Bump it with the server rather than on its own schedule: an app newer than the server may call endpoints the server lacks.
