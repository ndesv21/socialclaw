// Synced from ../socialclaw via tools/sync-public-cli.mjs. Edit the private repo, then re-run this sync.
import { AppError } from "./errors.mjs";

const X_REPLY_OPTIONS = ["everyone", "mentionedUsers", "following"];
const FACEBOOK_PAGE_MODES = ["auto", "feed", "photo", "video"];
const INSTAGRAM_MODES = ["auto", "image", "reel"];
const TIKTOK_PRIVACY_OPTIONS = ["SELF_ONLY"];
const TELEGRAM_PARSE_MODES = ["none", "HTML", "MarkdownV2"];
const YOUTUBE_PRIVACY_OPTIONS = ["private", "unlisted", "public"];
const WORDPRESS_POST_STATUSES = ["publish", "draft", "pending", "private"];
const WORDPRESS_POST_TYPES = ["post", "page"];
const PINTEREST_PIN_MODES = ["auto", "standard", "video", "multi_image", "product"];

function normalizeSettingsInput(settings) {
  if (settings === undefined || settings === null) {
    return {};
  }

  if (typeof settings !== "object" || Array.isArray(settings)) {
    throw new AppError("Post settings must be an object", {
      statusCode: 422,
      code: "post_settings_invalid"
    });
  }

  return { ...settings };
}

function assertNoUnknownSettings(settings, allowedKeys, code) {
  const unknown = Object.keys(settings).filter((key) => !allowedKeys.includes(key));
  if (unknown.length > 0) {
    throw new AppError(`Unsupported settings: ${unknown.join(", ")}`, {
      statusCode: 422,
      code,
      details: {
        allowedKeys
      }
    });
  }
}

function isVideoMedia(mediaLink) {
  const clean = String(mediaLink || "").split("?")[0].toLowerCase();
  return [".mp4", ".mov", ".webm", ".m4v"].some((ext) => clean.endsWith(ext));
}

function isImageMedia(mediaLink) {
  const clean = String(mediaLink || "").split("?")[0].toLowerCase();
  return [".jpg", ".jpeg", ".png", ".webp"].some((ext) => clean.endsWith(ext));
}

export function inferPublishTarget(accountOrDescriptor) {
  const provider = String(accountOrDescriptor?.provider || "").trim().toLowerCase();
  const accountType = String(accountOrDescriptor?.accountType || "").trim();
  const handle = String(accountOrDescriptor?.handle || accountOrDescriptor?.account || "").trim().toLowerCase();

  if (accountType) {
    return {
      provider,
      accountType
    };
  }

  if (provider === "x" || handle.startsWith("x:@")) {
    return { provider: "x", accountType: "x_user" };
  }

  if (provider === "tiktok" || handle.startsWith("tiktok:@")) {
    return { provider: "tiktok", accountType: "tiktok_user" };
  }

  if (provider === "telegram" || handle.startsWith("telegram:")) {
    return { provider: "telegram", accountType: accountType || "telegram_chat" };
  }

  if (provider === "discord" || handle.startsWith("discord:")) {
    return { provider: "discord", accountType: "discord_webhook" };
  }

  if (provider === "facebook" || handle.startsWith("facebook:")) {
    if (handle.startsWith("facebook:page:")) {
      return { provider: "facebook", accountType: "facebook_page" };
    }
    return { provider: "facebook", accountType: "facebook_user" };
  }

  if (provider === "instagram_business" || handle.startsWith("instagram:business:")) {
    return { provider: "instagram_business", accountType: "instagram_business_linked" };
  }

  if (provider === "instagram" || handle.startsWith("instagram:")) {
    if (handle.startsWith("instagram:standalone:")) {
      return { provider: "instagram", accountType: "instagram_standalone" };
    }
    if (handle.startsWith("instagram:business-user:")) {
      return { provider: "instagram_business", accountType: "instagram_business_identity" };
    }
    if (handle.startsWith("instagram:business:")) {
      return { provider: "instagram_business", accountType: "instagram_business_linked" };
    }
    return { provider: "instagram", accountType: "instagram_standalone" };
  }

  if (provider === "linkedin" || handle.startsWith("linkedin:")) {
    if (handle.startsWith("linkedin:page:")) {
      return { provider: "linkedin_page", accountType: "linkedin_page" };
    }
    return { provider: "linkedin", accountType: "linkedin_member" };
  }

  if (provider === "pinterest" || handle.startsWith("pinterest:")) {
    if (handle.startsWith("pinterest:board:")) {
      return { provider: "pinterest", accountType: "pinterest_board" };
    }
    return { provider: "pinterest", accountType: "pinterest_user" };
  }

  if (provider === "youtube" || handle.startsWith("youtube:channel:")) {
    return { provider: "youtube", accountType: "youtube_channel" };
  }

  if (provider === "reddit" || handle.startsWith("reddit:")) {
    return { provider: "reddit", accountType: "reddit_user" };
  }

  if (provider === "wordpress" || handle.startsWith("wordpress:")) {
    if (handle.startsWith("wordpress:site:")) {
      return { provider: "wordpress", accountType: "wordpress_site" };
    }
    return { provider: "wordpress", accountType: "wordpress_user" };
  }

  if (provider === "meta" || handle.startsWith("meta:")) {
    if (handle.startsWith("meta:page:")) {
      return { provider: "meta", accountType: "facebook_page" };
    }
    if (handle.startsWith("meta:instagram:")) {
      return { provider: "meta", accountType: "instagram_business" };
    }
    return { provider: "meta", accountType: "meta_user" };
  }

  return {
    provider,
    accountType: null
  };
}

