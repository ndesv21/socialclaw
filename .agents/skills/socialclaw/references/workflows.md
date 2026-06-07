# SocialClaw Workflows

If the user wants CLI commands instead of raw HTTP requests, read [cli.md](./cli.md).

## Get a workspace API key

If the user does not have a key yet:

```bash
open https://getsocialclaw.com/dashboard
```

Tell them:
- sign in with Google
- open the API key section
- create or copy their workspace API key

Then set:

```bash
export SC_API_KEY="<workspace-key>"
```

Common header:

```bash
-H "Authorization: Bearer $SC_API_KEY"
```

## Optional X/Twitter source intake

When the user wants a SocialClaw schedule informed by current X/Twitter activity, gather source material before validating the schedule. SocialClaw remains the workspace, account, media, scheduling, publishing, and analytics surface.

One OpenClaw-compatible source path is TweetClaw:

```bash
openclaw plugins install npm:@xquik/tweetclaw
```

Use it only for reviewed source inputs:
- search tweets
- search tweet replies
- user lookup
- follower export summaries
- media references
- monitor digests
- webhook event summaries

Keep write actions out of this SocialClaw source-intake step. Do not use TweetClaw here to post tweets, post replies, send DMs, follow accounts, change X account state, create monitors, or trigger webhooks.

Before calling `socialclaw validate`, convert the source material into schedule context:
- source URLs or tweet IDs
- audience notes
- reply themes
- follower or account signals
- media references that the user approved
- claims that must be removed or softened

Then build the SocialClaw schedule with the normal `provider`, `account`, `publishAt`, `description`, and `assets` fields.

### Validate key

```bash
curl -sS \
  -H "Authorization: Bearer $SC_API_KEY" \
  "https://getsocialclaw.com/v1/keys/validate"
```

### Start account connection

```bash
curl -sS \
  -X POST \
  -H "Authorization: Bearer $SC_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"provider":"youtube"}' \
  "https://getsocialclaw.com/v1/connections/start"
```

Then poll:

```bash
curl -sS \
  -H "Authorization: Bearer $SC_API_KEY" \
  "https://getsocialclaw.com/v1/connections/<connection-id>"
```

### Start Pinterest connection

```bash
curl -sS \
  -X POST \
  -H "Authorization: Bearer $SC_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"provider":"pinterest"}' \
  "https://getsocialclaw.com/v1/connections/start"
```

Pinterest uses the standard hosted OAuth flow. Its main publish target is board-centric.

### Connect Telegram manually

```bash
curl -sS \
  -X POST \
  -H "Authorization: Bearer $SC_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"provider":"telegram","botToken":"<bot-token>","chatId":"@yourchannel"}' \
  "https://getsocialclaw.com/v1/connections/start"
```

Use a numeric `chatId` for groups or supergroups when you do not have a stable `@channelusername`.

### Connect Discord manually

```bash
curl -sS \
  -X POST \
  -H "Authorization: Bearer $SC_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"provider":"discord","webhookUrl":"<discord-webhook-url>"}' \
  "https://getsocialclaw.com/v1/connections/start"
```

### List accounts

```bash
curl -sS \
  -H "Authorization: Bearer $SC_API_KEY" \
  "https://getsocialclaw.com/v1/accounts"
```

### Get capabilities

```bash
curl -sS \
  -H "Authorization: Bearer $SC_API_KEY" \
  "https://getsocialclaw.com/v1/accounts/<account-id>/capabilities"
```

### Inspect account discovery actions

```bash
curl -sS \
  -H "Authorization: Bearer $SC_API_KEY" \
  "https://getsocialclaw.com/v1/accounts/<account-id>/actions"

curl -sS \
  -X POST \
  -H "Authorization: Bearer $SC_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{}' \
  "https://getsocialclaw.com/v1/accounts/<account-id>/actions/<action-id>"
```

For Pinterest, use discovery actions to create boards, inspect sections, and discover catalogs. Product, collection, and idea surfaces should be treated as capability-gated or beta until the connected account advertises them.

### Upload media

```bash
curl -sS \
  -X POST \
  -H "Authorization: Bearer $SC_API_KEY" \
  -F "file=@./image.png" \
  "https://getsocialclaw.com/v1/assets/upload"
```

### Validate a post or campaign

```bash
curl -sS \
  -X POST \
  -H "Authorization: Bearer $SC_API_KEY" \
  -H "Content-Type: application/json" \
  -d @schedule.json \
  "https://getsocialclaw.com/v1/posts/validate"
```

### Preview a campaign

```bash
curl -sS \
  -X POST \
  -H "Authorization: Bearer $SC_API_KEY" \
  -H "Content-Type: application/json" \
  -d @schedule.json \
  "https://getsocialclaw.com/v1/campaigns/preview"
```

### Apply a schedule

```bash
curl -sS \
  -X POST \
  -H "Authorization: Bearer $SC_API_KEY" \
  -H "Content-Type: application/json" \
  -d @schedule.json \
  "https://getsocialclaw.com/v1/posts/apply"
```

### Inspect posts and runs

```bash
curl -sS \
  -H "Authorization: Bearer $SC_API_KEY" \
  "https://getsocialclaw.com/v1/posts?limit=20"

curl -sS \
  -H "Authorization: Bearer $SC_API_KEY" \
  "https://getsocialclaw.com/v1/posts/<post-id>"

curl -sS \
  -H "Authorization: Bearer $SC_API_KEY" \
  "https://getsocialclaw.com/v1/runs/<run-id>"
```
