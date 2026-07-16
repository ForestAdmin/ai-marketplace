# Forest Admin — minimal concepts (onboarding grounding)

> Just-enough vocabulary to run the headless onboarding **offline**. For anything deeper, use the **`forest-docs`** plugin (live docs) or https://docs.forestadmin.com.

- **Account / project** — you sign up for an **account in the web UI** (https://app.forestadmin.com — there is no CLI signup; email verification + ToS live there), then `forest login`. You then create a **project**: one **back-office** backed by your data, containing several environments. The back-office is Forest's UI at `https://app.forestadmin.com/<project>` — what users open; the agent server is its *backend*, never "the back-office".

- **Agent** — the program (Node.js `@forestadmin/agent` or Ruby `forest_admin_agent`) that connects to your database and exposes it to Forest. In **Standalone** mode it runs as its own server (vs **in-app**, embedded in an existing app). It runs on *your* infrastructure; Forest never holds your data.

- **Demo datasource** — the zero-DB path (`forest projects:create:demo`) scaffolds the agent on a **self-contained demo datasource** (`@forestadmin/datasource-demo-fintech`, bundled local data) instead of a real DB: realistic fintech sample data. No external `DATABASE_URL`, no introspection. For evaluating Forest end-to-end in minutes; the data is ephemeral. The scaffold also **ships a curated `forest-layout.json`** but does **not** apply it — run `forest layout:apply forest-layout.json` after boot (a separate onboarding step the orchestrator owns).

- **Environment** — an instance of the project. Types:
  - **development** — per-user local env; **roles are disabled**; created via `forest init` / the dev flow.
  - **remote** — a shared non-production env (staging-like); needs a reachable URL to be active.
  - **production** — the live env; its first deployment **creates the project's first role**.
  - An env is **active** when `isActive = apimapVersionId && apiEndpoint` (schema pushed **and** URL set).

- **Schema ↔ apimap** — the agent computes a **schema** of your collections/fields and pushes it to Forest as an **apimap** (versioned, `apimapVersionId`). In dev it is regenerated at boot; in **production** the agent serves the **committed** `.forestadmin-schema.json` (regenerate + commit + redeploy after changes).

- **Layout vs schema** — the **schema/apimap** = the data structure (collections, fields, relationships). The **layout** = the UI arrangement (what's shown, order, views). `forest deploy` pushes the **layout**, not the agent code.

- **Team / role / permission** — users belong to **teams**; a **role** carries the fine-grained permissions; a **permission level** (`admin|editor|user|developer|manager`) is the coarse access tier. An **invitation** ties an email to a team + role + permission level. The first **role** ("Operations") is created on production deployment.

- **Secrets** — `FOREST_ENV_SECRET` ties the agent to one environment (each env has its own). `FOREST_AUTH_SECRET` is a per-agent random secret for session signing (generated client-side, not stored by Forest).

- **Customizations** — code added to the agent (actions, computed fields, hooks, segments, charts, relationships) via the **`forest-code`** plugin. Wrapped in `agent.customizeCollection(...)`.
