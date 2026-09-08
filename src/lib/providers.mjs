// Synced from ../socialclaw via tools/sync-public-cli.mjs. Edit the private repo, then re-run this sync.
import path from "node:path";
import { AppError } from "./errors.mjs";

const SUPPORTED_PROVIDERS = [
  "x",
  "threads",
  "meta",
  "facebook",
  "instagram_business",
  "instagram",
  "snapchat",
  "tiktok",
  "linkedin",
  "linkedin_page",
  "pinterest",
  "youtube",
  "reddit",
  "discord",
  "telegram",
  "wordpress"
];

const PROVIDER_ALIASES = {
  x: "x",
  threads: "threads",
  twitter: "x",
  "x-twitter": "x",
  meta: "meta",
  facebook: "facebook",
  fb: "facebook",
  "instagram-business": "instagram_business",
  instagram_business: "instagram_business",
  "instagram-linked": "instagram_business",
  instagram: "instagram",
  ig: "instagram",
  snapchat: "snapchat",
  snap: "snapchat",
  tiktok: "tiktok",
  linkedin: "linkedin",
  li: "linkedin",
  "linkedin-page": "linkedin_page",
  linkedin_page: "linkedin_page",
  "linkedin-company": "linkedin_page",
  pinterest: "pinterest",
  pin: "pinterest",
  youtube: "youtube",
  yt: "youtube",
  reddit: "reddit",
  rd: "reddit",
  discord: "discord",
  dc: "discord",
  telegram: "telegram",
  tg: "telegram",
  wordpress: "wordpress",
  wp: "wordpress"
};

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const VIDEO_EXT = new Set([".mp4", ".mov", ".webm", ".m4v"]);
const MIME_BY_EXT = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".m4v": "video/x-m4v"
};
const X_UPLOAD_CHUNK_BYTES = 2 * 1024 * 1024;
const X_MEDIA_POLL_LIMIT = 15;
const LINKEDIN_IMAGE_LIMIT = 20;
const MB = 1024 * 1024;
const GB = 1024 * MB;
const LINKEDIN_MAX_VIDEO_BYTES = 5 * GB;
const LINKEDIN_POST_RETRY_DELAYS_MS = [1500, 3000, 5000];
const LINKEDIN_VIDEO_POLL_LIMIT = 30;
const LINKEDIN_VIDEO_POLL_DELAY_MS = 2000;
const INSTAGRAM_CAROUSEL_MEDIA_LIMIT = 10;
const INSTAGRAM_CONTAINER_POLL_LIMIT = 20;
const INSTAGRAM_CONTAINER_POLL_DELAY_MS = 3000;
const INSTAGRAM_CONTAINER_STATUS_REQUEST_RETRIES = 2;
const INSTAGRAM_PUBLISH_PRECONNECT_REQUEST_RETRIES = 2;
const INSTAGRAM_PUBLISH_PRECONNECT_RETRY_DELAYS_MS = [1000, 3000];
const INSTAGRAM_MEDIA_PREWARM_TIMEOUT_MS = 15_000;
const INSTAGRAM_MEDIA_FETCH_RETRY_DELAYS_MS = [500, 1500];

function instagramMediaFetchRetryDelaysMs() {
  const rawTestDelayMs = process.env.SC_INSTAGRAM_MEDIA_FETCH_RETRY_DELAY_MS;
  const testDelayMs = Number(rawTestDelayMs);
  if (rawTestDelayMs !== undefined && rawTestDelayMs !== "" && Number.isFinite(testDelayMs) && testDelayMs >= 0) {
    return [testDelayMs, testDelayMs];
  }
  return INSTAGRAM_MEDIA_FETCH_RETRY_DELAYS_MS;
}

function instagramContainerPollDelayMs() {
  const rawTestDelayMs = process.env.SC_INSTAGRAM_CONTAINER_POLL_DELAY_MS;
  const testDelayMs = Number(rawTestDelayMs);
  if (rawTestDelayMs !== undefined && rawTestDelayMs !== "" && Number.isFinite(testDelayMs) && testDelayMs >= 0) {
    return testDelayMs;
  }
  return INSTAGRAM_CONTAINER_POLL_DELAY_MS;
}

function instagramPublishPreconnectRetryDelaysMs() {
  const rawTestDelayMs = process.env.SC_INSTAGRAM_PUBLISH_RETRY_DELAY_MS;
  const testDelayMs = Number(rawTestDelayMs);
  if (rawTestDelayMs !== undefined && rawTestDelayMs !== "" && Number.isFinite(testDelayMs) && testDelayMs >= 0) {
    return Array(INSTAGRAM_PUBLISH_PRECONNECT_REQUEST_RETRIES).fill(testDelayMs);
  }
  return INSTAGRAM_PUBLISH_PRECONNECT_RETRY_DELAYS_MS;
}
const INSTAGRAM_CONTAINER_READY_STATUSES = new Set(["FINISHED"]);
const INSTAGRAM_CONTAINER_FAILED_STATUSES = new Set(["ERROR", "EXPIRED"]);
const FACEBOOK_PAGE_IMAGE_LIMIT = 10;
// Facebook /photos rejects images over 10 MB with error_subcode 1366046
// ("Your photos couldn't be uploaded. Photos should be less than 10 MB...").
// Instagram image containers cap at 8 MB. Pull these through the media route's
// `?maxbytes=` downscale so oversized originals still publish. Kept a touch
// under each ceiling to leave headroom for the byte count Meta measures.
const FACEBOOK_MAX_IMAGE_BYTES = Math.floor(9.8 * MB);
// Instagram downscales images wider than 1440px, and an oversized original
// (e.g. a 2048px AI-generated image) can make the media container silently fail
// with a bare status_code=ERROR. Cap the WIDTH only — height follows the aspect
// ratio, so portrait Stories/Reels (1080×1920) must not be squeezed into a
// square box. The height limit is a generous ceiling no valid IG image reaches.
const INSTAGRAM_MAX_IMAGE_WIDTH = 1440;
const INSTAGRAM_MAX_IMAGE_HEIGHT = 4096;
const FACEBOOK_VIDEO_UPLOAD_FALLBACK_CHUNK_BYTES = 4 * MB;
const FACEBOOK_VIDEO_MEDIA_FETCH_TIMEOUT_MS = 180_000;
const FACEBOOK_VIDEO_UPLOAD_START_TIMEOUT_MS = 30_000;
const FACEBOOK_VIDEO_UPLOAD_TRANSFER_TIMEOUT_MS = 90_000;
const FACEBOOK_VIDEO_UPLOAD_FINISH_TIMEOUT_MS = 60_000;
const X_MAX_IMAGE_BYTES = 5 * MB;
const X_MAX_VIDEO_BYTES = 512 * MB;
const SNAPCHAT_MAX_VIDEO_BYTES = 1 * GB;
const SNAPCHAT_MIN_VIDEO_DURATION_SEC = 5;
const SNAPCHAT_MAX_VIDEO_DURATION_SEC = 300;
const SNAPCHAT_MIN_VIDEO_WIDTH = 540;
const SNAPCHAT_MIN_VIDEO_HEIGHT = 960;
const SNAPCHAT_STORY_RESOLVE_POLLS = 4;
const SNAPCHAT_STORY_RESOLVE_DELAY_MS = 1200;
const TIKTOK_MAX_VIDEO_BYTES = 4 * GB;
const TIKTOK_MAX_PHOTO_COUNT = 35;
const TIKTOK_PHOTO_TITLE_MAX = 90;
const TIKTOK_PHOTO_DESCRIPTION_MAX = 4000;
// TikTok photo posts reject any image larger than 1080×1920 with
// `picture_size_check_failed`. We fit each image inside this box (aspect ratio
// preserved, downscale-only) at delivery time.
const TIKTOK_PHOTO_MAX_WIDTH = 1080;
const TIKTOK_PHOTO_MAX_HEIGHT = 1920;
const YOUTUBE_MAX_VIDEO_BYTES = 256 * GB;

