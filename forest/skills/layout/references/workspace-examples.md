# Workspaces — component palette, wiring & a full example

A good workspace is **not** four collection lists side by side. Real curated workspaces combine a
**master** list with **detail** panels wired to the selected record, action/workflow buttons, KPIs, and
structure (text, dividers, sections, tabs). The component/option **shapes** below are verified against
curated demo workspaces and against live `layout:patch` runs; the worked-example *assembly* and its
coordinates are ours (Templates A/B applied & round-tripped live — the `action` component's `actionId` is
the one exception, see its note). `layout:pull` a real env to copy more — see the end.

## The grid & sizing (positioning)

`displaySettings.{x,y,width,height}` are **grid cells of 20px each** (not pixels; floats are accepted but use
integers). The authoring canvas is **200 columns × 400 rows**, but **design for ~60 columns** (≈ 1200px, a
normal screen) so the workspace reads without horizontal scroll. In *view* mode the grid **shrinks to fit**
the outermost component.

**⚠️ Overlaps are not an error — they silently reflow.** The server accepts overlapping or oversized
components without complaint (returns `204`); then the front's collision fixer **pushes the offending
component straight down** (`y = other.endsY`) — there is **no horizontal wrap**. So a layout that "worked"
can render as a broken vertical stack. **You must place non-overlapping rectangles yourself** (see
*Pre-send self-check* at the end).

**Per-type default / minimum sizes** (cells) — start from the default, never go below the min:

| type | default w×h | min w×h |
|---|---|---|
| collection | 34×16 | 27×8 |
| section / tabs (containers) | 34×16 | 27×8 |
| chart | 17×11 | 8×6 |
| inbox (premium) | 20×8 | 20×8 |
| field / input | 10×4 | 1×2 |
| search / dropdown | 21×2 | 10×2 / 4×2 |
| text | 7×2 | 1×1 |
| action / workflow | 8×2 | 2×1 |
| divider (horizontal) | 20×2 | maxH 2 |
| divider (vertical) | 2×20 | maxW 2 |

**What the server actually enforces:** `x,y ≥ 0`, `width,height ≥ 1`, `tabs ≤ 10`, tab `position 0–9`,
component `name ≤ 50` and `[a-zA-Z0-9-_]` and `≠ currentUser`, `recordsPerPage 0–500`. **Every other spatial
rule (no overlap, total width, sane sizes) is on you** — the server won't reject a bad layout.

## Component palette (all types, real shapes)

Every component has `{ id:uuid, name, type, displaySettings:{x,y,width,height}, visibility:{type:"always"}, options:{…} }`.
`name`: `[a-zA-Z0-9-_]`, unique in the workspace. Only `options` differs per type:

| type | purpose | key `options` |
|---|---|---|
| `collection` | a live list of records (often the **master**) | `dataType:"collection", collectionId, onRowClick:"selectARecord", showSearchbar, showFilters, showActions, showWorkflows, enableSegments, visibleColumns:[{name,position}], filter, viewId, segmentId, sortingFieldName, sortingOrder, recordsPerPage` |
| `field` | one field of a record (**detail**) | `fieldName` (**required — send `null`** when using a path), `templatedFieldPath:"customer.email", shouldDisplayLabel:true, displayedLabel, widgetEdit, widgetDisplay, sourceWorkspaceComponentId` |
| `chart` | inline KPI / chart | `name, description` (**required — `null` ok**)`, type:"Value"|"Line"|…, aggregator:"Count"|"Sum", sourceCollectionId, aggregateFieldName, filter` (same shapes as dashboard charts — see patterns.md §4) |
| `action` | a Smart Action button | `type:"SMART", actionId, sourceCollectionId, componentToSelectRecordFromId, buttonType, displayedText, templatedBelongsToPath` |
| `workflow` | run a workflow on a record | `workflowId, sourceCollectionId, componentToSelectRecordFromId, buttonType, displayedText` |
| `inbox` | embed an inbox (premium `inbox`) | `inboxIds:[…], collectionId` |
| `text` | heading / instruction / label | `displayedText, fontSize, fontWeight:"normal"|"bold", fontStyle, textAlign:"left"|"center"|"right", color:"inherit"|"#hex"` |
| `divider` | visual separator | `direction:"horizontal", style:"solid", color:"inherit"` |
| `section` | group components in a box | `componentIds:[…]` |
| `tabs` | group components into tabs | `tabs:[{ name, tabId:uuid, position, componentIds:[…] }]` |

