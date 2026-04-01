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

An API key alone is not enough for execution. The workspace must also have an active trial or paid plan. If requests fail with `plan_required` or `subscription_*`, direct the user to:

- `https://getsocialclaw.com/pricing`
- `https://getsocialclaw.com/dashboard`

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

Use a numeric `chatId` for groups/supergroups when you do not have a stable `@channelusername`.

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

### Validate a post/campaign

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

## Minimal schedule patterns

### Single post

```json
{
  "posts": [
    {
      "account": "youtube:channel:123",
      "title": "Weekly update",
      "description": "Short description",
      "status": "scheduled",
      "publishAt": "2026-03-22T14:00:00.000Z",
      "assets": [
        {
          "mediaLink": "https://getsocialclaw.com/media/asset-id/token/video.mp4"
        }
      ]
    }
  ]
}
```

### Draft campaign

```json
{
  "campaigns": [
    {
      "name": "Launch",
      "mode": "draft",
      "targets": [
        {
          "account": "linkedin:member:123",
          "steps": [
            {
              "title": "Launch post",
              "description": "We shipped.",
              "publishAt": "2026-03-22T14:00:00.000Z"
            }
          ]
        }
      ]
    }
  ]
}
```

### Board-centric Pinterest pin

```json
{
  "posts": [
    {
      "account": "pinterest:board:123",
      "provider": "pinterest",
      "name": "Spring launch pin",
      "description": "Board-centric pin scheduled through SocialClaw.",
      "status": "scheduled",
      "publishAt": "2026-03-22T14:00:00.000Z",
      "assets": [
        {
          "url": "https://getsocialclaw.com/media/asset-id/token/image-1.jpg"
        },
        {
          "url": "https://getsocialclaw.com/media/asset-id/token/image-2.jpg"
        }
      ]
    }
  ]
}
```

Use one image asset for a standard pin, one video asset for a video pin, or multiple image assets for a multi-image pin.

## When to stop and tell the user something is unsupported

- Facebook personal profile publishing
- Personal Instagram accounts
- TikTok image posts
- Telegram OAuth browser auth
- Pinterest product, collection, or idea publishing when the connected account does not advertise those capabilities
- Reddit native media/gallery upload
- YouTube community posts or Shorts-specific flows
