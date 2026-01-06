# Filter Operators Reference

## Table of Contents
1. [Filter Structure](#filter-structure)
2. [Comparison Operators](#comparison-operators)
3. [String Operators](#string-operators)
4. [Date Operators](#date-operators)
5. [Array Operators](#array-operators)
6. [Null/Presence Operators](#nullpresence-operators)
7. [Combining Filters](#combining-filters)

## Filter Structure

Basic filter:
```json
{ "field": "fieldName", "operator": "OperatorName", "value": "someValue" }
```

Nested field (one level deep):
```json
{ "field": "relationName@@@fieldName", "operator": "Equal", "value": "someValue" }
```

## Comparison Operators

| Operator | Description | Example Value |
|----------|-------------|---------------|
| `Equal` | Exact match | `"active"`, `42`, `true` |
| `NotEqual` | Not equal | `"inactive"` |
| `LessThan` | Less than | `100` |
| `GreaterThan` | Greater than | `0` |
| `LessThanOrEqual` | Less than or equal | `99` |
| `GreaterThanOrEqual` | Greater than or equal | `1` |
| `In` | Value in array | `["active", "pending"]` |
| `NotIn` | Value not in array | `["deleted", "archived"]` |

## String Operators

| Operator | Description | Case Sensitive |
|----------|-------------|----------------|
| `Contains` | Contains substring | Yes |
| `IContains` | Contains substring | No |
| `NotContains` | Does not contain | Yes |
| `NotIContains` | Does not contain | No |
| `StartsWith` | Starts with | Yes |
| `IStartsWith` | Starts with | No |
| `EndsWith` | Ends with | Yes |
| `IEndsWith` | Ends with | No |
| `Like` | SQL LIKE pattern | Yes |
| `ILike` | SQL LIKE pattern | No |
| `Match` | Regex match | - |
| `LongerThan` | String length > value | - |
| `ShorterThan` | String length < value | - |

## Date Operators

**Relative dates (no value needed):**
| Operator | Description |
|----------|-------------|
| `Today` | Is today |
| `Yesterday` | Is yesterday |
| `Past` | Is in the past |
| `Future` | Is in the future |
| `PreviousWeek` | Is in previous week |
| `PreviousMonth` | Is in previous month |
| `PreviousQuarter` | Is in previous quarter |
| `PreviousYear` | Is in previous year |
| `PreviousWeekToDate` | From start of previous week to now |
| `PreviousMonthToDate` | From start of previous month to now |
| `PreviousQuarterToDate` | From start of previous quarter to now |
| `PreviousYearToDate` | From start of previous year to now |

**With value:**
| Operator | Value | Description |
|----------|-------|-------------|
| `Before` | ISO date | Before date |
| `After` | ISO date | After date |
| `PreviousXDays` | number | In last X days |
| `PreviousXDaysToDate` | number | From X days ago to now |
| `BeforeXHoursAgo` | number | Before X hours ago |
| `AfterXHoursAgo` | number | After X hours ago |

**Examples:**
```json
{ "field": "createdAt", "operator": "Today" }
{ "field": "createdAt", "operator": "After", "value": "2024-01-01" }
{ "field": "updatedAt", "operator": "PreviousXDays", "value": 7 }
```

## Array Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `IncludesAll` | Contains all values | `["tag1", "tag2"]` |
| `IncludesNone` | Contains none of values | `["spam", "test"]` |

## Null/Presence Operators

No value needed:
| Operator | Description |
|----------|-------------|
| `Present` | Field is not null/empty |
| `Blank` | Field is null or empty string |
| `Missing` | Field is null |

## Combining Filters

**AND conditions:**
```json
{
  "aggregator": "And",
  "conditions": [
    { "field": "status", "operator": "Equal", "value": "active" },
    { "field": "role", "operator": "Equal", "value": "admin" }
  ]
}
```

**OR conditions:**
```json
{
  "aggregator": "Or",
  "conditions": [
    { "field": "status", "operator": "Equal", "value": "pending" },
    { "field": "status", "operator": "Equal", "value": "processing" }
  ]
}
```

**Nested (max 3 levels):**
```json
{
  "aggregator": "And",
  "conditions": [
    { "field": "isActive", "operator": "Equal", "value": true },
    {
      "aggregator": "Or",
      "conditions": [
        { "field": "role", "operator": "Equal", "value": "admin" },
        { "field": "role", "operator": "Equal", "value": "superuser" }
      ]
    }
  ]
}
```