These are the **10 types you compose workspaces from**; the server accepts **18** in total (also `link`,
`dropdown`, `date-picker`, `search`, `metabase`, `toggle`, `input`, `smart` — rarely needed here).

> ⚠️ **Verified-live gotcha:** the server requires several option keys to be *present* even when empty — a
> `field` **must** carry `fieldName` (send `null` when you use `templatedFieldPath`), and a `chart` **must**
> carry `description` (`null` ok). Omitting the key → `422 … "fieldName" is required` / `"description" is required`.

## The 3 ways to wire a dependency to a master

The **master** is a `collection` component with `onRowClick:"selectARecord"`. Everything else reacts to
its selected record — via one of three references:

1. **Filtered list** (a detail *list*): `options.filter` uses a template on the master's **name** →
   `"value":"{{Alerts.selectedRecord.id}}"`. Same collection → `fieldName:"id"`; via a relation →
   `fieldName:"<relation>", subFieldName:"id"`.
2. **Field / detail panel**: a `field` component with `sourceWorkspaceComponentId:"<master component id>"`
   and `templatedFieldPath:"<field>"` (relations allowed: `"customer.email"`). Shows that field of the
   master's selected record.
3. **Action / workflow on the selection**: `componentToSelectRecordFromId:"<master component id>"` on an
   `action` or `workflow` component → the button runs against the selected record.

> Note the two id styles: `filter` templates reference the master by **name** (`{{Alerts.…}}`), while
> `field`/`action`/`workflow` reference it by **component id** (uuid).

## Full worked example — "AML review" workspace

A real master→detail screen: a header, an alert list (master), two detail fields following the selection,
a KPI, and a Smart Action button. Generate a uuid for each `id`; `<alerts>` below is the alert list's id.

```json
{ "layout": [ { "op": "add", "path": "/workspaces/-", "value": {
  "id": "<ws>", "name": "AML Review", "icon": "🕵️", "position": 0, "collectionId": null,
  "components": [
    { "id": "<hdr>", "name": "Header", "type": "text",
      "displaySettings": { "x": 0, "y": 0, "width": 60, "height": 2 },
      "options": { "displayedText": "Select an AML alert to investigate", "fontSize": 20, "fontWeight": "bold", "fontStyle": "normal", "textAlign": "left", "color": "inherit" },
      "visibility": { "type": "always" } },

    { "id": "<alerts>", "name": "Alerts", "type": "collection",
      "displaySettings": { "x": 0, "y": 2, "width": 34, "height": 16 },
      "options": { "dataType": "collection", "collectionId": "aml_alerts", "onRowClick": "selectARecord",
        "showSearchbar": true, "showFilters": true, "showActions": false, "showWorkflows": false,
        "enableSegments": true, "visibleColumns": [], "filter": null, "viewId": null, "segmentId": null,
        "sortingFieldName": null, "sortingOrder": null, "recordsPerPage": null, "relatedDataFieldName": null, "sourceWorkspaceComponentId": null },
      "visibility": { "type": "always" } },

    { "id": "<f1>", "name": "SelectedCustomer", "type": "field",
      "displaySettings": { "x": 36, "y": 2, "width": 22, "height": 4 },
      "options": { "fieldName": null, "widgetEdit": null, "widgetDisplay": null, "displayedLabel": null, "shouldDisplayLabel": true, "templatedFieldPath": "customer.email", "sourceWorkspaceComponentId": "<alerts>" },
      "visibility": { "type": "always" } },

    { "id": "<f2>", "name": "Severity", "type": "field",
      "displaySettings": { "x": 36, "y": 7, "width": 22, "height": 4 },
      "options": { "fieldName": null, "widgetEdit": null, "widgetDisplay": null, "displayedLabel": null, "shouldDisplayLabel": true, "templatedFieldPath": "severity", "sourceWorkspaceComponentId": "<alerts>" },
      "visibility": { "type": "always" } },

    { "id": "<kpi>", "name": "OpenAlerts", "type": "chart",
      "displaySettings": { "x": 36, "y": 12, "width": 22, "height": 6 },
      "options": { "name": "Open alerts", "description": null, "type": "Value", "aggregator": "Count", "sourceCollectionId": "aml_alerts", "aggregateFieldName": null, "filter": null },
      "visibility": { "type": "always" } },

    { "id": "<act>", "name": "ClearAlert", "type": "action",
      "displaySettings": { "x": 0, "y": 19, "width": 12, "height": 2 },
      "options": { "type": "SMART", "actionId": "<real actionId>", "sourceCollectionId": "aml_alerts", "componentToSelectRecordFromId": "<alerts>", "displayedText": "Clear alert" },
      "visibility": { "type": "always" } }
  ]
} } ] }
```

