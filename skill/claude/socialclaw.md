# SocialClaw is a social media scheduling skill for AI agents posting to X, LinkedIn, Instagram, Facebook Pages, TikTok, Discord, Telegram, YouTube, Reddit, WordPress, and Pinterest

SocialClaw is a workspace-scoped social publishing service at `https://getsocialclaw.com`.

## What this skill is

This skill is an instruction layer for the hosted SocialClaw service.

It does not contain the SocialClaw backend or the provider integrations themselves.
It teaches Claude Code how to:
- get or use a workspace API key
- call the SocialClaw HTTP API
- understand provider and account-type caveats
- optionally use the separate `socialclaw` CLI if it is already installed

This skill can work without the CLI. The CLI is only an optional client for the same hosted service.

Use this skill when the user wants to:
- connect or disconnect social accounts in a SocialClaw workspace
- upload media and get SocialClaw-hosted delivery URLs
- validate, preview, apply, or inspect scheduled posts and campaigns
- inspect connected account capabilities, publish settings, actions, jobs, health, or analytics

Do not use this skill for editing the SocialClaw codebase itself. This is for operating a deployed SocialClaw workspace.

## Defaults

- Base URL: `https://getsocialclaw.com`
- Auth: workspace API key in `Authorization: Bearer <key>`
- Preferred interface: `socialclaw` CLI when installed
- Fallback interface: SocialClaw HTTP API

## Runtime requirements

- Required env: `SC_API_KEY`
- Hosted base URL: `https://getsocialclaw.com`
- Optional CLI: `socialclaw` or `social` if already installed
- Workspace status: an active trial or paid plan is required for CLI/API execution through the workspace key

## Optional CLI

SocialClaw has a separate npm CLI package named `socialclaw`.

Prefer it when it is already installed or the user wants command-line examples. The CLI is a client for the hosted SocialClaw service. It can:
- store a workspace API key locally
- start account connection flows
- upload assets
- validate, preview, and apply schedules
- inspect posts, runs, analytics, usage, and workspace health
- install the packaged Claude Code command with `socialclaw install --claude`

If the user explicitly wants the CLI and it is not installed yet:

```bash
npm install -g socialclaw
```

## Quick start

If the user does not have a workspace API key yet:

```bash
open https://getsocialclaw.com/dashboard
```

Tell them:
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
5. Prefer explicit provider and account-type language:
   - Facebook Pages, not Facebook personal profiles
   - Instagram Business linked to a Facebook Page
   - Instagram standalone professional accounts
   - LinkedIn profile and LinkedIn page are separate providers
   - Pinterest is board-centric; inspect capabilities and actions before assuming sections, catalogs, or advanced surfaces
6. If a provider workflow is not supported, say so directly instead of inventing a workaround.
7. Treat Pinterest product, collection, and idea surfaces as capability-gated or beta unless account capabilities or actions explicitly advertise them.
8. Avoid echoing full API keys back into chat.

## Main workflow

1. Confirm the user has a workspace API key.
2. If needed, direct the user to the dashboard to sign in with Google and create a key.
3. Validate workspace access.
4. List accounts or start a connection flow.
5. Inspect capabilities and settings for the target account.
6. Upload media if needed.
7. Validate or preview the post or campaign.
8. Apply it.
9. Inspect posts, runs, analytics, or retry or reconcile if needed.

## CLI reference

### Authentication

```bash
socialclaw login --api-key <workspace-key>
```

Install the packaged command file:

```bash
socialclaw install --claude
```

### Accounts

```bash
socialclaw accounts list --json
socialclaw accounts capabilities --account-id <account-id> --json
socialclaw accounts settings --account-id <account-id> --json
socialclaw accounts actions --account-id <account-id> --json
socialclaw accounts connect --provider <provider> --open
socialclaw accounts connect --provider telegram --bot-token <token> --chat-id @yourchannel --json
socialclaw accounts connect --provider discord --webhook-url <url> --json
socialclaw accounts status --connection-id <id> --json
socialclaw accounts disconnect --account-id <id> --json
```

### Media

```bash
socialclaw assets upload --file ./image.png --json
socialclaw assets delete --asset-id <id> --retention-days 7 --json
```

### Schedules and campaigns

```bash
socialclaw validate -f schedule.json --json
socialclaw campaigns preview -f schedule.json --json
socialclaw apply -f schedule.json --json
socialclaw campaigns inspect --run-id <id> --json
socialclaw campaigns clone --run-id <id> --output cloned.json --json
socialclaw publish-draft --run-id <id> --start-at 2026-03-25T10:00:00.000Z --json
```

### Posts and runs

