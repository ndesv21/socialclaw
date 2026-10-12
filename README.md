<p align="center">
  <img src="https://raw.githubusercontent.com/ndesv21/socialclaw/main/.github/readme/logo.png" alt="SocialClaw logo" width="112">
</p>

<h1 align="center">SocialClaw</h1>

<p align="center">
  Social media scheduling CLI and OpenClaw skill for AI agents posting to X, LinkedIn, Instagram, Threads, Facebook Pages, TikTok, Discord, Telegram, YouTube, Reddit, WordPress, and Pinterest.
</p>

<p align="center">
  <a href="https://getsocialclaw.com"><strong>Official Website: getsocialclaw.com</strong></a> ·
  <a href="https://getsocialclaw.com/dashboard">Dashboard</a> ·
  <a href="https://www.npmjs.com/package/socialclaw">npm</a> ·
  <a href="https://github.com/ndesv21/socialclaw/tree/main/skill">Skill Bundle</a>
</p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/ndesv21/socialclaw/main/.github/readme/workflow-dark.png">
    <img src="https://raw.githubusercontent.com/ndesv21/socialclaw/main/.github/readme/workflow-light.png" alt="SocialClaw turns prompts, workflows, and AI agents into scheduled publishing, retries, inspection, and analytics across social channels." width="100%">
  </picture>
</p>

