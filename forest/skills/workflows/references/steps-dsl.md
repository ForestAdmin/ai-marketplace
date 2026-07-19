# Workflow `steps` DSL — reference

Verified against the app.forestadmin.com workflow editor (create + edit + save HARs on a live
`create:demo` project). `forest workflow:apply` compiles these `steps` into BPMN, uploads it
(presigned S3) to the target environment's bucket, and links it — the editor imports/executes it.

## Spec

```ts
WorkflowSpec = {
  name: string;
  collection: string;      // the workflow's collectionId
  start?: string;          // defaults to steps[0].id
  segments?: string[];
  steps: StepSpec[];       // non-empty; must contain at least one `end`
}
StepSpec = {
  id: string;              // /^[A-Za-z_][\w-]*$/, unique
  type: StepType;
  title?: string;          // → element name
  prompt?: string;         // → forest:description (the step's instruction)
  next?: string;           // link steps only
  branches?: { answer: string; next: string; color?: string }[];  // condition only, ≥2
  inboxId?: string;        // escalation only
  mcpServerId?: string;    // mcp only
  auto?: boolean;          // → automaticExecution (serviceTask types only)
  autoComplete?: boolean;  // → automaticCompletion (serviceTask types only)
}
```

## Step types (verified encoding)

| type | BPMN element | subtype | flags | required |
|---|---|---|---|---|
| `guidance` | userTask | `guideline` | — (manual human task) | `next` |
| `read` | serviceTask | `get-data` | `auto`,`autoComplete` | `next` |
| `update` | serviceTask | `update-data` | `auto`,`autoComplete` | `next` |
| `action` | serviceTask | `trigger-action` | `auto`,`autoComplete` | `next` |
| `load-related` | serviceTask | `load-related-record` | `auto`,`autoComplete` | `next` |
| `mcp` | serviceTask | `mcp-server` | `auto`,`autoComplete` | `next`,`mcpServerId` |
| `escalation` | intermediateThrowEvent | — | — | `next`,`inboxId` |
| `condition` | exclusiveGateway | — | — | `branches` (≥2) |
| `end` | endEvent | — | — | (no `next`/`branches`) |

- `auto`/`autoComplete` only apply to serviceTask types; on `guidance` they're a no-op.
- Branch `answer` becomes the outgoing flow's label; optional `color` → `forest:buttonColor`.
- `escalation.inboxId` must reference an **existing** inbox on the collection (prefer a workflow-type inbox).

## Example (4 steps: guidance → condition → update → end)

```json
{
  "name": "Refund review",
  "collection": "refund_requests",
  "steps": [
    { "id": "review", "type": "guidance",  "title": "Review request", "prompt": "Check the reason and amount", "next": "decide" },
    { "id": "decide", "type": "condition", "title": "Approve?", "branches": [ {"answer":"Approve","next":"refund"}, {"answer":"Reject","next":"done"} ] },
    { "id": "refund", "type": "update",    "title": "Mark refunded", "prompt": "Set status = refunded", "next": "done" },
    { "id": "done",   "type": "end",       "title": "Done" }
  ]
}
```

## Known gaps (the UI has fields the spec can't express yet)

- `condition`: no explicit question/decision-maker text (only `branches`).
- `action`: no target Smart Action (`actionId`).
- `load-related`: no relation picker.
- `read`/`update`: no field/collection selection.
- `mcp`: `mcpServerId` needs a real configured server.

These render as the right step **type** with empty config — good for a skeleton, incomplete for a
fully-wired workflow. The behaviour is resolved at runtime by the agent via the `prompt`, by design.

## Notes

- The editor canonicalizes element names to PascalCase on save; casing is cosmetic.
- BPMN carries the `app.forestadmin.com` namespace + a `bpmndi:BPMNDiagram` (diagram interchange) so the
  editor can import it. `workflow:apply` handles both — you only write `steps`.
