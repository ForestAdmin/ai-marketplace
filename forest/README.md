# forest — build a Forest Admin back-office from Claude

Set up and run a [Forest Admin](https://www.forestadmin.com) back-office **headlessly** — from Claude, in
your terminal, no clicking through the UI. Connect your database (or try a zero-DB demo), build screens,
automate processes, manage access, and deploy to production.

## Start here

```
/forest:start
```

That's it. Claude checks your tools, logs you in, connects a database (or spins up a demo with sample data),
boots your dev agent, and gives you a link to your live back-office. It asks before anything outward-facing.

## What it can do

Two slash commands; **everything else is *ask-driven*** — describe what you want and the right skill kicks in.

| You want to… | Do this | 
|---|---|
| **Get started / connect data** | `/forest:start` |
| **Build a screen** (workspace, master→detail, charts, folders) | *ask:* "build me a review screen for refunds" |
| **Automate a process** (approval, escalation) | *ask:* "add an approval workflow on refund_requests" |
| **Manage access** (roles, users, teams) | *ask:* "invite alice as an editor" |
| **Deploy to production** (+ invite the team) | `/forest:deploy`, or *ask:* "put this in production" |
| **Run it in your own app / infra** (mount on Express, Docker, private database) | *ask:* "mount Forest in my Express app" |
| **Customize behaviour** (actions, computed fields, hooks) | *ask* — handled by the companion `forest-code` plugin |

You don't hunt for commands. You say what you want; Claude picks the tool.

## Prerequisites

- **Node + npm** and **git**
- A **Forest Admin account** — [sign up](https://app.forestadmin.com) (web only; there's no CLI signup)
- A **database** to connect *or* nothing at all (the zero-DB demo runs on built-in sample data)
- *For production deploy:* the **Heroku CLI** logged in, and a **billed Heroku team**

## A few words you'll see

- **Agent** — the small program that connects your database to Forest and serves it. Runs on *your* machine/infra; Forest never holds your data.
- **Back-office** — your Forest UI at `https://app.forestadmin.com/<project>`. The thing you actually open and use.
- **Environment** — an instance of your project: **development** (local, just you) and **production** (live, for your team).
- **Workspace** — a custom screen: a master list you pick a record from, plus detail panels, charts and buttons that follow the selection.
- **Demo / zero-DB** — a throwaway project on sample fintech data, to see Forest working in a couple of minutes with no database.

More depth (for the curious): [`skills/onboard/references/concepts.md`](skills/onboard/references/concepts.md).

## What "done" looks like

A working back-office reading your real data at `https://app.forestadmin.com/<your-project>` — first on your
machine (dev), then optionally deployed so your team can use it. Start with `/forest:start` and follow along.
