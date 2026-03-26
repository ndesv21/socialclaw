# SocialClaw

Public home for the SocialClaw CLI and agent skill bundle.

This repo is the public integration surface for SocialClaw:
- the npm CLI package
- the OpenClaw/ClawHub skill bundle
- the Claude Code command file installed by `socialclaw install --claude`
- public usage docs and examples

Supported providers currently include:
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

The hosted SocialClaw service lives at:
- `https://getsocialclaw.com`

## Install

```bash
npm install -g socialclaw
socialclaw --help
social --help
```

## Authentication and access

Running `socialclaw login` without an API key opens the hosted dashboard so the user can:

- sign in with Google
- connect social accounts
- create or copy a workspace API key
- activate a trial or paid plan for CLI/API access

Important:

- the CLI works against a deployed SocialClaw workspace via API key auth
- an API key alone is not enough for agent execution; the workspace must also have an active trial or paid plan
- if a command returns `plan_required` or `subscription_*`, send the user to `https://getsocialclaw.com/pricing` or `https://getsocialclaw.com/dashboard`

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
socialclaw workspace health --json
socialclaw usage --json
```

## Claude Code

Install the packaged Claude Code command:

```bash
socialclaw install --claude
```

That copies the bundled command file into `~/.claude/commands/socialclaw.md`.

## What the CLI covers

- workspace API key login and hosted dashboard bootstrap
- browser OAuth connect plus manual Discord/Telegram connect
- hosted asset upload and deletion
- schedule validation, campaign preview, apply, inspect, clone, and draft publishing
- post, run, attempt, analytics, job, usage, and health inspection
- Claude Code command installation through `socialclaw install --claude`

Pinterest is exposed as the `pinterest` provider in the public CLI and skill bundle. Its main publish target is board-centric, with support for standard pins, video pins, multi-image pins, board creation and section/catalog discovery, plus pin/account analytics. Product, collection, and idea surfaces should be treated as capability-gated or beta rather than assumed for every workspace.

## Skill

The OpenClaw-compatible skill bundle lives in:
- [skill](./skill)

Publish that folder to ClawHub if you want agents to discover and use SocialClaw through a hosted skill.

## Publishing

Publish new CLI releases from this repository.

```bash
npm publish --access public
```

## Notes

- Users connect accounts inside the hosted SocialClaw dashboard.
- The dashboard and API live at `https://getsocialclaw.com`.
- The npm package also ships the public skill docs and Claude Code command asset.