export function describePublishSettingsForAccount(accountOrDescriptor) {
  const target = inferPublishTarget(accountOrDescriptor);

  if (target.provider === "x" && target.accountType === "x_user") {
    return {
      supported: true,
      target,
      fields: [
        {
          id: "replyControl",
          type: "enum",
          required: false,
          default: "everyone",
          options: X_REPLY_OPTIONS,
          description: "Controls who can reply to the X post."
        }
      ],
      discovery: {
        publishShape: "text_with_optional_native_media_upload",
        mediaDelivery: "socialclaw_uploads_media_to_x"
      }
    };
  }

  if (target.provider === "meta" && target.accountType === "facebook_page") {
    return {
      supported: true,
      target,
      fields: [
        {
          id: "pagePostMode",
          type: "enum",
          required: false,
          default: "auto",
          options: FACEBOOK_PAGE_MODES,
          description: "Choose whether SocialClaw should publish as a feed post, photo, or video. `auto` follows the media type."
        }
      ],
      discovery: {
        publishShape: "single_page_post",
        mediaDelivery: "meta_fetches_public_media_url"
      }
    };
  }

  if (target.provider === "facebook" && target.accountType === "facebook_page") {
    return {
      supported: true,
      target,
      fields: [
        {
          id: "pagePostMode",
          type: "enum",
          required: false,
          default: "auto",
          options: FACEBOOK_PAGE_MODES,
          description: "Choose whether SocialClaw should publish as a feed post, photo, or video. `auto` follows the media type."
        }
      ],
      discovery: {
        publishShape: "single_page_post",
        mediaDelivery: "meta_fetches_public_media_url"
      }
    };
  }

  if (target.provider === "meta" && target.accountType === "instagram_business") {
    return {
      supported: true,
      target,
      fields: [
        {
          id: "instagramPublishMode",
          type: "enum",
          required: false,
          default: "auto",
          options: INSTAGRAM_MODES,
          description: "Choose whether SocialClaw should publish the Instagram step as an image or reel. `auto` follows the media type."
        }
      ],
      discovery: {
        publishShape: "single_media_post",
        mediaDelivery: "meta_fetches_public_media_url"
      }
    };
  }

  if (
    (target.provider === "instagram_business" && target.accountType === "instagram_business_linked") ||
    (target.provider === "instagram" && target.accountType === "instagram_standalone")
  ) {
    return {
      supported: true,
      target,
      fields: [
        {
          id: "instagramPublishMode",
          type: "enum",
          required: false,
          default: "auto",
          options: INSTAGRAM_MODES,
          description: "Choose whether SocialClaw should publish the Instagram step as an image or reel. `auto` follows the media type."
        }
      ],
      discovery: {
        publishShape: "single_media_post",
        mediaDelivery:
          target.provider === "instagram_business"
            ? "meta_fetches_public_media_url"
            : "instagram_fetches_public_media_url"
      }
    };
  }

  if (target.provider === "tiktok" && target.accountType === "tiktok_user") {
    return {
      supported: true,
      target,
      fields: [
        {
          id: "privacyLevel",
          type: "enum",
          required: true,
          options: TIKTOK_PRIVACY_OPTIONS,
          description: "Choose who can view this TikTok post before you publish."
        },
        {
          id: "duetEnabled",
          type: "boolean",
          required: false,
          default: false,
          description: "Allow duets on the published TikTok video."
        },
        {
          id: "commentEnabled",
          type: "boolean",
          required: false,
          default: false,
          description: "Allow comments on the published TikTok video."
        },
        {
          id: "stitchEnabled",
          type: "boolean",
          required: false,
          default: false,
          description: "Allow stitch on the published TikTok video."
        },
        {
          id: "commercialContentToggle",
          type: "boolean",
          required: false,
          default: false,
          description: "Turn this on if the TikTok post promotes your brand, a third party, or both."
        },
        {
          id: "brandOrganicToggle",
          type: "boolean",
          required: false,
          default: false,
          description: "Declare that this TikTok post promotes your own brand."
        },
        {
          id: "brandContentToggle",
          type: "boolean",
          required: false,
          default: false,
          description: "Declare that this TikTok post contains branded content for another brand."
        }
      ],
      discovery: {
        publishShape: "video_only",
        mediaDelivery: "tiktok_pulls_public_video_url"
      }
    };
  }

  if (target.provider === "telegram" && String(target.accountType || "").startsWith("telegram_")) {
    return {
      supported: true,
      target,
      fields: [
        {
          id: "parseMode",
          type: "enum",
          required: false,
          default: "none",
          options: TELEGRAM_PARSE_MODES,
          description: "Optional Telegram message formatting mode. Use `none` for plain text."
        },
        {
          id: "disableNotification",
          type: "boolean",
          required: false,
          default: false,
          description: "Send the Telegram message silently."
        },
        {
          id: "protectContent",
          type: "boolean",
          required: false,
          default: false,
          description: "Protect the Telegram message from forwarding and saving."
        },
        {
          id: "disableLinkPreview",
          type: "boolean",
          required: false,
          default: false,
          description: "Disable link previews for text-only Telegram messages."
        }
      ],
      discovery: {
        publishShape: "text_message_with_optional_single_media",
        mediaDelivery: "telegram_fetches_public_media_url"
      }
    };
  }

  if (target.provider === "discord" && target.accountType === "discord_webhook") {
    return {
      supported: true,
      target,
      fields: [
        {
          id: "tts",
          type: "boolean",
          required: false,
          default: false,
          description: "Send the Discord message using text-to-speech."
        },
        {
          id: "suppressEmbeds",
          type: "boolean",
          required: false,
          default: false,
          description: "Suppress link embeds in the Discord message body."
        }
      ],
      discovery: {
        publishShape: "text_message_with_optional_single_media_upload",
        mediaDelivery: "socialclaw_fetches_media_and_uploads_to_discord_webhook"
      }
    };
  }

  if (target.provider === "linkedin" && target.accountType === "linkedin_member") {
    return {
      supported: false,
      target,
      fields: [],
      discovery: {
        publishShape: "text_or_image_post",
        mediaDelivery: "socialclaw_uploads_images_to_linkedin"
      }
    };
  }

  if (target.provider === "linkedin_page" && target.accountType === "linkedin_page") {
    return {
      supported: false,
      target,
      fields: [],
      discovery: {
        publishShape: "text_or_image_post",
        mediaDelivery: "socialclaw_uploads_images_to_linkedin"
      }
    };
  }

  if (target.provider === "pinterest" && target.accountType === "pinterest_board") {
    return {
      supported: true,
      target,
      fields: [
        {
          id: "pinMode",
          type: "enum",
          required: false,
          default: "auto",
          options: PINTEREST_PIN_MODES,
          description: "Choose the Pinterest pin mode. `auto` follows the supplied media. `product` is capability-gated by Pinterest."
        },
        {
          id: "link",
          type: "string",
          required: false,
          description: "Optional destination URL to attach to the pin."
        },
        {
          id: "altText",
          type: "string",
          required: false,
          description: "Optional alt text for the primary creative."
        },
        {
          id: "boardSectionId",
          type: "string",
          required: false,
          description: "Optional Pinterest board section id inside the selected board."
        },
        {
          id: "dominantColor",
          type: "string",
          required: false,
          description: "Optional hex dominant color, for example `#6E7874`."
        },
        {
          id: "isAffiliateLink",
          type: "boolean",
          required: false,
          default: false,
          description: "Used only for Pinterest product pin mode when the connected app has the required beta access."
        },
        {
          id: "coverImageUrl",
          type: "string",
          required: false,
          description: "Optional cover image URL for Pinterest video pins."
        },
        {
          id: "coverImageKeyFrameTime",
          type: "number",
          required: false,
          description: "Optional keyframe timestamp in seconds for Pinterest video pin cover image selection."
        }
      ],
      discovery: {
        publishShape: "board_scoped_pin",
        mediaDelivery: "pinterest_fetches_images_or_socialclaw_uploads_video_to_pinterest"
      }
    };
  }

  if (target.provider === "youtube" && target.accountType === "youtube_channel") {
    return {
      supported: true,
      target,
      fields: [
        {
          id: "privacyStatus",
          type: "enum",
          required: false,
          default: "private",
          options: YOUTUBE_PRIVACY_OPTIONS,
          description: "Choose the initial privacy status for the uploaded YouTube video."
        },
        {
          id: "notifySubscribers",
          type: "boolean",
          required: false,
          default: false,
          description: "Notify subscribers about the uploaded video when YouTube allows it."
        },
        {
          id: "madeForKids",
          type: "boolean",
          required: false,
          default: false,
          description: "Declare whether the uploaded video is made for kids."
        }
      ],
      discovery: {
        publishShape: "video_upload",
        mediaDelivery: "socialclaw_uploads_video_to_youtube"
      }
    };
  }

  if (target.provider === "reddit" && target.accountType === "reddit_user") {
    return {
      supported: true,
      target,
      fields: [
        {
          id: "subreddit",
          type: "string",
          required: true,
          description: "Target subreddit name without the r/ prefix."
        },
        {
          id: "sendReplies",
          type: "boolean",
          required: false,
          default: true,
          description: "Allow reply notifications for the Reddit submission."
        },
        {
          id: "nsfw",
          type: "boolean",
          required: false,
          default: false,
          description: "Mark the submission as NSFW."
        },
        {
          id: "spoiler",
          type: "boolean",
          required: false,
          default: false,
          description: "Mark the submission as a spoiler."
        },
        {
          id: "flairId",
          type: "string",
          required: false,
          description: "Optional Reddit flair template id to apply when the subreddit supports link flair."
        },
        {
          id: "flairText",
          type: "string",
          required: false,
          description: "Optional custom flair text. Use only when the selected flair template allows editable text."
        }
      ],
      discovery: {
        publishShape: "self_or_link_post",
        mediaDelivery: "reddit_links_to_the_supplied_public_url"
      }
    };
  }

  if (target.provider === "wordpress" && target.accountType === "wordpress_site") {
    return {
      supported: true,
      target,
      fields: [
        {
          id: "postStatus",
          type: "enum",
          required: false,
          default: "publish",
          options: WORDPRESS_POST_STATUSES,
          description: "Initial WordPress post status."
        },
        {
          id: "postType",
          type: "enum",
          required: false,
          default: "post",
          options: WORDPRESS_POST_TYPES,
          description: "WordPress content type to create."
        },
        {
          id: "slug",
          type: "string",
          required: false,
          description: "Optional slug to assign to the created WordPress post."
        }
      ],
      discovery: {
        publishShape: "article_or_page",
        mediaDelivery: "socialclaw_uploads_media_to_wordpress"
      }
    };
  }

  return {
    supported: false,
    target,
    fields: [],
    discovery: {}
  };
}

