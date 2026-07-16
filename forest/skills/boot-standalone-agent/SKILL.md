---
name: boot-standalone-agent
description: >
  Install dependencies and boot a freshly scaffolded Forest Admin Standalone
  agent locally so it pushes its schema and the development environment becomes
  active. Use right after `forest projects:create:sql/nosql/demo`, when someone
  wants to "start my Forest Admin agent", "run the agent locally", or "see my
  data in Forest Admin". Pairs with the onboard skill.
---

# Boot a Standalone agent (dev)

Brings a scaffolded agent up locally so it pushes its schema → the **dev environment becomes active**. This also satisfies the gate required before creating other environments ("finalize configuration"). Works the same for **real-DB** (`create:sql/nosql`) and **demo** (`create:demo`) scaffolds — the demo just has an in-memory datasource and no `.env`/`DATABASE_URL`.

## Prerequisites (preflight)

- 🟩 REMEDIATE if missing: `node`/`npm` (or ruby), and the generated project directory (with its `.env` for the real-DB scaffold; the demo scaffold has none).
- 🟥 FAIL-FAST (**real-DB scaffold only**): the `DATABASE_URL` in `.env` is unreachable (nothing to serve). The **demo scaffold has no database** — skip this check.

## Show before act

Before running anything mutating, show the **detected stack** (framework, ORM/datasource — or "in-memory demo datasource", database, entry point, port) read from the project files, and get acknowledgement.

> 🔒 **Secrets**: the project `.env` holds the `DATABASE_URL`. Reference it, **never `cat`/print it** — its value must not enter the model's context (see the orchestrator's *Secrets & credentials*).

## Procedure

`npm start` is a **long-running foreground process** — it does not return. Run it in the **background with its output redirected to a log file**, then poll the log for readiness. Never run `npm start` in the foreground (it blocks the whole run).

```bash
cd <generated-project-dir>
npm install                                   # then verify it populated deps (see landmines below)
npm run build                                 # TypeScript scaffold ONLY — `start` runs the COMPILED dist/;
                                              # skip for a JS scaffold (it has no build script)
npm start > /tmp/forest-agent.log 2>&1 &      # background; capture the log
AGENT_PID=$!                                   # keep the pid to stop it later
```

> ⚠️ **TypeScript scaffold** — its `start` script is `node ./dist/index.js`, i.e. it runs the **compiled** output. You **must `npm run build` first**, or `npm start` fails with "Cannot find module './dist/index.js'". (A JS scaffold has no build step — skip it.)

Then **poll the log** until the readiness line appears (or the process dies):

```bash
# re-run a few times; stop when you see "Successfully mounted" or the process has exited
grep -E "Successfully mounted on Standalone server|Error" /tmp/forest-agent.log
kill -0 "$AGENT_PID" 2>/dev/null || echo "agent exited — read /tmp/forest-agent.log for the error"
```

> Run any `forest` command (e.g. the readiness check below) via `bash -c '… </dev/null 2>&1'` — a broken zsh `command_not_found_handler` (mise) can swallow its output, and `</dev/null` avoids hanging on prompts. See the orchestrator's *Running the CLI* note.

> ⚠️ **Demo landmine** — `create:demo`'s bundled install can print "Hooray installation success!" yet leave `node_modules/@forestadmin` **empty**, so `npm start` fails to resolve `@forestadmin/*`. Before booting, **verify** `node_modules/@forestadmin` is populated; if not, **re-run `npm install`** and re-check.

> ⚠️ **TypeScript build landmine (`@types/node` skew)** — the scaffold pins TypeScript `^4.9` but does **not** pin `@types/node`, so `npm install` pulls the latest (v26+), whose `.d.ts` uses syntax TS 4.9 can't parse — `npm run build` then fails with parse errors in `node_modules/@types/node/*.d.ts` (and `skipLibCheck` does **not** skip *parse* errors). Fix in one shot instead of diagnosing: **`npm install --save-dev @types/node@^20`** (matches the Node 22 runtime closely enough), then rebuild. This also breaks the later Heroku build, so pin it here once. *(Root cause is the scaffold; pin proactively right after `npm install`.)*

## Readiness signal

Poll the **log file** for these lines (don't assume — confirm):

```
info: Schema was updated, sending new version (hash: …)
info: Successfully mounted on Standalone server (http://0.0.0.0:<port>)
```

- That means the **apimap was pushed** → the dev env is active. You can stop the process afterwards (`kill "$AGENT_PID"`); the apimap is recorded server-side.
- The **single source of truth** for readiness is this log line — check it first. Only if it's ambiguous, fall back to `forest environments:get <dev env id> --format json` (`isActive = apimapVersionId && apiEndpoint`). Don't flip between the two.

## Notes

- Dev environments have **roles disabled** (`areRolesDisabled`), so **no role is created** at this stage — that happens on production deployment (see `deploy-heroku` / `onboard` GATE 2).
- Fail-fast if the agent exits before mounting (print the error: DB connection, missing deps, port already in use).
