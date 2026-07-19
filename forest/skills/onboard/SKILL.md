---
name: onboard
description: >
  Onboard onto Forest Admin end-to-end, headlessly (no UI), Standalone-first.
  Use this skill when someone wants to "set up Forest Admin from scratch",
  "connect my database to Forest Admin", "build an internal back-office without
  the wizard", "just see Forest Admin running" (zero-DB demo), or go from login
  to a deployed production back-office with an invited team. It orchestrates the
  CLI (toolbelt) and the sibling skills (boot-standalone-agent, deploy-heroku)
  and hands off customizations to the forest-code skill.
---

# Forest Admin — headless onboarding (orchestrator)

Drive the whole Standalone onboarding from the terminal, in the **validated order**, owning waits, errors and the human checkpoints. You collect intent as **arguments** — never run a wizard.

Two principles run the whole skill:

- **Skills decide, the CLI executes.** Every step is a thin layer over a deterministic `forest` command.
- **The dev flow is bounded.** It runs *to a clear finish* — a working back-office on the user's machine — and then **stops**. Production, deploy and invites are **opt-in extensions behind that stop**, never the default continuation. Reaching the finish and asking "want more?" is success; sliding into deploy unprompted is the failure mode this skill exists to prevent.

## Welcome & tone (how to open)

Make this feel like a **guided setup**, not an interrogation. Narrating checks is *not* a wizard — you're showing your work, not asking the user to drive.

1. **Greet + frame** in 1–2 lines before any check, e.g.:
   > 👋 Welcome to Forest Admin! I'll get you a working back-office on your data. First I'll check the few tools we need, then we'll go step by step — I'll handle anything that's missing.
2. **Run the preflight as a visible checklist**, each item resolving live (✓ / fixing…):
   ```
   Checking your environment:
     node / npm   ✓  v22
     forest CLI   ✓  5.13        (or: missing → installing it for you…)
     git          ✓
     Forest login ✓  you@org.com (via `forest user`; or: let's log you in)
   ```
   When something's missing, **say what you're doing about it**, fix it (🟩 REMEDIATE), then re-show the line as ✓. Never dump a raw error and stop if you can remediate.
3. **Match the voice to the persona:**
   - **Ops** — warm, plain, zero jargon; give the *why* in a few words ("so your back-office can talk to Forest"). Celebrate milestones ("Nice — your back-office is starting up ⏳", "🎉 it's live").
   - **Dev** — concise and technical; the checklist can be terse.
4. **At each gate/checkpoint**, say in one line *what's happening and why* before pausing — especially before anything outward-facing.

## Stay on rails (read first — this is the #1 quality bar)

The flow only works if you run **the flow's commands and nothing else**. Improvised exploration is what makes onboarding feel slow, noisy and untrustworthy.

- **Run only the commands the chosen flow calls for.** No `list`/`describe`/`get` "just to look around", no re-listing environments you already resolved, no introspecting collections you don't need.
- **One command per need.** If a piece of data is already in hand (an id you resolved, a value the user gave), reuse it — don't re-fetch.
- **If you catch yourself about to "check something" that no upcoming step requires, don't.** Move to the next flow step instead.
- Every command you run should map to a step below. If it doesn't, it's drift.

## Running the CLI — the command contract (follow for EVERY `forest` call)

The goal is **zero self-inflicted misfires** (a prompt you triggered, a guessed id, a wrong-flow command). Genuine externalities — DB unreachable, build failure — are 🟥 fail-fast, not misfires. For every mutating command, in order:

1. **RESOLVE inputs** — never guess. Ids come from `forest environments --format json` (parse `id`/`name`/`type`; dev env is `type: development`). Names (team/role) are passed verbatim.
2. **VERIFY the precondition** — the relevant gate is satisfied (boot before any env op; deploy before invite), the DB is reachable, `node_modules/@forestadmin` is populated, etc.
3. **BUILD with every flag up front** — from the command card below, so the CLI never needs to prompt.
4. **EXECUTE wrapped** — `bash -c '… </dev/null 2>&1'`. Two proven reasons: (1) a broken zsh `command_not_found_handler` (e.g. `mise`) can **swallow `forest`'s stdout** — `bash` bypasses it; (2) `</dev/null` stops the CLI **hanging on an interactive prompt** (it fails fast instead). Don't rely on `timeout` — often absent on macOS.
5. **NEVER hand-answer a prompt.** A prompt means a flag is missing — add it and re-run. It is a bug in the card, never something to type through.
6. **CLI-only surface — never the private HTTP API.** This skill drives supported `forest`/`heroku` commands and nothing else. When there's **no CLI command** for what's asked (e.g. deleting a project — `projects` only has `create`/`get`), **point the user to the UI**; do **not** improvise a `curl` against the private API.

