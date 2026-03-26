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