> The first **5 components (text → collection → 2 fields → chart) were applied & round-tripped live**
> (this is Template A). The **`action` component is shown for its wiring shape only**: replace `<real actionId>`
> with an id read from `.forestadmin-schema.json` / `layout:pull` (never hand-crafted), and note its
> end-to-end behaviour was **not** verified here.

What this demonstrates: **text** header → **collection** master (`selectARecord`) → two **field** detail
panels following the selection (`sourceWorkspaceComponentId`) incl. a relation traversal
(`customer.email`) → a **KPI** chart → an **action** button wired to the selection
(`componentToSelectRecordFromId`).

## Layout templates (known-good coordinates)

Compose from a validated skeleton instead of computing coordinates — fill in the `collectionId`, field paths
and `actionId`, keep the geometry. All fit in ~60 cols with no overlaps.

### A. Master-left / detail-right (the default review screen)

| component | type | x | y | w | h |
|---|---|---|---|---|---|
| Header | text | 0 | 0 | 60 | 2 |
| Master (list, `onRowClick:"selectARecord"`) | collection | 0 | 2 | 34 | 16 |
| Detail field 1 | field | 36 | 2 | 22 | 4 |
| Detail field 2 | field | 36 | 7 | 22 | 4 |
| KPI | chart (`Value`) | 36 | 12 | 22 | 6 |
| Action on selection | action | 0 | 19 | 12 | 2 |

Details set `sourceWorkspaceComponentId: <master id>`; the action sets `componentToSelectRecordFromId: <master id>`.
(This is exactly the *AML review* worked example above.)

### B. Master-top / detail-bottom (a record + its related rows)

| component | type | x | y | w | h |
|---|---|---|---|---|---|
| Header | text | 0 | 0 | 80 | 2 |
| Master (list, `selectARecord`) | collection | 0 | 2 | 80 | 14 |
| Related list (filtered by selection) | collection | 0 | 17 | 80 | 14 |

The related list filters on `{{<MasterName>.selectedRecord.id}}` (see *The 3 ways to wire a dependency*).

### C. Tabbed case-management · D. single-record console

Master `collection` (x0, w34) beside a `tabs` container (x36, w44, h20) whose tabs group `field`/`chart`/`action`
by `componentIds`; or, for a workspace opened *on one record* (`workspace.collectionId` set), drop the master
and drive details from the `currentRecord` source. Pull a curated demo for the exact `tabs`/`section` shapes.

## Discovering the ids to wire (don't guess)

