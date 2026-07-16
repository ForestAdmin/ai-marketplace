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
  let t = '| chemin | ops | premium | note |\n|---|---|---|---|\n';
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

const doc = `# Catalogue des patchs layout — référence générée depuis la source serveur

> **Généré** (pas recopié) depuis \`ForestAdmin/forestadmin-server\` :
> \`packages/private-api/src/domain/layout/patterns/{make-layout-patch-patterns,make-patch-folder-patterns,workflow/patterns/make-patch-workflow-patterns}.ts\`
> + les validateurs Joi (\`validators/models/*\`). **${total} patterns** au total
> (${layout.length} layout + ${folders.length} folders + ${workflows.length} workflows).
> Régénérable via \`generate-reference.js\` — en cas de 422 inattendu, regénérer contre le HEAD serveur.

Endpoints : \`PATCH /api/layout\`, \`PATCH /api/folders\`, \`PATCH /api/workflows\`.
Corps = tableau RFC 6902 \`[{op,path,value?}]\`. Via la CLI toolbelt, l'entrée est un
objet keyé par domaine : \`{ "layout": [...], "folders": [...] }\`.

## Conventions de chemin

- \`:collectionId\` = **nom** de collection (ou nom de workspace — quirk serveur : le param
  s'appelle \`collectionId\` mais reçoit l'id de workspace). \`:primaryId\` / \`:workflowId\` /
  \`:folderId\` = **uuid** (ou int) que tu génères toi-même pour les \`add\`.
- \`:fieldId\` / \`:fieldName\` : un champ s'adresse par id OU par nom (deux familles de chemins).
- \`add\` → chemin finissant par \`/-\`, valeur = objet **complet** (avec \`id\` uuid).
- Réordonner = \`replace …/position\`. Renommer = \`replace …/name\`|\`displayName\`.

## Règles serveur (depuis le code, pas devinées)

- **Atomique par domaine** : une op invalide → tout le lot rejeté (\`204\` si succès).
- **Op \`test\` obligatoire** pour changer un discriminant polymorphe : la whitelist déclare
  \`options/collectionId\` et \`options/relatedDataFieldName\` d'un composant en \`op:'test'\`
  (\`polymorphic:'collection'\`), idem \`charts/:id/type\` et \`/sourceCollectionId\`. Affirme la
  valeur courante dans le **même lot** avant le \`replace\`.
- **Modifier les options d'un composant = chemins fins** (\`options/filter\`, \`options/onRowClick\`…).
  Le \`replace …/options\` en bloc est refusé en pratique → chemins fins, ou \`remove\`+\`add\`.
- **Colonnes de liste** : \`replace\` seulement (position/isVisible) — pas d'add/remove (schéma agent).
- **Règles métier** (refus dédié) : nom de composant workspace unique, nom de viewlist unique,
  nom/segmentId d'inbox uniques, pas de suppression du dossier principal, pas d'item dupliqué
  dans deux dossiers, pas de dossier fantôme.

## Erreurs

- \`422 Not-supported patch: {op,path}\` → hors whitelist (corriger le chemin).
- \`422 Invalid patch value (...) ValidationError: ...\` → Joi, **une erreur à la fois** → itérer.
- \`403\` → pack premium manquant (\`scopes\` | \`multipleDashboards\` | \`inbox\`) ou rôle insuffisant.

---

## Schémas de valeurs (extraits des validateurs Joi)

### Workspace (\`add /workspaces/-\`)
\`{ id:uuid, name, icon:string|null, position:number(≥0), collectionId:string|null, components:[] }\`

### Composant (\`add /workspaces/<ws>/components/-\`)
\`{ id:uuid, name, type, displaySettings:{x,y,width,height}, visibility:{type}, options:{…} }\`
- \`name\` : \`[a-zA-Z0-9-_]\` (pas d'espaces), **unique** dans le workspace, ≠ \`currentUser\`.
- \`visibility.type\` ∈ \`always\` | \`whenItsContextIsSet\` | \`whenAnotherComponentIsVisible\` (+\`componentId\`).
- \`type\` (18) : text, divider, chart, collection, field, link, dropdown, date-picker, search,
  action, metabase, tabs, section, toggle, input, inbox*, smart, workflow. (*premium \`inbox\`)
- options \`collection\` : \`{ collectionId, segmentId:null, onRowClick:"selectARecord"|"redirectToRecord",
  filter, viewId, sortingFieldName, sortingOrder, recordsPerPage, showSearchbar, showFilters,
  showCreate, showActions, showWorkflows, enableSegments, visibleColumns:[{name,position}],
  relatedDataFieldName, sourceWorkspaceComponentId }\`.
- **Dépendance master→detail** = \`options.filter.conditions[].value = "{{<NomComposantMaster>.selectedRecord.<champ>}}"\`
  (master doit avoir \`onRowClick:"selectARecord"\`). Même collection → \`fieldName:"id"\` ;
  via relation → \`fieldName:"<relation>", subFieldName:"id"\`.

### Charts (\`add …/charts/-\`) — \`{ id:uuid, name, description, type, displaySettings:{x,y,width,height}, …}\`
\`aggregator\` ∈ \`Sum\`|\`Count\` ; si \`Count\`, \`aggregateFieldName\` peut être \`null\`.
\`timeRange\` ∈ \`Day\`|\`Week\`|\`Month\`|\`Quarter\`|\`Year\` **ou une variable \`{{…}}\`**.
| type | champs requis (au-delà du commun) |
|---|---|
| \`Value\` | \`sourceCollectionId\`, \`aggregator\`, \`aggregateFieldName\`, \`filter\`(null ok) |
| \`Line\` | + \`groupByFieldName\`, \`timeRange\` |
| \`Pie\` | + \`groupByFieldName\` |
| \`Leaderboard\` | \`labelFieldName\`, \`relationshipFieldName\`, \`aggregateFieldName\`, \`aggregator\`, \`limit\`(≥1) |
| \`Objective\` | + \`objective\`(number) |
| \`Percentage\` | \`numeratorChartId\`, \`denominatorChartId\` |
| \`Smart\`/query | \`query\`(SQL) / code smart |

### Segment (\`add …/segments/-\`) — *premium \`scopes\`*
\`{ id:uuid, name, icon:string|null, type:"manual"|"smart", position, defaultSortingFieldName:string|null,
defaultSortingFieldOrder:"ascending"|"descending"|null, isVisible, hasColumnsConfiguration, columns:[…],
filter, query, connectionName:string|null }\`
- \`type:"manual"\` → \`filter\` **requis**, \`query\` interdit. \`type:"smart"\` → \`query\` **requis**, \`filter\` interdit.

### Folder children (\`add /folders/<id>/children/-\`)
\`{ id:"<collectionId>", type:"collection", position, isVisible }\` (le dossier \`isMain\` est insupprimable).

---

## Catalogue complet des chemins

### domaine \`layout\` (${layout.length} patterns, ${tl.paths} chemins)

${tl.md}
### domaine \`folders\` (${folders.length} patterns, ${tf.paths} chemins)

${tf.md}
### domaine \`workflows\` (${workflows.length} patterns, ${tw.paths} chemins) — *coquille seule ; le BPMN passe par un upload S3 séparé*

${tw.md}`;

fs.writeFileSync('/Users/gautier/test/forest-layout/REFERENCE.md', doc);
console.log('TOTAL patterns:', total, '| layout', layout.length, 'folders', folders.length, 'workflows', workflows.length);
console.log('wrote forest-layout/REFERENCE.md (', doc.length, 'chars )');
