---
name: forest-code
description: This skill should be used when the user asks to "write a Forest Admin action", "add a computed field", "create a segment", "implement a hook", "add a relationship", "write Forest Admin code", "customize a collection", "add a chart", "override create/update/delete", or mentions any Forest Admin agent customization in Node.js or Ruby.
---

# Forest Admin Code

Write production-ready Forest Admin agent customization code for the **modern** agent (`@forestadmin/agent` / `forest_admin_agent`).

> **Legacy check first.** If the project's `package.json` has `forest-express-sequelize` / `forest-express-mongoose`, or its `Gemfile` has `forest_liana`, it is a **legacy** agent — stop and use the **forest-legacy** skill instead. This skill's API (`customizeCollection`, `addAction`, `addField`) does not exist there.

## Workflow

### Step 1 — Collect context (one message)

Ask all three before generating anything:

1. **Runtime** — Node.js or Ruby? (Read it from the project: `package.json` → Node, `Gemfile` →
   Ruby. Only for a *new* install is it a choice, and then Node is the default — Ruby is for data
   models with polymorphic associations, which the Node agent cannot express.)
2. **Feature** — What to implement? (see Feature index below)
3. **Context** — Collection name(s), field names and types, business logic or constraints

No placeholders. Use the exact names the user provides.

### Step 2 — Load reference files, then generate

Choose based on runtime and feature:

| Feature group | Node.js | Ruby |
|--------------|---------|------|
| Actions, forms | `references/action-node.md` | `references/action-ruby.md` |
| Hooks, CRUD overrides | `references/hook-node.md` | `references/hook-ruby.md` |
| Computed fields, write handlers, validation, relationships | `references/field-node.md` | `references/field-ruby.md` |
| Segments, charts, search, filtering, sorting, misc | `references/node.md` | `references/ruby.md` |
| Custom datasources | `references/datasource-node.md` | `references/datasource-ruby.md` |

Load only what the feature requires. For a request that spans multiple groups (e.g. action + hook), load both relevant files.

Write production-ready code immediately after reading. Wrap all customizations in `agent.customizeCollection` / `agent.customize_collection`.

---

## Feature index

| Feature | Group |
|---------|-------|
| Action (button, form, file download) | actions |
| Computed field | fields |
| Write handler | fields |
| Validation | fields |
| Import / rename / remove field | fields |
| Binary field mode | fields |
| Relationships (all types) | fields |
| Hook (Before/After CRUD) | hooks |
| CRUD override | hooks |
| Segment | misc |
| Chart | misc |
| Search (replace / disable) | misc |
| Filter operator (emulate / replace) | misc |
| Sorting (emulate / replace / disable) | misc |
| Disable count | misc |
| Plugin | misc |
| Custom datasource (BaseDataSource / BaseCollection) | datasource |
| Replication datasource | datasource |

---

## Context API quick reference

| | Node.js | Ruby |
|--|---------|------|
| **Action — records** | `context.getRecords(['f'])` / `context.getRecord(['f'])` | `context.get_records(['f'])` / `context.get_record(['f'])` |
| **Action — form values** | `context.formValues` (keyed by label) | `context.form_values` (keyed by label) |
| **Current user** | `context.caller.id / .email / .timezone` | `context.caller.id / .email / .timezone` |
| **Hook — data (Before Create)** | `context.data` — modify in place | `context.data` — modify in place |
| **Hook — patch (Before Update)** | `context.patch` | `context.patch` |
| **Hook — fetch records** | `context.collection.list(context.filter, ['f'])` | `context.collection.list(context.filter, ['f'])` |

---

## Production checklist

- [ ] No `console.log`, `puts`, or debug statements
- [ ] No hardcoded secrets or environment-specific values
- [ ] Async functions handle errors (try/catch or propagate)
- [ ] `getValues` / `get_values` — one value per record, same order as input array
- [ ] `dependencies` — lists every field used in the computation
- [ ] `replaceFieldWriting` — returns a patch object, not the full record
- [ ] Hook `Before Create/Update` — modifies `context.data` / `context.patch` in place
- [ ] `overrideCreate` — returns the created records array
- [ ] `getValues` batches — one DB call for all IDs, never per-record
- [ ] Collection and field names match exactly what the user provided
