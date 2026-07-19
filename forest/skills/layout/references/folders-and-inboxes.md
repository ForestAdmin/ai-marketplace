# Folders & inboxes — verified recipes

All recipes here were **applied & round-tripped live** on a `create:demo` project (2026-07-19).

## Folders (sidebar organisation) — non-premium

Folders are a **separate domain** from `layout`: use the `folders` key in a patch, and in a `layout:pull`
they come back as a **top-level `folders[]` array — NOT under `layout`**. (Parse `pulled.folders`, not
`pulled.layout.folders`; the latter doesn't exist.)

### Discover the main folder id (needed for every folder op)

`layout:pull` → the top-level `folders[]` entry with **`isMain: true`**. It's a server-managed uuid that
already exists on a fresh env, with every collection auto-added as a child. There is **no patch path to
create the main folder** — you always reference the existing one.

### Create a folder — atomic (create + attach in ONE patch)

A folder object has **no `position`** (position lives on the *child reference*), `icon` is **required**
(`string|null`), `name` required. The server rejects a folder not attached to a parent in the same batch
(*"Cannot create a folder without adding it to the main folder"*):

```json
{ "folders": [
  { "op": "add", "path": "/folders/-", "value": { "id": "<F>", "name": "Compliance", "icon": "shield", "children": [] } },
  { "op": "add", "path": "/folders/<mainId>/children/-", "value": { "type": "folder", "id": "<F>", "position": 8, "isVisible": true } }
] }
```

### Move a collection into a folder — atomic (remove from old + add to new)

An item can't live in two folders (*duplicate rule → 422*), so remove it from its current parent (usually
the main folder) in the **same** batch:

```json
{ "folders": [
  { "op": "remove", "path": "/folders/<mainId>/children/<collectionId>" },
  { "op": "add",    "path": "/folders/<targetFolderId>/children/-", "value": { "type": "collection", "id": "<collectionId>", "position": 0, "isVisible": true } }
] }
```

**Rules:** 2 levels max (main → folder → children; a folder's children **can't** be `type:"folder"`; one
more level via `subChildren`). Child `type ∈ collection | folder | workspace | dashboard | inbox | segment`.
The main folder cannot be deleted.

## Inboxes (premium `inbox`) — two distinct objects

### 1. The inbox itself — `add /inboxes/-`

**Required:** `id, icon, name, position, collectionId, dispatchRule, type`.
`dispatchRule ∈ "random" | "basedOnSortingFields"` · `type ∈ "workflow" | "segment"`.
**Conditional:** `segmentId` (required iff `type:"segment"`), `sortingFields:[{fieldName, order}]` (1–3,
required iff `dispatchRule:"basedOnSortingFields"`). **Optional:** `folder`, `unassignAfter:{duration,unit}`,
`tasksLimit` (1–99), `canUsersReassign`. Minimal valid form (verified):

```json
{ "layout": [ { "op": "add", "path": "/inboxes/-", "value": {
  "id": "<uuid>", "icon": "inbox", "name": "Alert triage", "position": 0,
  "collectionId": "aml_alerts", "dispatchRule": "random", "type": "workflow"
} } ] }
```

A `type:"workflow"` inbox is what a workflow **`escalation`** step targets by `inboxId` (see the `workflows` skill).

### 2. The inbox workspace component

Embeds an **existing** inbox in a workspace (create the inbox first, above — the component only references it):

```json
{ "id": "<uuid>", "name": "TriageInbox", "type": "inbox",
  "displaySettings": { "x": 0, "y": 2, "width": 40, "height": 8 },
  "options": { "inboxIds": ["<inbox id>"], "collectionId": "aml_alerts" },
  "visibility": { "type": "always" } }
```
