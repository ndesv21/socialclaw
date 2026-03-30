---
name: socialclaw
description: Use when a user wants social media scheduling and publishing for AI agents on X, LinkedIn, Instagram, Facebook Pages, TikTok, Discord, Telegram, YouTube, Reddit, WordPress, and Pinterest through SocialClaw.
homepage: https://getsocialclaw.com
metadata: {"openclaw":{"homepage":"https://getsocialclaw.com","primaryEnv":"SC_API_KEY","requires":{"env":["SC_API_KEY"]},"install":[{"id":"npm","kind":"node","package":"socialclaw","bins":["socialclaw","social"],"label":"Install SocialClaw CLI (npm)"}]}}
---

# SocialClaw is a social media scheduling skill for AI agents posting to X, LinkedIn, Instagram, Facebook Pages, TikTok, Discord, Telegram, YouTube, Reddit, WordPress, and Pinterest

SocialClaw is a workspace-scoped social publishing service at `https://getsocialclaw.com`.

## What this skill is

This skill is an instruction layer for the hosted SocialClaw service.

It does not contain the SocialClaw backend or the provider integrations themselves.
It teaches an OpenClaw-compatible agent how to:
- get or use a workspace API key
- call the SocialClaw HTTP API
- understand provider/account-type caveats
- optionally use the separate `socialclaw` CLI if it is already installed

This skill can work without the CLI. The CLI is only an optional client for the same hosted service.

Use this skill when the user wants to:
- connect or disconnect social accounts in a SocialClaw workspace
- upload media and get SocialClaw-hosted delivery URLs
- validate, preview, apply, or inspect scheduled posts and campaigns
- inspect connected account capabilities, publish settings, actions, jobs, health, or analytics

Do not use this skill for editing the SocialClaw codebase itself. This bundle is for operating a deployed SocialClaw workspace.

## Defaults

- Base URL: `https://getsocialclaw.com`
- Auth: workspace API key in `Authorization: Bearer <key>`
- Preferred interface: `socialclaw` CLI when installed
- Fallback interface: SocialClaw HTTP API

## Runtime requirements

- Required env: `SC_API_KEY`
- Hosted base URL: `https://getsocialclaw.com`
- Optional CLI: `socialclaw` (or `social`) if already installed
- Workspace status: an active trial or paid plan is required for CLI/API execution through the workspace key

## Optional CLI

SocialClaw also has a separate npm CLI package named `socialclaw`.

Prefer it when it is already installed or the user wants command-line examples. The CLI is a client for the hosted SocialClaw service. It can:
- store a workspace API key locally
- start connection flows
- upload assets
- validate, preview, and apply schedules
- inspect posts, runs, analytics, usage, and workspace health
- install the packaged Claude Code command with `socialclaw install --claude`

The CLI is optional. This skill does not require it to function.

If the user explicitly wants the CLI and it is not installed yet:

```bash
npm install -g socialclaw
```

## Quick start

If the user does not have a workspace API key yet:

```bash
open https://getsocialclaw.com/dashboard
```

Then tell them:
- sign in with Google
- open the API key section
- create or copy their workspace API key

Set:

```bash
export SC_API_KEY="<workspace-key>"
```

If the CLI is installed, log in with it:

```bash
socialclaw login --api-key <workspace-key>
```

Otherwise validate the key over HTTP:

```bash
curl -sS \
  -H "Authorization: Bearer $SC_API_KEY" \
  "https://getsocialclaw.com/v1/keys/validate"
```

If execution fails with `plan_required`, `subscription_inactive`, `subscription_past_due`, `subscription_paused`, or `subscription_canceled`, direct the user to:

- `https://getsocialclaw.com/pricing`
- `https://getsocialclaw.com/dashboard`

## Operating rules

