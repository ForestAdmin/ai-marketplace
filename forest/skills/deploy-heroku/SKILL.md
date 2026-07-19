---
name: deploy-heroku
description: >
  Deploy a Forest Admin Standalone agent to production on Heroku, using the
  Heroku CLI. Use when someone wants to "deploy my Forest Admin agent to
  Heroku", "put my back-office in production", or "activate the production
  environment". Pushes the agent code, sets the production env vars, applies the
  known PaaS findings, and activates the environment. Pairs with the onboard skill.
---

# Deploy a Standalone agent to production (Heroku)

Activates a **production environment** by deploying the agent code so it pushes its schema. This is the manual procedure validated end-to-end — script it faithfully.

> Applies to the **real-DB** scaffold. The **demo** scaffold (`create:demo`) can technically be deployed too, but its datasource is **in-memory and ephemeral** (regenerated at boot, no `DATABASE_URL`) — usually demo locally and stop there. If you do deploy it, skip the DB findings (#2) and drop the `DATABASE_*` config vars.

## Prerequisites (preflight)

- 🟩 REMEDIATE if missing: `heroku` CLI installed, `heroku auth:whoami` authenticated, a **billed team** (apps must NOT be created in the personal space).
- Inputs: the built agent directory; the **production** environment's `FOREST_ENV_SECRET` (its `secretKey`, from `environments:create --type production` / `environments:get`); a `FOREST_AUTH_SECRET` (generate one if needed); a **production `DATABASE_URL`** — must be **remotely reachable** (a local dev DB won't work — see finding #2).

## Secrets (by reference, never echoed)

The prod `FOREST_ENV_SECRET` and `DATABASE_URL` must not enter the model's context. **Pipe** the env secret straight from the CLI into Heroku instead of printing it — **and silence `config:set`**:

```bash
forest environments:get <prod env id> --format json | jq -r .secretKey \
  | xargs -I{} heroku config:set -a <app> FOREST_ENV_SECRET={} >/dev/null 2>&1
```

> 🔒 **Verified-the-hard-way gotcha:** `heroku config:set` **echoes back the value it just set** on stdout
> (`FOREST_ENV_SECRET: <value>`). So piping the secret in is **not enough** — without `>/dev/null 2>&1` the
> value still lands in the model's context. Suppress the output of **every** `config:set` that carries a
> secret (`FOREST_ENV_SECRET`, `FOREST_AUTH_SECRET`, `DATABASE_URL`).

Generate `FOREST_AUTH_SECRET` in-shell (`openssl rand -hex 32`) and set `DATABASE_URL` from a sourced `.env` (`$DATABASE_URL`) — never inline a secret value or `cat` the `.env`.

## Findings to apply (do not skip)

1. **PORT** — the scaffold listens on `APPLICATION_PORT`, but Heroku injects `PORT`. Patch the agent entrypoint to `Number(process.env.PORT || process.env.APPLICATION_PORT)`.
2. **DATABASE_URL — production needs a remotely-reachable DB.** A **local dev database (`localhost` / Docker) will NOT work from Heroku** → require a **managed/remote** prod DB (the same one as dev only if dev already uses a remote DB; otherwise a dedicated prod DB). Even with a cloud DB, a direct URL can fail from Heroku over IPv6 (`ENETUNREACH`) → use an **IPv4 pooler** connection string (e.g. Supabase `:6543`).
3. **Billed team** — `heroku create -t <billed-team>` (e.g. `forestadmin-product`), not the personal space.
4. **Production schema** — with `NODE_ENV=production` the agent reads the **committed** `.forestadmin-schema.json` (not introspected). Make sure it is generated (dev boot) and committed; regenerate + recommit after any customization.

## Procedure

```bash
# 1. App on a billed team
heroku create -t <billed-team>            # note the app name + URL

# 2. Production config — set NON-secret vars openly, but pipe every SECRET in with output silenced
#    (config:set echoes values back → always `>/dev/null` for secret-bearing calls; see Secrets above).
heroku config:set -a <app> NODE_ENV=production DATABASE_SCHEMA=<schema> DATABASE_SSL_MODE=<mode>
forest environments:get <prod env id> --format json | jq -r .secretKey \
  | xargs -I{} heroku config:set -a <app> FOREST_ENV_SECRET={} >/dev/null 2>&1
heroku config:set -a <app> FOREST_AUTH_SECRET=$(openssl rand -hex 32) >/dev/null 2>&1
set -a; . ./.env; set +a; heroku config:set -a <app> DATABASE_URL="$DATABASE_URL" >/dev/null 2>&1  # real-DB only

# 3. Ship it (Node buildpack; a `web: npm start` Procfile is enough)
git init && git add -A && git commit -m "deploy agent"
heroku git:remote -a <app>                 # REQUIRED: wire the remote — `heroku create` only adds it
                                           # automatically if the git repo already existed at create time,
                                           # which it does not here (we git-init after create)
git push heroku HEAD:main
```

## Verify & activate

- Check the dyno logs for `Schema was updated, sending new version` then `Successfully mounted on Standalone server` and `State changed … to up`.
- The schema push on this **new** prod env sets `apimapVersionId` **and creates the project's first role ("Operations")**.
- **Set the apiEndpoint** so the env becomes fully active (otherwise the auth callback breaks with `null/forest/...`):
  ```bash
  forest environments:update -e <prod env id> -u https://<app>.herokuapp.com
  ```
- Confirm: `forest environments:get <prod env id> --format json` → `"isActive": true`.

## Troubleshooting (common failures)

Inspect first: `heroku logs --tail -a <app>` and `heroku ps -a <app>`.

| Symptom (logs) | Cause | Fix |
|---|---|---|
| `fatal: 'heroku' does not appear to be a git repository` on push | the git repo was created **after** `heroku create`, so the remote was never wired | `heroku git:remote -a <app>` then re-push |
| `Error R10 (Boot timeout)` / "failed to bind to $PORT" | the agent listens on `APPLICATION_PORT`, not Heroku's `PORT` | apply the **PORT patch** (`process.env.PORT \|\| process.env.APPLICATION_PORT`) and redeploy |
| `H10 App crashed` right after boot | runtime error before mount | read the stack in `heroku logs`; usually DB or env-var related (below) |
| `ENETUNREACH` / DB connection times out | direct DB URL is IPv6-only from the PaaS | use the **IPv4 pooler** connection string (Supabase `:6543`) |
| `no pg_hba` / `SSL required` / self-signed | DB SSL mismatch | set `DATABASE_SSL_MODE` (e.g. `required`) in `config:set` |
| Build fails on `npm install` / unsupported Node | Heroku picked a different Node | pin `engines.node` (e.g. `"22.x"`) in `package.json` |
| Auth warning `invalid_redirect_uri … null/forest/authentication/callback` | env `apiEndpoint` not set yet | `forest environments:update -e <id> -u <url>` then `heroku restart` |
| Prod back-office shows **0 collections** / empty schema | in `NODE_ENV=production` the agent reads the **committed** `.forestadmin-schema.json`, which is missing/stale | regenerate it (dev boot / `forest schema:update`), **commit**, redeploy |

## Redeploy after a change (code or customization)

In `NODE_ENV=production` the agent serves the **committed** `.forestadmin-schema.json` — it does **not** introspect. A code change or a `forest-code` customization stays invisible in production until you regenerate and redeploy. After ANY change:

1. Apply the change (e.g. via the `forest-code` skill — it writes the code but does **not** redeploy).
2. **Regenerate the schema**: boot the agent once in dev (it rewrites `.forestadmin-schema.json`), or run `forest schema:update`.
3. **Commit** the updated `.forestadmin-schema.json` (+ code).
4. `git push heroku HEAD:main`.
5. `heroku restart -a <app>` if the dyno doesn't recycle on its own.
6. Verify: `heroku logs --tail` shows a fresh `Schema was updated…`; the prod back-office reflects the change.

> Skipping steps 2–3 is the #1 reason "my changes don't show up in production": the schema file is the source of truth in prod.

## Fail-fast

- 🟥 Build failure, or prod never reaches `isActive` after a reasonable timeout → stop with the logs; do not loop silently.

## Cleanup (for test/dry runs)

`heroku apps:destroy <app> --confirm <app>` (Heroku CLI) tears down the app. **The Forest project has no CLI delete command** (gap in the toolbelt) — if it was a throwaway, delete it from the **UI** (Project settings → Danger zone). Do **not** reach for the private HTTP API to force it: this skill only drives supported CLI commands.
