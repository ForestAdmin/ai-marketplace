---
name: layout
description: >
  Build and edit a Forest Admin UI headlessly — collection display (name, icon,
  columns, fields, segments), dashboards & charts, folders, and especially
  workspaces with inter-dependent components (master→detail). Use when the user
  wants to create/modify a workspace, lay out components, wire a record-selection
  dependency, tweak how a collection is displayed, add a chart/dashboard, or
  organise the sidebar — via `forest layout patch` (direct PATCH, like the front)
  or `forest layout pull/apply` (versioned file). Workflows are OUT of scope →
  use the `workflows` skill (their behaviour is a BPMN upload, not a layout PATCH).
---

# Forest Admin — layout as code

Edit the UI by sending JSON-Patch operations to `PATCH /api/:domain`, exactly like
the frontend does when you tweak a collection or a workspace. Two ways in:

- **`forest layout patch`** — send ops **directly**, one `PATCH` per domain, no
  round-trip. Best for an agent: emit a self-contained patch, get a result. *(Ships in PR #796.)*
- **`forest layout pull` / `diff` / `apply`** — versioned `forest-layout.json`
  workflow (idempotent). Best for bulk/curated layouts and CI. *(Already in the CLI.)*

Scope: the layout-only domains **`layout`** and **`folders`**. Not workflows.

## When to use / not

- ✅ workspaces + components, master→detail dependencies, collection display, charts/dashboards, folders/sidebar.
- ❌ workflows (steps/BPMN) → **`workflows`** skill.
- ❌ data-model / customizations (actions, fields code) → **`forest-code`**.

## Two hard gotchas (read before patching)

1. **A `development` environment needs a branch.** Patching a dev env's layout returns
   `422 — a current branch is required`. Either target a **production** env, or create a
   branch first (`forest branch <name> -p <id>`). **Exception:** a `create:demo` **dev-only**
   project (no production env) accepts direct patches — `forest branch` even refuses there.
2. **Read-after-write is eventually consistent.** Right after a patch, an immediate
   `layout pull` can return a stale view (a just-added component may look missing, then reappear).
   **Retry the verify pull before concluding failure — never trust a single pull.**

## Command contract (every `forest` call)

Same discipline as the `onboard` skill: **resolve** ids from `forest environments --format json`
(never guess) → **build with all flags up front** (`-p <projectId> -e <env> -t <team>`) →
**wrap** `bash -c '… </dev/null 2>&1'` → **never hand-answer a prompt** (a prompt = a missing flag).
Ignore the harmless `Warning: Could not find typescript …`.

## Safe protocol

1. Build the ops in `ops.json`.
2. **Dry-run** (patch): `forest layout patch ops.json … --dry-run` → validates paths against the
   whitelist client-side, prints the plan, sends nothing. (File path: `layout diff` is the read-only preview.)
3. Send (drop `--dry-run`, add `-f`/`--force` for apply).
4. **Verify** with `forest layout pull … -o verify.json` (retry for read-after-write).
5. Every op is reversible (`replace` restores; `remove` deletes). Note the old value before a risky change.

## Input format (patch)

A JSON object keyed by domain; each value is an RFC 6902 op array:

```json
{
  "layout":  [{ "op": "replace", "path": "/collections/orders/displayName", "value": "Orders" }],
  "folders": [{ "op": "add",     "path": "/folders/<mainId>/children/-",     "value": { "id": "orders", "type": "collection", "position": 0, "isVisible": true } }]
}
```

Multiple ops = one atomic PATCH per domain (mix `add`/`remove`/`replace`). One invalid op → the
whole domain's PATCH is rejected; isolate risky ops when experimenting.

## Recipes (all verified live)

### Edit a collection
```json
{ "layout": [
  { "op": "replace", "path": "/collections/accounts/displayName", "value": "Comptes" },
  { "op": "replace", "path": "/collections/accounts/icon",        "value": "star" }
] }
```

### Create a workspace (generate a uuid client-side)
```json
{ "layout": [ { "op": "add", "path": "/workspaces/-", "value": {
  "id": "<uuid>", "name": "Support", "icon": "🗂️", "position": 0, "collectionId": null, "components": []
} } ] }
```

### Add a `collection` component
```json
{ "layout": [ { "op": "add", "path": "/workspaces/<wsId>/components/-", "value": {
  "id": "<uuid>", "name": "Accounts", "type": "collection",
  "displaySettings": { "x": 0, "y": 0, "width": 40, "height": 15 },
  "options": { "dataType": "collection", "collectionId": "accounts", "onRowClick": "selectARecord",
    "showSearchbar": true, "showFilters": true, "visibleColumns": [], "filter": null,
    "viewId": null, "segmentId": null, "sortingOrder": null, "sortingFieldName": null,
    "showCreate": false, "showActions": false, "showWorkflows": false, "enableSegments": true,
    "recordsPerPage": null, "relatedDataFieldName": null, "sourceWorkspaceComponentId": null },
  "visibility": { "type": "always" }
} } ] }
```
- Component `name`: `[a-zA-Z0-9-_]` only (**no spaces**), **unique** in the workspace, ≠ `currentUser`.
- `displaySettings` is a **grid** (units, not px); the grid is wide (~28). Avoid overlaps. Plan big (a table ≈ 40×15).

### Master → detail dependency (the heart of a workspace)
A **master** component with `"onRowClick": "selectARecord"` exposes `selectedRecord`. A **detail**
component references it in `options.filter` via `{{<MasterComponentName>.selectedRecord.<field>}}`
(by the master's **`name`**). Same collection → `fieldName:"id"`; via a relation → `fieldName:"<relation>", subFieldName:"id"`.
```json
{ "layout": [ { "op": "add", "path": "/workspaces/<wsId>/components/-", "value": {
  "id": "<uuid>", "name": "AccountBalances", "type": "collection",
  "displaySettings": { "x": 0, "y": 15, "width": 80, "height": 15 },
  "options": { "dataType": "collection", "collectionId": "account_balances",
    "onRowClick": "selectARecord", "visibleColumns": [],
    "filter": { "type": "and", "conditions": [
      { "value": "{{Accounts.selectedRecord.id}}", "operator": "is", "fieldName": "account", "subFieldName": "id", "embeddedFieldName": null } ] } },
  "visibility": { "type": "always" }
} } ] }
```

### Charts / dashboards, segments, inboxes, remove
See the full catalogue — paths, value schemas per chart type, premium packs, business rules.

## Reference catalogue

**[references/patterns.md](references/patterns.md)** — the exhaustive, source-generated catalogue
(**249 patterns** across `layout`/`folders`/`workflows` + value schemas from the Joi validators).
Consult it before any non-trivial patch. Regenerate against the server HEAD with
`references/generate-reference.js` (reads `make-*-patch-patterns.ts` + `validators/models/*` in `forestadmin-server`).

Server rules worth internalising (all in the catalogue): edit a component's options via **fine paths**
(the whole-`options` replace is refused 422); changing a component's `collectionId` or a chart's `type`
needs a `test` op in the same batch; premium gating (`scopes` / `multipleDashboards` / `inbox`) → 403;
`422 Not-supported patch` = bad path, `422 ValidationError` = Joi (one error at a time → iterate).
