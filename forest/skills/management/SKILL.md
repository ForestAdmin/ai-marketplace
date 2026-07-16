---
name: management
description: >
  Administer a Forest Admin project headlessly — access (roles, users, teams) and
  the dev lifecycle (branches, environments, deploy). Use when the user wants to
  invite/edit a user, create/copy/apply roles, create/delete a team or copy a
  team's layout, create a branch, push layout changes, create/reset/update an
  environment, or deploy to production. Wraps the toolbelt's `roles:*`, `users:*`,
  `teams:*`, `branch`, `switch`, `push`, `deploy`, `environments:*` commands.
  For first-time zero→prod bootstrap use `onboard`; for the UI use `layout`.
---

# Forest Admin — project management

Administration of an existing project, in two areas:

- **Access** — who's on the project and what they can do (`roles`, `users`, `teams`).
- **Dev lifecycle** — how layout/schema changes move dev→prod (`branch`, `push`, `deploy`, `environments`).

Not here: first-time bootstrap (project/DB/agent/first-deploy) → **`onboard`**; UI/workspaces → **`layout`**; agent code → **`forest-code`**.

## Command contract (every call)

Resolve ids from `forest environments --format json` (never guess) → build with all flags up front →
wrap `bash -c '… </dev/null 2>&1'` → never hand-answer a prompt (a prompt = a missing flag) → ignore the
`Could not find typescript` warning. Names (role/team/env) are passed **verbatim**.

## Two ordering gotchas (they cause the classic failures)

1. **The first role is created by the production deploy.** So `users:invite`/`users:edit -r <role>`
   **before** any deploy fails with *"No role found"*. Fix: deploy first, **or** create a role up front
   with `forest roles:create -n <name> -p <id>`.
2. **Branches need a remote (production) environment.** `forest branch` refuses on a dev-only project
   (*"…until this project has either a remote or a production environment"*). A `create:demo` dev-only
   project can't branch — and doesn't need to (it accepts direct layout writes).

---

## Access

### Roles
```bash
forest roles:create -n <name> -p <id>                       # create an empty role
forest roles:export -e <env> -p <id>                        # export roles → wide-format CSV
forest roles:apply <file.csv> -e <env> -p <id> [-F]         # apply a wide-format CSV of roles/permissions
forest roles:copy -f <src env> -t <dst env> -p <id>         # copy all roles between environments
```
- **Roles-as-code round-trip**: `roles:export` → edit the **wide-format CSV** (one row per role, columns
  = collections/actions/scopes) → `roles:apply`. This is the versionable, reviewable way to manage RBAC.
- `roles:apply` is per-**environment** (`-e` required). `-F` skips confirmation.

### Users
```bash
forest users:list -p <id>                                                    # who's on the project
forest users:invite -e <email> -l <level> [-r <role>] [-t <team>] -p <id>    # 🟦 sends a real email
forest users:edit  -e <email> [-l <level>] [-r <role>] [-t <team>…] [-f] -p <id>
```
- Permission `-l/--level`: **`admin|editor|user|developer|manager`**.
- `-e` repeats for several invitees; role/team resolve **by name**. `users:edit -t` sets the team(s)
  (`-f` to confirm when teams would be removed).
- ⚠️ invite/edit-with-role require a role to exist → see gotcha #1.

### Teams
```bash
forest teams:create -n <name> -p <id>
forest teams:delete -n <name> -p <id> [--force]
forest teams:copy-layout -f <team> -t <team> -p <id> [--force]   # ⚠ overwrites the destination team's layout
```

---

## Dev lifecycle

### Branches (isolate layout/schema changes)
```bash
forest branch <name> -p <id> [-o <origin env>]     # create a branch off an environment
forest branch --format json                        # list branches
forest branch <name> -d [--force]                  # delete
forest switch <name>                               # set the current local branch
```
A branch lets you edit a dev env's layout without touching production, then promote it. (Layout edits on
a dev env require a current branch — see the `layout` skill.)

### Promote & deploy
```bash
forest push -p <id> [--force]      # push the current branch's layout changes to its environment
forest deploy -p <id> [-f]         # deploy dev → production
```
For the **full first go-to-prod** (create prod env, prod DB, Heroku push with the production
`FOREST_ENV_SECRET`, activate) use the **`onboard`** skill's Segment 2 / the **`deploy-heroku`** skill —
they own the PaaS findings and secret-by-reference handling. This skill's `deploy`/`push` are the
granular commands for a project already wired for prod.

### Environments
```bash
forest environments -p <id> --format json                      # list (source of ids)
forest environments:create --type production -n Production -p <id>
forest environments:get <env id> --format json                # read (e.g. isActive, secretKey — pipe secrets, never print)
forest environments:update -e <env id> -u <apiEndpoint url>    # set URL → activates when apimap+endpoint present
forest environments:reset -e <env name> -p <id> [--force]      # reset a remote env's layout changes
forest environments:delete -e <env id> --force
```

## Secrets

`environments:get … secretKey` and the production `FOREST_ENV_SECRET`/`DATABASE_URL` are secrets — never
print them to the model. Pipe by reference (`forest environments:get <id> --format json | jq -r .secretKey | …`),
as in the `onboard` / `deploy-heroku` skills.
