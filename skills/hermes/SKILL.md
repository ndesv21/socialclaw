---
name: socialclaw
description: Schedule and publish social media posts across X, LinkedIn, Instagram, Facebook Pages, TikTok, YouTube, Reddit, Pinterest, WordPress, Discord, and Telegram. Use when the user wants to post, schedule, or publish to social media, or check post status and analytics.
version: "1.0.0"
license: MIT
compatibility: Requires a SocialClaw workspace API key and at least one connected social account. Networks are connected once at https://getsocialclaw.com/dashboard.
metadata:
  author: socialclaw
  hermes:
    tags: [social-media, scheduling, publishing, x, linkedin, instagram, tiktok, mcp]
    category: communication
required_environment_variables:
  - name: SOCIALCLAW_API_KEY
    prompt: SocialClaw workspace API key
    help: Create one at https://getsocialclaw.com/dashboard → Developers → Public API
    required_for: full functionality
---

# SocialClaw

Schedule and publish social media posts through connected accounts using the hosted SocialClaw API. SocialClaw handles each network's OAuth, media rules, and publish logic, so this skill only needs a workspace API key.

## When to Use
- The user wants to post or schedule content to social media
- The user wants to publish the same message to multiple platforms at once
- The user wants to check whether a scheduled post succeeded
- The user asks for post analytics

## Supported Networks
X, LinkedIn (profile + page), Instagram (business + standalone), Facebook Pages, TikTok, YouTube, Reddit, Pinterest, WordPress, Discord, and Telegram.

## Authentication
All requests go to `https://getsocialclaw.com` and send the workspace key:

```
Authorization: Bearer $SOCIALCLAW_API_KEY
```

Never hardcode the key — read it from the `SOCIALCLAW_API_KEY` environment variable.

## Procedure
1. **List connected accounts** to get an account id: `GET /v1/accounts`
2. *(optional)* **Check capabilities** (media/text limits): `GET /v1/accounts/{accountId}/capabilities`
3. *(optional)* **Upload media**: `POST /v1/assets/upload` with `{ filename, contentType, contentBase64 }` → returns a hosted URL to use as `media_link`
4. **Validate before publishing** (always): `POST /v1/posts/validate` with `{ schedule }`
5. **Schedule or publish**: `POST /v1/posts/apply` with `{ schedule }`. Omit `publish_at` to publish immediately.
6. **Check status**: `GET /v1/posts/{postId}/attempts`

### Schedule document shape
```json
{
  "timezone": "UTC",
  "posts": [
    {
      "account": "<accountId>",
      "name": "launch post",
      "description": "<the post text>",
      "publish_at": "2026-06-16T09:00:00Z",
      "media_link": "<optional hosted media URL>"
    }
  ]
}
```

## Examples

List connected accounts:
```bash
curl -s https://getsocialclaw.com/v1/accounts \
  -H "Authorization: Bearer $SOCIALCLAW_API_KEY"
```

Validate, then schedule a post:
```bash
PAYLOAD='{"schedule":{"timezone":"UTC","posts":[{"account":"ACCOUNT_ID","name":"launch","description":"Hello from Hermes 🦅","publish_at":"2026-06-16T09:00:00Z"}]}}'

curl -s -X POST https://getsocialclaw.com/v1/posts/validate \
  -H "Authorization: Bearer $SOCIALCLAW_API_KEY" -H "Content-Type: application/json" -d "$PAYLOAD"

curl -s -X POST https://getsocialclaw.com/v1/posts/apply \
  -H "Authorization: Bearer $SOCIALCLAW_API_KEY" -H "Content-Type: application/json" -d "$PAYLOAD"
```

## Alternative: hosted MCP or CLI
SocialClaw also exposes the same capabilities as tools:
- **MCP**: connect to the hosted streamable-HTTP server at `https://getsocialclaw.com/mcp` with `Authorization: Bearer $SOCIALCLAW_API_KEY`.
- **CLI**: `npx -y socialclaw mcp` (stdio MCP), or the `socialclaw` CLI after `socialclaw login`.

## Network Calls
- `https://getsocialclaw.com` — SocialClaw REST API and hosted MCP. This is the only host contacted.

## Notes & Limitations
- Always run `validate` before `apply` to catch provider-rule and media issues early.
- Each network has its own media type, text length, and account-model rules; the capabilities endpoint reports them.
- Publishing requires an active SocialClaw plan; listing tools/accounts works on a trial key.
- Accounts are connected once in the SocialClaw dashboard; this skill does not perform per-network OAuth.