**Prompt-triggers → the flag that silences them** (the cards already include these):

| Command | Prompt you'll hit | Flag(s) to always pass |
|---|---|---|
| `projects:create:sql` | "What's the IP/hostname…" | `-H http://localhost -P 3310` |
| `projects:create:nosql` | hostname; **and `-s` does NOT exist here** | `-H http://localhost -P 3310` (Mongo uses `--mongoDBSRV`, **never `-s`**) |
| `layout:apply` / `layout:pull` | "Select the team/environment" | `-e <env name|id> -t Operations` (+ `-f` to apply) |

- **Project naming** — default to a unique name to dodge collisions (a name stays **reserved even if creation failed**): `forest-implem-<random>` (dev) / `forest-demo-<random>` (ops). Only use a custom name the user volunteered.
- **Noise to ignore**: `forest` may print `Warning: Could not find typescript … Falling back to compiled source` — harmless.

## Secrets & credentials (never echo to the model)

The most dangerous secret here is the **database connection URI** — it carries your real DB password (full data access). `FOREST_ENV_SECRET`/`FOREST_AUTH_SECRET` are lower-risk (Forest-scoped, tool-generated).

**Hard rule: a secret must never enter the model's token stream** (everything Claude emits goes to provider logs + transcript). Secrets travel **by reference, never by value**:

- **DB URI → `.env` first.** Before creating anything in the dev flow, have the **user** write the connection into a `.env`:
  ```
  DATABASE_URL=postgres://…
  DATABASE_SCHEMA=public
  DATABASE_SSL_MODE=required
  ```
  Then source it and pass it by reference: `set -a; . ./.env; set +a` → `forest projects:create:sql -c "$DATABASE_URL" …`. The shell expands `$DATABASE_URL`; Claude only ever emits the **variable name**.
- **Never** ask the user to paste the URI into the chat, **never** `cat`/print a `.env`, **never** put a secret in a command literal or in the final recap.
- **Reading a secret back** (e.g. the prod `secretKey`): pipe it, don't print it — `forest environments:get <id> --format json | jq -r .secretKey | …` straight into `heroku config:set`, so the value never lands in the model's context.
- Fallback channel: the CLI's own **interactive prompt** (user types into their TTY) — even safer than env vars (no argv/`ps` exposure either).
- A hand-rolled root `.env` **must be gitignored** (else it ships via `git push heroku`).

## Two flows (choose at the start)

Frame the onboarding around **who the user is and whether they have a database** — not a technical toggle.

- **Dev flow — "I have a database, I want to build."** A developer connecting Forest to their own data → `forest projects:create:sql` / `:nosql`. The **core** goes: real DB → boot → **see your data** → stop. From there, layout / customizations / production-deploy / invite are **opt-in extensions** (see *Dev flow* below). The dev DB and the prod DB can differ.
- **Ops flow — "I have no database, I want to explore."** Someone evaluating Forest, no DB / no Docker → `forest projects:create:demo` scaffolds an agent on a **self-contained fintech demo datasource** + ships a curated layout file. Boot → apply layout → explore locally. Data is ephemeral; no production, no invites.

**Routing rule: no reachable database ⇒ ops/demo flow** (never block on "no DB"). If the user has a DB and wants their real data, it's the dev flow. Ask which fits; if they're unsure or DB-less, start the ops flow.

> These mirror the two Linear projects: *Headless onboarding · CLI & orchestration* (dev) and *Headless onboarding for ops* (ops).

### Ops flow — defaults (do NOT ask, just proceed)

