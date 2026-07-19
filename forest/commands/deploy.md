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

## 3. Hand off to onboard's go-to-prod (Segment 2 C)

Project and dev env resolved, run the **onboard** skill's **Segment 2 C** — it is the **single source of truth** for the go-to-prod sequence and owns every gate, checkpoint and secret-by-reference rule. Do **not** re-derive the steps here; the sketch below is just the map:

1. **Production env** — reuse the existing `type: production` env if there is one; else `forest environments:create --type production -n Production -p <projectId>`.
2. **Production DB** (🟦) — via a `.env` the user writes/sources, never pasted; must be remotely reachable (a local dev DB won't work from Heroku). Warn if it's the same DB as dev.
3. **Deploy** → the **`deploy-heroku`** skill (PORT patch, IPv4 pooler, billed team, committed schema, prod `FOREST_ENV_SECRET` piped by reference), then set `apiEndpoint` → `isActive: true`. 🚧 **GATE 2**: this deploy creates the project's **first role** — inviting only works after it succeeds.
4. **Surface + invite** — give the back-office link `https://app.forestadmin.com/<project-name>` (⚠️ never the Heroku URL); replay `forest layout:apply forest-layout.json …` on prod if the user curated one; then **offer** (don't force) `forest users:invite` — 🟦 real emails.

🟥 Fail-fast on a build failure, prod never reaching `isActive`, or an unreachable prod DB — stop with the logs (see `deploy-heroku` troubleshooting); never loop silently.
