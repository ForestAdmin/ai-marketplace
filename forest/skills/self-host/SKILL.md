---
name: self-host
description: >
  Run a Forest Admin agent inside your own codebase and infrastructure, rather
  than from a freshly scaffolded project on Heroku. Use when someone wants to
  "add Forest to my existing Express/Koa/Fastify/NestJS app", "run the agent in
  Docker / Kubernetes / ECS", "deploy it on our own platform", "connect a
  database that isn't public" (bastion, SOCKS proxy, SSL), "run several instances
  of the agent", or asks what actually has to be exposed — "does Forest need to
  be on the internet", "can we keep it inside our VPN", "where do the MCP server
  and the workflow runtime have to live", "can we split the three bricks". Also
  for "does Forest see our data", "what leaves our network", "make it highly
  available / redundant", "users get logged out randomly", "my schema changes
  don't show in production", "the agent is slow", "the database is under
  pressure", "404 on every Forest route". Node.js agent. Pairs with onboard (the
  scaffolded path) and deploy-heroku (Heroku specifically).
---

# Run the agent on your own infrastructure

The scaffolded path — `forest projects:create:*` then Heroku — is covered by **onboard** and
**deploy-heroku**. This skill is the other case: the agent lives in **their** repository, on
**their** platform, talking to a database that is often **not publicly reachable**.