The ops persona **explores**; they are not a developer. Minimise questions and jargon:
- **Language**: always **TypeScript** — never ask.
- **No production, no deploy, no invites** — never even bring them up. Ops = explore locally and stop.
- **Layout + workflows are applied automatically** (unlike the dev flow): `create:demo` ships a curated `forest-layout.json` **and** the workflows' BPMN sidecars — the ops user won't curate them, so apply them for them after boot with `--with-workflows`.
- **Project name**: default to a **unique** `forest-demo-<short random suffix>` (e.g. `forest-demo-7f3k`). Only use a custom name if the user volunteered one.
- **Everything non-interactive** — pass *all* flags so the CLI never prompts. **If a prompt appears, you forgot a flag.**
- **Plan recap in plain language** — no "GATE 1 / apimap / schema". Say what the user gets, e.g.:
  > 1. Build your demo back-office (sample fintech data, no setup). 2. Start it. 3. Apply a clean, ready-made layout. 4. Give you the link to open and explore.

## Collect intent (arguments, not a wizard)

- flow (dev / ops) · use-case / app name · language *(dev flow only — ops is always TypeScript)*.
- **(dev flow) dev database** connection — collected via a **`.env` the user writes** (`DATABASE_URL=…`), not pasted in chat (see *Secrets & credentials*). May be a **local** DB (`localhost` / Docker).
- **Do NOT ask about production, deploy, or invites up front.** In the dev flow those are decided **at the milestone** (after the user has seen their back-office working), not collected at the start — asking early is what pulls the run off the rails. The only exception: if the user *volunteers* "I want to deploy", note it and still run Segment 1 first.

---

## Dev flow — the path

Two segments with a hard boundary. **Segment 1 runs to completion by default. Segment 2 only happens behind the milestone STOP.**

### Segment 1 — Core (default; run to the finish)

