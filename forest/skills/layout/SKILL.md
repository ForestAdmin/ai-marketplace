---
name: layout
description: >
  Build and edit a Forest Admin UI headlessly — collection display (name, icon,
  columns, fields, segments), dashboards & charts, folders, and especially
  workspaces with inter-dependent components (master→detail). Use when the user
  wants to create/modify a workspace, lay out components, wire a record-selection
  dependency, tweak how a collection is displayed, add a chart/dashboard, or
  organise the sidebar — via `forest layout:patch` (direct PATCH, like the front)
  or `forest layout:pull/apply` (versioned file). Workflows are OUT of scope →
  use the `workflows` skill (their behaviour is a BPMN upload, not a layout PATCH).
---

# Forest Admin — layout as code

Edit the UI **headlessly through the `forest layout:*` CLI** — which sends JSON-Patch to the layout API,
exactly like the frontend does when you tweak a collection or a workspace. Two ways in:

- **`forest layout:patch`** — send ops **directly**, one `PATCH` per domain, no round-trip. Best for an
  agent: emit a self-contained patch, get a result.
- **`forest layout:pull` / `diff` / `apply`** — versioned `forest-layout.json` workflow (idempotent).
  Best for bulk/curated layouts and CI.

Scope: the layout-only domains **`layout`** and **`folders`**. Not workflows.

## When to use / not

- ✅ workspaces + components, master→detail dependencies, collection display, charts/dashboards, folders/sidebar.
- ❌ workflows (steps/BPMN) → **`workflows`** skill.
- ❌ data-model / customizations (actions, fields code) → **`forest-code`**.

## Before you build a workspace — clarify first (ask, don't assume)

A workspace is a **designed screen** and you're building it **blind** (no visual feedback). Guessing the
shape burns round-trips and yields the "four lists side by side" anti-pattern. So for anything beyond a
trivial one-field tweak, **ask a few targeted questions before emitting any patch**, then restate the plan
and build only once the user confirms. Don't interrogate — ask the 3–5 that actually change the layout:

- **The job.** What will someone *do* here? (triage a queue · investigate one record 360° · approve/reject
  · monitor KPIs) → this picks the archetype/template.
- **The master.** Which collection is the list you select a record *from*? (the spine of master→detail)
- **The detail.** Once a record is selected, what must appear — which fields/relations, which related lists?
- **The actions.** Which Smart Actions / workflows run on the selected record?
- **Context.** Any KPIs or charts for at-a-glance context?
- **Shape & target.** Preferred layout (master-left/detail-right · master-top/detail-bottom · tabs)? Which
  environment + team?

Then **restate it** ("Master = Alerts; on select → Customer email + Severity fields + Open-alerts KPI + a
Clear-alert button; master-left") and confirm. **Prefer a template** (references) over hand-placing coordinates.

## Two hard gotchas (read before patching)

1. **A `development` environment needs a branch.** Patching a dev env's layout returns
   `422 — a current branch is required`. Either target a **production** env, or create a branch first
   (`forest branch <name> --projectId <id>` — ⚠ `branch` takes `--projectId`, **no `-p` alias**). **Exception:**
   a `create:demo` **dev-only** project (no production env) accepts direct patches — `forest branch` even refuses there.
2. **Read-after-write is eventually consistent.** Right after a patch, an immediate
   `layout:pull` can return a stale view (a just-added component may look missing, then reappear).
   **Retry the verify pull before concluding failure — never trust a single pull.**

## Command contract (every `forest` call)

Same discipline as the `onboard` skill: **resolve** ids from `forest environments --format json`
(never guess) → **build with all flags up front** (`-p <projectId> -e <env> -t <team>`) →
**wrap** `bash -c '… </dev/null 2>&1'` → **never hand-answer a prompt** (a prompt = a missing flag).
Ignore the harmless `Warning: Could not find typescript …`.
**CLI-only surface — never the private HTTP API.** Only drive supported `forest layout:*` commands; when the
CLI can't do something (e.g. inspect a Smart Action's `actionId` — there's no `actions:*` command), read it
from `.forestadmin-schema.json` / `layout:pull`, or **send the user to the UI** — never `curl` the private API.

## Safe protocol

1. Build the ops in `ops.json`. **For a workspace, build incrementally** — shell → master → verify → each
   detail wired to the master → verify — so a failure points at the exact component, not a monolithic batch.
2. **Self-check before sending** — the server won't catch layout mistakes (it returns `204` on overlaps,
   dangling references, ghost ids; they only break at *render*). Run the **bundled linter**
   `node scripts/lint-workspace.mjs ops.json` (overlaps / out-of-bounds / dangling refs / missing required
   keys), then emit a quick **ASCII grid preview** to eyeball placement.
   → details in **[references/workspace-examples.md](references/workspace-examples.md)** (*Pre-send self-check*).