1. Start by confirming the user has a SocialClaw workspace API key.
2. If the user does not have a key yet, send them to `https://getsocialclaw.com/dashboard` to sign in with Google and create one.
3. A workspace API key alone is not sufficient for execution. If billing-related errors appear, route the user to pricing or dashboard billing instead of retrying commands.
4. Never ask the user for provider app secrets. End users connect accounts inside SocialClaw.
5. Prefer explicit provider/account-type language:
   - Facebook Pages, not Facebook personal profiles
   - Instagram Business linked to a Facebook Page
   - Instagram standalone professional accounts
   - LinkedIn profile and LinkedIn page are separate providers
   - Pinterest is board-centric; inspect capabilities/actions before assuming sections, catalogs, or advanced surfaces
6. If a provider workflow is not supported, say so directly instead of inventing a workaround.
7. Treat Pinterest product, collection, and idea surfaces as capability-gated or beta unless account capabilities/actions explicitly advertise them.
8. Avoid echoing full API keys back into chat.

## Main workflow

1. Confirm the user has a workspace API key.
2. If needed, direct the user to the dashboard to sign in with Google and create a key.
3. Validate workspace access.
4. List accounts or start a connection flow.
5. Inspect capabilities/settings for the target account.
6. Upload media if needed.
7. Validate or preview the post/campaign.
8. Apply it.
9. Inspect posts, runs, analytics, or retry/reconcile if needed.

## Essential examples

If the CLI is installed, prefer commands like these:

Store the workspace key:

```bash
socialclaw login --api-key <workspace-key>
```

Start a connection flow:

```bash
socialclaw accounts connect --provider youtube --open
```

Start a Pinterest OAuth connection:

```bash
socialclaw accounts connect --provider pinterest --open
```

Connect Telegram manually with a bot token and chat target:

```bash
socialclaw accounts connect --provider telegram --bot-token <bot-token> --chat-id @yourchannel --json
```

Connect Discord manually with a channel webhook URL:

```bash
socialclaw accounts connect --provider discord --webhook-url <discord-webhook-url> --json
```

List connected accounts:

```bash
socialclaw accounts list --json
```

Upload media:

```bash
socialclaw assets upload --file ./image.png --json
```

Validate a schedule:

```bash
socialclaw validate -f schedule.json --json
```

Apply a schedule:

```bash
socialclaw apply -f schedule.json --json
```

Install the Claude Code command:

```bash
socialclaw install --claude
```

Inspect a post:

```bash
socialclaw posts get --post-id <post-id> --json
```

## Connection workflow

For browser-based account linking:

- CLI:
  - `socialclaw accounts connect --provider <provider> --open`
  - then `socialclaw accounts status --connection-id <id> --json`
- API:
  - `POST /v1/connections/start`
  - return the authorize URL to the user or open it if browser tools are available
  - poll `GET /v1/connections/:connectionId`

Supported providers:
- `x`
- `facebook`
- `instagram_business`
- `instagram`
- `linkedin`
- `linkedin_page`
- `pinterest`
- `tiktok`
- `discord`
- `telegram`
- `youtube`
- `reddit`
- `wordpress`

Telegram and Discord are the exceptions to the browser-based OAuth flow.

Telegram is connected manually with:
- a Telegram bot token
- a target `chat_id` or `@channelusername`

For Telegram:
- CLI:
  - `socialclaw accounts connect --provider telegram --bot-token <token> --chat-id <@channel|chat_id> --json`
- API:
  - `POST /v1/connections/start` with `{"provider":"telegram","botToken":"...","chatId":"..." }`

Discord is connected manually with:
- a Discord channel webhook URL

For Discord:
- CLI:
  - `socialclaw accounts connect --provider discord --webhook-url <discord-webhook-url> --json`
- API:
  - `POST /v1/connections/start` with `{"provider":"discord","webhookUrl":"..." }`

## Read next

- For HTTP fallback recipes, read [references/workflows.md](./references/workflows.md).
- For the optional CLI and command examples, read [references/cli.md](./references/cli.md).
- For provider/account-type caveats, read [references/providers.md](./references/providers.md).