export function canonicalProvider(value) {
  if (!value) {
    return null;
  }
  const key = String(value).trim().toLowerCase();
  return PROVIDER_ALIASES[key] || null;
}

export function providerFromAccount(account) {
  if (!account || !account.includes(":")) {
    return null;
  }
  const handle = String(account).trim().toLowerCase();
  if (handle.startsWith("instagram:business:") || handle.startsWith("instagram:business-user:")) {
    return "instagram_business";
  }
  if (handle.startsWith("linkedin:page:") || handle.startsWith("linkedin:page-admin:")) {
    return "linkedin_page";
  }
  if (handle.startsWith("pinterest:board:") || handle.startsWith("pinterest:user:")) {
    return "pinterest";
  }
  if (handle.startsWith("snapchat:@") || handle.startsWith("snapchat:profile:")) {
    return "snapchat";
  }
  const prefix = handle.split(":", 1)[0];
  return canonicalProvider(prefix);
}

function extFromMedia(mediaLink) {
  if (!mediaLink) {
    return null;
  }
  const clean = mediaLink.split("?")[0];
  return path.extname(clean).toLowerCase() || null;
}

function isVideoMedia(mediaLink) {
  const ext = extFromMedia(mediaLink);
  return ext ? VIDEO_EXT.has(ext) : false;
}

function isImageMedia(mediaLink) {
  const ext = extFromMedia(mediaLink);
  return ext ? IMAGE_EXT.has(ext) : false;
}

function providerTextLabel(provider) {
  const labels = {
    x: "X",
    x_user: "X",
    threads: "Threads",
    linkedin: "LinkedIn",
    linkedin_page: "LinkedIn",
    meta: "Facebook",
    facebook: "Facebook",
    instagram: "Instagram",
    instagram_business: "Instagram",
    tiktok: "TikTok",
    telegram: "Telegram",
    discord: "Discord",
    snapchat: "Snapchat"
  };
  return labels[provider] || "This platform";
}

// Records a visible warning when we trim over-limit text instead of silently
// dropping the tail (the old `.slice()` lost real content with no signal). The
// warning rides along on the post and is surfaced on the published post record.
function recordTextTrimWarning(post, { limit, originalLength }) {
  if (!post || typeof post !== "object") {
    return;
  }
  if (!Array.isArray(post.textTrimWarnings)) {
    post.textTrimWarnings = [];
  }
  const dropped = Math.max(0, originalLength - limit);
  const isStandardX = (post.provider === "x" || post.provider === "x_user") && limit <= 280;
  post.textTrimWarnings.push({
    code: "text_trimmed_to_platform_limit",
    provider: post.provider || null,
    limit,
    originalLength,
    droppedCharacters: dropped,
    message:
      `Post text was ${originalLength} characters but ${providerTextLabel(post.provider)} allows ${limit}; ` +
      `the last ${dropped} character(s) were trimmed to fit.` +
      (isStandardX
        ? " Reconnect this account if it has X Premium to publish longer posts."
        : "")
  });
}

// Body-only providers publish the `description` as the post body. The campaign
// step `name` is an organizational label (campaigns auto-generate one per step),
// not post content — prepending it silently corrupted tweets and pushed real
// content past the character limit, so it is no longer used as text here.
// Title-bearing providers (Reddit, YouTube, WordPress) map `name` to their real
// title field via createTitle() and are unaffected.
function composePostText(post, { maxLength = null } = {}) {
  const text = String(post?.description || "").trim();
  if (!maxLength || weightedTextLength(text, post?.provider) <= maxLength) {
    return text;
  }
  recordTextTrimWarning(post, { limit: maxLength, originalLength: text.length });
  return text.slice(0, maxLength);
}

function composeTikTokPhotoText(post) {
  return {
    title: String(post.name || "").trim().slice(0, TIKTOK_PHOTO_TITLE_MAX),
    description: String(post.description || "").trim().slice(0, TIKTOK_PHOTO_DESCRIPTION_MAX)
  };
}