3. **Dry-run** (patch): `forest layout:patch ops.json … --dry-run` → validates paths against the
   whitelist client-side, prints the plan, sends nothing. (`layout:diff` is the read-only preview for the file flow.)
4. Send (drop `--dry-run`, add `-f`/`--force` for apply).
5. **Verify** with `forest layout:pull … -o verify.json` (retry for read-after-write).
6. Every op is reversible (`replace` restores; `remove` deletes). Note the old value before a risky change.

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

## Recipes

> **Verified live:** workspace creation and the collection/field/chart component shapes (Templates A/B
> applied & round-tripped on a real `create:demo` project). Simple collection-display edits below use the
> same `layout` whitelist (see the catalogue); treat anything not marked verified as expected-but-unproven.

### Edit a collection
```json
{ "layout": [
  { "op": "replace", "path": "/collections/accounts/displayName", "value": "Comptes" },
  { "op": "replace", "path": "/collections/accounts/icon",        "value": "star" }
] }
```

### Create a workspace shell (generate a uuid client-side)
```json
{ "layout": [ { "op": "add", "path": "/workspaces/-", "value": {
  "id": "<uuid>", "name": "Support", "icon": "🗂️", "position": 0, "collectionId": null, "components": []
} } ] }
```

### Workspaces — components, master→detail, templates

A real workspace is a **master** list + **detail** panels wired to its selected record, action/workflow
buttons, KPIs and structure — **not four lists side by side**. Everything mechanical lives in one place:

→ **[references/workspace-examples.md](references/workspace-examples.md)** — the 20px grid & per-type sizes,
the full **18-type** palette, the **three ways to wire** a dependency, ready-to-fill **layout templates**
(A: master-left/detail-right · B: master-top/detail-bottom · C/D), a complete worked **"AML review"**
example, **discovering the ids** to wire, and the **pre-send self-check** (lint + ASCII preview).

Facts to carry inline so you don't misfire even without opening the reference:
- `displaySettings.{x,y,width,height}` is a **20px grid**; the server does **not** validate spatial coherence
  (overlaps → `204`, then the front silently reflows them downward), so **lint before sending**.
- A `field` **must** carry `fieldName` (send `null` with a path) and a `chart` **must** carry `description`
  (`null` ok) — omit the key and you `422`.
- Wiring ids (`collectionId`, `actionId`, `workflowId`, field paths) are **derived, not invented** — read
  them from `.forestadmin-schema.json` / a `layout:pull`, never hand-craft the `@@@` form.

### Folders (sidebar) & inboxes

→ **[references/folders-and-inboxes.md](references/folders-and-inboxes.md)** — verified recipes for organising
the sidebar (create a folder, move a collection into it) and for inboxes (the `/inboxes/-` object + the
workspace `inbox` component). Two things that bite: **folders are a top-level `folders[]` key in a pull, not
under `layout`** (grab the main folder id from the `isMain:true` entry), and creating a folder is **atomic**
(add the folder *and* attach it to a parent in one patch). Inboxes are **premium**.

## Reference catalogue

**[references/patterns.md](references/patterns.md)** — the exhaustive, source-generated catalogue
(**249 patterns** across `layout`/`folders`/`workflows` + value schemas from the Joi validators).
Consult it before any non-trivial patch. *(Maintainers regenerate it against the server HEAD via the plugin's
`tooling/generate-reference.js`; that's authoring tooling, not part of this skill.)*

Server rules worth internalising (all in the catalogue): edit a component's options via **fine paths**
(the whole-`options` replace is refused 422); changing a component's `collectionId` or a chart's `type`
needs a `test` op in the same batch; **missing premium pack** (`scopes` / `multipleDashboards` / `inbox`) →
**`402` Payment Required** (a `403` means an insufficient *role*, not premium);
`422 Not-supported patch` = bad path, `422 ValidationError` = Joi (one error at a time → iterate).
