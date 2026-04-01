# SocialClaw Provider Notes

## Facebook

- Use `facebook` for Facebook Pages.
- Personal Facebook profiles are not publish targets.
- Media: one effective image or video per post.

## Instagram Business

- Use `instagram_business` only for professional/business accounts linked to a Facebook Page.
- Publishing requires media.
- Personal Instagram accounts do not belong on this provider.

## Instagram Standalone

- Use `instagram` for standalone professional accounts through Instagram Login.
- This is separate from `instagram_business`.
- Publishing requires media.

## X

- Supports text posts.
- Supports native upload for up to four images or one video.
- Supports reply steps in campaign flows.

## LinkedIn Profile

- Use `linkedin` for member profiles.
- Supports text and native image/video upload.
- Supports one video or up to twenty images per post.

## LinkedIn Page

- Use `linkedin_page` for organization/page targets.
- Separate from member profile connections.
- Supports text and native image/video upload.
- Supports one video or up to twenty images per post.

## Pinterest

- Use `pinterest` for Pinterest's official OAuth provider flow.
- The primary publish target is board-centric.
- Supports standard pins, video pins, and multi-image pins.
- Use discovery actions to create boards, inspect board sections, and discover connected catalogs.
- Pin analytics and account analytics are supported through the standard SocialClaw analytics commands.
- Product, collection, and idea surfaces are capability-gated or beta. Check account capabilities/actions before promising them.

## TikTok

- Use `tiktok` for video posting only.
- Requires a public video URL or a SocialClaw-hosted video URL.
- Non-video TikTok posts are not supported.

## Telegram

- Use `telegram` for bot-based posting into channels, groups, supergroups, or chats.
- Telegram is not connected through OAuth; it is connected manually with a bot token and `chat_id` or `@channelusername`.
- One optional image or one optional video is supported per Telegram post.
- Channels require the bot to be an administrator or creator.
- Provider-native analytics, replies, and threaded interactions are not implemented.

## Discord

- Use `discord` for channel posting through a Discord webhook URL.
- Discord is not connected through OAuth; it is connected manually with a channel webhook URL.
- One optional image or one optional video is supported per Discord post.
- SocialClaw fetches the media URL and uploads the file to the webhook before sending the message.
- Thread targeting, embeds, and provider-native analytics are not implemented.

## YouTube

- Use `youtube` for channel uploads.
- One video per post.
- Community posts, Shorts-specific flows, playlists, and live-stream flows are not supported.

## Reddit

- Use `reddit` for self posts and link posts.
- A `subreddit` setting is required.
- Native Reddit media upload is not supported.
- Live discovery actions can help find subreddit targets and flair options.

## WordPress

- Use `wordpress` for WordPress.com or Jetpack-connected sites.
- SocialClaw uploads remote media and embeds it into the published content.

## Legacy Meta

- `meta` exists for older workspaces only.
- New workspaces should prefer explicit `facebook` and `instagram_business`.
