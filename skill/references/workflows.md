# SocialClaw Workflows

## CLI first

If the `socialclaw` CLI is installed, prefer it over handwritten HTTP calls.

### Login

```bash
socialclaw login --api-key <workspace-key> --base-url https://getsocialclaw.com
```

### Connect an account

```bash
socialclaw accounts connect --provider youtube --open
socialclaw accounts status --connection-id <connection-id> --json
```

### List accounts

```bash
socialclaw accounts list --json
socialclaw accounts capabilities --account-id <account-id> --json
socialclaw accounts settings --account-id <account-id> --json
socialclaw accounts actions --account-id <account-id> --json
```

### Upload media

```bash
socialclaw assets upload --file ./video.mp4 --json
```

### Validate or preview a schedule

```bash
socialclaw validate -f schedule.json --json
socialclaw campaigns preview -f schedule.json --json
```

### Apply a schedule

```bash
socialclaw apply -f schedule.json --json
```

### Inspect results

```bash
socialclaw posts list --limit 20 --json
socialclaw posts get --post-id <post-id> --json
socialclaw runs inspect --run-id <run-id> --json
socialclaw analytics post --post-id <post-id> --json
socialclaw workspace health --json
socialclaw connections health --json
socialclaw jobs list --limit 20 --json
```

## HTTP fallback

Set:

```bash
export SC_BASE_URL="https://getsocialclaw.com"
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
  "$SC_BASE_URL/v1/keys/validate"
```

### Start account connection

```bash
curl -sS \
  -X POST \
  -H "Authorization: Bearer $SC_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"provider":"youtube"}' \
  "$SC_BASE_URL/v1/connections/start"
```

Then poll:

```bash
curl -sS \
  -H "Authorization: Bearer $SC_API_KEY" \
  "$SC_BASE_URL/v1/connections/<connection-id>"
```

### List accounts

```bash
curl -sS \
  -H "Authorization: Bearer $SC_API_KEY" \
  "$SC_BASE_URL/v1/accounts"
```

### Get capabilities

```bash
curl -sS \
  -H "Authorization: Bearer $SC_API_KEY" \
  "$SC_BASE_URL/v1/accounts/<account-id>/capabilities"
```

### Upload media

```bash
curl -sS \
  -X POST \
  -H "Authorization: Bearer $SC_API_KEY" \
  -F "file=@./image.png" \
  "$SC_BASE_URL/v1/assets/upload"
```

### Validate a post/campaign

```bash
curl -sS \
  -X POST \
  -H "Authorization: Bearer $SC_API_KEY" \
  -H "Content-Type: application/json" \
  -d @schedule.json \
  "$SC_BASE_URL/v1/posts/validate"
```

### Preview a campaign

```bash
curl -sS \
  -X POST \
  -H "Authorization: Bearer $SC_API_KEY" \
  -H "Content-Type: application/json" \
  -d @schedule.json \
  "$SC_BASE_URL/v1/campaigns/preview"
```

### Apply a schedule

```bash
curl -sS \
  -X POST \
  -H "Authorization: Bearer $SC_API_KEY" \
  -H "Content-Type: application/json" \
  -d @schedule.json \
  "$SC_BASE_URL/v1/posts/apply"
```

### Inspect posts and runs

```bash
curl -sS \
  -H "Authorization: Bearer $SC_API_KEY" \
  "$SC_BASE_URL/v1/posts?limit=20"

curl -sS \
  -H "Authorization: Bearer $SC_API_KEY" \
  "$SC_BASE_URL/v1/posts/<post-id>"

curl -sS \
  -H "Authorization: Bearer $SC_API_KEY" \
  "$SC_BASE_URL/v1/runs/<run-id>"
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

## When to stop and tell the user something is unsupported

- Facebook personal profile publishing
- Personal Instagram accounts
- TikTok image posts
- Reddit native media/gallery upload
- LinkedIn video posts
- YouTube community posts or Shorts-specific flows
