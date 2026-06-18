---
name: deploy-scalingo
description: >
  Deploy a Forest Admin Standalone agent to production on Scalingo (EU PaaS),
  using the Scalingo CLI + git push. Use when someone wants to "deploy my Forest
  Admin agent to Scalingo", "host my admin panel in the EU", or "put the agent
  in production on a European PaaS". Creates the app, (optionally) a managed
  Postgres, sets the production env vars, deploys via git, and activates the
  environment. Pairs with forest-onboard.
---

# Deploy a Standalone agent to production (Scalingo, EU)

Activates a **production environment** by pushing the agent code to **Scalingo** (French/EU PaaS) so it pushes its schema. Scalingo is **git-push based, like Heroku** (no Docker required, Node buildpack auto-detected), runs in the **EU** (`osc-fr1` Paris / `osc-secnum-fr1`), and can provision a **managed Postgres** in-platform — a strong data-residency story for European customers.

> ✅ **Validated end-to-end on a real production deploy (2026-06-18):** create app → managed Postgres → seed via `db-tunnel` → scaffold → `git push` → schema pushed + first role created → `environments:update` → `isActive: true`. Verified against scalingo CLI 1.46 in `osc-fr1`.

## Prerequisites (preflight)

- 🟩 REMEDIATE if missing: `scalingo` CLI (`brew install Scalingo/scalingo/scalingo` or the official installer) + authenticated (`scalingo login`); `git`; `node`/`npm`.
- Inputs: the built agent directory (a git repo); the **production** env's `FOREST_ENV_SECRET` (`secret_key`); a generated `FOREST_AUTH_SECRET`; a **production `DATABASE_URL`** — either a **Scalingo managed Postgres** (recommended, EU + in-platform) or an existing remotely-reachable DB.

## Findings to apply (do not skip)

