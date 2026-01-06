# Forest Admin AI Marketplace

AI skills and plugins for Forest Admin integrations.

## Available Plugins

### forest-mcp

MCP server skill for querying and manipulating Forest Admin data. Provides tools for:
- Listing and searching records
- Creating, updating, and deleting records
- Exploring collection schemas and relations
- Filtering with comprehensive operators

## Installation

### Claude Code

**Option 1: Via marketplace (recommended)**
```
/plugin marketplace add ForestAdmin/ai-marketplace
/plugin install forest-mcp
```

**Option 2: Manual copy**

Copy the skill folder to your skills directory:

```bash
# Personal (all projects)
cp -r forest-mcp/skills/forest-mcp ~/.claude/skills/

# Project-specific (shared via git)
cp -r forest-mcp/skills/forest-mcp .claude/skills/
```

### Claude Desktop

1. Create a ZIP of the skill folder:
   ```bash
   cd forest-mcp/skills
   zip -r forest-mcp.zip forest-mcp/
   ```

2. In Claude Desktop:
   - Go to **Settings > Capabilities**
   - Enable **Code execution and file creation**
   - In the Skills section, click **Upload skill**
   - Select the `forest-mcp.zip` file

## Repository Structure

```
ai-marketplace/
├── .claude-plugin/
│   └── marketplace.json          # Marketplace catalog
└── forest-mcp/                   # Plugin
    ├── .claude-plugin/
    │   └── plugin.json           # Plugin manifest
    └── skills/
        └── forest-mcp/           # Skill
            ├── SKILL.md
            └── references/
                └── filters-reference.md
```

## License

MIT
