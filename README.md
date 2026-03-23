# SocialClaw

Public home for the SocialClaw CLI and OpenClaw skill.

This repo is the public integration surface for SocialClaw:
- the npm CLI package
- the OpenClaw/ClawHub skill bundle
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
socialclaw login
```

Running `socialclaw login` without an API key opens the hosted dashboard so the user can sign in with Google and create a workspace API key.

Commands:

```bash
socialclaw --help
social --help
```

## Quick start

```bash
socialclaw login
socialclaw login --api-key <workspace-key> --base-url https://getsocialclaw.com
socialclaw accounts list --json
socialclaw accounts connect --provider pinterest --open
socialclaw accounts connect --provider discord --webhook-url <webhook-url> --json
socialclaw accounts connect --provider telegram --bot-token <bot-token> --chat-id @yourchannel --json
socialclaw assets upload --file ./image.png --json
socialclaw validate -f schedule.json --json
socialclaw apply -f schedule.json --json
```

Pinterest is exposed as the `pinterest` provider in the public CLI and skill bundle. Its main publish target is board-centric, with support for standard pins, video pins, multi-image pins, board creation and section/catalog discovery, plus pin/account analytics. Product, collection, and idea surfaces should be treated as capability-gated or beta rather than assumed for every workspace.

## Skill

The OpenClaw-compatible skill bundle lives in:
- [skill](./skill)

Publish that folder to ClawHub if you want agents to discover and use SocialClaw through a hosted skill.

## Publishing

This public repo is the only npm publish source for the `socialclaw` package.

```bash
cd /Users/nardibraho/Desktop/socialclaw-public
npm publish --access public
```

## Notes

- This public repo does not include the private SocialClaw backend.
- End users connect accounts inside the hosted SocialClaw product.
- The CLI works against a deployed SocialClaw workspace via API key auth.
