// Synced from ../socialclaw via tools/sync-public-cli.mjs. Edit the private repo, then re-run this sync.
import path from "node:path";
import { AppError } from "./errors.mjs";

const SUPPORTED_PROVIDERS = [
  "x",
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
const INSTAGRAM_CAROUSEL_IMAGE_LIMIT = 10;
const INSTAGRAM_VIDEO_CONTAINER_POLL_LIMIT = 20;
const INSTAGRAM_VIDEO_CONTAINER_POLL_DELAY_MS = 3000;
const INSTAGRAM_CONTAINER_READY_STATUSES = new Set(["FINISHED"]);
const INSTAGRAM_CONTAINER_FAILED_STATUSES = new Set(["ERROR", "EXPIRED"]);
const FACEBOOK_PAGE_IMAGE_LIMIT = 10;
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

function isGeneratedCampaignStepName(post) {
  const name = String(post?.name || "").trim();
  const campaignName = String(post?.campaignName || "").trim();
  const sequencePosition = Number.isInteger(post?.sequencePosition)
    ? post.sequencePosition
    : Number.isInteger(post?.stepIndex)
      ? post.stepIndex + 1
      : null;

  return Boolean(
    name &&
    campaignName &&
    sequencePosition &&
    name === `${campaignName} Step ${sequencePosition}`
  );
}

function composePostText(post, { maxLength = null } = {}) {
  const title = isGeneratedCampaignStepName(post) ? "" : post.name;
  const chunks = [title, post.description].filter(Boolean).map((item) => String(item).trim());
  const text = chunks.join("\n\n");
  return maxLength ? text.slice(0, maxLength) : text;
}

function composeTikTokPhotoText(post) {
  return {
    title: String(post.name || "").trim().slice(0, TIKTOK_PHOTO_TITLE_MAX),
    description: String(post.description || "").trim().slice(0, TIKTOK_PHOTO_DESCRIPTION_MAX)
  };
}

// TikTok photo posts only accept JPEG and WebP source images. Other formats
// (notably PNG) are accepted at init but fail asynchronously with
// file_format_check_failed, so the post never appears. Route non-native formats
// through the media server's `?format=jpeg` conversion, keeping the pulled URL
// on the verified publishing domain.
function tikTokPhotoImageUrl(asset) {
  const url = String(asset?.url || "").trim();
  if (!url) {
    return url;
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
    const username = String(account?.handle || "")
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
      if (accountLower.startsWith("meta:instagram:")) {
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