1. **PORT** — Scalingo injects a **dynamic** `$PORT` at runtime (observed e.g. `26941`, not a fixed port). The PORT patch `Number(process.env.PORT || process.env.APPLICATION_PORT)` + bind `0.0.0.0` is essential.
2. **`FOREST_SERVER_URL` must be publicly reachable** — same finding as the other PaaS: use a **public** Forest server (prod). An internal/dev server fails with `getaddrinfo ENOTFOUND`.
3. **Managed Postgres** — `scalingo addons-add postgresql <plan>` (e.g. `postgresql-starter-512`). The addon **auto-sets `DATABASE_URL`** (and `SCALINGO_POSTGRESQL_URL`) on the app — **do not override `DATABASE_URL`**. The DB starts empty → seed it (see #6).
4. **db-tunnel needs an SSH key registered with Scalingo.** The managed DB has a **private IP** (not publicly reachable); local access (seed + scaffold introspection) goes through `scalingo db-tunnel` → `127.0.0.1:10000`, which auths over **SSH**. An API-token login is NOT enough: `scalingo keys-add <name> ~/.ssh/id_ed25519.pub` + `ssh-add`, else the tunnel fails with *"no authentication method has succeeded"*.
5. **Managed Postgres presents a self-signed certificate** (`self-signed certificate in certificate chain`). ⚠️ The quick workaround `NODE_TLS_REJECT_UNAUTHORIZED=0` disables TLS verification **process-wide** — including the agent↔`api.forestadmin.com` connection — so it's acceptable only for a **throwaway spike, NOT production** (MITM risk). For prod, **scope SSL to the DB**: configure the SQL datasource with Scalingo's **CA certificate** (proper verification), or at minimum `rejectUnauthorized: false` only on the Postgres connection — never the global env var.
6. **Deploy branch** — Scalingo deploys the remote **`main`** branch: `git push scalingo master:main` (local `master` → remote `main`). Node buildpack runs `npm start` (a `web: npm start` Procfile is optional).
7. **App name** can't contain the word `scalingo` (422 on create).
8. **Production schema** — with `NODE_ENV=production` the agent serves the **committed** `.forestadmin-schema.json` (not introspected) — generate (dev boot) + commit before deploying; regenerate + commit + redeploy after any customization.

## Procedure

```bash
APP=forest-agent
REGION=osc-fr1          # EU (Paris); or osc-secnum-fr1

# 1. Auth + create the app (adds a `scalingo` git remote)
scalingo login
cd <built-agent-dir> && git init && git add -A && git commit -m "deploy agent"
scalingo create "$APP" --region "$REGION"      # ⚠️ confirm --region flag; else `scalingo --app $APP git-setup`

# 2. (Recommended) managed Postgres in the EU
scalingo --app "$APP" addons-add postgresql postgresql-starter-512   # ⚠️ confirm plan name

# 3. Production env vars (DATABASE_URL is already set by the addon — do NOT set it)
scalingo --app "$APP" env-set \
  NODE_ENV=production \
  FOREST_SERVER_URL=https://api.forestadmin.com \
  FOREST_ENV_SECRET=<prod env secret_key> \
  FOREST_AUTH_SECRET=<generated> \
  DATABASE_SCHEMA=public \
  DATABASE_SSL_MODE=required \
  NODE_TLS_REJECT_UNAUTHORIZED=0      # ⚠️ spike-only — disables TLS process-wide; for prod scope SSL to the DB (CA cert), see finding #5

# 4. Deploy (git push — Scalingo builds via buildpack; repo already committed in step 1)
git push scalingo master:main        # Scalingo deploys the remote `main` branch
```

> Default URL format: `https://<app>.osc-fr1.scalingo.io` (⚠️ confirm region subdomain).

## Verify & activate

- Watch the build/run logs for `Schema was updated…` then `Successfully mounted on Standalone server`:
  ```bash
  scalingo --app "$APP" logs --lines 100      # ⚠️ confirm flag
  ```
- The schema push on this **new** prod env sets `apimapVersionId` **and creates the project's first role ("Operations")**.
- **Set the apiEndpoint**:
  ```bash
  forest environments:update -e <prod env id> -u https://<app>.osc-fr1.scalingo.io
  ```
- Confirm: `forest environments:get <prod env id> --format json` → `"isActive": true`.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Build fails / app crashes on boot | wrong Node version or missing `start` | pin `engines.node` in `package.json`; ensure `npm start` (or a `web:` Procfile) boots the agent |
| App doesn't bind / 502 | not listening on `$PORT` | apply the PORT patch (`process.env.PORT \|\| process.env.APPLICATION_PORT`), bind `0.0.0.0` |
| `getaddrinfo ENOTFOUND <forest server>` | `FOREST_SERVER_URL` not public (dev/internal) | use a public Forest server (prod) — finding #2 |
| DB connection refused / SSL | wrong `DATABASE_URL` or SSL mode | use `$SCALINGO_POSTGRESQL_URL`; set `DATABASE_SSL_MODE` |
| Prod panel shows 0 collections | `.forestadmin-schema.json` missing/stale | regenerate (dev boot) + commit + redeploy |
| Auth warning `invalid_redirect_uri … null/...callback` | env `apiEndpoint` not set yet | `forest environments:update -e <id> -u <url>` then restart |

## Redeploy after a change

`NODE_ENV=production` serves the committed schema. After ANY change: regenerate `.forestadmin-schema.json` (dev boot / `forest schema:update`) → commit → `git push scalingo master:main` (the `:main` refspec is required — Scalingo only deploys the remote `main` branch).

## Fail-fast

- 🟥 Build failure, or prod never reaches `isActive` after a reasonable timeout → stop with the logs.

## Cleanup (for test/dry runs)

`scalingo --app <app> apps-destroy` (⚠️ confirm command; may prompt to type the app name) · the managed Postgres addon is removed with the app · then delete the Forest project if throwaway (`DELETE /api/projects/:id`).