// TikTok photo posts reject images larger than 1080×1920 (picture_size_check_failed)
// and accept only JPEG/WebP sources (PNG passes init but fails asynchronously
// with file_format_check_failed). For SocialClaw-hosted media, `?maxdim=` fits
// the image inside the box (aspect ratio preserved, downscale-only) and always
// returns JPEG, so one derivative satisfies both rules. Off-domain URLs we
// cannot transform, so fall back to `?format=jpeg` for non-native formats.
function tikTokPhotoImageUrl(asset, publicBaseUrl) {
  const url = String(asset?.url || "").trim();
  if (!url) {
    return url;
  }
  // A single asset whose url is several URLs joined together (e.g. a carousel
  // packed into one comma-separated `media_link`) is unfetchable and fails the
  // whole post with an opaque `photo_pull_failed`. Ingestion now splits these
  // into separate assets, but guard here too so any legacy or out-of-band post
  // fails fast with an actionable message instead of a mystery pull error.
  if ((url.match(/https?:\/\//gi) || []).length > 1) {
    throw new AppError(
      "This photo has several image URLs packed into one — split them into separate images and try again.",
      {
        statusCode: 422,
        code: "tiktok_photo_media_malformed",
        retryable: false
      }
    );
  }
  if (isSocialClawMediaUrl(url, publicBaseUrl)) {
    return constrainImageDimensionsUrl(url, TIKTOK_PHOTO_MAX_WIDTH, TIKTOK_PHOTO_MAX_HEIGHT, publicBaseUrl);
  }
  const mime = String(asset?.mime || "").toLowerCase();
  const isNativeFormat =
    mime === "image/jpeg" ||
    mime === "image/webp" ||
    /\.(?:jpe?g|webp)(?:[?#]|$)/i.test(url);
  if (isNativeFormat) {
    return url;
  }
  return url.includes("?") ? `${url}&format=jpeg` : `${url}?format=jpeg`;
}

const TIKTOK_PHOTO_PREWARM_TIMEOUT_MS = 15_000;

function tikTokPhotoFlagEnabled(name) {
  const raw = process.env[name];
  return raw === undefined || String(raw).trim() !== "0";
}

// TikTok's photo puller enforces a short fetch timeout per image and fails the
// whole post when any image is slow (photo_pull_failed). Fetching each URL
// ourselves right before init loads it into the API's in-memory media cache,
// so the pull that follows is served from RAM instead of a cold cross-region
// S3 read. Kill switch: SC_TIKTOK_PHOTO_PREWARM=0.
async function warmTikTokPhotoImageUrls(photoImages) {
  if (!tikTokPhotoFlagEnabled("SC_TIKTOK_PHOTO_PREWARM")) {
    return;
  }
  await Promise.all(
    photoImages.map(async (url) => {
      if (!/^https?:\/\//i.test(String(url || ""))) {
        return;
      }
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(TIKTOK_PHOTO_PREWARM_TIMEOUT_MS) });
        await response.arrayBuffer();
      } catch {
        // Warm-up is best effort; the publish proceeds either way.
      }
    })
  );
}

// Choose the URL TikTok's photo puller will fetch for each image.
//
// Video pulls (a raw stored URL) never hit `photo_pull_failed`; photo pulls that
// go through the size-fit `?maxdim=` derivative do — its cold, cross-replica
// generation can blow TikTok's short photo-pull timeout. So when we can confirm a
// SocialClaw-hosted image is a JPEG already within 1080×1920, we hand TikTok the
// RAW stored URL instead: the original object is already in shared storage, so
// the pull is a plain fast read exactly like a video's. Anything we can't confirm
// in-box (oversized, non-JPEG, unmeasurable, or off-domain) keeps the derivative,
// which we warm so its shared-storage copy exists before the pull.
// Kill switch SC_TIKTOK_PHOTO_PREWARM=0 restores the old always-derivative path.
async function resolveTikTokPhotoImageUrls(assets, publicBaseUrl) {
  if (!tikTokPhotoFlagEnabled("SC_TIKTOK_PHOTO_PREWARM")) {
    return assets.map((asset) => tikTokPhotoImageUrl(asset, publicBaseUrl));
  }
  return Promise.all(assets.map((asset) => resolveTikTokPhotoImageUrl(asset, publicBaseUrl)));
}

// Minimal baseline/progressive JPEG dimension reader (SOI + SOF frame header).
// Mirrors readJpegDimensions in asset-previews.mjs; inlined here so the provider
// layer stays decoupled from that module's db/ffmpeg import chain. Returns null
// for anything that isn't a parseable JPEG, which routes callers to the safe
// derivative path.
function readTikTokJpegDimensions(bytes) {
  if (!bytes || bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    return null;
  }
  const len = bytes.length;
  let offset = 2;
  while (offset + 1 < len) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    let marker = bytes[offset + 1];
    while (marker === 0xff && offset + 2 < len) {
      offset += 1;
      marker = bytes[offset + 1];
    }
    offset += 2;
    if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      continue;
    }
    if (offset + 1 >= len) {
      break;
    }
    const segLen = (bytes[offset] << 8) | bytes[offset + 1];
    if (segLen < 2) {
      break;
    }
    const isFrameHeader =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isFrameHeader) {
      if (offset + 6 >= len) {
        break;
      }
      const height = (bytes[offset + 3] << 8) | bytes[offset + 4];
      const width = (bytes[offset + 5] << 8) | bytes[offset + 6];
      return width > 0 && height > 0 ? { width, height } : null;
    }
    offset += segLen;
  }
  return null;
}

async function resolveTikTokPhotoImageUrl(asset, publicBaseUrl) {
  const url = String(asset?.url || "").trim();
  if (!url) {
    return url;
  }
  // Malformed multi-URL guard, identical to the synchronous path.
  if ((url.match(/https?:\/\//gi) || []).length > 1) {
    throw new AppError(
      "This photo has several image URLs packed into one — split them into separate images and try again.",
      { statusCode: 422, code: "tiktok_photo_media_malformed", retryable: false }
    );
  }
  // Off-domain media can't be measured or transformed — keep the native-format
  // / `?format=jpeg` behaviour, warmed exactly as before.
  if (!isSocialClawMediaUrl(url, publicBaseUrl)) {
    const resolved = tikTokPhotoImageUrl(asset, publicBaseUrl);
    await warmTikTokPhotoImageUrls([resolved]);
    return resolved;
  }

  // Fetch the raw stored image once: this both warms it and lets us measure it.
  let bytes = null;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(TIKTOK_PHOTO_PREWARM_TIMEOUT_MS) });
    if (response.ok) {
      bytes = Buffer.from(await response.arrayBuffer());
    }
  } catch {
    // Unreachable or slow — fall through to the size-capped derivative.
  }

  const dims = bytes ? readTikTokJpegDimensions(bytes) : null;
  if (dims && dims.width <= TIKTOK_PHOTO_MAX_WIDTH && dims.height <= TIKTOK_PHOTO_MAX_HEIGHT) {
    // Confirmed in-box JPEG: TikTok pulls the raw stored file (already in shared
    // storage — no derivative generation, as reliable as a video pull).
    return url;
  }

  // Oversized, non-JPEG, or unmeasurable: use the size-capped derivative and warm
  // it so every replica can serve it as a plain read.
  const derivative = constrainImageDimensionsUrl(url, TIKTOK_PHOTO_MAX_WIDTH, TIKTOK_PHOTO_MAX_HEIGHT, publicBaseUrl);
  await warmTikTokPhotoImageUrls([derivative]);
  return derivative;
}

function tikTokPhotoStatusPollDelaysMs() {
  const override = Number(process.env.SC_TIKTOK_PHOTO_STATUS_POLL_DELAY_MS || 0);
  if (Number.isFinite(override) && override > 0) {
    return [override, override, override];
  }
  return [4000, 8000, 8000];
}

