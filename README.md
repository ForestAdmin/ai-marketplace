# Forest Admin AI Marketplace

Collection of AI skills for Forest Admin integrations.

## Available Skills

### forest-mcp

MCP server skill for querying and manipulating Forest Admin data. Provides tools for:
- Listing and searching records
- Creating, updating, and deleting records
- Exploring collection schemas and relations
- Filtering with comprehensive operators

## Installation

### Claude Code

Copy the skill folder to one of these locations:

**Personal (available in all projects):**
```bash
cp -r forest-mcp ~/.claude/skills/
```

**Project-specific (shared via git):**
```bash
cp -r forest-mcp .claude/skills/
```

Restart Claude Code. The skill will be automatically detected.

### Claude Desktop

1. Create a ZIP of the skill folder:
   ```bash
   zip -r forest-mcp.zip forest-mcp/
   ```

2. In Claude Desktop:
   - Go to **Settings > Capabilities**
   - Enable **Code execution and file creation**
   - In the Skills section, click **Upload skill**
   - Select the `forest-mcp.zip` file

## License

MIT
