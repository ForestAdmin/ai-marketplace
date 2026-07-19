---
name: workflows
description: >
  Vibe-code Forest Admin workflows headlessly — author, update and deploy a
  workflow's behaviour from a JSON `steps` spec. Use when the user wants to
  "create a workflow", "add a process/automation on a collection", "add steps
  to a workflow", "wire an approval / escalation flow", or edit an existing
  workflow's steps. Wraps `forest workflow:apply` (compiles steps → BPMN →
  uploads to the environment's bucket → links). For UI/layout use the `layout`
  skill; for actions/fields code use `forest-code`.
---

# Forest Admin — workflows as code

Author a workflow's **behaviour** (its step graph) from a declarative spec and deploy it in one
command. `forest workflow:apply` compiles the `steps` to BPMN, uploads it to the **target**
environment's own S3 bucket, and links it — editor-compatible and runnable.

Why a dedicated command (not `layout:patch`): a workflow's behaviour is **not** a layout PATCH —
the step graph lives in a BPMN artifact on S3, and only its pointer sits in the layout. `layout:patch`
can't compile or upload BPMN, so it refuses the `workflows` domain. This skill owns the whole gesture.

## The command

```bash
# from a file
forest workflow:apply spec.json -p <projectId> -e <env> -t <team>

# from stdin (disables prompts → pass -f)
cat spec.json | forest workflow:apply - -p <projectId> -e <env> -t <team> -f

# validate only (resolve scope, match the workflow, print the plan; send nothing)
forest workflow:apply spec.json -p <projectId> -e <env> -t <team> --dry-run
```

Spec shape: `{ name, collection, steps, id?, segments?, position?, start? }`. See
**[references/steps-dsl.md](references/steps-dsl.md)** for the step types, encoding and a full example.

## Upsert — re-apply IS the edit

`workflow:apply` is **idempotent, keyed by (collection, name)**:
- new name → **creates** the workflow (shell + BPMN upload + link).
- existing name+collection → **updates** it in place (reuses the id, recompiles, re-uploads, relinks).

So "change step 3" = edit the spec and re-run `apply`. There's no separate update/delete command —
re-apply is the update; to remove, `forest layout:patch` with `remove /workflows/:id` (layout domain).

## Before authoring — clarify first (ask, don't assume)

A workflow encodes a **process**, and a wrong guess is worse than a bad layout — it ships *behaviour*. So
**ask before writing steps**, then restate the flow and build only once confirmed. The questions that
actually shape the graph:

- **Trigger & scope.** Which collection does it run on, and what starts it (a record a user selects, a condition)?
- **Outcome.** What should be true when it finishes? (record marked refunded, ticket escalated, a notification sent)
- **The happy path.** The ordered steps of the normal case, in the user's words.
- **Decision points.** Where does it branch, on what question, and what are the answers? **Every branch of a
  `condition` must reach an `end`** — ask for the reject/failure path explicitly; it's the one people forget.
- **Who acts.** At each step: a human decision (`guidance`) or an automated `update`/`action`/`load-related`/`read`?
- **Targets the DSL can't express yet.** Several step types compile as skeleton-only (see *Gotchas* for the
  list) — confirm each such step's intent in its `prompt`, and **say plainly** which are skeleton, not fully wired.

Then **restate the graph** ("Review → Approve? → [yes] Mark refunded → end │ [no] → end"), confirm the target
environment + team, and only then write the spec.

## The vibe-coding loop

1. **Write the spec** (`{name, collection, steps}`) — follow the DSL reference; every branch of a
   `condition` must reach an `end`.
2. **`--dry-run`** → validates the spec + shows create-vs-update, sends nothing. Fix and repeat.
3. **Apply** → `↑ workflow BPMN uploaded`, returns the workflow id.
4. **Verify** → open/execute in the UI, or `forest layout:pull --with-workflows … ` (the workflow
   comes back with a live, downloadable BPMN sidecar). Retry the pull (read-after-write is lazy).

## Gotchas

- **A `development` env needs a branch** (`422 — a current branch is required`) — target production,
  or `forest branch <name> --projectId <id>` first (⚠ `branch` takes `--projectId`, no `-p` alias).
  **Exception:** a `create:demo` **dev-only** project accepts direct writes (no branch; `forest branch` refuses there).
- **Read-after-write is eventually consistent** — a pull right after apply may lag; retry before
  concluding failure.
- **Skeleton, not fully wired**: `action`/`load-related`/`read`/`update`/`mcp` steps render the right
  *type* but with empty config (no action target, no relation, no field picker yet). The
  behaviour is resolved at runtime by the agent via each step's `prompt`. Say so — don't claim a step
  is fully configured when the DSL can't express its target.
- **Command contract**: resolve ids from `forest environments --format json`, pass all flags up front,
  wrap `bash -c '… </dev/null 2>&1'`, never hand-answer a prompt. Ignore the `Could not find typescript` warning.
- **CLI-only surface — never the private HTTP API.** Drive only `forest workflow:apply` (and `layout:patch`
  to remove a workflow). If the CLI can't express something, **point the user to the UI** — never `curl` the API.

## Example run

```bash
cat > refund.json <<'JSON'
{ "name": "Refund review", "collection": "refund_requests", "steps": [
  { "id": "review", "type": "guidance",  "title": "Review request", "prompt": "Check reason & amount", "next": "decide" },
  { "id": "decide", "type": "condition", "title": "Approve?", "branches": [ {"answer":"Approve","next":"refund"}, {"answer":"Reject","next":"done"} ] },
  { "id": "refund", "type": "update",    "title": "Mark refunded", "prompt": "Set status = refunded", "next": "done" },
  { "id": "done",   "type": "end",       "title": "Done" } ] }
JSON
forest workflow:apply refund.json -p <projectId> -e Development -t Operations --dry-run   # check
forest workflow:apply refund.json -p <projectId> -e Development -t Operations -f          # deploy
```
