---
name: deploy-railway
description: >
  Deploy a Forest Admin Standalone agent to production on Railway, using the
  Railway CLI. Use when someone wants to "deploy my Forest Admin agent to
  Railway", "put my admin panel in production on Railway", or "activate the
  production environment on Railway". Pushes the agent code, provisions/sets the
  production env vars (optionally a Railway-hosted Postgres), applies the known
  PaaS findings, and activates the environment. Pairs with forest-onboard.
---

# Deploy a Standalone agent to production (Railway)

Activates a **production environment** by deploying the agent code so it pushes its schema. Railway is the closest analog to Heroku — CLI-first, no Docker required (Nixpacks auto-detects Node), and it can host the Postgres DB **inside the same project**, which sidesteps most of the IPv4/IPv6 pooler pain. Script this faithfully.

> ✅ **Validated end-to-end on a real production deploy (2026-06-15):** account → `projects:create:sql` → dev boot → prod env → `railway up` → schema pushed + first role created → `environments:update` → `isActive: true`. CLI flags verified against railway 5.12.1. Variables: `railway variable set KEY=value` (the older `railway variables --set "K=V"` still works but is legacy); secrets can be piped with `--stdin`. Non-interactive project creation: `railway init --name <app> --workspace <id>`. Unattended deploy: `railway up -y`.
> ✅ **PORT confirmed on a real Railway deploy (2026-06-15):** Railway injects `PORT` at runtime (observed `PORT=8080`). The scaffold listens on `APPLICATION_PORT`, so the PORT patch below is **required** — without it the app binds the wrong port and the domain returns 502.

## Prerequisites (preflight)

- 🟩 REMEDIATE if missing: `railway` CLI (`npm i -g @railway/cli` or `brew install railway`); authenticated (`railway whoami`; if not, `railway login`, or `railway login --browserless` / `RAILWAY_TOKEN` for headless/CI); `node`/`npm`.
- Inputs: the built agent directory; the **production** environment's `FOREST_ENV_SECRET` (its `secretKey`, from `environments:create --type production` / `environments:get`); a `FOREST_AUTH_SECRET` (generate one if needed); a **production `DATABASE_URL`** — either a **Railway-hosted Postgres** (recommended, provisioned below) or an existing **remotely-reachable** managed DB (a local dev DB will NOT work — see finding #2).

## Findings to apply (do not skip)

1. **PORT** — the scaffold listens on `APPLICATION_PORT`, but Railway provides a `PORT` at runtime. Patch the agent entrypoint to `Number(process.env.PORT || process.env.APPLICATION_PORT)` and bind `0.0.0.0`. (Confirm PORT injection at first run; if Railway does not inject it, set a `PORT` variable explicitly.)
2. **DATABASE_URL — production needs a remotely-reachable DB.** A **local dev database (`localhost` / Docker) will NOT work from Railway.** Preferred: provision a **Railway Postgres in the same project** and reference it via `${{ Postgres.DATABASE_URL }}` so traffic stays on Railway's network and there's no IPv4/IPv6 pooler problem. If you reuse an external managed DB, the same IPv6 `ENETUNREACH` caveat as other PaaS can apply → prefer an IPv4/pooled connection string.
3. **No billed-team gate like Heroku**, but deploys run under the logged-in **workspace/project**; make sure the right one is linked before `railway up`. Free trials may sleep/limit services — use a paid plan for a real prod panel.
4. **Production schema** — with `NODE_ENV=production` the agent reads the **committed** `.forestadmin-schema.json` (not introspected). Make sure it is generated (dev boot) and committed; regenerate + recommit after any customization.
5. **`FOREST_SERVER_URL` must be publicly reachable from the PaaS.** The deployed agent phones home to the Forest server to push its schema. A **public** server works (e.g. `https://api.forestadmin.com`); an **internal/dev server is NOT publicly resolvable** and the agent crashes with `getaddrinfo ENOTFOUND` (verified 2026-06-15: `api.development.forestadmin.com` does not resolve via public DNS). Use a publicly-reachable Forest server for any PaaS deploy.

## Procedure

```bash
# 1. From the agent directory: auth + create/link the project
cd <built-agent-dir>
railway login                       # or: railway login --browserless / export RAILWAY_TOKEN=... (headless)
railway init --name <app>           # non-interactive; add --workspace <id> when outside a TTY
# (existing project: `railway link` to select workspace/project/environment.)

# 2. (Recommended) Provision a Railway-hosted Postgres in this project
railway add --database postgres

# 3. Production config (use the PROD env secret, not the dev one).
#    Modern syntax (railway 5.x); --skip-deploys batches without redeploying each time.
railway variable set NODE_ENV=production --skip-deploys
railway variable set DATABASE_URL='${{ Postgres.DATABASE_URL }}' --skip-deploys
railway variable set DATABASE_SCHEMA=<schema> --skip-deploys
railway variable set DATABASE_SSL_MODE=<mode> --skip-deploys
#    Secrets via stdin (avoid leaking them in argv / shell history):
echo "<prod env secretKey>" | railway variable set FOREST_ENV_SECRET --stdin --skip-deploys
echo "<generated>"          | railway variable set FOREST_AUTH_SECRET --stdin --skip-deploys
#    (legacy one-liner also works: railway variables --set "K=V" --set "K2=V2")

# 4. Ship it (Nixpacks auto-detects Node; needs a `start` script in package.json — no Procfile)
railway up -y                       # -y = unattended; add --detach to not stream the build log

# 5. Generate the public domain (so Forest can reach the agent)
railway domain                      # prints https://<app>.up.railway.app
```