// TikTok acknowledges photo posts before fetching/validating the images, so a
// publish_id alone is not success. A brief status check right after init turns
// silent async failures (photo_pull_failed & friends) into real errors —
// retryable when the pull itself failed, since a retry re-inits against a warm
// media cache. Kill switch: SC_TIKTOK_PHOTO_STATUS_POLL=0.
async function assertTikTokPhotoPublishHealthy({ apiBaseUrl, accessToken, publishId }) {
  if (!tikTokPhotoFlagEnabled("SC_TIKTOK_PHOTO_STATUS_POLL")) {
    return null;
  }

  let lastPayload = null;
  for (const delayMs of tikTokPhotoStatusPollDelaysMs()) {
    await sleep(delayMs);

    let payload;
    try {
      const detail = await requestJsonDetailed(`${apiBaseUrl}/post/publish/status/fetch/`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${accessToken}`
        },
        json: {
          publish_id: publishId
        }
      });
      payload = unwrapTikTokPayload(detail.payload) || {};
    } catch {
      // A status-endpoint hiccup must not fail an already accepted publish.
      continue;
    }

    lastPayload = payload;
    const status = String(payload.status || "").trim().toUpperCase();

    if (status === "FAILED") {
      const failReason = String(payload.fail_reason || "").trim() || "unknown";
      throw new AppError(`TikTok rejected the photo post after acceptance: ${failReason}`, {
        statusCode: 502,
        code: "tiktok_photo_publish_failed",
        retryable: failReason === "photo_pull_failed",
        details: {
          publishId,
          failReason,
          payload
        }
      });
    }

    if (status === "PUBLISH_COMPLETE" || status === "SEND_TO_USER_INBOX") {
      return payload;
    }
  }

  return lastPayload;
}

// Returns the provider-facing identity when TikTok reports a username change.
// Scheduled posts target the immutable connected-account id, so both the public
// handle and URL username can safely track the live provider account.
function tikTokAccountUsernameUpdate(account, creatorUsername) {
  const username = String(creatorUsername || "").trim();
  if (!username) {
    return null;
  }
  const handle = `tiktok:@${username.replace(/^@+/, "")}`;
  if (
    String(account?.providerUsername || "").trim().toLowerCase() === username.toLowerCase() &&
    String(account?.handle || "").trim().toLowerCase() === handle.toLowerCase()
  ) {
    return null;
  }
  return { providerUsername: username, handle };
}

function tikTokPublicPostIdFromStatus(statusPayload) {
  const ids = statusPayload?.publicaly_available_post_id;
  return Array.isArray(ids) ? ids.find(Boolean) || null : null;
}

function maybeAltText(value) {
  const text = String(value || "").trim();
  return text ? text : undefined;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function splitScopes(scopeString) {
  return String(scopeString || "")
    .split(/[\s,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function expiresSoon(expiresAt, skewMs = 60_000) {
  if (!expiresAt) {
    return false;
  }
  return new Date(expiresAt).getTime() <= Date.now() + skewMs;
}

function buildProviderUrl(provider, account, providerPostId) {
  if (!providerPostId) {
    return null;
  }

  if (provider === "x") {
    return `https://x.com/i/web/status/${providerPostId}`;
  }

  if (provider === "meta") {
    if (account?.accountType === "facebook_page" && String(providerPostId).includes("_")) {
      return `https://www.facebook.com/${providerPostId}`;
    }
    return null;
  }

  if (provider === "facebook") {
    if (String(providerPostId).includes("_")) {
      return `https://www.facebook.com/${providerPostId}`;
    }
    return null;
  }

  if (provider === "linkedin") {
    return `https://www.linkedin.com/feed/update/${providerPostId}/`;
  }

  if (provider === "linkedin_page") {
    return `https://www.linkedin.com/feed/update/${providerPostId}/`;
  }

  if (provider === "pinterest") {
    return `https://www.pinterest.com/pin/${providerPostId}/`;
  }

  if (provider === "youtube") {
    return `https://www.youtube.com/watch?v=${providerPostId}`;
  }

  if (provider === "tiktok") {
    // providerUsername is the account's real TikTok username, which is what
    // appears in profile and video URLs. The handle now follows that username;
    // it remains a fallback for accounts connected before we recorded one.
    const username = String(account?.providerUsername || account?.handle || "")
      .trim()
      .replace(/^tiktok:/, "")
      .replace(/^@+/, "");
    if (username) {
      return `https://www.tiktok.com/@${username}/video/${providerPostId}`;
    }
    return null;
  }

  if (provider === "snapchat") {
    return null;
  }

  if (provider === "reddit") {
    return `https://www.reddit.com/by_id/${providerPostId}`;
  }

  if (provider === "discord") {
    const guildId = String(account?.meta?.guildId || "").trim();
    const channelId = String(account?.meta?.channelId || "").trim();
    if (guildId && channelId) {
      return `https://discord.com/channels/${guildId}/${channelId}/${providerPostId}`;
    }
    return null;
  }

  if (provider === "telegram") {
    const username = String(account?.meta?.chatUsername || "").trim().replace(/^@+/, "");
    if (username) {
      return `https://t.me/${username}/${providerPostId}`;
    }
    return null;
  }

  return null;
}

function buildDiscordWebhookMessageUrl(account, accessToken, config, providerPostId) {
  const webhookId = String(account?.meta?.webhookId || account?.externalId || "").trim();
  const webhookToken = String(accessToken || "").trim();
  const messageId = String(providerPostId || "").trim();
  if (!webhookId || !webhookToken || !messageId) {
    throw new AppError("Discord delete requires webhook credentials and a provider post id", {
      statusCode: 422,
      code: "discord_delete_missing_fields"
    });
  }
  const baseUrl = String(config.discord.apiBaseUrl || "https://discord.com/api/v10").replace(/\/$/, "");
  return `${baseUrl}/webhooks/${encodeURIComponent(webhookId)}/${encodeURIComponent(webhookToken)}/messages/${encodeURIComponent(messageId)}`;
}

function primaryMediaUrl(post) {
  return mediaUrlsForPost(post)[0] || null;
}

function mediaAssetsForPost(post) {
  const assets = Array.isArray(post.assets)
    ? post.assets
        .map((asset) => {
          if (!asset) {
            return null;
          }
          if (typeof asset === "string") {
            return {
              url: asset.trim(),
              altText: null,
              id: null,
              managed: false,
              originalFilename: null,
              mime: inferMimeFromUrl(asset),
              kind: null,
              size: null
            };
          }
          if (!asset.url) {
            return null;
          }
          return {
            url: String(asset.url).trim(),
            altText: asset.altText ? String(asset.altText).trim() : null,
            id: asset.id ? String(asset.id).trim() : null,
            managed: Boolean(asset.managed),
            originalFilename: asset.originalFilename ? String(asset.originalFilename).trim() : null,
            mime: asset.mime ? sanitizeContentType(asset.mime) : inferMimeFromUrl(asset.url),
            kind: asset.kind ? String(asset.kind).trim().toLowerCase() : null,
            size: Number.isFinite(Number(asset.size)) ? Number(asset.size) : null,
            duration: Number.isFinite(Number(asset.duration)) ? Number(asset.duration) : null,
            width: Number.isFinite(Number(asset.width)) ? Number(asset.width) : null,
            height: Number.isFinite(Number(asset.height)) ? Number(asset.height) : null
          };
        })
        .filter((asset) => asset && asset.url)
    : [];

  if (assets.length > 0) {
    return assets;
  }

  return post.mediaLink
    ? [
        {
          url: String(post.mediaLink).trim(),
          altText: null,
          id: null,
          managed: false,
          originalFilename: null,
          mime: inferMimeFromUrl(post.mediaLink),
          kind: null,
          size: Number.isFinite(Number(post.size)) ? Number(post.size) : null,
          duration: Number.isFinite(Number(post.duration)) ? Number(post.duration) : null,
          width: Number.isFinite(Number(post.width)) ? Number(post.width) : null,
          height: Number.isFinite(Number(post.height)) ? Number(post.height) : null
        }
      ]
    : [];
}

function mediaUrlsForPost(post) {
  return mediaAssetsForPost(post).map((asset) => asset.url);
}

function inferMimeFromUrl(mediaUrl) {
  const ext = extFromMedia(mediaUrl);
  return ext ? MIME_BY_EXT[ext] || null : null;
}

function kindFromAsset(asset) {
  if (asset?.kind === "video" || asset?.kind === "image") {
    return asset.kind;
  }
  if (isVideoMedia(asset?.url)) {
    return "video";
  }
  if (isImageMedia(asset?.url)) {
    return "image";
  }
  return "other";
}

function normalizeTikTokPhotoCoverIndex(settings = {}, photoCount = 0) {
  const raw = settings.photoCoverIndex;
  const value = raw === undefined || raw === null || raw === "" ? 0 : Number(raw);
  if (!Number.isInteger(value) || value < 0 || value >= photoCount) {
    throw new AppError("TikTok photoCoverIndex must point to one of the selected photos", {
      code: "tiktok_photo_cover_index_invalid",
      statusCode: 422,
      details: {
        photoCount
      }
    });
  }
  return value;
}

function tikTokMediaShapeForPost(post) {
  const assets = mediaAssetsForPost(post);
  const kinds = assets.map((asset) => kindFromAsset(asset));
  const imageCount = kinds.filter((kind) => kind === "image").length;
  const videoCount = kinds.filter((kind) => kind === "video").length;
  const otherCount = kinds.filter((kind) => kind === "other").length;

  if (assets.length === 0) {
    return {
      kind: "missing",
      assets,
      imageCount,
      videoCount,
      otherCount
    };
  }

  if (otherCount > 0) {
    return {
      kind: "unsupported",
      assets,
      imageCount,
      videoCount,
      otherCount
    };
  }

  if (videoCount === 1 && assets.length === 1) {
    return {
      kind: "video",
      assets,
      imageCount,
      videoCount,
      otherCount
    };
  }

  if (imageCount === assets.length) {
    return {
      kind: "photo",
      assets,
      imageCount,
      videoCount,
      otherCount
    };
  }

  return {
    kind: "mixed",
    assets,
    imageCount,
    videoCount,
    otherCount
  };
}

function enforceKnownAssetSize(asset, maxBytes, { code, message }) {
  const size = Number(asset?.size);
  if (!Number.isFinite(size) || size <= 0) {
    return;
  }
  if (size <= maxBytes) {
    return;
  }
  throw new AppError(message, {
    statusCode: 422,
    code,
    details: {
      size,
      maxBytes,
      assetId: asset?.id || null,
      url: asset?.url || null
    }
  });
}

function snapchatModeFromPost(post) {
  const mode = String(post?.settings?.snapchatPublishMode || "spotlight").trim().toLowerCase();
  if (["spotlight", "story", "saved_story"].includes(mode)) {
    return mode;
  }
  return "spotlight";
}

function snapchatModeLabel(mode) {
  if (mode === "story") {
    return "Story";
  }
  if (mode === "saved_story") {
    return "Saved Story";
  }
  return "Spotlight";
}

function assetCreatedAtMs(asset) {
  const value = new Date(asset?.created_at || asset?.createdAt || 0).getTime();
  return Number.isFinite(value) ? value : 0;
}

function normalizeSnapchatAssetId(asset, fallback = null) {
  return String(
    asset?.id ||
    asset?.story_id ||
    asset?.saved_story_id ||
    asset?.spotlight_id ||
    fallback ||
    ""
  ).trim() || null;
}

function findSnapchatAssetById(items, assetId) {
  const normalizedId = String(assetId || "").trim();
  if (!normalizedId) {
    return null;
  }
  return (Array.isArray(items) ? items : []).find((item) => normalizeSnapchatAssetId(item) === normalizedId) || null;
}

function validateSnapchatVideoMetadata(asset, mode) {
  const label = `Snapchat ${snapchatModeLabel(mode)}`;
  const duration = Number(asset?.duration || 0);
  if (Number.isFinite(duration) && duration > 0) {
    if (duration < SNAPCHAT_MIN_VIDEO_DURATION_SEC || duration > SNAPCHAT_MAX_VIDEO_DURATION_SEC) {
      throw new AppError(
        `${label} videos must be between ${SNAPCHAT_MIN_VIDEO_DURATION_SEC} and ${SNAPCHAT_MAX_VIDEO_DURATION_SEC} seconds`,
        {
          statusCode: 422,
          code: "snapchat_video_duration_invalid",
          details: {
            duration,
            minSeconds: SNAPCHAT_MIN_VIDEO_DURATION_SEC,
            maxSeconds: SNAPCHAT_MAX_VIDEO_DURATION_SEC
          }
        }
      );
    }
  }

  const width = Number(asset?.width || 0);
  const height = Number(asset?.height || 0);
  if (Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0) {
    if (width < SNAPCHAT_MIN_VIDEO_WIDTH || height < SNAPCHAT_MIN_VIDEO_HEIGHT) {
      throw new AppError(
        `${label} videos must be at least ${SNAPCHAT_MIN_VIDEO_WIDTH}x${SNAPCHAT_MIN_VIDEO_HEIGHT}`,
        {
          statusCode: 422,
          code: "snapchat_video_resolution_invalid",
          details: {
            width,
            height,
            minWidth: SNAPCHAT_MIN_VIDEO_WIDTH,
            minHeight: SNAPCHAT_MIN_VIDEO_HEIGHT
          }
        }
      );
    }
  }
}

function sanitizeContentType(value) {
  if (!value) {
    return null;
  }
  return String(value).split(";", 1)[0].trim().toLowerCase() || null;
}

function assertInstagramCarouselAssets(mediaAssets) {
  if (mediaAssets.length > INSTAGRAM_CAROUSEL_MEDIA_LIMIT) {
    throw new AppError(`Instagram carousels support up to ${INSTAGRAM_CAROUSEL_MEDIA_LIMIT} image or video assets`, {
      code: "instagram_carousel_limit_exceeded",
      statusCode: 422
    });
  }

  const unsupported = mediaAssets.find((asset) => !["image", "video"].includes(kindFromAsset(asset)));
  if (unsupported) {
    throw new AppError("Instagram carousels support image and video assets", {
      code: "instagram_carousel_media_unsupported",
      statusCode: 422
    });
  }
}

function assertInstagramStoryAssets(mediaAssets) {
  if (mediaAssets.length !== 1) {
    throw new AppError("Instagram Stories require exactly one image or video asset", {
      code: "instagram_story_single_media_required",
      statusCode: 422
    });
  }
  if (!["image", "video"].includes(kindFromAsset(mediaAssets[0]))) {
    throw new AppError("Instagram Stories require an image or video asset", {
      code: "instagram_story_media_unsupported",
      statusCode: 422
    });
  }
}

function instagramPlacementForPost(post) {
  return String(post?.settings?.instagramPlacement || "post").trim().toLowerCase();
}

export function assertSupportedProvider(provider) {
  if (!SUPPORTED_PROVIDERS.includes(provider)) {
    throw new AppError(`Unsupported provider: ${provider}`, {
      code: "provider_unsupported",
      statusCode: 422
    });
  }
}

export function validateProviderPayload(normalizedPost) {
  const { provider, account, mediaLink } = normalizedPost;
  const accountLower = String(account || "").toLowerCase();
  const ext = extFromMedia(mediaLink);
  const mediaAssets = mediaAssetsForPost(normalizedPost);
  const mediaUrls = mediaAssets.map((asset) => asset.url);
  const mediaKinds = mediaAssets.map((asset) => kindFromAsset(asset));
  const videoCount = mediaKinds.filter((kind) => kind === "video").length;
  const interactionType = String(normalizedPost.interactionType || "post").trim().toLowerCase();
  const assetCount = mediaUrls.length;

  assertSupportedProvider(provider);

  if (provider === "threads") {
    if (interactionType !== "post") {
      throw new AppError("Threads currently supports posts only", { statusCode: 422, code: "threads_interaction_unsupported" });
    }
    if (assetCount > 20) {
      throw new AppError("Threads supports up to 20 media items", { statusCode: 422, code: "threads_media_limit_exceeded" });
    }
    if (mediaKinds.includes("other")) {
      throw new AppError("Threads supports images and videos", { statusCode: 422, code: "threads_media_unsupported" });
    }
    if (!assetCount && !String(normalizedPost.description || "").trim()) {
      throw new AppError("Threads needs text or media", { statusCode: 422, code: "threads_content_required" });
    }
  }

  if (interactionType === "comment") {
    throw new AppError(`${provider} does not support comment publishing in SocialClaw yet`, {
      code: "provider_comment_unsupported",
      statusCode: 422
    });
  }

  if (provider === "x") {
    if (assetCount > 4) {
      throw new AppError("X supports up to four image assets per post", {
        code: "x_media_limit_exceeded",
        statusCode: 422
      });
    }

    if (mediaKinds.includes("other")) {
      throw new AppError("X supports image/video media URLs or plain text", {
        code: "x_media_unsupported",
        statusCode: 422
      });
    }

    if (videoCount > 1 || (videoCount === 1 && assetCount > 1)) {
      throw new AppError("X supports one video asset or up to four image assets per post", {
        code: "x_multi_video_unsupported",
        statusCode: 422
      });
    }

    for (const asset of mediaAssets) {
      if (kindFromAsset(asset) === "image") {
        enforceKnownAssetSize(asset, X_MAX_IMAGE_BYTES, {
          code: "x_image_too_large",
          message: "X image assets must be 5 MB or smaller"
        });
      }
      if (kindFromAsset(asset) === "video") {
        enforceKnownAssetSize(asset, X_MAX_VIDEO_BYTES, {
          code: "x_video_too_large",
          message: "X video assets must be 512 MB or smaller"
        });
      }
    }

    if (interactionType === "reply" && !normalizedPost.parentStepId && !normalizedPost.resolvedParentProviderPostId) {
      throw new AppError("X replies require a parent step or resolved parent provider post id", {
        code: "x_reply_parent_required",
        statusCode: 422
      });
    }

    if (ext && !(IMAGE_EXT.has(ext) || VIDEO_EXT.has(ext))) {
      throw new AppError("X supports plain text plus up to four image assets or one video asset that SocialClaw uploads natively", {
        code: "x_media_unsupported",
        statusCode: 422
      });
    }
  }

  if (provider === "meta") {
    const isMetaInstagram = accountLower.startsWith("meta:instagram:");
    if (isMetaInstagram && instagramPlacementForPost(normalizedPost) !== "post") {
      assertInstagramStoryAssets(mediaAssets);
    }
    if (assetCount > 1) {
      if (isMetaInstagram) {
        assertInstagramCarouselAssets(mediaAssets);
      } else {
        if (assetCount > FACEBOOK_PAGE_IMAGE_LIMIT) {
          throw new AppError(`Facebook Pages support up to ${FACEBOOK_PAGE_IMAGE_LIMIT} image assets per post`, {
            code: "facebook_media_limit_exceeded",
            statusCode: 422
          });
        }
        if (videoCount > 0 || mediaKinds.some((kind) => kind !== "image")) {
          throw new AppError("Facebook Pages support one video asset or up to ten image assets per post", {
            code: "facebook_multi_media_unsupported",
            statusCode: 422
          });
        }
      }
    }

    if (interactionType !== "post") {
      throw new AppError("Meta publish interactions currently support only post steps", {
        code: "meta_interaction_unsupported",
        statusCode: 422
      });
    }

    if (accountLower.startsWith("meta:instagram:") && !mediaLink) {
      throw new AppError("Instagram posts require media", {
        code: "instagram_media_required",
        statusCode: 422
      });
    }

    if (ext && !(IMAGE_EXT.has(ext) || VIDEO_EXT.has(ext))) {
      throw new AppError("Meta supports image/video media URLs", {
        code: "meta_media_unsupported",
        statusCode: 422
      });
    }
  }

  if (provider === "facebook") {
    if (assetCount > 1) {
      if (assetCount > FACEBOOK_PAGE_IMAGE_LIMIT) {
        throw new AppError(`Facebook Pages support up to ${FACEBOOK_PAGE_IMAGE_LIMIT} image assets per post`, {
          code: "facebook_media_limit_exceeded",
          statusCode: 422
        });
      }
      if (videoCount > 0 || mediaKinds.some((kind) => kind !== "image")) {
        throw new AppError("Facebook Pages support one video asset or up to ten image assets per post", {
          code: "facebook_multi_media_unsupported",
          statusCode: 422
        });
      }
    }

    if (interactionType !== "post") {
      throw new AppError("Facebook publish interactions currently support only post steps", {
        code: "facebook_interaction_unsupported",
        statusCode: 422
      });
    }

    if (ext && !(IMAGE_EXT.has(ext) || VIDEO_EXT.has(ext))) {
      throw new AppError("Facebook supports image/video media URLs", {
        code: "facebook_media_unsupported",
        statusCode: 422
      });
    }
  }

  if (provider === "instagram_business" || provider === "instagram") {
    const instagramPlacement = instagramPlacementForPost(normalizedPost);
    if (instagramPlacement !== "post") {
      assertInstagramStoryAssets(mediaAssets);
    }
    if (assetCount > 1) {
      assertInstagramCarouselAssets(mediaAssets);
    }

    if (interactionType !== "post") {
      throw new AppError("Instagram publish interactions currently support only post steps", {
        code: "instagram_interaction_unsupported",
        statusCode: 422
      });
    }

    if (!mediaLink) {
      throw new AppError("Instagram posts require media", {
        code: "instagram_media_required",
        statusCode: 422
      });
    }

    if (ext && !(IMAGE_EXT.has(ext) || VIDEO_EXT.has(ext))) {
      throw new AppError("Instagram supports image/video media URLs", {
        code: "instagram_media_unsupported",
        statusCode: 422
      });
    }
  }

  if (provider === "tiktok") {
    if (interactionType !== "post") {
      throw new AppError("TikTok publish interactions currently support only post steps", {
        code: "tiktok_interaction_unsupported",
        statusCode: 422
      });
    }

    const tiktokMedia = tikTokMediaShapeForPost(normalizedPost);

    if (tiktokMedia.kind === "missing") {
      throw new AppError("TikTok posts require one video or one to 35 image assets", {
        code: "tiktok_media_required",
        statusCode: 422
      });
    }

    if (tiktokMedia.kind === "unsupported") {
      throw new AppError("TikTok media must be image (.jpg/.jpeg/.png/.webp) or video (.mp4/.mov/.webm/.m4v)", {
        code: "tiktok_media_unsupported",
        statusCode: 422
      });
    }

    if (tiktokMedia.kind === "mixed") {
      throw new AppError("TikTok supports either one video or one photo gallery per post, not mixed media", {
        code: "tiktok_mixed_media_unsupported",
        statusCode: 422
      });
    }

    if (tiktokMedia.kind === "photo") {
      if (assetCount > TIKTOK_MAX_PHOTO_COUNT) {
        throw new AppError(`TikTok photo posts support up to ${TIKTOK_MAX_PHOTO_COUNT} images`, {
          code: "tiktok_photo_limit_exceeded",
          statusCode: 422
        });
      }
      normalizeTikTokPhotoCoverIndex(normalizedPost.settings || {}, assetCount);
    }

    if (tiktokMedia.kind === "video") {
      for (const asset of mediaAssets) {
        if (kindFromAsset(asset) === "video") {
          enforceKnownAssetSize(asset, TIKTOK_MAX_VIDEO_BYTES, {
            code: "tiktok_video_too_large",
            message: "TikTok video assets must be 4 GB or smaller"
          });
        }
      }
    }
  }

  if (provider === "snapchat") {
    const snapchatMode = snapchatModeFromPost(normalizedPost);
    const label = `Snapchat ${snapchatModeLabel(snapchatMode)}`;
    if (interactionType !== "post") {
      throw new AppError(`${label} publish interactions currently support only post steps`, {
        code: "snapchat_interaction_unsupported",
        statusCode: 422
      });
    }

    if (assetCount !== 1 || !mediaLink) {
      throw new AppError(`${label} publishing requires exactly one video media asset`, {
        code: "snapchat_media_required",
        statusCode: 422
      });
    }

    if (ext !== ".mp4" || videoCount !== 1 || mediaKinds.includes("image") || mediaKinds.includes("other")) {
      throw new AppError(`${label} currently supports exactly one .mp4 video asset`, {
        code: "snapchat_video_required",
        statusCode: 422
      });
    }

    if (snapchatMode === "saved_story") {
      const title = String(normalizedPost.name || "").trim();
      if (!title) {
        throw new AppError("Snapchat Saved Story publishing requires a title", {
          code: "snapchat_saved_story_title_required",
          statusCode: 422
        });
      }
      if (title.length > 45) {
        throw new AppError("Snapchat Saved Story titles must be 45 characters or shorter", {
          code: "snapchat_saved_story_title_too_long",
          statusCode: 422,
          details: {
            maxLength: 45
          }
        });
      }
    }

    for (const asset of mediaAssets) {
      if (kindFromAsset(asset) === "video") {
        enforceKnownAssetSize(asset, SNAPCHAT_MAX_VIDEO_BYTES, {
          code: "snapchat_video_too_large",
          message: `${label} videos must be 1 GB or smaller`
        });
        validateSnapchatVideoMetadata(asset, snapchatMode);
      }
    }
  }

  if (provider === "linkedin") {
    if (interactionType !== "post") {
      throw new AppError("LinkedIn publish interactions currently support only post steps", {
        code: "linkedin_interaction_unsupported",
        statusCode: 422
      });
    }

    if (assetCount > LINKEDIN_IMAGE_LIMIT) {
      throw new AppError(`LinkedIn supports up to ${LINKEDIN_IMAGE_LIMIT} image assets per post`, {
        code: "linkedin_media_limit_exceeded",
        statusCode: 422
      });
    }

    if (videoCount > 1 || (videoCount === 1 && assetCount > 1)) {
      throw new AppError("LinkedIn supports one video asset or up to twenty image assets per post", {
        code: "linkedin_multi_video_unsupported",
        statusCode: 422
      });
    }

    if (mediaKinds.includes("other")) {
      throw new AppError("LinkedIn supports image URLs or plain text in SocialClaw today", {
        code: "linkedin_media_unsupported",
        statusCode: 422
      });
    }

    if (ext && !(IMAGE_EXT.has(ext) || VIDEO_EXT.has(ext))) {
      throw new AppError("LinkedIn supports plain text plus image assets that SocialClaw uploads natively", {
        code: "linkedin_media_unsupported",
        statusCode: 422
      });
    }

    for (const asset of mediaAssets) {
      if (kindFromAsset(asset) === "video") {
        enforceKnownAssetSize(asset, LINKEDIN_MAX_VIDEO_BYTES, {
          code: "linkedin_video_too_large",
          message: "LinkedIn video assets must be 5 GB or smaller"
        });
      }
    }
  }

  if (provider === "linkedin_page") {
    if (interactionType !== "post") {
      throw new AppError("LinkedIn page publish interactions currently support only post steps", {
        code: "linkedin_page_interaction_unsupported",
        statusCode: 422
      });
    }

    if (assetCount > LINKEDIN_IMAGE_LIMIT) {
      throw new AppError(`LinkedIn pages support up to ${LINKEDIN_IMAGE_LIMIT} image assets per post`, {
        code: "linkedin_media_limit_exceeded",
        statusCode: 422
      });
    }

    if (videoCount > 1 || (videoCount === 1 && assetCount > 1)) {
      throw new AppError("LinkedIn pages support one video asset or up to twenty image assets per post", {
        code: "linkedin_multi_video_unsupported",
        statusCode: 422
      });
    }

    if (mediaKinds.includes("other")) {
      throw new AppError("LinkedIn pages support image URLs or plain text in SocialClaw today", {
        code: "linkedin_media_unsupported",
        statusCode: 422
      });
    }

    for (const asset of mediaAssets) {
      if (kindFromAsset(asset) === "video") {
        enforceKnownAssetSize(asset, LINKEDIN_MAX_VIDEO_BYTES, {
          code: "linkedin_video_too_large",
          message: "LinkedIn video assets must be 5 GB or smaller"
        });
      }
    }
  }

  if (provider === "pinterest") {
    const pinMode = String(normalizedPost.settings?.pinMode || "auto").trim().toLowerCase();

    if (interactionType !== "post") {
      throw new AppError("Pinterest publish interactions currently support only post steps", {
        code: "pinterest_interaction_unsupported",
        statusCode: 422
      });
    }

    if (assetCount > 5) {
      throw new AppError("Pinterest supports up to five image assets per pin", {
        code: "pinterest_media_limit_exceeded",
        statusCode: 422
      });
    }

    if (videoCount > 1 || (videoCount === 1 && assetCount > 1)) {
      throw new AppError("Pinterest supports one video asset or up to five image assets per pin", {
        code: "pinterest_multi_video_unsupported",
        statusCode: 422
      });
    }

    if (mediaKinds.includes("other")) {
      throw new AppError("Pinterest supports image URLs, one video URL, or a capability-gated product pin mode", {
        code: "pinterest_media_unsupported",
        statusCode: 422
      });
    }

    if (pinMode !== "product" && assetCount === 0) {
      throw new AppError("Pinterest pins require at least one image or video asset", {
        code: "pinterest_media_required",
        statusCode: 422
      });
    }
  }

  if (provider === "youtube") {
    if (assetCount > 1) {
      throw new AppError("YouTube currently supports one video asset per post", {
        code: "provider_multi_asset_unsupported",
        statusCode: 422
      });
    }

    if (interactionType !== "post") {
      throw new AppError("YouTube publish interactions currently support only post steps", {
        code: "youtube_interaction_unsupported",
        statusCode: 422
      });
    }

    if (!mediaLink) {
      throw new AppError("YouTube uploads require a video media link", {
        code: "youtube_video_required",
        statusCode: 422
      });
    }

    if (!ext || !VIDEO_EXT.has(ext)) {
      throw new AppError("YouTube media must be video (.mp4/.mov/.webm/.m4v)", {
        code: "youtube_video_required",
        statusCode: 422
      });
    }

    for (const asset of mediaAssets) {
      if (kindFromAsset(asset) === "video") {
        enforceKnownAssetSize(asset, YOUTUBE_MAX_VIDEO_BYTES, {
          code: "youtube_video_too_large",
          message: "YouTube video assets must be 256 GB or smaller"
        });
      }
    }
  }

  if (provider === "reddit") {
    if (assetCount > 1) {
      throw new AppError("Reddit currently supports one effective media asset per post", {
        code: "provider_multi_asset_unsupported",
        statusCode: 422
      });
    }

    if (interactionType !== "post") {
      throw new AppError("Reddit publish interactions currently support only post steps", {
        code: "reddit_interaction_unsupported",
        statusCode: 422
      });
    }
  }

  if (provider === "wordpress") {
    if (interactionType !== "post") {
      throw new AppError("WordPress publish interactions currently support only post steps", {
        code: "wordpress_interaction_unsupported",
        statusCode: 422
      });
    }

    if (assetCount > 20) {
      throw new AppError("WordPress currently supports up to twenty remote media assets per post", {
        code: "wordpress_media_limit_exceeded",
        statusCode: 422
      });
    }

    if (mediaKinds.includes("other")) {
      throw new AppError("WordPress media URLs must resolve to supported image/video types", {
        code: "wordpress_media_unsupported",
        statusCode: 422
      });
    }
  }

  if (provider === "telegram") {
    if (assetCount > 1) {
      throw new AppError("Telegram currently supports one media asset per post", {
        code: "provider_multi_asset_unsupported",
        statusCode: 422
      });
    }

    if (interactionType !== "post") {
      throw new AppError("Telegram publish interactions currently support only post steps", {
        code: "telegram_interaction_unsupported",
        statusCode: 422
      });
    }

    const text = composePostText({
      name: normalizedPost.name,
      description: normalizedPost.description
    });
    if (!mediaLink && !text) {
      throw new AppError("Telegram posts require text or one media asset", {
        code: "telegram_text_or_media_required",
        statusCode: 422
      });
    }

    if (mediaKinds.includes("other")) {
      throw new AppError("Telegram supports one image or one video asset per post", {
        code: "telegram_media_unsupported",
        statusCode: 422
      });
    }

    if (ext && !(IMAGE_EXT.has(ext) || VIDEO_EXT.has(ext))) {
      throw new AppError("Telegram media must be image/video (.jpg/.jpeg/.png/.webp/.mp4/.mov/.webm/.m4v)", {
        code: "telegram_media_unsupported",
        statusCode: 422
      });
    }
  }

  if (provider === "discord") {
    if (assetCount > 1) {
      throw new AppError("Discord currently supports one media asset per post", {
        code: "provider_multi_asset_unsupported",
        statusCode: 422
      });
    }

    if (interactionType !== "post") {
      throw new AppError("Discord publish interactions currently support only post steps", {
        code: "discord_interaction_unsupported",
        statusCode: 422
      });
    }

    const text = composePostText({
      name: normalizedPost.name,
      description: normalizedPost.description
    });
    if (!mediaLink && !text) {
      throw new AppError("Discord posts require text or one media asset", {
        code: "discord_text_or_media_required",
        statusCode: 422
      });
    }

    if (mediaKinds.includes("other")) {
      throw new AppError("Discord supports text plus a single image or video asset per post", {
        code: "discord_media_unsupported",
        statusCode: 422
      });
    }

    if (ext && !(IMAGE_EXT.has(ext) || VIDEO_EXT.has(ext))) {
      throw new AppError("Discord media must be image/video (.jpg/.jpeg/.png/.webp/.mp4/.mov/.webm/.m4v)", {
        code: "discord_media_unsupported",
        statusCode: 422
      });
    }
  }
}
