# SocialClaw CLI

The `socialclaw` CLI is an optional command-line client for the hosted SocialClaw service.

It is not required for this skill. This skill can operate over the SocialClaw HTTP API alone.

If the CLI is installed, it gives the agent or user a shorter way to do the same hosted operations:
- store a workspace API key locally
- start account connection flows
- upload media
- validate and apply schedules
- inspect posts, runs, analytics, and workspace health
- install the packaged Claude Code command

Install:

```bash
npm install -g socialclaw
```

Commands:
- primary command: `socialclaw`
- alias: `social`

## Authentication

Use the dashboard to create a workspace API key, then log in:

```bash
socialclaw login --api-key <workspace-key>
```

This stores the key locally and uses `https://getsocialclaw.com` by default.

The workspace must also have an active trial or paid plan for CLI/API execution. If commands return `plan_required` or `subscription_*`, direct the user to:

- `https://getsocialclaw.com/pricing`
- `https://getsocialclaw.com/dashboard`

If the user has no key yet:

```bash
open https://getsocialclaw.com/dashboard
```

Install the Claude Code command:

```bash
socialclaw install --claude
```

## Accounts

List connected accounts:

```bash
socialclaw accounts list --json
```

Inspect what an account supports:

```bash
socialclaw accounts capabilities --account-id <account-id> --json
socialclaw accounts settings --account-id <account-id> --json
socialclaw accounts actions --account-id <account-id> --json
```

Start a browser-based account connection:

```bash
socialclaw accounts connect --provider youtube --open
socialclaw accounts status --connection-id <connection-id> --json
```

Connect Pinterest through the standard OAuth flow:

```bash
socialclaw accounts connect --provider pinterest --open
socialclaw accounts capabilities --provider pinterest --json
```

Pinterest is board-centric. After connecting, inspect account actions before assuming sections, catalogs, or advanced product/collection/idea surfaces are available:

```bash
socialclaw accounts actions --account-id <account-id> --json
socialclaw accounts action --account-id <account-id> --action <action-id> --body '{}' --json
```

Connect Telegram manually with a bot token and chat target:

```bash
socialclaw accounts connect --provider telegram --bot-token <bot-token> --chat-id @yourchannel --json
```

Use a numeric `chat_id` when posting into a group/supergroup that does not expose a stable username.

Connect Discord manually with a channel webhook URL:

```bash
socialclaw accounts connect --provider discord --webhook-url <discord-webhook-url> --json
```

Use a channel webhook URL created from the target Discord server/channel integrations screen.

Disconnect an account:

```bash
socialclaw accounts disconnect --account-id <account-id> --json
```

## Media

Upload media into the workspace:

```bash
socialclaw assets upload --file ./image.png --json
socialclaw assets upload --file ./video.mp4 --json
```

Delete an uploaded asset:

```bash
socialclaw assets delete --asset-id <asset-id> --retention-days 7 --json
```

## Schedules and campaigns

Validate a schedule file before applying it:

```bash
socialclaw validate -f schedule.json --json
```

Preview a campaign:

```bash
socialclaw campaigns preview -f schedule.json --json
```

Apply a schedule:

```bash
socialclaw apply -f schedule.json --json
```

Inspect a stored campaign/run:

```bash
socialclaw campaigns inspect --run-id <run-id> --json
socialclaw campaigns clone --run-id <run-id> --output cloned.json --json
```

Publish a draft run:

```bash
socialclaw publish-draft --run-id <run-id> --start-at 2026-03-25T10:00:00.000Z --json
```

## Posts and runs

List posts:

```bash
socialclaw posts list --limit 20 --json
```

Filter posts:

```bash
socialclaw posts list --provider youtube --status published --limit 20 --json
```

Inspect an individual post or its attempts:

```bash
socialclaw posts get --post-id <post-id> --json
socialclaw posts attempts --post-id <post-id> --json
```

Reconcile a provider post:

```bash
socialclaw posts reconcile --post-id <post-id> --json
```

Inspect a run:

```bash
socialclaw runs inspect --run-id <run-id> --json
socialclaw status --run-id <run-id> --json
```

Retry or cancel:

```bash
socialclaw retry --post-id <post-id> --json
socialclaw cancel --post-id <post-id> --json
```

Render a timeline view:

```bash
socialclaw view --run-id <run-id> --format terminal
socialclaw view --run-id <run-id> --format html --output run.html
```

## Analytics and workspace health

Inspect analytics:

```bash
socialclaw analytics post --post-id <post-id> --json
socialclaw analytics account --account-id <account-id> --json
socialclaw analytics run --run-id <run-id> --json
```

Pinterest pin analytics and Pinterest account analytics use the same commands after the target board/account is connected.

Force a refresh:

```bash
socialclaw analytics refresh --post-id <post-id> --json
```

Inspect workspace health:

```bash
socialclaw workspace health --json
socialclaw connections health --json
socialclaw jobs list --limit 20 --json
socialclaw usage --json
```

## What the CLI does not do

- It does not replace the SocialClaw backend.
- It does not contain provider OAuth implementations by itself.
- It does not eliminate the need for a workspace API key.
- It is a client for the hosted service, not a standalone scheduler.
- Telegram is a manual bot-token provider, not an OAuth browser redirect.
- Pinterest product, collection, and idea surfaces should be treated as capability-gated or beta until account capabilities/actions confirm them.
