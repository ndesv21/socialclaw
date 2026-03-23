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
const LINKEDIN_IMAGE_LIMIT = 20;

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
  const prefix = handle.split(":", 1)[0];
  return canonicalProvider(prefix);
}

export function assertSupportedProvider(provider) {
  if (!SUPPORTED_PROVIDERS.includes(provider)) {
    throw new AppError(`Unsupported provider: ${provider}`, {
      code: "provider_unsupported",
      statusCode: 422
    });
  }
}

function extFromMedia(mediaLink) {
  if (!mediaLink) {
    return null;
  }
  const clean = String(mediaLink).split("?")[0];
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

function mediaAssetsForPost(post) {
  const assets = Array.isArray(post.assets)
    ? post.assets
        .map((asset) => {
          if (!asset) {
            return null;
          }
          if (typeof asset === "string") {
            return { url: asset.trim() };
          }
          if (!asset.url) {
            return null;
          }
          return { url: String(asset.url).trim() };
        })
        .filter((asset) => asset && asset.url)
    : [];

  if (assets.length > 0) {
    return assets;
  }

  return post.mediaLink
    ? [
        {
          url: String(post.mediaLink).trim()
        }
      ]
    : [];
}

function mediaUrlsForPost(post) {
  return mediaAssetsForPost(post).map((asset) => asset.url);
}

export function validateProviderPayload(normalizedPost) {
  const { provider, account, mediaLink } = normalizedPost;
  const accountLower = String(account || "").toLowerCase();
  const ext = extFromMedia(mediaLink);
  const mediaUrls = mediaUrlsForPost(normalizedPost);
  const mediaKinds = mediaUrls.map((url) => {
    if (isVideoMedia(url)) {
      return "video";
    }
    if (isImageMedia(url)) {
      return "image";
    }
    return "other";
  });
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
    if (interactionType === "reply" && !normalizedPost.parentStepId && !normalizedPost.resolvedParentProviderPostId) {
      throw new AppError("X replies require a parent step or resolved parent provider post id", {
        code: "x_reply_parent_required",
        statusCode: 422
      });
    }
    if (ext && !(IMAGE_EXT.has(ext) || VIDEO_EXT.has(ext))) {
      throw new AppError("X supports plain text plus up to four image assets or one video asset", {
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
      throw new AppError("LinkedIn supports image/video URLs or plain text in SocialClaw today", {
        code: "linkedin_media_unsupported",
        statusCode: 422
      });
    }
    if (ext && !(IMAGE_EXT.has(ext) || VIDEO_EXT.has(ext))) {
      throw new AppError("LinkedIn supports plain text plus image assets or one video asset", {
        code: "linkedin_media_unsupported",
        statusCode: 422
      });
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
      throw new AppError("LinkedIn pages support image/video URLs or plain text in SocialClaw today", {
        code: "linkedin_media_unsupported",
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

  if (provider === "discord") {
    const text = [normalizedPost.name, normalizedPost.description]
      .filter(Boolean)
      .map((value) => String(value).trim())
      .join("\n\n");

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

  if (provider === "telegram") {
    const text = [normalizedPost.name, normalizedPost.description]
      .filter(Boolean)
      .map((value) => String(value).trim())
      .join("\n\n");

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
    if (!mediaLink && !text) {
      throw new AppError("Telegram posts require text or one media asset", {
        code: "telegram_text_or_media_required",
        statusCode: 422
      });
    }
    if (mediaKinds.includes("other")) {
      throw new AppError("Telegram supports text plus a single image or video asset per post", {
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
}
