# SocialClaw

Schedule and publish social media posts from Claude, inspect delivery and analytics, and manage Instagram comments and messages. SocialClaw connects your workspace to X, LinkedIn, Instagram, Threads, Facebook Pages, TikTok, YouTube, Reddit, Pinterest, WordPress, Discord, and Telegram. Features depend on each connected account's capabilities.

## Connect

1. Create or sign in to your [SocialClaw workspace](https://getsocialclaw.com/dashboard), connect your social accounts, and ensure your plan supports the operations you need.
2. Install this plugin and connect SocialClaw when Claude prompts you. Complete OAuth sign-in in the browser. In Claude Code, open `/mcp` and authenticate SocialClaw.
3. Ask “Show my connected accounts” to verify the connection and workspace.

The plugin connects to the hosted MCP endpoint at https://getsocialclaw.com/mcp. No local server, npm installation, or pasted API key is required. A Claude subscription does not include a SocialClaw subscription.

For Claude Code, install from the public marketplace once this release is on its default branch:

```text
/plugin install socialclaw --marketplace ndesv21/socialclaw
```

## What you can do

- Find connected accounts and inspect platform publishing rules.
- Upload or reuse media, validate a schedule, and publish or schedule authorized posts.
- Inspect posts, publishing attempts, and runs; retry failures or cancel scheduled posts.
- Read analytics, refresh supported post metrics, and check workspace usage and health.
- Read Instagram media, comments, mentions, insights, and conversations; send authorized replies and moderate comments.

The hosted server advertised 34 tools when checked on October 12, 2026. The plugin discovers tools from the server, so the live schemas and capabilities take precedence over this snapshot. The separate npm stdio server may expose a different tool set.

## Example requests

- “Show my connected social accounts.”
- “Draft a LinkedIn announcement for this launch without publishing.”
- “Schedule this photo to Instagram tomorrow at 10:00 Europe/Tirane.”
- “Check whether my last publishing run completed.”
- “Read comments on my latest Instagram post and draft replies for review.”

The skill validates schedules before applying them and checks delivery status afterward. Requests to draft or preview do not authorize publishing. Instagram messaging and provider-specific operations remain subject to each network's permissions and restrictions.

## Privacy Policy

SocialClaw receives the account, media, post, analytics, and messaging data needed for the tools you use. Authorized publishing and replies send content to the selected social platform. Read the [Privacy Policy](https://getsocialclaw.com/privacy) for collection, storage, sharing, retention, and contact details, and the [Terms of Service](https://getsocialclaw.com/terms) for service terms. The plugin does not require you to place credentials in its files or in chat.

## Help

[Documentation](https://getsocialclaw.com/docs/mcp) · [Contact support](https://getsocialclaw.com/contact) · support@getsocialclaw.com

Source: [ndesv21/socialclaw](https://github.com/ndesv21/socialclaw). Plugin files are licensed under MIT; see LICENSE. SocialClaw is an independent service, not an Anthropic product.
