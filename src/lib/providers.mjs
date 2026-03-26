// Synced from ../socialclaw via tools/sync-public-cli.mjs. Edit the private repo, then re-run this sync.
import path from "node:path";
import { AppError } from "./errors.mjs";

const SUPPORTED_PROVIDERS = [
  "x",
  "meta",
  "facebook",
  "instagram_business",
  "instagram",
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
const X_UPLOAD_CHUNK_BYTES = 4 * 1024 * 1024;
const X_MEDIA_POLL_LIMIT = 15;
const LINKEDIN_IMAGE_LIMIT = 20;
const MB = 1024 * 1024;
const GB = 1024 * MB;
const LINKEDIN_MAX_VIDEO_BYTES = 5 * GB;
const LINKEDIN_POST_RETRY_DELAYS_MS = [1500, 3000, 5000];
const LINKEDIN_VIDEO_POLL_LIMIT = 30;
const LINKEDIN_VIDEO_POLL_DELAY_MS = 2000;
const X_MAX_IMAGE_BYTES = 5 * MB;
const X_MAX_VIDEO_BYTES = 512 * MB;
const TIKTOK_MAX_VIDEO_BYTES = 4 * GB;
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

function composePostText(post, { maxLength = null } = {}) {
  const chunks = [post.name, post.description].filter(Boolean).map((item) => String(item).trim());
  const text = chunks.join("\n\n");
  return maxLength ? text.slice(0, maxLength) : text;
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
            size: Number.isFinite(Number(asset.size)) ? Number(asset.size) : null
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
          size: Number.isFinite(Number(post.size)) ? Number(post.size) : null
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

function sanitizeContentType(value) {
  if (!value) {
    return null;
  }
  return String(value).split(";", 1)[0].trim().toLowerCase() || null;
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
    if (assetCount > 1) {
      throw new AppError("Meta currently supports one media asset per post", {
        code: "provider_multi_asset_unsupported",
        statusCode: 422
      });
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
      throw new AppError("Facebook currently supports one media asset per post", {
        code: "provider_multi_asset_unsupported",
        statusCode: 422
      });
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
    if (assetCount > 1) {
      throw new AppError("Instagram currently supports one media asset per post", {
        code: "provider_multi_asset_unsupported",
        statusCode: 422
      });
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
    if (assetCount > 1) {
      throw new AppError("TikTok currently supports one media asset per post", {
        code: "provider_multi_asset_unsupported",
        statusCode: 422
      });
    }

    if (interactionType !== "post") {
      throw new AppError("TikTok publish interactions currently support only post steps", {
        code: "tiktok_interaction_unsupported",
        statusCode: 422
      });
    }

    if (!mediaLink) {
      throw new AppError("TikTok posts require a video media link", {
        code: "tiktok_media_required",
        statusCode: 422
      });
    }

    if (!ext || !VIDEO_EXT.has(ext)) {
      throw new AppError("TikTok media must be video (.mp4/.mov/.webm/.m4v)", {
        code: "tiktok_video_required",
        statusCode: 422
      });
    }

    for (const asset of mediaAssets) {
      if (kindFromAsset(asset) === "video") {
        enforceKnownAssetSize(asset, TIKTOK_MAX_VIDEO_BYTES, {
          code: "tiktok_video_too_large",
          message: "TikTok video assets must be 4 GB or smaller"
        });
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
    }, { maxLength: 2000 });
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
