const fs = require('fs');

function parseFile(file) {
  const src = fs.readFileSync(file, 'utf8');
  // enum map: Member = '/path'
  const enumMap = {};
  const enumBlock = src.match(/export enum \w+ \{([\s\S]*?)\}/);
  if (enumBlock) {
    for (const m of enumBlock[1].matchAll(/(\w+)\s*=\s*['"`]([^'"`]+)['"`]/g)) enumMap[m[1]] = m[2];
  }
  const start = src.indexOf('return [');
  const end = src.indexOf('\n  ];', start);
  const body = src.slice(start, end > 0 ? end : undefined);
  const chunks = body.split(/(?=\bpath:\s*)/).slice(1);
  const grabStr = (c, k) => { const m = c.match(new RegExp(k + String.raw`:\s*(['"\`])([^'"\`]+)\1`)); return m ? m[2] : ''; };
  const grabRaw = (c, k) => { const m = c.match(new RegExp(k + String.raw`:\s*([^\n,}]+)`)); return m ? m[1].trim() : ''; };
  return chunks.map(c => {
    let p = grabStr(c, 'path');
    if (!p) { const e = c.match(/path:\s*\w+\.(\w+)/); if (e) p = enumMap[e[1]] || ''; }
    return {
      path: p,
      op: grabStr(c, 'op'),
      polymorphic: grabStr(c, 'polymorphic'),
      premium: grabRaw(c, 'premiumPack').replace(/EnvironmentsFeatures\./, ''),
      restrict: (c.match(/businessRestrictions:\s*\[([^\]]*)\]/) || [, ''])[1].trim().replace(/prevent|check|make-?/gi, '').replace(/,\s*/g, ', '),
    };
  }).filter(e => e.path && e.op);
}

function table(entries) {
  const byPath = {};
  for (const e of entries) {
    byPath[e.path] = byPath[e.path] || { ops: new Set(), premium: '', restrict: '', poly: '' };
    byPath[e.path].ops.add(e.op);
    if (e.premium) byPath[e.path].premium = e.premium;
    if (e.restrict) byPath[e.path].restrict = e.restrict;
    if (e.polymorphic) byPath[e.path].poly = e.polymorphic;
  }
  let t = '| path | ops | premium | note |\n|---|---|---|---|\n';
  for (const [p, i] of Object.entries(byPath)) {
    const flags = [i.restrict && `⚠ ${i.restrict}`, i.poly && `poly:${i.poly}`].filter(Boolean).join(' ');
    t += `| \`${p}\` | ${[...i.ops].join(' / ')} | ${i.premium || ''} | ${flags} |\n`;
  }
  return { md: t, paths: Object.keys(byPath).length };
}

const layout = parseFile('/tmp/mlpp.ts');
const folders = parseFile('/tmp/folders.ts');
const workflows = parseFile('/tmp/workflows.ts');
const tl = table(layout), tf = table(folders), tw = table(workflows);
const total = layout.length + folders.length + workflows.length;

const doc = `# Layout patch catalogue — reference generated from the server source

> **Generated** (not hand-copied) from \`ForestAdmin/forestadmin-server\`:
> \`packages/private-api/src/domain/layout/patterns/{make-layout-patch-patterns,make-patch-folder-patterns,workflow/patterns/make-patch-workflow-patterns}.ts\`
> + the Joi validators (\`validators/models/*\`). **${total} patterns** total
> (${layout.length} layout + ${folders.length} folders + ${workflows.length} workflows).
> *(Maintainers: regenerate against the server HEAD via \`tooling/generate-reference.js\` — authoring tooling, outside the skill.)*

Endpoints: \`PATCH /api/layout\`, \`PATCH /api/folders\`, \`PATCH /api/workflows\`.
Body = an RFC 6902 array \`[{op,path,value?}]\`. Through the toolbelt CLI, the input is an
object keyed by domain: \`{ "layout": [...], "folders": [...] }\`.

## Path conventions

- \`:collectionId\` = collection **name** (or workspace name — server quirk: the param is
  called \`collectionId\` but receives the workspace id). \`:primaryId\` / \`:workflowId\` /
  \`:folderId\` = a **uuid** (or int) you generate yourself for \`add\`s.
- \`:fieldId\` / \`:fieldName\`: a field is addressed by id OR by name (two path families).
- \`add\` → path ending in \`/-\`, value = the **complete** object (with an \`id\` uuid).
- Reorder = \`replace …/position\`. Rename = \`replace …/name\`|\`displayName\`.

## Server rules (from the code, not guessed)

- **Atomic per domain**: one invalid op → the whole batch is rejected (\`204\` on success).
- **\`test\` op required** to change a polymorphic discriminant: the whitelist declares a
  component's \`options/collectionId\` and \`options/relatedDataFieldName\` as \`op:'test'\`
  (\`polymorphic:'collection'\`), same for \`charts/:id/type\` and \`/sourceCollectionId\`. Assert the
  current value in the **same batch** before the \`replace\`.
- **Editing a component's options = fine paths** (\`options/filter\`, \`options/onRowClick\`…).
  A whole-\`options\` \`replace\` is refused in practice → fine paths, or \`remove\`+\`add\`.
- **List columns**: \`replace\` only (position/isVisible) — no add/remove (agent schema).
- **Business rules** (dedicated refusal): unique workspace-component name, unique viewlist name,
  unique inbox name/segmentId, no deleting the main folder, no item duplicated across two
  folders, no ghost folder.

## Errors

- \`422 Not-supported patch: {op,path}\` → outside the whitelist (fix the path).
- \`422 Invalid patch value (...) ValidationError: ...\` → Joi, **one error at a time** → iterate.
- \`402\` (Payment Required) → missing premium pack (\`scopes\` | \`multipleDashboards\` | \`inbox\`).
- \`403\` (Forbidden) → insufficient role permission (not premium).

---

## Value schemas (extracted from the Joi validators)

### Workspace (\`add /workspaces/-\`)
\`{ id:uuid, name, icon:string|null, position:number(≥0), collectionId:string|null, components:[] }\`

### Component (\`add /workspaces/<ws>/components/-\`)
\`{ id:uuid, name, type, displaySettings:{x,y,width,height}, visibility:{type}, options:{…} }\`
- \`name\`: \`[a-zA-Z0-9-_]\` (no spaces), **unique** in the workspace, ≠ \`currentUser\`.
- \`visibility.type\` ∈ \`always\` | \`whenItsContextIsSet\` | \`whenAnotherComponentIsVisible\` (+\`componentId\`).
- \`type\` (18): text, divider, chart, collection, field, link, dropdown, date-picker, search,
  action, metabase, tabs, section, toggle, input, inbox*, smart, workflow. (*premium \`inbox\`)
- \`collection\` options: \`{ collectionId, segmentId:null, onRowClick:"selectARecord"|"redirectToRecord",
  filter, viewId, sortingFieldName, sortingOrder, recordsPerPage, showSearchbar, showFilters,
  showCreate, showActions, showWorkflows, enableSegments, visibleColumns:[{name,position}],
  relatedDataFieldName, sourceWorkspaceComponentId }\`.
- **master→detail dependency** = \`options.filter.conditions[].value = "{{<MasterComponentName>.selectedRecord.<field>}}"\`
  (the master must have \`onRowClick:"selectARecord"\`). Same collection → \`fieldName:"id"\`;
  via a relation → \`fieldName:"<relation>", subFieldName:"id"\`.

### Charts (\`add …/charts/-\`) — \`{ id:uuid, name, description, type, displaySettings:{x,y,width,height}, …}\`
\`aggregator\` ∈ \`Sum\`|\`Count\`; if \`Count\`, \`aggregateFieldName\` may be \`null\`.
\`timeRange\` ∈ \`Day\`|\`Week\`|\`Month\`|\`Quarter\`|\`Year\` **or a \`{{…}}\` variable**.
| type | required fields (beyond the common ones) |
|---|---|
| \`Value\` | \`sourceCollectionId\`, \`aggregator\`, \`aggregateFieldName\`, \`filter\`(null ok) |
| \`Line\` | + \`groupByFieldName\`, \`timeRange\` |
| \`Pie\` | + \`groupByFieldName\` |
| \`Leaderboard\` | \`labelFieldName\`, \`relationshipFieldName\`, \`aggregateFieldName\`, \`aggregator\`, \`limit\`(≥1) |
| \`Objective\` | + \`objective\`(number) |
| \`Percentage\` | \`numeratorChartId\`, \`denominatorChartId\` |
| \`Smart\`/query | \`query\`(SQL) / smart code |

### Segment (\`add …/segments/-\`) — *premium \`scopes\`*
\`{ id:uuid, name, icon:string|null, type:"manual"|"smart", position, defaultSortingFieldName:string|null,
defaultSortingFieldOrder:"ascending"|"descending"|null, isVisible, hasColumnsConfiguration, columns:[…],
filter, query, connectionName:string|null }\`
- \`type:"manual"\` → \`filter\` **required**, \`query\` forbidden. \`type:"smart"\` → \`query\` **required**, \`filter\` forbidden.

### Folder children (\`add /folders/<id>/children/-\`)
\`{ id:"<collectionId>", type:"collection", position, isVisible }\` (the \`isMain\` folder cannot be deleted).

---

## Full path catalogue

### domain \`layout\` (${layout.length} patterns, ${tl.paths} paths)

${tl.md}
### domain \`folders\` (${folders.length} patterns, ${tf.paths} paths)

${tf.md}
### domain \`workflows\` (${workflows.length} patterns, ${tw.paths} paths) — *shell only; the BPMN goes through a separate S3 upload*

${tw.md}`;

fs.writeFileSync('/Users/gautier/test/forest-layout/REFERENCE.md', doc);
console.log('TOTAL patterns:', total, '| layout', layout.length, 'folders', folders.length, 'workflows', workflows.length);
console.log('wrote forest-layout/REFERENCE.md (', doc.length, 'chars )');
