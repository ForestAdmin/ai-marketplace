---
description: Start the Forest Admin headless onboarding (dev or ops flow)
argument-hint: [dev | ops | <use-case description>]
---

Launch the **onboard** skill (`/forest:onboard`) and drive the headless Forest Admin onboarding end-to-end.

Treat `$ARGUMENTS` as the initial intent:
- `dev` → the user has a database and wants to build a back-office on it (real-DB flow).
- `ops` → no database, just explore (zero-DB demo flow via `projects:create:demo`).
- anything else → a free-text use-case; infer the flow (no reachable DB ⇒ ops/demo).

Then follow the skill exactly:
1. Run the **preflight** (remediate missing tools / auth; route "no DB" to the ops flow — never fail-fast on it).
2. **Stay on rails**: run only the chosen flow's commands, no improvised exploration. Follow the **command contract** (resolve → verify → full-flagged → wrapped → never hand-answer a prompt) for every `forest` call.
3. Collect remaining intent as **arguments** (never a wizard); for the dev flow, get the DB connection via a **`.env` the user writes** — never ask for the URI in chat, never echo a secret. **Do not ask about production/deploy/invites up front** — those are decided at the milestone.
4. **Dev flow is bounded**: run **Segment 1** (auth → create → boot) to the **🎉 milestone** — prove the back-office shows the user's data, surface `https://app.forestadmin.com/<project>`, then **STOP** and present the opt-in menu. **Segment 2** (layout / customizations / deploy → invite) only runs if the user chooses it. Honor **GATE 1** (boot before any env/layout op) and **GATE 2** (deploy before invite), and the 🟦 checkpoints (prod env, deploy, invitations).
5. End on the milestone menu (core) or the concise summary (after deploy). The link to give the user is always the **back-office** `https://app.forestadmin.com/<project>` — never the localhost/Heroku agent-backend URL.

If `$ARGUMENTS` is empty, ask the user which flow fits (dev vs ops) before starting.