Two things to get right before anything else: **what actually has to be exposed** (less than people
assume), and **the schema lifecycle** (the reason a self-hosted install "works locally and is empty
in production").

> **Node.js agent** — the right default; features land there first. One exception to check up
> front: if their data model relies on **polymorphic associations** (`commentable_id` +
> `commentable_type`), the Node agent cannot model them and the answer is the Rails agent — see
> *Which agent technology* in **onboard**.

## The three bricks — and what each one has to expose

A Forest installation is three bricks. **In Node all three are mounted in the agent by default**,
because one process is the simplest thing that works — but each is a separate deployable
(`@forestadmin/mcp-server` ships a `forest-mcp-server` binary, `@forestadmin/workflow-executor`
ships `forest-workflow-executor`). Splitting them later is a network decision, not a rewrite.

Their exposure requirements are **not** the same, and this usually surprises a security team in the
good direction:

| Brick | Who calls it (inbound) | Exposure it needs |
|---|---|---|
| **Backend** — the agent: data, CRUD, actions, charts | **The user's browser.** The Forest UI runs client-side and calls the agent directly | Reachable from the browsers of the people using it — **a private network or VPN is enough. It never needs a public address.** |
| **Runtime** — the workflow executor | **Only the agent**, which proxies `/_internal/executor/*` to it. It calls out to the agent and its own state database | **None. Not even on the VPN.** |
| **MCP server** — AI/LLM access to the data | **The LLM's infrastructure** | **Public** — unless they run their LLM on their own infra, in which case it stays as private as the rest |

Say this early to anyone worried about opening their network: the bricks that touch their data can
stay entirely inside it. Only the AI brick has a reason to be public, and only if the LLM belongs
to someone else.

### Their data never goes to Forest — only metadata

This is the sentence a security team actually wants, and it is worth being precise about:

- **What the backend sends out**: the **schema** (collection, field, relation and action
  *structure* — names and types), preceded by a hash check so an unchanged schema is not even
  re-sent. That is metadata about the shape of their database, not its contents.
- **What it fetches back**: permissions, scopes, rendering data, IP-whitelist rules, and the event
  stream. All inbound.
- **Records never cross.** Row data travels database → agent → **the user's browser**. It does not
  transit through Forest's servers, and it is not stored there.

⚠️ One precision so nobody is caught out later: **activity logs**. The **MCP brick** reports AI
activity to Forest — the action, the collection name, an optional label, and **the primary keys of
the affected records**. Identifiers and the operation, never field values. The backend brick emits
none of these, so this only applies once AI access is enabled.

⚠️ **Private is not isolated.** Even fully private, the agent needs **egress** to Forest: schema
push at boot, permission fetches, and — with `instantCacheRefresh` (default) — an SSE connection
for instant permission and scope refresh. Allow outbound to their `forestServerUrl`
(`https://api.forestadmin.com` by default). Blocking it gives a boot failure or stale permissions,
never a silent success.

→ Splitting the bricks, exposing MCP while the backend stays private (and the OAuth discovery
landmine that comes with it), running the runtime separately, and redundancy brick by brick:
**`references/topology.md`**.

## Before the first line of code

This skill starts once a **Forest project and environment exist** — that part is **onboard**'s job
(or the UI). Note that `forest projects:create:*` always *scaffolds a new project*: for an existing
repository, take the environment's secret and wire the agent in by hand instead.

```bash
npm install @forestadmin/agent @forestadmin/datasource-sql
```

```ts
import { createAgent } from '@forestadmin/agent';
import { createSqlDataSource } from '@forestadmin/datasource-sql';

const agent = createAgent({
  authSecret: process.env.FOREST_AUTH_SECRET,
  envSecret: process.env.FOREST_ENV_SECRET,
  isProduction: process.env.NODE_ENV === 'production',
  typingsPath: 'src/forest/typings.ts',   // dev-only, see below
});

agent.addDataSource(createSqlDataSource(process.env.DATABASE_URL));
await agent.mountOnStandaloneServer().start();
```

The first boot **generates** `typingsPath`; from then on, type the agent with the generated schema
(`createAgent<Schema>({…})`, importing `Schema` from that file) so collection and field names are
checked at compile time. Don't hand-write it.

⚠️ **The directory must already exist.** `typingsPath` and `schemaPath` are validated at startup by
checking that their **parent directory** exists — pointing at `src/forest/typings.ts` in a repo with
no `src/forest/` fails immediately with `options.typingsPath is invalid`. `mkdir -p` first, or point
them somewhere that exists.

Boot it, confirm collections appear in the back-office, **then** customize — one file per collection,
imported from a thin agent module. Booting first is what keeps a customization error from being
mistaken for a connection error.

## Choose the shape of the backend brick

| Shape | How | Pick it when |
|---|---|---|
| **Standalone** | `mountOnStandaloneServer(port?, host?)` | The agent should have its own deploy, logs and lifecycle. Cleanest to operate and to reason about. |
| **Mounted on an existing app** | `mountOnExpress` / `mountOnKoa` / `mountOnFastify` / `mountOnNestJs` | Their app is already deployed inside the network that can reach the database, and reusing that pipeline is worth coupling the two. |

⚠️ **Coupling is the real cost of mounting**: every Forest change then rides their release train,
and a Forest boot failure takes their app's process down with it. If releases are slow or gated,
recommend standalone.

> **Show before act** — before editing an existing application, print the **detected stack**
> (framework + version, entry point, port, path prefix or reverse proxy) and get acknowledgement.
> You are about to touch code that serves their users.

When mounting:

- **`prefix` must match the path the outside world actually uses**, including whatever a reverse
  proxy strips or adds. A mismatch is a 404 on every Forest route with a perfectly healthy agent.
- **Mount outside app-level auth or redirect middleware.** The agent authenticates its own routes
  (a signed `forest_session_token` cookie); a global login redirect in front of them breaks the
  Forest authentication callback.
- `agent.start()` is what pushes the schema and mounts the routes — mounting alone does nothing.

## Reach the database

- 🔒 **The connection URI is the dangerous secret** — it carries a real database password. Keep it
  in `.env` and pass it **by reference**: `set -a; . ./.env; set +a` then `"$DATABASE_URL"`. Never
  `cat` a `.env`, never ask for the URI in chat, never inline it in a command.
- **Start read-only.** `SELECT` on the tables in scope is enough to browse and chart the data.
  Write access is a separate, explicit step, taken when actions that write are actually built.
- **TLS**: `sslMode` is `'preferred' | 'disabled' | 'required' | 'verify' | 'manual'`. Managed
  databases usually need `'required'`; `'verify'` when a CA is provided. `'disabled'` needs a reason
  worth repeating to their security team.
- **Private database**: `createSqlDataSource` accepts `ssh` (bastion) and `proxySocks`. If neither
  is available, the agent has to run **inside** their network. 🟥 FAIL-FAST rather than guessing a
  route to the database.
- **Pool and timeouts**: pass `pool` and `connectionTimeoutInMs`. This is production data; an agent
  that exhausts the connection pool gets its credentials revoked.
- **Co-locate.** Same region as the database. Every list view is several round-trips — a
  cross-continent install feels broken even when it is correct.

## Keep the boot cheap

**Scope the collections** at `addDataSource` time, not afterwards:

```ts
agent.addDataSource(createSqlDataSource(process.env.DATABASE_URL), {
  include: ['customers', 'orders', 'invoices'],   // or: exclude: ['audit_log', 'sessions']
});
```

**Cache the introspection** on a large schema — by default `datasource-sql` introspects at every
boot, which is usually the slowest part of startup. Generate it once with `introspect(uri)`, commit
the JSON, pass it back as `{ introspection }`, and regenerate it when the database structure
changes (a stale introspection shows a stale schema).

## Environment and process contract

*(“Runtime” above is the workflow-executor brick; this section is about the agent's own process.)*

| Variable | Rule |
|---|---|
| `FOREST_ENV_SECRET` | One **per Forest environment**, 64 hex characters. A truncated or wrong-environment value fails at startup. Never reuse dev's in production. |
| `FOREST_AUTH_SECRET` | Any long random string (`openssl rand -hex 32`), but it **signs the session cookie** → **identical on every instance**, **stable across deploys**. |
| `DATABASE_URL` | By reference, from the platform's secret store. |
| `NODE_ENV` / `isProduction` | `true` only in production — it changes schema behaviour (below) and stops typings generation. |

⚠️ **The `authSecret` landmine.** Let each replica generate its own value, or rotate it on every
deploy, and users get signed out at random — the most-reported symptom with the least obvious
cause. One stable shared value.

In a container:

- **Port and host need no patching in your own code**: `mountOnStandaloneServer()` already uses
  `PORT` when no port is passed (falling back to `3351`), and binds `::` / `0.0.0.0` rather than
  loopback. Don't hardcode `127.0.0.1` — the platform's health check will never reach it.
  *(deploy-heroku's PORT patch is about the CLI **scaffold**'s entrypoint, not the agent itself.)*
- **Health check**: `GET /{prefix}/forest/` is public and unauthenticated, and answers
  `{"error": null, "message": "Agent is running"}` with 200. Point liveness/readiness probes and
  load-balancer checks there.
- **Graceful shutdown**: call `await agent.stop()` on `SIGTERM`. It drains an embedded workflow
  executor **first**, while the agent it depends on is still serving, then closes the Forest client.

## Production reads a frozen schema — the #1 self-hosted failure

- `isProduction: false` → the schema is rebuilt from the datasources and **written** to `schemaPath`
  (default `.forestadmin-schema.json`) at every boot.
- `isProduction: true` → the file is **read** from disk and pushed as-is. Missing file = hard
  failure: `Can't load .forestadmin-schema.json. Providing a schema is mandatory in production.`

So, in their repo:

1. **Commit `.forestadmin-schema.json`.** It is a build artifact production depends on.
2. **Ship it in the image.** A Dockerfile copying only `dist/` and `package*.json` produces exactly
   the failure above — `COPY .forestadmin-schema.json ./`.
3. **Regenerate + commit after any change** to collections, fields, actions or segments (boot once
   in dev, or `forest schema:update`). The redeploy loop in **deploy-heroku** applies verbatim to
   any platform.
4. **Typings** (`typingsPath`) are written only when `isProduction` is false. Commit them; never
   expect them to appear in production.

## Redundancy — every brick can be doubled

None of the three bricks has to be a single point of failure. Each scales horizontally, and the
requirements are short:

| Brick | Running several instances | Requires |
|---|---|---|
| **Backend** | N replicas behind a load balancer, **no sticky sessions** — the session is a JWT in a cookie, so any replica can serve any request | identical `FOREST_AUTH_SECRET`; `skipSchemaUpdate` on the replicas (below) |
| **Runtime** | Supported by design — duplicate execution is prevented **upstream**: the orchestrator atomically claims a pending run, so concurrent triggers get nothing | a shared run-state database (**never** `inMemory`, which is per-process); identical `FOREST_EXECUTOR_ENCRYPTION_KEY` |
| **MCP** | Instances are interchangeable — registered OAuth clients are fetched from Forest rather than stored locally, and tokens are JWTs, so one instance verifies what another issued | identical `FOREST_AUTH_SECRET` |

**The common thread is `FOREST_AUTH_SECRET`.** It signs the browser session *and* the MCP tokens, so
one identical value across every replica of every brick is what makes the whole thing horizontally
scalable. A per-instance value doesn't fail loudly — it just logs people out and rejects valid
tokens at random.

Each backend replica also keeps **its own** permission cache and **its own** SSE connection to
Forest. That is expected, not a leak: N replicas mean N event streams.

### One schema push, not N

N replicas each pushing a schema on boot is a race for no benefit. On the runtime instances:

```ts
createAgent<Schema>({ ...options, skipSchemaUpdate: true })
```

…and push the schema **once**, from CI or a release step, with the environment's secret in scope:

```bash
FOREST_ENV_SECRET=… forest schema:apply    # reads .forestadmin-schema.json from the cwd
```

`skipSchemaUpdate` is incompatible with the `experimental` no-code options (the agent warns at
startup).

## Monitoring and database pressure

The agent instruments itself through **one channel: the `logger` option**. Wire it into whatever
they already run (Datadog, CloudWatch, pino, Sentry) instead of leaving it on `console` — a
built-in middleware logs every request with its duration and status, and `datasource-sql` can log
**every SQL statement it generates** at level `Debug`.

That log is also the entry point for reducing load on the database: measure first, then remove
requests (`disableCount`, `replaceSearch`), then index — never index from intuition.

→ Route-by-route reference, the logger wiring, capturing generated SQL safely, and the eight levers
that reduce database pressure: **`references/monitoring.md`**.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `options.envSecret is invalid` | not 64 hex chars — truncated, quoted, or from another environment | re-copy the right environment's secret |
| Users logged out at random | `authSecret` differs per instance or changed on deploy | one stable shared value |
| `Can't load .forestadmin-schema.json` | `isProduction: true` and the file was not shipped | commit it, `COPY` it into the image |
| Production shows 0 collections / a stale schema | prod reads the frozen file; nothing regenerated it | regenerate in dev, commit, redeploy |
| Duplicate/oscillating schema pushes | every replica pushes on boot | `skipSchemaUpdate: true` + one `schema:apply` |
| 404 on every Forest route | mounted under a path without a matching `prefix` | align `prefix` with the public path |
| Forest auth callback loops or redirects to the app's login | Forest routes sit behind app-level auth middleware | mount them outside it |
| Platform health check fails, container marked unhealthy | probe on the wrong path, or the agent bound to loopback | probe `GET /{prefix}/forest/`; don't pass `127.0.0.1` as host |
| Boot fails, or permissions stay stale, on a private network | egress to `forestServerUrl` blocked (schema push, permissions, SSE refresh) | allow outbound to `api.forestadmin.com` |
| No MCP client can authenticate, discovery fails | the proxy publishes `basePath` only; OAuth discovery lives at the **origin root** | see `references/topology.md` |
| Customization throws on a missing collection | `include`/`exclude` narrower than the customization | fix the scope, or `ignoreMissingSchemaElementErrors` as a stopgap |
| `options.typingsPath is invalid` / `options.schemaPath is invalid` at startup | the **parent directory** does not exist | `mkdir -p` it, or point elsewhere |
| Boot hangs with no error | the network path to the database, not the agent | connect with a plain client **from the same host** before touching agent code |
| Boot is very slow | introspection at every start on a large schema | cache the introspection |
| Correct but sluggish everywhere | agent and database in different regions | co-locate |
| A list view is slow but the records come back fast | the separate `count` request on a large table | `disableCount()` — see `references/monitoring.md` |
| Search times out, or spikes the database | default search scanning every searchable field | `replaceSearch` onto an indexed column, or `disableSearch()` |
| "It's slow" with no route named | nobody read the request log | read `[status] METHOD path - Xms` first, then optimise the named route |

## Fail-fast

- 🟥 No reachable route to the database (no public access, no bastion, no proxy, and the agent
  cannot run inside their network) → stop and say so. Do not improvise tunnels.
- 🟥 The agent exits before logging `Successfully mounted` → print the error and stop; it is almost
  always the connection, a missing environment variable, or the schema file.
