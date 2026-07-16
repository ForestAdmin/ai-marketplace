---
description: Deploy an existing Forest Admin dev project to production (Heroku) and optionally invite the team
argument-hint: [project name (optional, to disambiguate)]
---

Deploy an **already-existing dev project** to production. This is the dedicated entry point into the **onboard** skill's **Segment 2 C** ("go-to-prod") for someone who has *already* run the dev flow (project scaffolded, agent booted, schema pushed) and now wants to make it real for their team — **without re-running Segment 1**.

This command **never creates a new project**. If there's no Forest scaffold here, it's the wrong command — point the user to `/forest:start` instead.

Follow the **onboard** skill's contracts throughout: *Stay on rails*, the *command contract* (resolve → verify → full-flagged → wrapped → never hand-answer a prompt), and *Secrets by reference* (never echo the prod `FOREST_ENV_SECRET` or `DATABASE_URL`).

## 1. Focused preflight (remediate, then proceed)

- 🟩 **Scaffold present** — the cwd must be a booted dev scaffold: `package.json` depending on `@forestadmin/agent`, a `.env` with `FOREST_ENV_SECRET`, and a `.forestadmin-schema.json`. If `.forestadmin-schema.json` is missing or stale, **boot the agent once in dev to regenerate it** (see `boot-standalone-agent`) — production serves the *committed* schema, so it must exist and be committed.
- 🟩 **Heroku ready** — `heroku` CLI installed, `heroku auth:whoami` authenticated, and a **billed team** available (apps must NOT live in the personal space). Remediate if missing.
- 🟩 **Forest auth** — `forest user` shows a session (else `forest login`).

## 2. Resolve the project (don't guess)

The local `.env` ties the scaffold to its dev env via `FOREST_ENV_SECRET`, but **no CLI command maps that secret to a project** — so resolve explicitly:

1. `forest projects --format json` → parse `id`/`name`.
2. **Exactly one project → use it.** **Several → ask the user which one** (by name; `$ARGUMENTS` may already name it). This is legitimate disambiguation, not a wizard.
3. With the `projectId`, list envs once: `forest environments --format json -p <projectId>`.
   - Confirm the **development** env (`type: development`) exists and is active (sanity check that Segment 1 really happened).
   - **Check for an existing production env** (`type: production`). If one exists, **reuse it** — do NOT create a duplicate. If none, create it in the next step.

## 3. Production environment

- If no production env exists: `forest environments:create --type production -n Production -p <projectId>` (URL omitted → created **inactive**, **no role yet**).
- 🚧 **GATE 2**: the production deployment creates the project's **first role ("Operations")** — so inviting only works *after* this deploy succeeds.

## 4. Collect the production database (🟦 checkpoint)

The prod DB **may differ from dev** and **must be remotely reachable** — a local dev DB (`localhost`/Docker) will NOT work from Heroku. Collect the prod `DATABASE_URL` via a **`.env` the user writes / sources**, never pasted in chat. Ask: same-as-dev (only valid if dev is already a remote DB) vs a dedicated prod DB. 🟦 If same DB, warn that admin actions hit real production data.

## 5. Deploy → activate

Hand off to the **`deploy-heroku`** skill: it applies the validated findings (PORT patch, IPv4 pooler if needed, billed team, committed schema), pushes the agent with the **production** `FOREST_ENV_SECRET` (piped by reference), then sets `apiEndpoint` (`forest environments:update -e <prod env id> -u <url>`) → `isActive: true`. The schema push creates `apimapVersionId` **and the first role**.

## 6. Surface + offer invite

- Give the **back-office** link: `https://app.forestadmin.com/<project-name>` — ⚠️ never the Heroku URL (that's the agent backend).
- *(If the user curated a `forest-layout.json` as code)* replay it on prod: `forest layout:apply forest-layout.json -e <prod env id> -t Operations -f`.
- **Then** offer to invite the team (now unlocked by GATE 2): `forest users:invite -e <email> -l <level> [-r <role>] [-t <team>]` — 🟦 sends real emails. Offer it; don't force it.

## Fail-fast

🟥 Build failure, prod never reaching `isActive`, or an unreachable prod DB → stop with the logs (see `deploy-heroku` troubleshooting); do not loop silently.
