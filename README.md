# Forest Admin AI Marketplace

AI skills and plugins for building and running Forest Admin from Claude.

## Plugins

### ★ forest — start here

Build a Forest Admin back-office **headlessly** from Claude — no clicking through the UI.

**Type `/forest:start` to begin.** It sets up everything step by step (checks your tools, logs you in,
connects a database — or spins up a zero-DB demo — boots the dev agent, and shows you your data).

From there, the plugin covers four areas. Only two are slash commands; **everything else is *ask-driven*** —
you describe what you want in plain language and the right skill kicks in:

| Area | How to trigger | What it does |
|---|---|---|
| **Onboard** | `/forest:start` | Log in → connect DB (or demo) → boot agent → see your data. |
| **Layout & workspaces** | *just ask* — "build me a review screen", "add a chart" | Collection display, dashboards/charts, folders, and workspaces with master→detail selection. |
| **Workflows** | *just ask* — "add an approval flow on refunds" | Author approval / escalation processes on a collection. |
| **Management & deploy** | *just ask*, or `/forest:deploy` | Roles, users, teams, environments, and deploy to production (Heroku). |

**Prerequisites:** Node + npm, git, a Forest Admin account ([sign up here](https://app.forestadmin.com) —
web only), and a database *or* nothing (zero-DB demo). For production deploy: the Heroku CLI + a billed team.

### forest-code

Write and maintain Forest Admin **agent code** (backend customizations). Two skills, auto-selected from the
project's `package.json` / `Gemfile`:
- **forest-code** — modern agent (`@forestadmin/agent` Node.js + `forest_admin_agent` Ruby): actions, fields, hooks, segments, charts, relationships, datasources.
- **forest-legacy** — legacy agents (`forest-express-*`, `forest-rails`): Smart Actions/Fields/Segments/Collections, routes.

Pairs with `forest` — when you ask for a customization mid-build, `forest` hands off to it.

### forest-mcp

MCP server skill for querying and manipulating Forest Admin **data**: list/search records, create/update/delete, explore collection schemas and relations, filter with rich operators.

### forest-docs

Connects your AI client to the Forest Admin **documentation** MCP server (hosted by Mintlify): search and read the docs on demand. Works in any MCP-capable tool, not only Claude.

> **Migrating?** Earlier releases had a separate `forest-onboarding` plugin — it's now part of `forest`. Install `forest`.

## Installation

### Claude Code

```
/plugin marketplace add ForestAdmin/ai-marketplace
/plugin install forest          # ★ the main plugin — start here
/plugin install forest-code     # agent customizations (recommended alongside forest)
/plugin install forest-mcp      # query/manipulate data (optional)
/plugin install forest-docs     # ask the docs (optional)
```

Then run `/forest:start` in a project folder.

### Claude Desktop

1. Create a ZIP of the skill folder (example for forest-mcp):
   ```bash
   cd forest-mcp/skills
   zip -r forest-mcp.zip forest-mcp/
   ```
2. In Claude Desktop: **Settings → Capabilities**, enable **Code execution and file creation**, then in the Skills section click **Upload skill** and select the ZIP.

## Repository Structure

```
ai-marketplace/
├── .claude-plugin/
│   └── marketplace.json          # Marketplace catalog
├── forest/                       # ★ main plugin — onboarding, layout, workflows, management
│   ├── .claude-plugin/plugin.json
│   ├── commands/                 # /forest:start, /forest:deploy
│   ├── skills/                   # onboard, layout, workflows, management, boot, deploy-heroku
│   └── tooling/                  # maintainer scripts (not loaded as skills)
├── forest-code/                  # agent customization code (modern + legacy)
├── forest-mcp/                   # data MCP skill
└── forest-docs/                  # docs MCP
```

## License

MIT
