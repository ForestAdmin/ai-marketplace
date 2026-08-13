# Topology — splitting the three bricks and exposing only what must be public

Read this when the default (all three bricks in the agent process) does not match their network
constraints, or when someone needs to know exactly what talks to what before opening a firewall.

## Who calls whom

```
INBOUND                            BRICK                    OUTBOUND
──────────────────────────────────────────────────────────────────────────────────────
user's browser            ──►  BACKEND (agent)        ──►  their database
(private network / VPN)                               ──►  Forest API — egress only:
                                                           schema push, permissions, SSE

the agent only, proxied   ──►  RUNTIME (executor)     ──►  the agent (data layer)
via /_internal/executor/*                             ──►  its own state database

LLM infrastructure        ──►  MCP SERVER             ──►  the agent (data layer)
(public, unless the LLM
 runs on their own infra)
```

Consequences worth stating explicitly to an ops team:

- **The only inbound traffic the backend needs is from the browsers of their own users.** One
  caveat worth knowing rather than discovering: the agent also exposes
  `POST /forest/scope-cache-invalidation`, an inbound hook that refreshes scopes without waiting
  for the cache to expire. With `instantCacheRefresh` (the default) that invalidation arrives over
  the agent's **own outbound** SSE connection instead — which is why the cache duration is set to a
  year in that mode — so a backend unreachable from the public internet still refreshes.
- **The runtime is addressed only by the agent.** Its URL only has to resolve *from the agent*.
- **The MCP server calls the agent**, not the database directly — so a public MCP brick does not
  imply a publicly reachable database or backend.

## Egress the agent needs (even when fully private)

To their `forestServerUrl` — `https://api.forestadmin.com` unless overridden:

| Why | What the payload actually contains | When |
|---|---|---|
| Schema hash check | a hash of the schema file | before each push — an unchanged schema is not re-sent |
| Push the schema (apimap) | collection, field, relation, action and segment **structure**: names, types, options | every boot, unless `skipSchemaUpdate` |
| Fetch permissions, scopes, rendering data, IP-whitelist rules | inbound — nothing of theirs goes out | on demand, cached |
| SSE event stream | inbound — permission/scope invalidation events | continuously, when `instantCacheRefresh` is on (the default) |

**No row from their database is in any of those payloads.** Records go database → agent → the
user's browser and nowhere else.

The one exception to know about, because it is easier to state than to discover: the **MCP brick**
posts activity logs to Forest (`createMcpActivityLog`) describing AI activity — action, collection
name, optional label, rendering id, and the **primary keys** of the affected records, stringified.
Identifiers and the operation, never field values. The agent brick (`@forestadmin/agent`) emits no
activity log at all, so this surface exists only once AI access is enabled.

Blocking egress does not degrade quietly: expect a boot failure, or permissions that only refresh
when the cache expires. If their policy forbids a long-lived outbound connection, that is the
conversation to have — set `instantCacheRefresh: false` and a
`permissionsCacheDurationInSeconds` they accept, and know that permission changes then take up to
that long to apply.

## Exposing MCP while the backend stays private

Two ways. The second is cleaner whenever the exposure requirements genuinely differ.

### Option A — one process, selective reverse proxy

Group the MCP routes under a path so a proxy can publish just those:

```ts
agent.mountAiMcpServer({
  basePath: '/ai',
  allowedOAuthClients: ['dust.tt'],
  enabledTools: ['describeCollection', 'list', 'listRelated'],   // read-only
  tokenTtl: { accessTokenSeconds: 900, refreshTokenSeconds: 86400 },
});
```

⚠️ **`basePath` does not move everything.** OAuth **discovery metadata stays at the origin root**
(prefix-suffixed), so root `.well-known` traffic must still reach the agent. A proxy publishing
`/ai` alone will let **no** MCP client authenticate — it will look like a broken integration, not a
misconfigured proxy. Publish the root `.well-known` paths too.

### Option B — MCP as its own process

```bash
npx forest-mcp-server        # from @forestadmin/mcp-server
```

Configured by environment: `FOREST_AGENT_URL` (where the agent lives), `FOREST_ENV_SECRET`,
`FOREST_AUTH_SECRET`, plus the optional `FOREST_MCP_ENABLED_TOOLS`,
`FOREST_MCP_ALLOWED_OAUTH_CLIENTS`, `FOREST_MCP_ACCESS_TOKEN_TTL_SECONDS` and
`FOREST_MCP_REFRESH_TOKEN_TTL_SECONDS`.