export function validatePublishSettingsForTarget({ provider, account, settings, mediaLink }) {
  const normalizedSettings = normalizeSettingsInput(settings);
  const target = inferPublishTarget({ provider, account });

  if (target.provider === "x" && target.accountType === "x_user") {
    assertNoUnknownSettings(normalizedSettings, ["replyControl"], "x_settings_unsupported");

    if (!normalizedSettings.replyControl) {
      return {};
    }

    if (!X_REPLY_OPTIONS.includes(normalizedSettings.replyControl)) {
      throw new AppError(`Invalid X replyControl: ${normalizedSettings.replyControl}`, {
        statusCode: 422,
        code: "x_reply_control_invalid",
        details: {
          supportedValues: X_REPLY_OPTIONS
        }
      });
    }

    return {
      replyControl: normalizedSettings.replyControl
    };
  }

  if (target.provider === "meta" && target.accountType === "facebook_page") {
    assertNoUnknownSettings(normalizedSettings, ["pagePostMode"], "facebook_page_settings_unsupported");
    const pagePostMode = String(normalizedSettings.pagePostMode || "auto");

    if (!FACEBOOK_PAGE_MODES.includes(pagePostMode)) {
      throw new AppError(`Invalid Facebook pagePostMode: ${pagePostMode}`, {
        statusCode: 422,
        code: "facebook_page_mode_invalid",
        details: {
          supportedValues: FACEBOOK_PAGE_MODES
        }
      });
    }

    if (!mediaLink && !["auto", "feed"].includes(pagePostMode)) {
      throw new AppError("Facebook pagePostMode must be `feed` or `auto` when no media_link is provided", {
        statusCode: 422,
        code: "facebook_page_mode_mismatch"
      });
    }

    if (mediaLink && isVideoMedia(mediaLink) && !["auto", "video"].includes(pagePostMode)) {
      throw new AppError("Facebook pagePostMode must be `video` or `auto` for video media", {
        statusCode: 422,
        code: "facebook_page_mode_mismatch"
      });
    }

    if (mediaLink && isImageMedia(mediaLink) && !["auto", "photo"].includes(pagePostMode)) {
      throw new AppError("Facebook pagePostMode must be `photo` or `auto` for image media", {
        statusCode: 422,
        code: "facebook_page_mode_mismatch"
      });
    }

    return {
      pagePostMode
    };
  }

  if (target.provider === "facebook" && target.accountType === "facebook_page") {
    assertNoUnknownSettings(normalizedSettings, ["pagePostMode"], "facebook_page_settings_unsupported");
    const pagePostMode = String(normalizedSettings.pagePostMode || "auto");

    if (!FACEBOOK_PAGE_MODES.includes(pagePostMode)) {
      throw new AppError(`Invalid Facebook pagePostMode: ${pagePostMode}`, {
        statusCode: 422,
        code: "facebook_page_mode_invalid",
        details: {
          supportedValues: FACEBOOK_PAGE_MODES
        }
      });
    }

    if (!mediaLink && !["auto", "feed"].includes(pagePostMode)) {
      throw new AppError("Facebook pagePostMode must be `feed` or `auto` when no media_link is provided", {
        statusCode: 422,
        code: "facebook_page_mode_mismatch"
      });
    }

    if (mediaLink && isVideoMedia(mediaLink) && !["auto", "video"].includes(pagePostMode)) {
      throw new AppError("Facebook pagePostMode must be `video` or `auto` for video media", {
        statusCode: 422,
        code: "facebook_page_mode_mismatch"
      });
    }

    if (mediaLink && isImageMedia(mediaLink) && !["auto", "photo"].includes(pagePostMode)) {
      throw new AppError("Facebook pagePostMode must be `photo` or `auto` for image media", {
        statusCode: 422,
        code: "facebook_page_mode_mismatch"
      });
    }

    return {
      pagePostMode
    };
  }

  if (target.provider === "meta" && target.accountType === "instagram_business") {
    assertNoUnknownSettings(normalizedSettings, ["instagramPublishMode"], "instagram_settings_unsupported");
    const instagramPublishMode = String(normalizedSettings.instagramPublishMode || "auto");

    if (!INSTAGRAM_MODES.includes(instagramPublishMode)) {
      throw new AppError(`Invalid Instagram instagramPublishMode: ${instagramPublishMode}`, {
        statusCode: 422,
        code: "instagram_publish_mode_invalid",
        details: {
          supportedValues: INSTAGRAM_MODES
        }
      });
    }

    if (mediaLink && isVideoMedia(mediaLink) && !["auto", "reel"].includes(instagramPublishMode)) {
      throw new AppError("Instagram instagramPublishMode must be `reel` or `auto` for video media", {
        statusCode: 422,
        code: "instagram_publish_mode_mismatch"
      });
    }

    if (mediaLink && isImageMedia(mediaLink) && !["auto", "image"].includes(instagramPublishMode)) {
      throw new AppError("Instagram instagramPublishMode must be `image` or `auto` for image media", {
        statusCode: 422,
        code: "instagram_publish_mode_mismatch"
      });
    }

    return {
      instagramPublishMode
    };
  }

  if (
    (target.provider === "instagram_business" && target.accountType === "instagram_business_linked") ||
    (target.provider === "instagram" && target.accountType === "instagram_standalone")
  ) {
    assertNoUnknownSettings(normalizedSettings, ["instagramPublishMode"], "instagram_settings_unsupported");
    const instagramPublishMode = String(normalizedSettings.instagramPublishMode || "auto");

    if (!INSTAGRAM_MODES.includes(instagramPublishMode)) {
      throw new AppError(`Invalid Instagram instagramPublishMode: ${instagramPublishMode}`, {
        statusCode: 422,
        code: "instagram_publish_mode_invalid",
        details: {
          supportedValues: INSTAGRAM_MODES
        }
      });
    }

    if (mediaLink && isVideoMedia(mediaLink) && !["auto", "reel"].includes(instagramPublishMode)) {
      throw new AppError("Instagram instagramPublishMode must be `reel` or `auto` for video media", {
        statusCode: 422,
        code: "instagram_publish_mode_mismatch"
      });
    }

    if (mediaLink && isImageMedia(mediaLink) && !["auto", "image"].includes(instagramPublishMode)) {
      throw new AppError("Instagram instagramPublishMode must be `image` or `auto` for image media", {
        statusCode: 422,
        code: "instagram_publish_mode_mismatch"
      });
    }

    if (!mediaLink) {
      throw new AppError("Instagram publishing requires a media link", {
        statusCode: 422,
        code: "instagram_media_required"
      });
    }

    return {
      instagramPublishMode
    };
  }

  if (target.provider === "tiktok" && target.accountType === "tiktok_user") {
    assertNoUnknownSettings(
      normalizedSettings,
      [
        "privacyLevel",
        "duetEnabled",
        "commentEnabled",
        "stitchEnabled",
        "commercialContentToggle",
        "brandOrganicToggle",
        "brandContentToggle"
      ],
      "tiktok_settings_unsupported"
    );

    const privacyLevel = String(normalizedSettings.privacyLevel || "").trim();
    if (!privacyLevel) {
      throw new AppError("TikTok privacyLevel is required", {
        statusCode: 422,
        code: "tiktok_privacy_level_required"
      });
    }
    if (!TIKTOK_PRIVACY_OPTIONS.includes(privacyLevel)) {
      throw new AppError(`Invalid TikTok privacyLevel: ${privacyLevel}`, {
        statusCode: 422,
        code: "tiktok_privacy_level_invalid",
        details: {
          supportedValues: TIKTOK_PRIVACY_OPTIONS
        }
      });
    }

    const duetEnabled =
      normalizedSettings.duetEnabled === undefined ? false : Boolean(normalizedSettings.duetEnabled);
    const commentEnabled =
      normalizedSettings.commentEnabled === undefined ? false : Boolean(normalizedSettings.commentEnabled);
    const stitchEnabled =
      normalizedSettings.stitchEnabled === undefined ? false : Boolean(normalizedSettings.stitchEnabled);
    const brandOrganicToggle = Boolean(normalizedSettings.brandOrganicToggle);
    const brandContentToggle = Boolean(normalizedSettings.brandContentToggle);
    const commercialContentToggle =
      normalizedSettings.commercialContentToggle === undefined
        ? brandOrganicToggle || brandContentToggle
        : Boolean(normalizedSettings.commercialContentToggle);

    if (commercialContentToggle && !brandOrganicToggle && !brandContentToggle) {
      throw new AppError("Select at least one TikTok commercial content disclosure option", {
        statusCode: 422,
        code: "tiktok_commercial_content_required"
      });
    }

    if (brandContentToggle && privacyLevel === "SELF_ONLY") {
      throw new AppError("TikTok branded content posts cannot use SELF_ONLY privacy", {
        statusCode: 422,
        code: "tiktok_brand_content_private_invalid"
      });
    }

    return {
      privacyLevel,
      duetEnabled,
      commentEnabled,
      stitchEnabled,
      commercialContentToggle,
      brandOrganicToggle,
      brandContentToggle
    };
  }

  if (target.provider === "telegram" && String(target.accountType || "").startsWith("telegram_")) {
    const normalized = normalizeSettingsInput(settings);
    assertNoUnknownSettings(
      normalized,
      ["parseMode", "disableNotification", "protectContent", "disableLinkPreview"],
      "telegram_settings_unsupported"
    );

    if (normalized.parseMode !== undefined) {
      const value = String(normalized.parseMode || "none").trim();
      if (!TELEGRAM_PARSE_MODES.includes(value)) {
        throw new AppError(`parseMode must be one of: ${TELEGRAM_PARSE_MODES.join(", ")}`, {
          statusCode: 422,
          code: "telegram_parse_mode_invalid"
        });
      }
    }

    for (const key of ["disableNotification", "protectContent", "disableLinkPreview"]) {
      if (normalized[key] !== undefined && typeof normalized[key] !== "boolean") {
        throw new AppError(`${key} must be a boolean`, {
          statusCode: 422,
          code: "telegram_setting_invalid"
        });
      }
    }

    if (mediaLink && !isImageMedia(mediaLink) && !isVideoMedia(mediaLink)) {
      throw new AppError("Telegram media must be an image or video URL", {
        statusCode: 422,
        code: "telegram_media_unsupported"
      });
    }

    return {
      parseMode: normalized.parseMode === "none" || normalized.parseMode === undefined ? null : normalized.parseMode,
      disableNotification: Boolean(normalized.disableNotification),
      protectContent: Boolean(normalized.protectContent),
      disableLinkPreview: Boolean(normalized.disableLinkPreview)
    };
  }

  if (target.provider === "discord" && target.accountType === "discord_webhook") {
    const normalized = normalizeSettingsInput(settings);
    assertNoUnknownSettings(
      normalized,
      ["tts", "suppressEmbeds"],
      "discord_settings_unsupported"
    );

    for (const key of ["tts", "suppressEmbeds"]) {
      if (normalized[key] !== undefined && typeof normalized[key] !== "boolean") {
        throw new AppError(`${key} must be a boolean`, {
          statusCode: 422,
          code: "discord_setting_invalid"
        });
      }
    }

    if (mediaLink && !isImageMedia(mediaLink) && !isVideoMedia(mediaLink)) {
      throw new AppError("Discord media must be an image or video URL", {
        statusCode: 422,
        code: "discord_media_unsupported"
      });
    }

    return {
      tts: Boolean(normalized.tts),
      suppressEmbeds: Boolean(normalized.suppressEmbeds)
    };
  }

  if (target.provider === "linkedin" && target.accountType === "linkedin_member") {
    assertNoUnknownSettings(normalizedSettings, [], "linkedin_settings_unsupported");
    return {};
  }

  if (target.provider === "linkedin_page" && target.accountType === "linkedin_page") {
    assertNoUnknownSettings(normalizedSettings, [], "linkedin_page_settings_unsupported");
    return {};
  }

  if (target.provider === "pinterest" && target.accountType === "pinterest_board") {
    assertNoUnknownSettings(
      normalizedSettings,
      [
        "pinMode",
        "link",
        "destinationLink",
        "altText",
        "boardSectionId",
        "dominantColor",
        "isAffiliateLink",
        "coverImageUrl",
        "coverImageKeyFrameTime"
      ],
      "pinterest_settings_unsupported"
    );

    const pinMode = String(normalizedSettings.pinMode || "auto").trim().toLowerCase();
    if (!PINTEREST_PIN_MODES.includes(pinMode)) {
      throw new AppError(`Invalid Pinterest pinMode: ${pinMode}`, {
        statusCode: 422,
        code: "pinterest_pin_mode_invalid",
        details: {
          supportedValues: PINTEREST_PIN_MODES
        }
      });
    }

    if (pinMode === "product") {
      throw new AppError("Pinterest product pin mode is capability-gated by Pinterest and is not available in SocialClaw's generic publish flow yet", {
        statusCode: 422,
        code: "pinterest_product_pin_beta_required"
      });
    }

    if (pinMode === "video" && mediaLink && !isVideoMedia(mediaLink)) {
      throw new AppError("Pinterest pinMode `video` requires a video media URL", {
        statusCode: 422,
        code: "pinterest_video_required"
      });
    }

    if (pinMode === "multi_image" && mediaLink && !isImageMedia(mediaLink)) {
      throw new AppError("Pinterest pinMode `multi_image` requires image assets", {
        statusCode: 422,
        code: "pinterest_multi_image_required"
      });
    }

    if (normalizedSettings.coverImageKeyFrameTime !== undefined && !Number.isFinite(Number(normalizedSettings.coverImageKeyFrameTime))) {
      throw new AppError("Pinterest coverImageKeyFrameTime must be a number", {
        statusCode: 422,
        code: "pinterest_cover_keyframe_invalid"
      });
    }

    const link = String(normalizedSettings.link || normalizedSettings.destinationLink || "").trim() || null;
    const altText = String(normalizedSettings.altText || "").trim() || null;
    const boardSectionId = String(normalizedSettings.boardSectionId || "").trim() || null;
    const dominantColor = String(normalizedSettings.dominantColor || "").trim() || null;
    const coverImageUrl = String(normalizedSettings.coverImageUrl || "").trim() || null;

    return {
      pinMode,
      link,
      altText,
      boardSectionId,
      dominantColor,
      isAffiliateLink: Boolean(normalizedSettings.isAffiliateLink),
      coverImageUrl,
      coverImageKeyFrameTime:
        normalizedSettings.coverImageKeyFrameTime === undefined
          ? null
          : Number(normalizedSettings.coverImageKeyFrameTime)
    };
  }

  if (target.provider === "youtube" && target.accountType === "youtube_channel") {
    assertNoUnknownSettings(
      normalizedSettings,
      ["privacyStatus", "notifySubscribers", "madeForKids"],
      "youtube_settings_unsupported"
    );

    const privacyStatus = String(normalizedSettings.privacyStatus || "private").toLowerCase();
    if (!YOUTUBE_PRIVACY_OPTIONS.includes(privacyStatus)) {
      throw new AppError(`Invalid YouTube privacyStatus: ${privacyStatus}`, {
        statusCode: 422,
        code: "youtube_privacy_status_invalid",
        details: {
          supportedValues: YOUTUBE_PRIVACY_OPTIONS
        }
      });
    }

    if (!mediaLink || !isVideoMedia(mediaLink)) {
      throw new AppError("YouTube uploads require a video media link", {
        statusCode: 422,
        code: "youtube_video_required"
      });
    }

    return {
      privacyStatus,
      notifySubscribers:
        normalizedSettings.notifySubscribers === undefined ? false : Boolean(normalizedSettings.notifySubscribers),
      madeForKids:
        normalizedSettings.madeForKids === undefined ? false : Boolean(normalizedSettings.madeForKids)
    };
  }

  if (target.provider === "reddit" && target.accountType === "reddit_user") {
    assertNoUnknownSettings(
      normalizedSettings,
      ["subreddit", "sendReplies", "nsfw", "spoiler", "flairId", "flairText"],
      "reddit_settings_unsupported"
    );

    const subreddit = String(normalizedSettings.subreddit || "").trim().replace(/^r\//i, "");
    if (!subreddit) {
      throw new AppError("Reddit posts require a subreddit setting", {
        statusCode: 422,
        code: "reddit_subreddit_required"
      });
    }

    const flairId = String(normalizedSettings.flairId || "").trim() || null;
    const flairText = String(normalizedSettings.flairText || "").trim() || null;

    if (flairText && !flairId) {
      throw new AppError("Reddit flairText requires a flairId", {
        statusCode: 422,
        code: "reddit_flair_id_required"
      });
    }

    return {
      subreddit,
      sendReplies:
        normalizedSettings.sendReplies === undefined ? true : Boolean(normalizedSettings.sendReplies),
      nsfw: normalizedSettings.nsfw === undefined ? false : Boolean(normalizedSettings.nsfw),
      spoiler: normalizedSettings.spoiler === undefined ? false : Boolean(normalizedSettings.spoiler),
      flairId,
      flairText
    };
  }

  if (target.provider === "wordpress" && target.accountType === "wordpress_site") {
    assertNoUnknownSettings(normalizedSettings, ["postStatus", "postType", "slug"], "wordpress_settings_unsupported");
    const postStatus = String(normalizedSettings.postStatus || "publish").toLowerCase();
    const postType = String(normalizedSettings.postType || "post").toLowerCase();
    const slug = String(normalizedSettings.slug || "").trim() || null;

    if (!WORDPRESS_POST_STATUSES.includes(postStatus)) {
      throw new AppError(`Invalid WordPress postStatus: ${postStatus}`, {
        statusCode: 422,
        code: "wordpress_post_status_invalid",
        details: {
          supportedValues: WORDPRESS_POST_STATUSES
        }
      });
    }

    if (!WORDPRESS_POST_TYPES.includes(postType)) {
      throw new AppError(`Invalid WordPress postType: ${postType}`, {
        statusCode: 422,
        code: "wordpress_post_type_invalid",
        details: {
          supportedValues: WORDPRESS_POST_TYPES
        }
      });
    }

    return {
      postStatus,
      postType,
      slug
    };
  }

  if (Object.keys(normalizedSettings).length > 0) {
    throw new AppError("This connected account does not support publish settings", {
      statusCode: 422,
      code: "publish_settings_unsupported"
    });
  }

  return {};
}

export function validatePublishSettingsForConnectedAccount(account, settings, mediaLink) {
  return validatePublishSettingsForTarget({
    provider: account.provider,
    account: account.handle,
    settings,
    mediaLink
  });
}
