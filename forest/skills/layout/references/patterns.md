# Catalogue des patchs layout — référence générée depuis la source serveur

> **Généré** (pas recopié) depuis `ForestAdmin/forestadmin-server` :
> `packages/private-api/src/domain/layout/patterns/{make-layout-patch-patterns,make-patch-folder-patterns,workflow/patterns/make-patch-workflow-patterns}.ts`
> + les validateurs Joi (`validators/models/*`). **249 patterns** au total
> (230 layout + 12 folders + 7 workflows).
> Régénérable via `generate-reference.js` — en cas de 422 inattendu, regénérer contre le HEAD serveur.

Endpoints : `PATCH /api/layout`, `PATCH /api/folders`, `PATCH /api/workflows`.
Corps = tableau RFC 6902 `[{op,path,value?}]`. Via la CLI toolbelt, l'entrée est un
objet keyé par domaine : `{ "layout": [...], "folders": [...] }`.

## Conventions de chemin

- `:collectionId` = **nom** de collection (ou nom de workspace — quirk serveur : le param
  s'appelle `collectionId` mais reçoit l'id de workspace). `:primaryId` / `:workflowId` /
  `:folderId` = **uuid** (ou int) que tu génères toi-même pour les `add`.
- `:fieldId` / `:fieldName` : un champ s'adresse par id OU par nom (deux familles de chemins).
- `add` → chemin finissant par `/-`, valeur = objet **complet** (avec `id` uuid).
- Réordonner = `replace …/position`. Renommer = `replace …/name`|`displayName`.

## Règles serveur (depuis le code, pas devinées)

- **Atomique par domaine** : une op invalide → tout le lot rejeté (`204` si succès).
- **Op `test` obligatoire** pour changer un discriminant polymorphe : la whitelist déclare
  `options/collectionId` et `options/relatedDataFieldName` d'un composant en `op:'test'`
  (`polymorphic:'collection'`), idem `charts/:id/type` et `/sourceCollectionId`. Affirme la
  valeur courante dans le **même lot** avant le `replace`.
- **Modifier les options d'un composant = chemins fins** (`options/filter`, `options/onRowClick`…).
  Le `replace …/options` en bloc est refusé en pratique → chemins fins, ou `remove`+`add`.
- **Colonnes de liste** : `replace` seulement (position/isVisible) — pas d'add/remove (schéma agent).
- **Règles métier** (refus dédié) : nom de composant workspace unique, nom de viewlist unique,
  nom/segmentId d'inbox uniques, pas de suppression du dossier principal, pas d'item dupliqué
  dans deux dossiers, pas de dossier fantôme.

## Erreurs

- `422 Not-supported patch: {op,path}` → hors whitelist (corriger le chemin).
- `422 Invalid patch value (...) ValidationError: ...` → Joi, **une erreur à la fois** → itérer.
- `403` → pack premium manquant (`scopes` | `multipleDashboards` | `inbox`) ou rôle insuffisant.

---

## Schémas de valeurs (extraits des validateurs Joi)

### Workspace (`add /workspaces/-`)
`{ id:uuid, name, icon:string|null, position:number(≥0), collectionId:string|null, components:[] }`

