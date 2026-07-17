# Workspaces — component palette, wiring & a full example

A good workspace is **not** four collection lists side by side. Real curated workspaces combine a
**master** list with **detail** panels wired to the selected record, action/workflow buttons, KPIs, and
structure (text, dividers, sections, tabs). Shapes below are taken verbatim from curated demo workspaces
(`layout pull` a real env to copy more — see the end).

## Component palette (all types, real shapes)

Every component has `{ id:uuid, name, type, displaySettings:{x,y,width,height}, visibility:{type:"always"}, options:{…} }`.
`name`: `[a-zA-Z0-9-_]`, unique in the workspace. Only `options` differs per type:

| type | purpose | key `options` |
|---|---|---|
| `collection` | a live list of records (often the **master**) | `dataType:"collection", collectionId, onRowClick:"selectARecord", showSearchbar, showFilters, showActions, showWorkflows, enableSegments, visibleColumns:[{name,position}], filter, viewId, segmentId, sortingFieldName, sortingOrder, recordsPerPage` |
| `field` | one field of a record (**detail**) | `templatedFieldPath:"customer.email", shouldDisplayLabel:true, displayedLabel, widgetEdit, widgetDisplay, sourceWorkspaceComponentId` |
| `chart` | inline KPI / chart | `name, type:"Value"|"Line"|…, aggregator:"Count"|"Sum", sourceCollectionId, aggregateFieldName, filter` (same shapes as dashboard charts — see patterns.md §4) |
| `action` | a Smart Action button | `type:"SMART", actionId, sourceCollectionId, componentToSelectRecordFromId, buttonType, displayedText, templatedBelongsToPath` |
| `workflow` | run a workflow on a record | `workflowId, sourceCollectionId, componentToSelectRecordFromId, buttonType, displayedText` |
| `inbox` | embed an inbox (premium `inbox`) | `inboxIds:[…], collectionId` |
| `text` | heading / instruction / label | `displayedText, fontSize, fontWeight:"normal"|"bold", fontStyle, textAlign:"left"|"center"|"right", color:"inherit"|"#hex"` |
| `divider` | visual separator | `direction:"horizontal", style:"solid", color:"inherit"` |
| `section` | group components in a box | `componentIds:[…]` |
| `tabs` | group components into tabs | `tabs:[{ name, tabId:uuid, position, componentIds:[…] }]` |

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
      "displaySettings": { "x": 0, "y": 0, "width": 40, "height": 2 },
      "options": { "displayedText": "Select an AML alert to investigate", "fontSize": 20, "fontWeight": "bold", "fontStyle": "normal", "textAlign": "left", "color": "inherit" },
      "visibility": { "type": "always" } },

    { "id": "<alerts>", "name": "Alerts", "type": "collection",
      "displaySettings": { "x": 0, "y": 2, "width": 40, "height": 16 },
      "options": { "dataType": "collection", "collectionId": "aml_alerts", "onRowClick": "selectARecord",
        "showSearchbar": true, "showFilters": true, "showActions": false, "showWorkflows": false,
        "enableSegments": true, "visibleColumns": [], "filter": null, "viewId": null, "segmentId": null,
        "sortingFieldName": null, "sortingOrder": null, "recordsPerPage": null, "relatedDataFieldName": null, "sourceWorkspaceComponentId": null },
      "visibility": { "type": "always" } },

    { "id": "<f1>", "name": "SelectedCustomer", "type": "field",
      "displaySettings": { "x": 42, "y": 2, "width": 18, "height": 4 },
      "options": { "templatedFieldPath": "customer.email", "shouldDisplayLabel": true, "sourceWorkspaceComponentId": "<alerts>" },
      "visibility": { "type": "always" } },

    { "id": "<f2>", "name": "Severity", "type": "field",
      "displaySettings": { "x": 42, "y": 6, "width": 18, "height": 4 },
      "options": { "templatedFieldPath": "severity", "shouldDisplayLabel": true, "sourceWorkspaceComponentId": "<alerts>" },
      "visibility": { "type": "always" } },

    { "id": "<kpi>", "name": "OpenAlerts", "type": "chart",
      "displaySettings": { "x": 42, "y": 10, "width": 8, "height": 7 },
      "options": { "name": "Open alerts", "type": "Value", "aggregator": "Count", "sourceCollectionId": "aml_alerts", "aggregateFieldName": null, "filter": null },
      "visibility": { "type": "always" } },

    { "id": "<act>", "name": "ClearAlert", "type": "action",
      "displaySettings": { "x": 0, "y": 18, "width": 14, "height": 2 },
      "options": { "type": "SMART", "actionId": "aml_alerts-Clear@@@Alert", "sourceCollectionId": "aml_alerts", "componentToSelectRecordFromId": "<alerts>", "displayedText": "Clear alert" },
      "visibility": { "type": "always" } }
  ]
} } ] }
```

What this demonstrates: **text** header → **collection** master (`selectARecord`) → two **field** detail
panels following the selection (`sourceWorkspaceComponentId`) incl. a relation traversal
(`customer.email`) → a **KPI** chart → an **action** button wired to the selection
(`componentToSelectRecordFromId`).

## Getting exact shapes to copy (recommended)

`actionId`, `workflowId`, widget configs and filter shapes are fiddly. The reliable way is to build one
in the app, then **pull it and copy the mould**:

```bash
forest layout:pull -e <env> -t <team> -o forest-layout.json   # inspect layout.workspaces[].components
```

Curated demo workspaces to learn from (rich, real): *AML Investigation* (tabs + master→detail + actions +
inbox), *Customer Onboarding* (chart + workflow + sections), *Kyc Case Workspace* (field detail + actions).
