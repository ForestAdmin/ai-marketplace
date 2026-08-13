# Monitoring the agent, and reducing pressure on the database

The agent instruments itself through **one channel: the `logger` option**. There is no built-in
metrics exporter — the logger is the seam, so wire it into whatever they already run.

## Wire the logger once

```ts
createAgent<Schema>({
  ...options,
  loggerLevel: 'Info',                     // 'Debug' only for a deliberate SQL-capture session
  logger: (level, message, error) => appLogger[level.toLowerCase()]({ message, err: error }),
});
```

The signature is `(level, message, error?)`. Levels are `Debug` / `Info` / `Warn` / `Error`, and
`loggerLevel` filters everything below the chosen one.

## Routes

A built-in middleware logs every request with its duration:

```
[200] GET /forest/customers - 43ms
[500] POST /forest/_actions/orders/0/refund/hooks/load - 2104ms
```

The level carries the outcome: **`Info`** below 400, **`Warn`** for 4xx, **`Error`** for 5xx (with
the error object as the third logger argument). One logger therefore gives per-route latency and an
error feed, with no extra instrumentation.

Routes live under **`/{prefix}/forest/…`**. The ones worth a dashboard, because they are what a
screen actually costs:

| Route | Fires when |
|---|---|
| `GET /forest/<collection>` | a list view or a related list loads |
| `GET /forest/<collection>/count` | the **same** list view — pagination counts separately |
| `GET /forest/<collection>/:id` | a record detail opens |
| `POST /forest/stats/<collection>` | **one request per chart** on a dashboard |
| `GET /forest/<collection>.csv` | an export — the heaviest read there is |
| `POST /forest/_actions/…/hooks/{load,change,search}` | an action form opens, changes, or searches |
| `POST /forest/_internal/native_query` | a live query / SQL-backed chart |
| `GET /forest/` | the public health check (`{"error": null, "message": "Agent is running"}`) |

A slow `count` behind a fast list, or a dashboard whose p95 is eight chart requests deep, is a
different problem from "Forest is slow". **Name the route before optimising anything.**

## The SQL the agent generates

`datasource-sql` pipes **every statement it runs** into the same logger at level `Debug`. Set
`loggerLevel: 'Debug'` and the exact generated SQL appears, in order, next to the route that caused
it.

- ⚠️ **Not for permanent production use.** High volume, and statements can embed filter values from
  the data. Turn it on deliberately — locally, or on a staging environment with a production-like
  dataset — capture what you need, turn it back off.
- With **`createSequelizeDataSource`** the user owns the Sequelize instance, so SQL logging is
  theirs to configure (`logging`, `benchmark`); the agent does not override it.
- Under real load the **database's own** instrumentation is the source of truth:
  `pg_stat_statements`, the MySQL slow query log, MongoDB's profiler. The agent tells you *which
  route*; the database tells you *what it cost*.

## Eight levers, in order

Measure, then remove requests, then index. Never index from intuition.

**1. Capture, don't guess.** Reproduce the slow screen with `Debug` on, take the statements, run
`EXPLAIN`. That gives the real WHERE / ORDER BY columns instead of the ones you assume the UI uses.

**2. Delete the request that does nothing for the user.** Every list view fires a second HTTP
request for the total count, and `COUNT(*)` over a large filtered table is often slower than the page
itself:

```ts
.customizeCollection('events', c => c.disableCount())
```

Pagination then works without a total. On collections with millions of rows this is usually the
single biggest win available.

**3. Search is where full scans come from.** The default search spans the collection's searchable
fields. Narrow it to something indexed, or hand it to a real index:

```ts
.customizeCollection('customers', c =>
  c.replaceSearch(search => ({ field: 'email', operator: 'StartsWith', value: search })))
// or, when search has no business there at all:
.customizeCollection('audit_log', c => c.disableSearch())
```

**4. Index what the UI actually filters, sorts and searches on** — plus the foreign keys behind every
relation panel. Watch deep pagination too: `OFFSET` cost grows linearly, so page 400 of a list is not
page 1.

**5. `emulate*` moves work out of the database and into the agent's memory.**
`emulateFieldFiltering`, `emulateFieldOperator` and `emulateFieldSorting` are in-memory **by design**
— convenient on a small collection, a way to pull a lot of rows on a large one. Prefer a real
database capability: index the column, or map the sort onto an indexed equivalent with
`replaceFieldSorting`.

**6. Computed fields are the N+1 factory.** A getter that queries per record turns one list view into
N queries. Compute from the declared `dependencies` (already fetched), or push the work into the
datasource. `getValues` receives **all** the records — one query for the batch, never one per record.

**7. Aggregate in SQL, not in JS.** Charts needing real aggregation belong in a live query
(`liveQueryConnections`), not a JS loop over fetched records.

**8. Cap the heavy reads.** `limitExportSize` for CSV exports, `bodyParserOptions.jsonLimit`
(default `50mb`) for request bodies.

## What to alert on

Nothing here is Forest-specific, but these are the signals that catch real regressions:

| Signal | Why it matters |
|---|---|
| 5xx rate on `/forest/*` | the agent's own error feed — already at `Error` level in the logger |
| p95 duration per route | catches one slow collection instead of averaging it away |
| `count` duration vs list duration on the same collection | the `disableCount` decision, measured |
| Database connections in use vs `pool` max | pool exhaustion looks like a hung UI |
| Boot duration | a growing introspection, or a database that got further away |
