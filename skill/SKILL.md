---
name: socialclaw
description: Use when an OpenClaw-compatible agent needs to connect customer social accounts, upload media, schedule posts, inspect publish status, or manage a SocialClaw workspace through the deployed SocialClaw service. Relevant for X, Facebook Pages, Instagram Business, Instagram standalone, LinkedIn profile/page, TikTok, YouTube, Reddit, and WordPress workflows.
homepage: https://getsocialclaw.com
metadata: {"openclaw":{"homepage":"https://getsocialclaw.com","primaryEnv":"SC_API_KEY","requires":{"env":["SC_API_KEY"]}}}
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
- This skill operates the hosted SocialClaw service through its HTTP API.

## Operating rules

1. Start by confirming the user has a SocialClaw workspace API key.
2. If the user does not have a key yet, send them to `https://getsocialclaw.com/dashboard` to sign in with Google and create one.
3. Never ask the user for provider app secrets. End users connect accounts inside SocialClaw.
4. Prefer explicit provider/account-type language:
   - Facebook Pages, not Facebook personal profiles
   - Instagram Business linked to a Facebook Page
   - Instagram standalone professional accounts
   - LinkedIn profile and LinkedIn page are separate providers
5. If a provider workflow is not supported, say so directly instead of inventing a workaround.
6. Avoid echoing full API keys back into chat.

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

## Connection workflow

For browser-based account linking:

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

- For request payloads and HTTP recipes, read [references/workflows.md](./references/workflows.md).
- For provider/account-type caveats, read [references/providers.md](./references/providers.md).