The public surface is then a separate host, and the backend stays completely private — only the MCP
process needs to reach it.

### Controls to set on any public MCP surface

- **`allowedOAuthClients`** — registered clients matched by the **domain of their redirect URIs**
  (subdomains included); anything else gets `invalid_client`. Unset means any registered client is
  accepted. Note the parser **fails closed**: a value that is set but contains no usable domain
  leaves an empty allowlist and the agent refuses at startup rather than allowing everyone.
- **`enabledTools`** — read-only access is `['describeCollection', 'list', 'listRelated']`. Grant
  create/update/delete and actions only when someone asked for them.
- **`tokenTtl`** — `accessTokenSeconds` cannot outlive the 1h Forest grant; `refreshTokenSeconds`
  bounds the time between two interactive logins, which is otherwise unbounded because Forest
  re-grants the refresh lifetime on every refresh.

## Running the runtime separately

`addWorkflowExecutor()` (in-process) and the `workflowExecutorUrl` option (separate deployment) are
**mutually exclusive** — pick one.

### Embedded (the default)

```ts
agent.addWorkflowExecutor({
  database: { uri: process.env.EXECUTOR_DATABASE_URL },
  agentUrl: 'https://forest.internal.example.com',   // see landmine below
  encryptionKey: process.env.FOREST_EXECUTOR_ENCRYPTION_KEY,
});
```

- ⚠️ **`agentUrl` is auto-derived only on `mountOnStandaloneServer`.** Mounted on Express, Fastify,
  Koa or NestJS, the agent cannot know the host application's address — pass it explicitly or the
  executor cannot reach the data layer.
- `inMemory: true` needs no database but loses runs on restart — never production.
- `port` defaults to `3400` on loopback; the agent proxies to it internally, so nothing else needs
  to reach that port.
- `encryptionKey` (HKDF secret, `openssl rand -hex 32`) encrypts OAuth-protected MCP connector
  credentials at rest. Only needed if those connectors are used — without it their credential
  deposits return 503. **Same value on every instance**, or credentials stored by one instance are
  unreadable by another.

### Standalone

```bash
npx forest-workflow-executor    # from @forestadmin/workflow-executor
```

Environment: `AGENT_URL` (back to the agent), `DATABASE_URL` (run state),
`FOREST_EXECUTOR_ENCRYPTION_KEY` (same on all instances). Then point the agent at it:

```ts
createAgent<Schema>({ ...options, workflowExecutorUrl: 'http://executor.internal:4001' });
```

The agent forwards `/_internal/executor/*` to it verbatim, so the executor inherits the agent's
authentication layer — which is exactly why it needs no exposure of its own, and why its URL only
has to resolve from the agent.

## Redundancy, brick by brick

Availability constraints do not force a different architecture — each brick doubles as it is.

### Backend

N replicas behind a load balancer. **No sticky sessions required**: the Forest session is a JWT in
the `forest_session_token` cookie, verified with `authSecret`, so there is no server-side session to
pin. Requirements: identical `FOREST_AUTH_SECRET` everywhere, and `skipSchemaUpdate: true` on the
replicas with a single push from CI (see the main skill).

Per-replica state to expect, none of it a problem: its own permission/scope cache, and its own SSE
connection to Forest. Cache warm-up is per replica, so a freshly added instance does a few more
permission fetches at first.

### Runtime

Explicitly designed for it. Duplicate execution is prevented **upstream, not locally**: the
orchestrator atomically claims a pending run, and concurrent triggers get nothing back. The
executor's in-flight tracking is a per-instance short-circuit, not a concurrency guard — so do not
rely on it, and do not try to make it the lock.

Requirements:

- **A shared run-state database.** `inMemory: true` keeps state in the process — with two instances
  each sees half the runs and loses them on restart. Never redundant, never production.
- **Identical `FOREST_EXECUTOR_ENCRYPTION_KEY`**, or connector credentials written by one instance
  are undecryptable by the next one to pick up the run.

### MCP

Instances are interchangeable with no shared store: registered OAuth clients are fetched from Forest
(`/oauth/register/<clientId>`) rather than kept locally, and the access and refresh tokens it issues
are JWTs signed with `authSecret`. So an instance can verify and refresh a token another one issued
— **provided `FOREST_AUTH_SECRET` is identical**. Get that wrong across replicas and clients get
`invalid_token` on whichever instance the load balancer happens to pick, which reads as a flaky
integration rather than a configuration error.
