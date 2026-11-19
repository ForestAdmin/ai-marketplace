# forest-docs

Ask Claude anything about Forest and get answers grounded in the official documentation. The plugin connects Claude to the Forest documentation MCP server, so Claude can search and read the docs on demand instead of answering from memory.

## Install

In Claude Code:

```
/plugin install forest-docs --marketplace ForestAdmin/ai-marketplace
```

## What it does

The plugin declares one remote MCP server, `forest-docs`, reached over HTTPS at:

```
https://docs.forest.app/mcp
```

When you ask a Forest question, Claude sends search queries and page requests to that server and reads the documentation pages it returns. The server only serves public documentation: it needs no account, no API key and no credentials, and the plugin sends no data about your project or your files.

The plugin contains no skills, hooks or scripts, and runs nothing on your machine.

## Example prompts

- "How do I add a smart action with a form in the Node.js agent?"
- "What is the difference between a segment and a scope?"
- "How do I deploy my Forest project to production?"

## Privacy

Forest's privacy policy: https://forest.app/legal/privacy-policy

## License

MIT, see [LICENSE](../LICENSE).