```bash
socialclaw posts list --limit 20 --json
socialclaw posts get --post-id <id> --json
socialclaw posts attempts --post-id <id> --json
socialclaw posts reconcile --post-id <id> --json
socialclaw runs inspect --run-id <id> --json
socialclaw retry --post-id <id> --json
socialclaw cancel --post-id <id> --json
socialclaw view --run-id <id> --format terminal
```

### Analytics and health

```bash
socialclaw analytics post --post-id <id> --json
socialclaw analytics account --account-id <id> --json
socialclaw analytics run --run-id <id> --json
socialclaw analytics refresh --post-id <id> --json
socialclaw workspace health --json
socialclaw connections health --json
socialclaw jobs list --limit 20 --json
socialclaw usage --json
```

## HTTP fallback

If the CLI is not available, use the HTTP API directly.

Common header:

```bash
-H "Authorization: Bearer $SC_API_KEY"
```

### Validate key

```bash
curl -sS \
  -H "Authorization: Bearer $SC_API_KEY" \
  "https://getsocialclaw.com/v1/keys/validate"
```

### List accounts

```bash
curl -sS \
  -H "Authorization: Bearer $SC_API_KEY" \
  "https://getsocialclaw.com/v1/accounts"
```

### Start account connection

```bash
curl -sS -X POST \
  -H "Authorization: Bearer $SC_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"provider":"youtube"}' \
  "https://getsocialclaw.com/v1/connections/start"
```

Then poll:

```bash
curl -sS \
  -H "Authorization: Bearer $SC_API_KEY" \
  "https://getsocialclaw.com/v1/connections/<connection-id>"
```

### Connect Telegram manually

```bash
curl -sS -X POST \
  -H "Authorization: Bearer $SC_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"provider":"telegram","botToken":"<bot-token>","chatId":"@yourchannel"}' \
  "https://getsocialclaw.com/v1/connections/start"
```

### Connect Discord manually

```bash
curl -sS -X POST \
  -H "Authorization: Bearer $SC_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"provider":"discord","webhookUrl":"<discord-webhook-url>"}' \
  "https://getsocialclaw.com/v1/connections/start"
```

### Upload media

```bash
curl -sS -X POST \
  -H "Authorization: Bearer $SC_API_KEY" \
  -F "file=@./image.png" \
  "https://getsocialclaw.com/v1/assets/upload"
```

### Apply a schedule

```bash
curl -sS -X POST \
  -H "Authorization: Bearer $SC_API_KEY" \
  -H "Content-Type: application/json" \
  -d @schedule.json \
  "https://getsocialclaw.com/v1/posts/apply"
```

### Inspect posts

```bash
curl -sS \
  -H "Authorization: Bearer $SC_API_KEY" \
  "https://getsocialclaw.com/v1/posts?limit=20"

curl -sS \
  -H "Authorization: Bearer $SC_API_KEY" \
  "https://getsocialclaw.com/v1/posts/<post-id>"
```

## Provider notes

**Facebook** — Facebook Pages only (`facebook`). Personal profiles are not publish targets.

**Instagram Business** (`instagram_business`) — professional/business accounts linked to a Facebook Page only. Requires media.

**Instagram standalone** (`instagram`) — standalone professional accounts through Instagram Login. Separate from `instagram_business`. Requires media.

**X** — text posts, up to four images or one video, reply steps in campaign flows.

**LinkedIn profile** (`linkedin`) — text and native image or video. Up to twenty images or one video per post.

**LinkedIn page** (`linkedin_page`) — separate from member profiles. Same media limits.

**Pinterest** (`pinterest`) — board-centric. Standard pins, video pins, multi-image pins. Use discovery actions to inspect boards, sections, and catalogs. Product, collection, and idea surfaces are capability-gated or beta.

**TikTok** (`tiktok`) — video only. Requires a public or SocialClaw-hosted video URL.

**Telegram** (`telegram`) — bot-based posting. Connected manually with a bot token and `chat_id` or `@channelusername`, not via OAuth. One optional image or video per post.

**Discord** (`discord`) — channel posting via webhook URL. Connected manually, not via OAuth. One optional image or video per post.

**YouTube** (`youtube`) — channel video uploads. One video per post. Community posts and Shorts-specific flows are not supported.

**Reddit** (`reddit`) — self posts and link posts. Requires a `subreddit` setting. Native media upload is not supported.

**WordPress** (`wordpress`) — WordPress.com or Jetpack-connected sites. SocialClaw uploads remote media before publishing.

**Legacy Meta** (`meta`) — older workspaces only. Prefer explicit `facebook` and `instagram_business` for new workspaces.