**[getsocialclaw.com](https://getsocialclaw.com) is the official SocialClaw website** — the hosted dashboard, API, and account sign-up all live there.

This repo is the public home for:
- the `socialclaw` npm CLI
- the OpenClaw and ClawHub skill bundle
- the Claude plugin with hosted MCP/OAuth and the optional `/socialclaw` command asset
- public usage docs, provider notes, and schedule examples

## Claude plugin

For Claude, use the focused bundle in [`plugins/socialclaw/`](./plugins/socialclaw). It connects to the hosted MCP server through OAuth and includes the current publishing, analytics, and Instagram workflow skill. No CLI installation or API-key environment variable is required. See [submission steps](./docs/claude-directory-submission.md) for the maintainer workflow.

## Install

```bash
npm install -g socialclaw
socialclaw login
socialclaw accounts list --json
```

**Install as an AI agent skill** (Claude Code, Cursor, Cline, Codex, and more):

```bash
npx skills add ndesv21/socialclaw
```

## What the CLI covers

- workspace API key login and hosted dashboard bootstrap
- browser OAuth connect plus manual Discord and Telegram connect
- hosted asset upload and deletion
- schedule validation, campaign preview, apply, inspect, clone, and draft publishing
- post, run, attempt, analytics, job, usage, and health inspection
- provider-side deletion for supported published posts
- Claude Code command installation through `socialclaw install --claude`

## CLI at a glance

```bash
socialclaw login
socialclaw accounts list --json
socialclaw assets upload --file ./image.png --json
socialclaw validate -f schedule.json --json
socialclaw apply -f schedule.json --json
socialclaw posts delete --post-id <post-id> --json
```

<details>
<summary>Current help surface</summary>

```text
____             _       _      ____ _
/ ___|  ___   ___(_) __ _| |    / ___| | __ ___      __
\___ \ / _ \ / __| |/ _` | |   | |   | |/ _` \ \ /\ / /
 ___) | (_) | (__| | (_| | |   | |___| | (_| |\ V  V /
|____/ \___/ \___|_|\__,_|_|    \____|_|\__,_| \_/\_/

socialclaw login
socialclaw accounts list --json
socialclaw assets upload --file <path> --json
socialclaw campaigns preview -f <schedule.(yaml|yml|json)> --json
socialclaw validate -f <schedule.(yaml|yml|json)> --json
socialclaw apply -f <schedule.(yaml|yml|json)> --json
socialclaw posts get --post-id <id> --json
socialclaw posts delete --post-id <id> --json
socialclaw status --run-id <id> --json
socialclaw analytics post --post-id <id> --json
```

</details>

## Watch the Demo

<p align="center">
  <a href="https://www.youtube.com/watch?v=Biy8saQqf44">
    <img src="https://raw.githubusercontent.com/ndesv21/socialclaw/main/.github/readme/socialclaw-demo-poster.png" alt="Watch the SocialClaw demo video" width="820">
  </a>
</p>

<p align="center">
  <sub>Click the image to open the demo video.</sub>
</p>

## Built for Agent-Driven Publishing

<p align="center">
  <img src="https://raw.githubusercontent.com/ndesv21/socialclaw/main/.github/readme/agent-social-banner.jpg" alt="SocialClaw connects AI agents to social publishing across major channels." width="100%">
</p>

## Authentication and access

Running `socialclaw login` without an API key opens the hosted dashboard so the user can:

- sign in with Google
- connect social accounts
- create or copy a workspace API key
- activate a trial or paid plan for CLI and API access

Important:

- the CLI works against a deployed SocialClaw workspace via API key auth
- an API key alone is not enough for agent execution; the workspace must also have an active trial or paid plan
- if a command returns `plan_required` or `subscription_*`, go to `https://getsocialclaw.com/pricing` or `https://getsocialclaw.com/dashboard`

## Quick start

```bash
socialclaw login
socialclaw login --api-key <workspace-key> --base-url https://getsocialclaw.com
socialclaw accounts list --json
socialclaw accounts capabilities --provider pinterest --json
socialclaw accounts connect --provider pinterest --open
socialclaw accounts connect --provider discord --webhook-url <webhook-url> --json
socialclaw accounts connect --provider telegram --bot-token <bot-token> --chat-id @yourchannel --json
socialclaw assets upload --file ./image.png --json
socialclaw campaigns preview -f schedule.json --json
socialclaw validate -f schedule.json --json
socialclaw apply -f schedule.json --json
socialclaw posts delete --post-id <post-id> --json
socialclaw workspace health --json
socialclaw usage --json
```

## Agent integrations

### MCP server

The hosted MCP server at `https://getsocialclaw.com/mcp` supports OAuth and advertised 34 tools on October 12, 2026, including media uploads, scheduling, delivery checks, analytics, and Instagram comments and messages. Its live schemas are authoritative. Use the hosted connection for the Claude plugin.

The npm package also ships a separate stdio MCP server for local clients. It exposes a smaller tool set and uses a workspace API key. The examples below are for that optional local server.
Claude Code:

```bash
claude mcp add socialclaw \
  --env SOCIALCLAW_API_KEY=sc_live_your_key \
  -- npx -y socialclaw mcp
```

Claude Desktop, Cursor, and other JSON-configured clients:

```json
{
  "mcpServers": {
    "socialclaw": {
      "command": "npx",
      "args": ["-y", "socialclaw", "mcp"],
      "env": {
        "SOCIALCLAW_API_KEY": "sc_live_your_key"
      }
    }
  }
}
```

If you have already run `socialclaw login --api-key <key>`, the server reuses the saved credentials and the `env` block is unnecessary. See the [hosted MCP reference](https://getsocialclaw.com/docs/mcp) for the current hosted tools; do not assume the local stdio server has every hosted tool.

### Claude Code plugin

Install the packaged Claude Code plugin from inside Claude Code:

```shell
/plugin marketplace add ndesv21/socialclaw
/plugin install socialclaw@socialclaw
```

This installs the focused marketplace plugin from [`plugins/socialclaw/`](./plugins/socialclaw), including its OAuth MCP connection and Claude skill. It is the cleanest option if you want Claude to auto-invoke SocialClaw when a user asks to connect accounts, upload media, schedule posts, inspect delivery, or check analytics.

### Claude slash command and skill file

If you want the explicit `/socialclaw` command instead of the full plugin flow:

```bash
socialclaw install --claude
```

That installs the bundled command file from [`skill/claude/socialclaw.md`](./skill/claude/socialclaw.md) into `~/.claude/commands/socialclaw.md`.

Use this path when you want a lightweight Claude Code setup that:
- exposes one clear SocialClaw command
- keeps the workspace API key flow explicit
- still lets Claude use the same hosted SocialClaw API and CLI workflow

### OpenClaw and ClawHub

The OpenClaw-compatible skill bundle lives in [`skill/`](./skill).

It is designed for OpenClaw and other compatible agent runtimes that can load a `SKILL.md`, work from a workspace API key, and call either:
- the SocialClaw HTTP API directly
- the `socialclaw` CLI as a client for the hosted service

This is the bundle to publish to ClawHub for OpenClaw discovery.

### Other agents

SocialClaw is not limited to one agent framework. The repo also includes an agent manifest in [`skill/agents/openai.yaml`](./skill/agents/openai.yaml), and the CLI works well for any runtime that can execute shell commands or make HTTP requests.

That makes SocialClaw a good fit for:
- Codex and terminal-native agent workflows
- Claude Code via plugin or command file
- OpenClaw and ClawHub skills
- custom internal agents that need one stable publishing surface for social channels

In practice, these integrations share the same model:
- connect customer accounts inside SocialClaw
- authenticate the hosted Claude connector with OAuth, or use a workspace API key for CLI/API clients
- upload media, validate, apply, inspect, analyze, and optionally delete supported posts through the hosted service

## Supported providers

- X
- Facebook Pages
- Instagram Business
- Instagram standalone professional accounts
- LinkedIn profile
- LinkedIn page
- Pinterest
- TikTok
- Discord
- Telegram
- YouTube
- Reddit
- WordPress
- Threads (subject to connected-account capabilities)

Pinterest is exposed as the `pinterest` provider in the public CLI and skill bundle. Its main publish target is board-centric, with support for standard pins, video pins, multi-image pins, board creation and section or catalog discovery, plus pin and account analytics. Product, collection, and idea surfaces should be treated as capability-gated or beta rather than assumed for every workspace.

TikTok supports one video or one photo gallery per post. Photo galleries can include up to 35 images and expose `autoAddMusic` plus `photoCoverIndex`; selecting a specific TikTok song or sound is not available through TikTok's Content Posting API. For photo galleries, normalize images before upload, preferably to 1080x1920 JPEGs for vertical slides or another standard TikTok-compatible aspect/size. Oversized or unusual image dimensions may pass SocialClaw validation and initial TikTok acceptance, then fail later with `picture_size_check_failed`; reconcile photo posts after publish to confirm TikTok reports `PUBLISH_COMPLETE`.

## Publishing

Bump the version with `npm version`:

```bash
npm version patch
git push && git push --tags
npm publish --access public
```

To sync reference files manually after editing `skill/references/`:

```bash
npm run sync:references
```

## Notes

- Users connect accounts inside the hosted SocialClaw dashboard.
- The dashboard and API live at `https://getsocialclaw.com`.
- The npm package ships the CLI, skill docs, Claude Code plugin, and command asset.

### Threads availability

Threads publishing support is prepared in this release and requires service activation after Meta app approval. Connect with `socialclaw accounts connect --provider threads --open`; supports text and image/video carousels up to 20 items. See [provider notes](skill/references/providers.md#threads) for current limits.

## Privacy and support

Read the [Privacy Policy](https://getsocialclaw.com/privacy) and [Terms of Service](https://getsocialclaw.com/terms). For help, [contact SocialClaw](https://getsocialclaw.com/contact) or email support@getsocialclaw.com.
