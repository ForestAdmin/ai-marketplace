---
name: forest-mcp
description: |
  Query and manipulate Forest Admin data through MCP tools. Use when the user wants to search, filter, explore, create, update, delete data from their Forest Admin database. Triggers on questions like "find all users", "create a new order", "update user 42", "delete inactive products", "show me customers from Paris", or any data operation request involving Forest Admin collections.
---

# Forest Admin MCP Server

MCP server providing CRUD operations on Forest Admin data.

## Quick Start

**Always start by describing the collection** to understand available fields, operators, and relations:

```json
{ "name": "describeCollection", "arguments": { "collectionName": "users" } }
```

## Available Tools

| Tool | Purpose |
|------|---------|
| `describeCollection` | Get schema: fields, types, operators, relations, actions |
| `list` | Query records with search, filters, sort, pagination |
| `listRelated` | Query related records (one-to-many, many-to-many) |
| `create` | Create a new record |
| `update` | Update an existing record |
| `delete` | Delete one or more records |

## Tool Usage

### describeCollection

**Always call first** before querying or modifying data.

```json
{
  "name": "describeCollection",
  "arguments": { "collectionName": "orders" }
}
```

Returns: fields (name, type, operators), relations, actions, metadata.

### list

Query records from a collection.

```json
{
  "name": "list",
  "arguments": {
    "collectionName": "users",
    "search": "john",
    "filters": { "field": "status", "operator": "Equal", "value": "active" },
    "sort": { "field": "createdAt", "ascending": false },
    "fields": ["id", "name", "email"],
    "pagination": { "size": 10, "number": 1 },
    "enableCount": true
  }
}
```

**Parameters:**
- `collectionName` (required): Collection to query
- `search`: Free-text search
- `filters`: Filter conditions (see [filters reference](references/filters-reference.md))
- `sort`: `{ field, ascending }` - Sort results
- `fields`: Limit returned fields. Use `relationName@@@fieldName` for relation fields
- `pagination`: `{ size, number }` - Default: 15 records, page 1
- `enableCount`: Return `totalCount` alongside records
- `shouldSearchInRelation`: Also search in related collections

### listRelated

Query records from a relation.

```json
{
  "name": "listRelated",
  "arguments": {
    "collectionName": "users",
    "relationName": "orders",
    "parentRecordId": 42,
    "filters": { "field": "status", "operator": "Equal", "value": "pending" }
  }
}
```

Same parameters as `list`, plus:
- `relationName` (required): Relation name on parent collection
- `parentRecordId` (required): ID of parent record

### create

```json
{
  "name": "create",
  "arguments": {
    "collectionName": "users",
    "attributes": { "name": "John Doe", "email": "john@example.com" }
  }
}
```

### update

```json
{
  "name": "update",
  "arguments": {
    "collectionName": "users",
    "recordId": 42,
    "attributes": { "status": "inactive" }
  }
}
```

### delete

```json
{
  "name": "delete",
  "arguments": {
    "collectionName": "users",
    "recordIds": [42, 43, 44]
  }
}
```

## Filter Syntax

Simple filter:
```json
{ "field": "status", "operator": "Equal", "value": "active" }
```

Combined filters:
```json
{
  "aggregator": "And",
  "conditions": [
    { "field": "status", "operator": "Equal", "value": "active" },
    { "field": "createdAt", "operator": "After", "value": "2024-01-01" }
  ]
}
```

Filter on relation field (use `@@@` separator):
```json
{ "field": "company@@@name", "operator": "Contains", "value": "Inc" }
```

**Common operators:** `Equal`, `NotEqual`, `Contains`, `IContains`, `StartsWith`, `In`, `NotIn`, `LessThan`, `GreaterThan`, `Before`, `After`, `Present`, `Blank`

See [filters reference](references/filters-reference.md) for complete operator list.

## Understanding Operators

When `describeCollection` returns `operators: null` for a field, it means the operators are **unknown** (older agent version), not that filtering is unsupported. In this case:
- Try common operators (`Equal`, `Contains`, `In`, etc.)
- The request will fail with a clear error if the operator is not supported

When operators are returned, use only those listed for each field.

## Best Practices

1. **Describe first**: Always call `describeCollection` to discover available fields
2. **Use field projection**: Specify `fields` to reduce data transfer
3. **Paginate large results**: Use `pagination` for large datasets
4. **Handle unknown operators**: When `operators: null`, try common operators - errors are informative