> Railway has **no `Procfile`** and **no git remote**: the start command comes from `package.json` `"scripts": { "start": ... }`, and `railway up` uploads the current directory (it does not `git push`).

## Verify & activate

- Stream logs and look for `Schema was updated, sending new version` then `Successfully mounted on Standalone server`:
  ```bash
  railway logs            # runtime/deployment logs;  railway logs --build  for the build
  ```
- The schema push on this **new** prod env sets `apimapVersionId` **and creates the project's first role ("Operations")**.
- **Set the apiEndpoint** to the Railway URL so the env becomes fully active (otherwise the auth callback breaks with `null/forest/...`):
  ```bash
  forest environments:update -e <prod env id> -u https://<app>.up.railway.app
  ```
- Confirm: `forest environments:get <prod env id> --format json` → `"isActive": true`.

## Troubleshooting (common failures)

Inspect first: `railway logs` (runtime) and `railway logs --build`.

| Symptom | Cause | Fix |
|---|---|---|
| Domain returns 502 / "Application failed to respond" | agent listens on `APPLICATION_PORT`, not Railway's `PORT`, or binds `127.0.0.1` | apply the **PORT patch** (`process.env.PORT \|\| process.env.APPLICATION_PORT`), bind `0.0.0.0`, redeploy |
| Crash right after boot | runtime error before mount | read the stack in `railway logs`; usually DB or env-var related |
| `getaddrinfo ENOTFOUND <forest server>` at startup | `FOREST_SERVER_URL` not publicly resolvable from the PaaS (e.g. an internal/dev Forest server) | point `FOREST_SERVER_URL` at a **publicly-reachable** Forest server (prod or a public staging) — see finding #5 |
| `options.envSecret is invalid` | wrong/empty `FOREST_ENV_SECRET`, or stale logs from a pre-secrets deploy | confirm the var equals the **production** env `secret_key`; redeploy; check the **latest** deployment's logs (old crashed deploys linger in `railway logs`) |
| DB connection times out / `ENETUNREACH` against an **external** DB | direct DB URL is IPv6-only from the PaaS | prefer a **Railway-hosted Postgres** referenced via `${{ Postgres.DATABASE_URL }}`, or use an IPv4/pooled connection string |
| `no pg_hba` / `SSL required` / self-signed | DB SSL mismatch | set `DATABASE_SSL_MODE` (e.g. `required`) |
| Build fails / wrong Node version | Nixpacks picked a different Node | pin `engines.node` (e.g. `"22.x"`) in `package.json` (Nixpacks honors `engines`) |
| `railway up` errors "no linked project/service" | dir isn't linked, or multiple services | run `railway link` (and pass `-s/--service`) |
| Auth warning `invalid_redirect_uri … null/forest/authentication/callback` | env `apiEndpoint` not set yet | `forest environments:update -e <id> -u <url>`, then redeploy |
| Prod panel shows **0 collections** / empty schema | in `NODE_ENV=production` the agent reads the **committed** `.forestadmin-schema.json`, which is missing/stale | regenerate it (dev boot / `forest schema:update`), **commit**, redeploy |

## Redeploy after a change (code or customization)

In `NODE_ENV=production` the agent serves the **committed** `.forestadmin-schema.json` — it does **not** introspect. After ANY change:

1. Apply the change (e.g. via the `forest-code` skill — it writes the code but does **not** redeploy).
2. **Regenerate the schema**: boot the agent once in dev (it rewrites `.forestadmin-schema.json`), or run `forest schema:update`.
3. **Commit** the updated `.forestadmin-schema.json` (+ code).
4. `railway up` (re-uploads + rebuilds the current directory).
5. Verify: `railway logs` shows a fresh `Schema was updated…`; the prod panel reflects the change.

> Skipping steps 2–3 is the #1 reason "my changes don't show up in production": the schema file is the source of truth in prod.

## Fail-fast

- 🟥 Build failure, or prod never reaches `isActive` after a reasonable timeout → stop with the logs; do not loop silently.

## Cleanup (for test/dry runs)

`railway down` (removes the latest deployment) and/or `railway delete` (deletes the project) · then delete the Forest project if it was a throwaway (`DELETE /api/projects/:id`, cascades env/role/invitation).
