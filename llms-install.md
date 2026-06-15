# SocialClaw — install guide for AI agents (Cline / Claude / Cursor)

SocialClaw exposes an MCP server two ways. **Prefer the remote endpoint** — nothing to install.

## Prerequisite
A SocialClaw workspace API key from https://getsocialclaw.com/dashboard → Developers → Public API.
An active trial or paid plan is required for `tools/call` (publishing). `tools/list` works without a key.

## Option A — Remote (recommended, zero install)
Add a streamable-HTTP MCP server:

- URL: `https://getsocialclaw.com/mcp`
- Header: `Authorization: Bearer <WORKSPACE_API_KEY>`

Cline / Cursor `mcpServers` config:
```json
{
  "mcpServers": {
    "socialclaw": {
      "type": "streamableHttp",
      "url": "https://getsocialclaw.com/mcp",
      "headers": { "Authorization": "Bearer ${SOCIALCLAW_API_KEY}" }
    }
  }
}
```

## Option B — Local (stdio via npm)
```json
{
  "mcpServers": {
    "socialclaw": {
      "command": "npx",
      "args": ["-y", "socialclaw", "mcp"],
      "env": { "SOCIALCLAW_API_KEY": "<WORKSPACE_API_KEY>" }
    }
  }
}
```

Claude Code one-liner:
```bash
claude mcp add socialclaw --env SOCIALCLAW_API_KEY=<WORKSPACE_API_KEY> -- npx -y socialclaw mcp
```

## Verify
Ask the agent: "List my connected SocialClaw accounts." It should call the account-list tool and return your channels. If you get a `plan_required` / `subscription_*` error, the key is valid but the workspace needs an active plan (https://getsocialclaw.com/pricing).

## What the agent can do (17 tools)
List/inspect accounts & capabilities · upload media · validate & preview schedules · apply (schedule/publish) posts · list/get posts · retry/cancel · pull post/account/run analytics · workspace health.
