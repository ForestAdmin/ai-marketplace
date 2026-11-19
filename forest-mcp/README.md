# forest-mcp

A skill that teaches Claude how to work with Forest Admin data through the Forest Admin MCP server: explore a collection's schema, then search, filter, create, update and delete records.

## Install

In Claude Code:

```
/plugin install forest-mcp --marketplace ForestAdmin/ai-marketplace
```

## What it does

The plugin contains one skill, `forest-mcp`, and nothing else. It is documentation for Claude: how to call the Forest Admin MCP tools (`describeCollection`, `list`, `listRelated`, `create`, `update`, `delete`), how to write filters (including filters on related fields with the `@@@` separator), and which operators to use.

The plugin does not bundle or start an MCP server, run any script or hook, or send data anywhere by itself. To use it, connect the Forest Admin MCP server for your project in Claude. Every request then goes through that server, with your own Forest Admin sign-in and the permissions your role has in the project.

## Write operations

`create`, `update` and `delete` change records in your Forest Admin project. The skill tells Claude to describe the collection first and to confirm with you before it creates, updates or deletes records.

## Example prompts

- "Show me the customers from Paris created this month"
- "How many orders are still pending for user 42?"
- "Mark subscription 1234 as cancelled"

## Privacy

Forest Admin's privacy policy: https://www.forestadmin.com/legal/privacy-policy

## License

MIT, see [LICENSE](../LICENSE).
