<p align="center">
  <img src="https://raw.githubusercontent.com/ndesv21/socialclaw/main/.github/readme/logo.png" alt="SocialClaw logo" width="112">
</p>

<h1 align="center">SocialClaw</h1>

<p align="center">
  Social media scheduling CLI and OpenClaw skill for AI agents posting to X, LinkedIn, Instagram, Facebook Pages, TikTok, Discord, Telegram, YouTube, Reddit, WordPress, and Pinterest.
</p>

<p align="center">
  <a href="https://getsocialclaw.com">Website</a> ·
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

SocialClaw is the public home for:
- the `socialclaw` npm CLI
- the OpenClaw and ClawHub skill bundle
- the Claude Code plugin and `/socialclaw` command asset
- public usage docs, provider notes, and schedule examples

The hosted SocialClaw service lives at:
- `https://getsocialclaw.com`

## Install

```bash
npm install -g socialclaw
socialclaw login
socialclaw accounts list --json
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
  <a href="https://raw.githubusercontent.com/ndesv21/socialclaw/main/.github/readme/socialclaw-demo.mp4">
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

### Claude Code plugin

Install the packaged Claude Code plugin from inside Claude Code:

```shell
/plugin marketplace add ndesv21/socialclaw
/plugin install socialclaw@socialclaw
```

This installs the marketplace plugin from [`skills/socialclaw/`](./skills/socialclaw) with metadata from [`.claude-plugin/`](./.claude-plugin). It is the cleanest option if you want Claude to auto-invoke SocialClaw when a user asks to connect accounts, upload media, schedule posts, inspect delivery, or check analytics.

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

In practice, all of these share the same model:
- connect customer accounts inside SocialClaw
- create a workspace API key
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

Pinterest is exposed as the `pinterest` provider in the public CLI and skill bundle. Its main publish target is board-centric, with support for standard pins, video pins, multi-image pins, board creation and section or catalog discovery, plus pin and account analytics. Product, collection, and idea surfaces should be treated as capability-gated or beta rather than assumed for every workspace.

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