### Composant (`add /workspaces/<ws>/components/-`)
`{ id:uuid, name, type, displaySettings:{x,y,width,height}, visibility:{type}, options:{…} }`
- `name` : `[a-zA-Z0-9-_]` (pas d'espaces), **unique** dans le workspace, ≠ `currentUser`.
- `visibility.type` ∈ `always` | `whenItsContextIsSet` | `whenAnotherComponentIsVisible` (+`componentId`).
- `type` (18) : text, divider, chart, collection, field, link, dropdown, date-picker, search,
  action, metabase, tabs, section, toggle, input, inbox*, smart, workflow. (*premium `inbox`)
- options `collection` : `{ collectionId, segmentId:null, onRowClick:"selectARecord"|"redirectToRecord",
  filter, viewId, sortingFieldName, sortingOrder, recordsPerPage, showSearchbar, showFilters,
  showCreate, showActions, showWorkflows, enableSegments, visibleColumns:[{name,position}],
  relatedDataFieldName, sourceWorkspaceComponentId }`.
- **Dépendance master→detail** = `options.filter.conditions[].value = "{{<NomComposantMaster>.selectedRecord.<champ>}}"`
  (master doit avoir `onRowClick:"selectARecord"`). Même collection → `fieldName:"id"` ;
  via relation → `fieldName:"<relation>", subFieldName:"id"`.

### Charts (`add …/charts/-`) — `{ id:uuid, name, description, type, displaySettings:{x,y,width,height}, …}`
`aggregator` ∈ `Sum`|`Count` ; si `Count`, `aggregateFieldName` peut être `null`.
`timeRange` ∈ `Day`|`Week`|`Month`|`Quarter`|`Year` **ou une variable `{{…}}`**.
| type | champs requis (au-delà du commun) |
|---|---|
| `Value` | `sourceCollectionId`, `aggregator`, `aggregateFieldName`, `filter`(null ok) |
| `Line` | + `groupByFieldName`, `timeRange` |
| `Pie` | + `groupByFieldName` |
| `Leaderboard` | `labelFieldName`, `relationshipFieldName`, `aggregateFieldName`, `aggregator`, `limit`(≥1) |
| `Objective` | + `objective`(number) |
| `Percentage` | `numeratorChartId`, `denominatorChartId` |
| `Smart`/query | `query`(SQL) / code smart |

### Segment (`add …/segments/-`) — *premium `scopes`*
`{ id:uuid, name, icon:string|null, type:"manual"|"smart", position, defaultSortingFieldName:string|null,
defaultSortingFieldOrder:"ascending"|"descending"|null, isVisible, hasColumnsConfiguration, columns:[…],
filter, query, connectionName:string|null }`
- `type:"manual"` → `filter` **requis**, `query` interdit. `type:"smart"` → `query` **requis**, `filter` interdit.

### Folder children (`add /folders/<id>/children/-`)
`{ id:"<collectionId>", type:"collection", position, isVisible }` (le dossier `isMain` est insupprimable).

---

## Catalogue complet des chemins

### domaine `layout` (230 patterns, 179 chemins)

| chemin | ops | premium | note |
|---|---|---|---|
| `/collections/:collectionId/displayName` | replace |  |  |
| `/collections/:collectionId/displayNamePlural` | replace |  |  |
| `/collections/:collectionId/icon` | replace |  |  |
| `/collections/:collectionId/restrictedToSegments` | replace |  |  |
| `/collections/:collectionId/defaultSortingOrder` | replace |  |  |
| `/collections/:collectionId/defaultSortingFieldName` | replace |  |  |
| `/collections/:collectionId/displayFieldName` | replace |  |  |
| `/collections/:collectionId/layout/columns/:collectionId/position` | replace |  |  |
| `/collections/:collectionId/layout/columns/:collectionId/isVisible` | replace |  |  |
| `/collections/:collectionId/layout/scope` | replace | scopes |  |
| `/collections/:collectionId/layout/segments/-` | add |  |  |
| `/collections/:collectionId/layout/segments/:collectionId` | remove |  |  |
| `/collections/:collectionId/layout/segments/:collectionId/name` | replace |  |  |
| `/collections/:collectionId/layout/segments/:collectionId/icon` | replace |  |  |
| `/collections/:collectionId/layout/segments/:collectionId/position` | replace |  |  |
| `/collections/:collectionId/layout/segments/:collectionId/defaultSortingFieldName` | replace |  |  |
| `/collections/:collectionId/layout/segments/:collectionId/defaultSortingFieldOrder` | replace |  |  |
| `/collections/:collectionId/layout/segments/:collectionId/isVisible` | replace |  |  |
| `/collections/:collectionId/layout/segments/:collectionId/hasColumnsConfiguration` | replace |  |  |
| `/collections/:collectionId/layout/segments/:collectionId/columns` | replace |  |  |
| `/collections/:collectionId/layout/segments/:collectionId/filter` | replace |  |  |
| `/collections/:collectionId/layout/segments/:collectionId/query` | replace |  |  |
| `/collections/:collectionId/layout/segments/:collectionId/connectionName` | replace |  |  |
| `/collections/:collectionId/layout/segments/:collectionId/columns/:collectionId/position` | replace |  |  |
| `/collections/:collectionId/layout/segments/:collectionId/columns/:collectionId/isVisible` | replace |  |  |
| `/collections/:collectionId/layout/fields/:fieldId/displayName` | replace |  |  |
| `/collections/:collectionId/layout/fields/:fieldId/description` | replace |  |  |
| `/collections/:collectionId/layout/fields/:fieldId/isReadOnly` | replace |  |  |
| `/collections/:collectionId/layout/fields/:fieldId/isFilterDisplayed` | replace |  |  |
| `/collections/:collectionId/layout/fields/:fieldId/isDissociateDisplayed` | replace |  |  |
| `/collections/:collectionId/layout/fields/:fieldId/widgetEdit` | replace |  |  |
| `/collections/:collectionId/layout/fields/:fieldId/widgetDisplay` | replace |  |  |
| `/collections/:collectionId/layout/fields/:fieldId/mappingValues` | replace |  |  |
| `/collections/:collectionId/layout/fields/:fieldId/conditionalFormatting` | replace |  |  |
| `/collections/:collectionId/layout/fields/:fieldName/displayName` | replace |  |  |
| `/collections/:collectionId/layout/fields/:fieldName/description` | replace |  |  |
| `/collections/:collectionId/layout/fields/:fieldName/isReadOnly` | replace |  |  |
| `/collections/:collectionId/layout/fields/:fieldName/isFilterDisplayed` | replace |  |  |
| `/collections/:collectionId/layout/fields/:fieldName/widgetEdit` | replace |  |  |
| `/collections/:collectionId/layout/fields/:fieldName/widgetDisplay` | replace |  |  |
| `/collections/:collectionId/layout/fields/:fieldName/mappingValues` | replace |  |  |
| `/collections/:collectionId/layout/fields/:fieldName/conditionalFormatting` | replace |  |  |
| `/collections/:collectionId/layout/viewCreate/rows/:collectionId/position` | replace |  |  |
| `/collections/:collectionId/layout/viewCreate/rows/:collectionId/isVisible` | replace |  |  |
| `/collections/:collectionId/layout/viewEdit/charts/-` | add |  |  |
| `/collections/:collectionId/layout/viewEdit/charts/:primaryId` | replace / remove |  |  |
| `/collections/:collectionId/layout/actions/:actionId/position` | replace |  |  |
| `/collections/:collectionId/layout/actions/:actionId/isVisible` | replace |  |  |
| `/collections/:collectionId/layout/actions/:actionId/displayName` | replace |  |  |
| `/collections/:collectionId/layout/actions/:actionId/confirmation` | replace |  |  |
| `/collections/:collectionId/layout/actions/:actionId/segments` | replace |  |  |
| `/collections/:collectionId/layout/actions/:actionId/buttonType` | replace |  |  |
| `/collections/:collectionId/layout/viewEdit/charts/:primaryId/aggregator` | replace / remove |  |  |
| `/collections/:collectionId/layout/viewEdit/charts/:primaryId/aggregateFieldName` | replace / remove |  |  |
| `/collections/:collectionId/layout/viewEdit/charts/:primaryId/apiRoute` | replace / remove |  |  |
| `/collections/:collectionId/layout/viewEdit/charts/:primaryId/description` | replace / remove |  |  |
| `/collections/:collectionId/layout/viewEdit/charts/:primaryId/denominatorChartId` | replace / remove |  |  |
| `/collections/:collectionId/layout/viewEdit/charts/:primaryId/displaySettings` | replace / remove |  |  |
| `/collections/:collectionId/layout/viewEdit/charts/:primaryId/displaySettings/x` | replace |  |  |
| `/collections/:collectionId/layout/viewEdit/charts/:primaryId/displaySettings/y` | replace |  |  |
| `/collections/:collectionId/layout/viewEdit/charts/:primaryId/displaySettings/width` | replace |  |  |
| `/collections/:collectionId/layout/viewEdit/charts/:primaryId/displaySettings/height` | replace |  |  |
| `/collections/:collectionId/layout/viewEdit/charts/:primaryId/fieldName` | replace / remove |  |  |
| `/collections/:collectionId/layout/viewEdit/charts/:primaryId/groupByFieldName` | replace / remove |  |  |
| `/collections/:collectionId/layout/viewEdit/charts/:primaryId/filter` | replace / remove |  |  |
| `/collections/:collectionId/layout/viewEdit/charts/:primaryId/labelFieldName` | replace / remove |  |  |
| `/collections/:collectionId/layout/viewEdit/charts/:primaryId/limit` | replace / remove |  |  |
| `/collections/:collectionId/layout/viewEdit/charts/:primaryId/name` | replace / remove |  |  |
| `/collections/:collectionId/layout/viewEdit/charts/:primaryId/numeratorChartId` | replace / remove |  |  |
| `/collections/:collectionId/layout/viewEdit/charts/:primaryId/objective` | replace / remove |  |  |
| `/collections/:collectionId/layout/viewEdit/charts/:primaryId/query` | replace / remove |  |  |
| `/collections/:collectionId/layout/viewEdit/charts/:primaryId/connectionName` | replace / remove |  |  |
| `/collections/:collectionId/layout/viewEdit/charts/:primaryId/relationshipFieldName` | replace / remove |  |  |
| `/collections/:collectionId/layout/viewEdit/charts/:primaryId/sourceCollectionId` | replace / test / remove |  |  |
| `/collections/:collectionId/layout/viewEdit/charts/:primaryId/smartRoute` | replace / remove |  |  |
| `/collections/:collectionId/layout/viewEdit/charts/:primaryId/s3Versions` | replace / remove |  |  |
| `/collections/:collectionId/layout/viewEdit/charts/:primaryId/timeRange` | replace / remove |  |  |
| `/collections/:collectionId/layout/viewEdit/charts/:primaryId/type` | replace / test / remove |  |  |
| `/collections/:collectionId/layout/viewEdit/charts/:primaryId/allowJavascript` | replace / remove |  |  |
| `/collections/:collectionId/layout/viewEdit/summaryView` | replace |  |  |
| `/collections/:collectionId/layout/viewEdit/rows/:collectionId/position` | replace |  |  |
| `/collections/:collectionId/layout/viewEdit/rows/:collectionId/isVisible` | replace |  |  |
| `/collections/:collectionId/layout/viewEdit/rows/:collectionId/explorerConfiguration` | replace |  |  |
| `/collections/:collectionId/layout/viewEdit/rows/:collectionId/explorerConfiguration/isVisible` | replace |  |  |
| `/collections/:collectionId/layout/viewEdit/rows/:collectionId/explorerConfiguration/position` | replace |  |  |
| `/collections/:collectionId/layout/viewEdit/rows/:collectionId/explorerConfiguration/recordsPerPage` | replace |  |  |
| `/collections/:collectionId/layout/viewEdit/rows/:collectionId/explorerConfiguration/displayFieldNames` | replace |  |  |
| `/collections/:collectionId/layout/viewLists/-` | add |  | ⚠ ViewlistNameDuplication |
| `/collections/:collectionId/layout/viewLists/:collectionId` | remove |  |  |
| `/collections/:collectionId/layout/viewLists/:collectionId/name` | replace |  |  |
| `/collections/:collectionId/layout/viewLists/:collectionId/position` | replace |  |  |
| `/collections/:collectionId/layout/viewLists/:collectionId/s3Versions` | replace |  |  |
| `/collections/:collectionId/layout/viewLists/:collectionId/recordsPerPage` | replace |  |  |
| `/collections/:collectionId/layout/viewLists/:collectionId/allowJavascript` | replace |  |  |
| `/dashboards/-` | add | multipleDashboards |  |
| `/dashboards/:primaryId` | remove |  |  |
| `/dashboards/:primaryId/name` | replace |  |  |
| `/dashboards/:primaryId/icon` | replace |  |  |
| `/dashboards/:primaryId/position` | replace |  |  |
| `/dashboards/:primaryId/charts/-` | add |  |  |
| `/dashboards/:primaryId/charts/:primaryId` | replace / remove |  |  |
| `/dashboards/:primaryId/charts/:primaryId/aggregator` | replace / remove |  |  |
| `/dashboards/:primaryId/charts/:primaryId/aggregateFieldName` | replace / remove |  |  |
| `/dashboards/:primaryId/charts/:primaryId/apiRoute` | replace / remove |  |  |
| `/dashboards/:primaryId/charts/:primaryId/description` | replace / remove |  |  |
| `/dashboards/:primaryId/charts/:primaryId/denominatorChartId` | replace / remove |  |  |
| `/dashboards/:primaryId/charts/:primaryId/displaySettings` | replace / remove |  |  |
| `/dashboards/:primaryId/charts/:primaryId/displaySettings/x` | replace |  |  |
| `/dashboards/:primaryId/charts/:primaryId/displaySettings/y` | replace |  |  |
| `/dashboards/:primaryId/charts/:primaryId/displaySettings/width` | replace |  |  |
| `/dashboards/:primaryId/charts/:primaryId/displaySettings/height` | replace |  |  |
| `/dashboards/:primaryId/charts/:primaryId/groupByFieldName` | replace / remove |  |  |
| `/dashboards/:primaryId/charts/:primaryId/fieldName` | replace / remove |  |  |
| `/dashboards/:primaryId/charts/:primaryId/filter` | replace / remove |  |  |
| `/dashboards/:primaryId/charts/:primaryId/objective` | replace / remove |  |  |
| `/dashboards/:primaryId/charts/:primaryId/labelFieldName` | replace / remove |  |  |
| `/dashboards/:primaryId/charts/:primaryId/limit` | replace / remove |  |  |
| `/dashboards/:primaryId/charts/:primaryId/name` | replace / remove |  |  |
| `/dashboards/:primaryId/charts/:primaryId/numeratorChartId` | replace / remove |  |  |
| `/dashboards/:primaryId/charts/:primaryId/query` | replace / remove |  |  |
| `/dashboards/:primaryId/charts/:primaryId/connectionName` | replace / remove |  |  |
| `/dashboards/:primaryId/charts/:primaryId/relationshipFieldName` | replace / remove |  |  |
| `/dashboards/:primaryId/charts/:primaryId/smartRoute` | replace / remove |  |  |
| `/dashboards/:primaryId/charts/:primaryId/s3Versions` | replace / remove |  |  |
| `/dashboards/:primaryId/charts/:primaryId/allowJavascript` | replace |  |  |
| `/dashboards/:primaryId/charts/:primaryId/sourceCollectionId` | replace / test / remove |  |  |
| `/dashboards/:primaryId/charts/:primaryId/timeRange` | replace / remove |  |  |
| `/dashboards/:primaryId/charts/:primaryId/type` | replace / test / remove |  |  |
| `/workspaces/-` | add |  |  |
| `/workspaces/:collectionId/icon` | replace |  |  |
| `/workspaces/:collectionId/name` | replace |  |  |
| `/workspaces/:collectionId/position` | replace |  |  |
| `/workspaces/:collectionId` | remove |  |  |
| `/workspaces/:collectionId/components/-` | add |  | ⚠ WorkspaceComponentNameDuplication |
| `/workspaces/:collectionId/components/:primaryId/name` | replace |  | ⚠ WorkspaceComponentNameDuplication |
| `/workspaces/:collectionId/components/:primaryId/displaySettings` | replace |  |  |
| `/workspaces/:collectionId/components/:primaryId/visibility` | replace |  |  |
| `/workspaces/:collectionId/components/:primaryId/options/collectionId` | test |  | poly:collection |
| `/workspaces/:collectionId/components/:primaryId/options/relatedDataFieldName` | test |  | poly:collection |
| `/workspaces/:collectionId/components/:primaryId/options/segmentId` | replace |  | poly:collection |
| `/workspaces/:collectionId/components/:primaryId/options/onRowClick` | replace |  | poly:collection |
| `/workspaces/:collectionId/components/:primaryId/options/visibleColumns/-` | add |  | poly:collection |
| `/workspaces/:collectionId/components/:primaryId/options/visibleColumns/:fieldName` | remove |  | poly:collection |
| `/workspaces/:collectionId/components/:primaryId/options/visibleColumns/:fieldName/position` | replace |  | poly:collection |
| `/workspaces/:collectionId/components/:primaryId/options/sortingOrder` | replace |  | poly:collection |
| `/workspaces/:collectionId/components/:primaryId/options/sortingFieldName` | replace |  | poly:collection |
| `/workspaces/:collectionId/components/:primaryId/options/recordsPerPage` | replace |  | poly:collection |
| `/workspaces/:collectionId/components/:primaryId/options/showSearchbar` | replace |  | poly:collection |
| `/workspaces/:collectionId/components/:primaryId/options/enableSegments` | replace |  | poly:collection |
| `/workspaces/:collectionId/components/:primaryId/options/showFilters` | replace |  | poly:collection |
| `/workspaces/:collectionId/components/:primaryId/options/showCreate` | replace |  | poly:collection |
| `/workspaces/:collectionId/components/:primaryId/options/showActions` | replace |  | poly:collection |
| `/workspaces/:collectionId/components/:primaryId/options/showWorkflows` | replace |  | poly:collection |
| `/workspaces/:collectionId/components/:primaryId/options/filter` | replace |  | poly:collection |
| `/workspaces/:collectionId/components/:primaryId/options/viewId` | replace |  | poly:collection |
| `/workspaces/:collectionId/components/:primaryId/options/tabs/-` | add |  | poly:tabs |
| `/workspaces/:collectionId/components/:primaryId/options/tabs/:primaryId/${key}` | replace |  | poly:tabs |
| `/workspaces/:collectionId/components/:primaryId/options/tabs/:primaryId` | remove |  | poly:tabs |
| `/workspaces/:collectionId/components/:primaryId/options/tabs/:primaryId/componentIds/-` | add |  | poly:tabs |
| `/workspaces/:collectionId/components/:primaryId/options/tabs/:primaryId/componentIds/:primaryId` | remove |  | poly:tabs |
| `/workspaces/:collectionId/components/:primaryId/options/componentIds/-` | add |  | poly:section |
| `/workspaces/:collectionId/components/:primaryId/options/componentIds/:primaryId` | remove |  | poly:section |
| `/workspaces/:collectionId/components/:primaryId/options/templateUrl` | replace |  | poly:smart |
| `/workspaces/:collectionId/components/:primaryId/options/componentUrl` | replace |  | poly:smart |
| `/workspaces/:collectionId/components/:primaryId/options/styleUrl` | replace |  | poly:smart |
| `/workspaces/:collectionId/components/:primaryId` | remove |  |  |
| `/workspaces/:collectionId/components/:primaryId/options` | replace | inbox |  |
| `/sections` | replace |  |  |
| `/inboxes/-` | add | inbox | ⚠ InboxNameDuplication, InboxSegmentIdDuplication |
| `/inboxes/:primaryId/name` | replace | inbox | ⚠ InboxNameDuplication |
| `/inboxes/:primaryId/icon` | replace | inbox |  |
| `/inboxes/:primaryId/position` | replace | inbox |  |
| `/inboxes/:primaryId/folder` | replace | inbox |  |
| `/inboxes/:primaryId/unassignAfter` | replace | inbox |  |
| `/inboxes/:primaryId/tasksLimit` | replace | inbox |  |
| `/inboxes/:primaryId/canUsersReassign` | replace | inbox |  |
| `/inboxes/:primaryId/dispatchRule` | replace | inbox |  |
| `/inboxes/:primaryId/sortingFields` | replace | inbox |  |
| `/inboxes/:primaryId` | remove | inbox |  |

### domaine `folders` (12 patterns, 12 chemins)

| chemin | ops | premium | note |
|---|---|---|---|
| `/folders/-` | add |  | ⚠ CreateFolderAsGhost |
| `/folders/:folderId` | remove |  | ⚠ DeleteMainFolder |
| `/folders/:folderId/name` | replace |  |  |
| `/folders/:folderId/icon` | replace |  |  |
| `/folders/:folderId/children/-` | add |  | ⚠ DuplicateItemInFolders |
| `/folders/:folderId/children/:collectionId/isVisible` | replace |  |  |
| `/folders/:folderId/children/:collectionId/position` | replace |  |  |
| `/folders/:folderId/children/:collectionId` | remove |  |  |
| `/folders/:folderId/children/:collectionId/subChildren/-` | add |  | ⚠ DuplicateItemInFolders |
| `/folders/:folderId/children/:collectionId/subChildren/:collectionId/isVisible` | replace |  |  |
| `/folders/:folderId/children/:collectionId/subChildren/:collectionId/position` | replace |  |  |
| `/folders/:folderId/children/:collectionId/subChildren/:collectionId` | remove |  |  |

### domaine `workflows` (7 patterns, 7 chemins) — *coquille seule ; le BPMN passe par un upload S3 séparé*

| chemin | ops | premium | note |
|---|---|---|---|
| `/workflows/-` | add |  | ⚠ WorkflowNameUniqueness |
| `/workflows/:workflowId` | remove |  |  |
| `/workflows/:workflowId/name` | replace |  | ⚠ WorkflowReplaceNameUniqueness |
| `/workflows/:workflowId/bpmnAwsS3Identifier` | replace |  |  |
| `/workflows/:workflowId/segmentIds` | replace |  |  |
| `/workflows/:workflowId/position` | replace |  |  |
| `/workflows/:workflowId/isVisible` | replace |  |  |