Wiring ids look cryptic but are **derivable, not inventable**:

- **`collectionId` / `sourceCollectionId`** = the model name "flattened": `/ \ space :` become `@@@`. So
  `public.Order` → `public@@@Order`; a plain `orders` stays `orders`. In a field/action path, `@@@` encodes a
  **belongsTo hop** (rendered `->`).
- **`actionId`** — native Smart Actions get a **UUID** at schema mapping. Read it from `.forestadmin-schema.json`
  (present after a dev boot) or from a `layout:pull` of an env that already uses the action. Don't hand-craft a
  `name@@@suffix` unless you copied it.
- **`workflowId`** — a **UUID**; get it from `layout:pull --with-workflows` or the id returned by `forest workflow:apply`.
- **`templatedFieldPath` / `fieldName`** — real field names & relation paths from `.forestadmin-schema.json`
  (or a `layout:pull` of a similar env).

The server validates these **permissively** (any string without `/ \ space :`), so a wrong-but-well-formed id
passes Joi and **only breaks at render**. That is exactly why you read real ids instead of guessing.

## Pre-send self-check (lint + ASCII preview)

The layout endpoint checks Joi types and the path whitelist — **not** whether your screen makes sense. It
accepts overlapping components, 500-col widths, a `sourceWorkspaceComponentId` pointing at nothing, a
`{{Ghost.selectedRecord}}` with no `Ghost` component, a non-existent `actionId` — each returns `204`, then
fails silently. So validate locally **before** sending.

**Bundled linter** — do checks 1–4 automatically:

```bash
node <this-skill-dir>/scripts/lint-workspace.mjs ops.json   # exits non-zero + lists every issue
```

It reports overlaps, out-of-bounds, dangling `sourceWorkspaceComponentId`/`componentToSelectRecordFromId`,
ghost `{{Name.selectedRecord}}` filter refs, bad/duplicate names, and missing required keys (`field.fieldName`,
`chart.description`). Or do the same checks by hand:

1. **Bounds** — every component `x,y ≥ 0`, `width,height ≥ 1`; total width ≤ ~60 cols; sizes ≥ the per-type min.
2. **No overlap** — no two rectangles `[x, x+width] × [y, y+height]` intersect (else the front reflows downward).
3. **Reference integrity** —
   - every `{{Name.selectedRecord.…}}` filter → a component whose **`name`** is `Name` **and** has `onRowClick:"selectARecord"`;
   - every `sourceWorkspaceComponentId` / `componentToSelectRecordFromId` → an existing component **`id`** (uuid) here;
   - `section.componentIds` / `tabs[].componentIds` → existing ids.
4. **Names** — unique in the workspace, `[a-zA-Z0-9-_]`, ≤ 50, ≠ `currentUser`.

Then **render an ASCII map** of the grid to eyeball the placement — schematic: each component is drawn as a
single row regardless of its real height, so use it to catch column overlaps & out-of-bounds, not exact proportions:

```
cols → 0        10        20        30        40        50   60
 y0  [ Header ................................................. ]
 y2  [ Master: Alerts ............ ] [ SelectedCustomer ....... ]
 y7  [ Master: Alerts ............ ] [ Severity ............... ]
 y12 [ Master: Alerts ............ ] [ OpenAlerts (KPI) ....... ]
 y19 [ ClearAlert ]
```

If two boxes touch or one runs past the right edge, fix the coordinates **before** sending — the server won't tell you.

## Getting exact shapes to copy (fallback)

For fiddly widget configs and filter shapes, build one in the app, then **pull it and copy the mould**:

```bash
forest layout:pull -e <env> -t <team> -o forest-layout.json   # inspect layout.workspaces[].components
```

Curated demo workspaces to learn from (rich, real): *AML Investigation* (tabs + master→detail + actions +
inbox), *Customer Onboarding* (chart + workflow + sections), *Kyc Case Workspace* (field detail + actions).