1. **Account** — check auth with **`forest user`** (it prints the logged-in email). If it shows no session: `forest login`; if the user has no account, sign up in the **web UI** first (https://app.forestadmin.com — email verification + ToS live there; **there is no CLI signup**), then `forest login`. Token persists across commands.

2. **Project + dev env** — **`.env` first** (secret-safe): have the user write `DATABASE_URL`/`DATABASE_SCHEMA`/`DATABASE_SSL_MODE` into a `.env`, then `set -a; . ./.env; set +a`. Then **use the matching card** (the URI is passed **by reference**, never inlined):
   - **SQL** (`-s` is valid here):
     ```bash
     forest projects:create:sql forest-implem-<random> \
       -c "$DATABASE_URL" -l <javascript|typescript> \
       -s "$DATABASE_SCHEMA" --databaseSslMode "$DATABASE_SSL_MODE" \
       -H http://localhost -P 3310
     ```
   - **NoSQL / Mongo** (⚠️ **no `-s`** — passing it errors; use `--mongoDBSRV` if the URI needs SRV):
     ```bash
     forest projects:create:nosql forest-implem-<random> \
       -c "$DATABASE_URL" -l <javascript|typescript> \
       --databaseSslMode "$DATABASE_SSL_MODE" \
       -H http://localhost -P 3310
     ```
   Always pass `-H http://localhost -P 3310` (else it prompts for hostname). This creates the project, the **dev environment**, the agent scaffold and the project's `.env`. **Never** use legacy `forest projects create` (forest-express v1).

3. **Boot the dev agent** → use the **`boot-standalone-agent`** skill (it runs the agent in the background, captures the log, and polls for readiness). The agent pushes its schema → dev env active.
   - 🚧 **GATE 1**: an environment must have pushed its apimap here, otherwise later steps are refused (*"Please finalize the configuration…"*).

4. **🎉 Milestone — "your back-office is live"** (this is the finish line of the core):
   - **Prove it, don't just assert it.** Confirm the schema was pushed (the boot log line, or `forest environments:get <dev env id> --format json` → `isActive`) **and** that collections actually surface — the proof a dev cares about is *seeing their tables*, not an `isActive` flag.
   - **Surface the link** — the back-office is `https://app.forestadmin.com/<project-name>`. ⚠️ The localhost/Heroku URL is the **agent backend**, never the back-office — don't present it as the thing to open.
   - **Be honest about what this is:** it runs **on the user's machine, for them only**, and stops when they stop the process. That honesty is what makes the deploy option meaningful — don't oversell local as production.
   - **STOP here.** Present a short, finite menu and **run nothing** until the user picks:
     ```
     🎉 Your back-office is live and reading your real data → https://app.forestadmin.com/<project>
        (it's running on your machine, just for you)

        From here, just tell me what you'd like — for example:
          · "build a screen"        → I'll compose a workspace (a list + detail panels, charts, action buttons)
          · "automate something"    → I'll wire a workflow (an approval or escalation flow on a collection)
          · "tidy up how it looks"  → rename/hide fields, organise the sidebar, a quick cleanup pass
          · "put it in production"   → deploy it so your team can use it (this unlocks inviting teammates)
        …or you're good for now — your call.
     ```
     *(These are ask-driven — the user just describes what they want and you route to the right skill:
     "build a screen"/"tidy up" → `layout`, "automate" → `workflows`, "deploy"/"invite" → deploy path.
     Surfacing them here is how the user discovers capabilities that have no slash command.)*

### Segment 2 — Opt-in extensions (only after the user chooses at the milestone)

- **A. Layout (offered, never automatic in the dev flow).** A fresh back-office shows everything — foreign keys, audit timestamps, secret columns. Two honest options, the user picks:
  - **In the app** — layout is fundamentally visual and the UI has the feedback loop; this is the natural place to arrange it.
  - **As code (if they ask me to)** — a conservative denoise pass via `layout:pull`/`layout:apply`, producing a versioned `forest-layout.json`. Because there's no visual feedback loop here, keep it **rules-based and conservative**: hide **foreign keys** (`*_id`), **audit timestamps** (`created_at`/`updated_at`/`deleted_at`) and **secrets** (`password`/`hash`/`token`/`secret`/`encrypted`); **keep visible** business identifiers (`public_id`, `external_id`, `slug`, `reference`, `*_number`). **Don't** reorder columns or pick a record title blind — that needs the UI. Steps: `forest layout:pull -e <env name|id> -t Operations` → edit `forest-layout.json` → `forest layout:apply forest-layout.json -e <env name|id> -t Operations -f`.
  - 🚧 Layout requires **boot first (GATE 1)** — `layout:apply` is rejected until the agent has pushed its schema.

- **B. Customizations** → hand off to the **`forest-code`** skill (actions, fields, hooks, segments). After any customization, **regenerate `.forestadmin-schema.json` + commit + redeploy** (production reads the frozen schema) — see `deploy-heroku`.

- **C. Go-to-prod (deploy → invite).** Only if the user chose to make it real for their team. *(A returning user who already has a booted dev project — i.e. is past Segment 1 in a fresh session — should enter here directly via the **`/forest:deploy`** command, which resolves the existing project/prod-env instead of re-creating anything. Never re-run Segment 1 for them.)*
  1. **Production environment** — `forest environments:create --type production -n Production` (URL may be omitted; created **inactive**, **no role yet**).
  2. **Collect the production database here** (not earlier): it **may differ from dev** and **must be remotely reachable** (a local dev DB will NOT work from a PaaS). Ask same-as-dev (only valid if dev is already remote) vs a dedicated prod DB; capture that prod `DATABASE_URL` **separately**. 🟦 If same DB, warn that admin actions hit real production data.
  3. **Deploy** → use the **`deploy-heroku`** skill: push the agent code with the **production** `FOREST_ENV_SECRET`. The agent pushes its schema to prod → `apimapVersionId` **+ the first role ("Operations") is created here**. Set `apiEndpoint` (`forest environments:update -e <id> -u <url>`) → `isActive: true`.
     - 🚧 **GATE 2**: the **first role is created by this deployment** — so **inviting before deploying fails** ("No role found"). There is **no pre-deploy shortcut**: `forest roles:create` also refuses without a production env (verified live). Deploy first, then invite.
  4. **Re-apply the layout to prod** *(if the user did the code layout in A)* — replay the same versioned file: `forest layout:apply forest-layout.json -e <prod env id> -t Operations -f`. Since the artefact already exists, prod layout is nearly free.
  5. **Surface the prod back-office link** `https://app.forestadmin.com/<project-name>` before inviting.
  6. **Invite the team** — `forest users:invite -e <email> -l <level> [-r <role>] [-t <team>]` (`-e` repeats for several users; resolves role/team **by name**). 🟦 sends real emails. **This step lives here, downstream of deploy — never offer it as a standalone milestone option.**

---

## Ops flow — the path

Linear and short; no segments, no stop-and-ask beyond the plan recap.

1. **Account** — `forest user` / `forest login` as above.
2. **Project + dev env** — fully non-interactive: `forest projects:create:demo forest-demo-<suffix> -l typescript -H http://localhost -P 3310`. Always pass `-H`/`-P` (localhost) so it **never prompts for hostname**. No DB, no `.env`.
3. **Boot** → `boot-standalone-agent` (demo scaffold: in-memory datasource, no `.env`). 🚧 GATE 1.
4. **Apply the curated layout + workflows** (auto, on the dev env, after boot): `forest layout:apply forest-layout.json --with-workflows -e <dev env id> -t Operations -f`. `create:demo` ships the layout file **and** the workflows' BPMN sidecars (`workflows/<id>.bpmn`) but does **not** apply them — don't skip, or the back-office is uncurated and its workflows 404. `--with-workflows` re-uploads each sidecar to this project's own bucket and links it (a plain apply would leave the workflows without a runnable BPMN).
5. **Done** — give the link `https://app.forestadmin.com/<project-name>` and stop. No prod, no invites.

## Output (end of run)

The **back-office** is always `https://app.forestadmin.com/<project-name>` — that is the link to give the user. The localhost/Heroku URL is the **agent backend**, never the back-office.

- **Ops flow** — keep it plain and end on the link: *"Your demo back-office is live — open `https://app.forestadmin.com/<project-name>` to explore."* No env-vars block, no technical ids, no jargon.
- **Dev flow (core)** — end on the milestone menu (above). Don't dump a technical summary unless asked.
- **Dev flow (after deploy)** — a concise summary: projectId, dev (& prod) environment ids, the **production env-vars block** (`FOREST_ENV_SECRET`, generated `FOREST_AUTH_SECRET`, `DATABASE_URL`), what is live, the **back-office link**, and any remaining manual steps.

## Notes

- **Readiness**: local = the agent log line `Successfully mounted on Standalone server`; remote = poll `forest environments:get … --format json` (`isActive = apimapVersionId && apiEndpoint`).
- **CLI surface (audited)**: `login`, `user`, `projects:create:demo|sql|nosql`, `environments`(+`:create|update|get|delete|reset`), `users:invite`, `roles:create`, `layout:pull|apply`, `schema:update|apply|diff`, `teams:*` are in the toolbelt (`main`). Flag notes: `projects:create:nosql` has **no `-s`** (Mongo uses `--mongoDBSRV`); `environments`/`environments:get` take `--format json`; `environments:delete`/`layout:apply` use `-f`/`--force`; for `layout` commands, `-e` is `--env` (name **or** id) while `environments:update` `-e` is `--environmentId` (id). **Not in the CLI at all:** `signup` (account creation stays in the web UI). If `forest teams` errors with "Command not found", update the CLI (`npm i -g forest-cli`).
- Concepts grounding: see `references/concepts.md` for the minimal vocabulary.

## Companion plugins (auto-installed, degrade gracefully)

This plugin **declares `forest-code` and `forest-docs` as dependencies** (see `plugin.json`), so on a modern Claude Code they are installed alongside it — the handoff is seamless. If a companion is somehow absent, degrade gracefully.

| Need | Use | If not installed |
|---|---|---|
| **Write customizations** (actions, fields, hooks, segments…) | **`forest-code`** plugin | Recommend installing `forest-code`; do not hand-roll customization code. |
| **Product questions** ("what is X", how a feature works) | **`forest-docs`** plugin (MCP → live docs) | Answer from `references/concepts.md`; point to https://docs.forestadmin.com. |

After any `forest-code` customization, run the **redeploy loop** (regenerate `.forestadmin-schema.json` → commit → redeploy) — see the `deploy-heroku` skill. `forest-code` writes the code; **it does not redeploy** — that is this plugin's job.
