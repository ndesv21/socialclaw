---
name: socialclaw
description: Use when an OpenClaw-compatible agent needs to connect customer social accounts, upload media, schedule posts, inspect publish status, or manage a SocialClaw workspace through the deployed SocialClaw service. Relevant for X, Facebook Pages, Instagram Business, Instagram standalone, LinkedIn profile/page, TikTok, YouTube, Reddit, and WordPress workflows.
---

# SocialClaw

SocialClaw is a workspace-scoped social publishing service at `https://getsocialclaw.com`.

Use this skill when the user wants to:
- connect or disconnect social accounts in a SocialClaw workspace
- upload media and get SocialClaw-hosted delivery URLs
- validate, preview, apply, or inspect scheduled posts and campaigns
- inspect connected account capabilities, publish settings, actions, jobs, health, or analytics

Do not use this skill for editing the SocialClaw codebase itself. This bundle is for operating a deployed SocialClaw workspace.

## Defaults

- Base URL: `https://getsocialclaw.com`
- Auth: workspace API key in `Authorization: Bearer <key>`
- Prefer the SocialClaw CLI if `social` is available.
- Otherwise use the HTTP API directly.

## Operating rules

1. Start by confirming the user has a SocialClaw workspace API key.
2. Never ask the user for provider app secrets. End users connect accounts inside SocialClaw.
3. Prefer explicit provider/account-type language:
   - Facebook Pages, not Facebook personal profiles
   - Instagram Business linked to a Facebook Page
   - Instagram standalone professional accounts
   - LinkedIn profile and LinkedIn page are separate providers
4. If a provider workflow is not supported, say so directly instead of inventing a workaround.
5. Avoid echoing full API keys back into chat.

## Main workflow

1. Validate workspace access.
2. List accounts or start a connection flow.
3. Inspect capabilities/settings for the target account.
4. Upload media if needed.
5. Validate or preview the post/campaign.
6. Apply it.
7. Inspect posts, runs, analytics, or retry/reconcile if needed.

## Connection workflow

For browser-based account linking:

- CLI:
  - `social accounts connect --provider <provider> --open`
  - then `social accounts status --connection-id <id>`
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
- `tiktok`
- `youtube`
- `reddit`
- `wordpress`

## Read next

- For command recipes and request payloads, read [references/workflows.md](./references/workflows.md).
- For provider/account-type caveats, read [references/providers.md](./references/providers.md).
