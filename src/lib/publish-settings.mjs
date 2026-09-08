// Synced from ../socialclaw via tools/sync-public-cli.mjs. Edit the private repo, then re-run this sync.
import { AppError } from "./errors.mjs";

const X_REPLY_DEFAULT = "";
const X_REPLY_LEGACY_DEFAULT = "everyone";
const X_REPLY_RESTRICTIVE_OPTIONS = ["following", "mentionedUsers", "subscribers", "verified"];
const X_REPLY_OPTIONS = [X_REPLY_DEFAULT, ...X_REPLY_RESTRICTIVE_OPTIONS];
const FACEBOOK_PAGE_MODES = ["auto", "feed", "photo", "video"];
const FACEBOOK_VIDEO_UPLOAD_MODES = ["auto", "native", "remote_url"];
const INSTAGRAM_MODES = ["auto", "image", "reel"];
const INSTAGRAM_PLACEMENTS = ["post", "story", "post_and_story"];
const INSTAGRAM_TRIAL_REEL_STRATEGIES = ["", "MANUAL", "SS_PERFORMANCE"];
const INSTAGRAM_STANDALONE_SETTING_KEYS = [
  "instagramPublishMode",
  "instagramPlacement",
  "instagramAltTexts",
  "instagramUserTags",
  "instagramCollaborators",
  "instagramCoverUrl",
  "instagramThumbOffsetMs",
  "instagramShareToFeed",
  "instagramAudioName",
  "instagramTrialReelGraduationStrategy",
  "instagramIsAiGenerated",
  "instagramLocationId"
];
const SNAPCHAT_MODES = ["spotlight", "story", "saved_story"];
const TIKTOK_PRIVACY_OPTIONS = [
  "PUBLIC_TO_EVERYONE",
  "FOLLOWER_OF_CREATOR",
  "MUTUAL_FOLLOW_FRIENDS",
  "SELF_ONLY"
];
const TIKTOK_POST_MODES = ["direct_post", "draft"];
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

function isMp4Media(mediaLink) {
  const clean = String(mediaLink || "").split("?")[0].toLowerCase();
  return clean.endsWith(".mp4");
}

function normalizeInstagramUsername(value, settingId) {
  const username = String(value || "").trim().replace(/^@+/, "");
  if (!username || username.length > 30 || !/^[A-Za-z0-9._]+$/.test(username)) {
    throw new AppError(`${settingId} contains an invalid Instagram username`, {
      statusCode: 422,
      code: "instagram_username_invalid",
      details: { settingId, username }
    });
  }
  return username;
}

function normalizeInstagramAltTexts(value) {
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value) || value.length > 10) {
    throw new AppError("instagramAltTexts must be an array with up to 10 entries", {
      statusCode: 422,
      code: "instagram_alt_texts_invalid"
    });
  }
  const normalized = value.map((entry, mediaIndex) => {
    if (entry === undefined || entry === null || entry === "") {
      return "";
    }
    if (typeof entry !== "string") {
      throw new AppError(`instagramAltTexts[${mediaIndex}] must be a string`, {
        statusCode: 422,
        code: "instagram_alt_text_invalid"
      });
    }
    const text = entry.trim();
    if (text.length > 1000) {
      throw new AppError(`instagramAltTexts[${mediaIndex}] must be 1000 characters or shorter`, {
        statusCode: 422,
        code: "instagram_alt_text_invalid"
      });
    }
    return text;
  });
  while (normalized.length && !normalized[normalized.length - 1]) {
    normalized.pop();
  }
  return normalized;
}

function normalizeInstagramUserTags(value, { needsImageCoordinates = false } = {}) {
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value) || value.length > 20) {
    throw new AppError("instagramUserTags must be an array with up to 20 entries", {
      statusCode: 422,
      code: "instagram_user_tags_invalid"
    });
  }

  const seen = new Set();
  return value.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new AppError(`instagramUserTags[${index}] must be an object`, {
        statusCode: 422,
        code: "instagram_user_tag_invalid"
      });
    }
    const username = normalizeInstagramUsername(entry.username, `instagramUserTags[${index}]`);
    const mediaIndex = entry.mediaIndex === undefined || entry.mediaIndex === null || entry.mediaIndex === ""
      ? 0
      : Number(entry.mediaIndex);
    if (!Number.isInteger(mediaIndex) || mediaIndex < 0 || mediaIndex > 9) {
      throw new AppError(`instagramUserTags[${index}].mediaIndex must be an integer from 0 to 9`, {
        statusCode: 422,
        code: "instagram_user_tag_media_index_invalid"
      });
    }

    const key = `${mediaIndex}:${username.toLowerCase()}`;
    if (seen.has(key)) {
      throw new AppError(`instagramUserTags contains duplicate tag @${username} for media ${mediaIndex + 1}`, {
        statusCode: 422,
        code: "instagram_user_tag_duplicate"
      });
    }
    seen.add(key);

    const normalized = { username, mediaIndex };
    for (const coordinate of ["x", "y"]) {
      if (entry[coordinate] === undefined || entry[coordinate] === null || entry[coordinate] === "") {
        if (needsImageCoordinates) {
          normalized[coordinate] = 0.5;
        }
        continue;
      }
      const coordinateValue = Number(entry[coordinate]);
      if (!Number.isFinite(coordinateValue) || coordinateValue < 0 || coordinateValue > 1) {
        throw new AppError(`instagramUserTags[${index}].${coordinate} must be between 0 and 1`, {
          statusCode: 422,
          code: "instagram_user_tag_coordinate_invalid"
        });
      }
      normalized[coordinate] = coordinateValue;
    }
    return normalized;
  });
}

function normalizeInstagramCollaborators(value) {
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value) || value.length > 3) {
    throw new AppError("instagramCollaborators must be an array with up to 3 usernames", {
      statusCode: 422,
      code: "instagram_collaborators_invalid"
    });
  }
  const collaborators = value.map((entry) => normalizeInstagramUsername(entry, "instagramCollaborators"));
  if (new Set(collaborators.map((entry) => entry.toLowerCase())).size !== collaborators.length) {
    throw new AppError("instagramCollaborators cannot contain duplicates", {
      statusCode: 422,
      code: "instagram_collaborators_invalid"
    });
  }
  return collaborators;
}

function normalizeInstagramHttpsUrl(value, settingId) {
  const clean = String(value || "").trim();
  if (!clean) {
    return "";
  }
  try {
    const url = new URL(clean);
    if (url.protocol !== "https:") {
      throw new Error("not https");
    }
  } catch {
    throw new AppError(`${settingId} must be a public HTTPS URL`, {
      statusCode: 422,
      code: "instagram_url_invalid",
      details: { settingId }
    });
  }
  return clean;
}

function normalizeInstagramStandaloneAdvancedSettings(settings, { mediaLink, placement }) {
  const isVideo = isVideoMedia(mediaLink);
  const publishesToFeed = placement !== "story";
  const publishesReel = publishesToFeed && isVideo;
  const altTexts = normalizeInstagramAltTexts(settings.instagramAltTexts);
  const userTags = normalizeInstagramUserTags(settings.instagramUserTags, {
    needsImageCoordinates: publishesToFeed && !isVideo
  });
  const collaborators = normalizeInstagramCollaborators(settings.instagramCollaborators);
  const coverUrl = normalizeInstagramHttpsUrl(settings.instagramCoverUrl, "instagramCoverUrl");
  const audioName = String(settings.instagramAudioName || "").trim();
  if (audioName.length > 1000) {
    throw new AppError("instagramAudioName must be 1000 characters or shorter", {
      statusCode: 422,
      code: "instagram_audio_name_invalid"
    });
  }

  let thumbOffsetMs = null;
  if (settings.instagramThumbOffsetMs !== undefined && settings.instagramThumbOffsetMs !== null && settings.instagramThumbOffsetMs !== "") {
    thumbOffsetMs = Number(settings.instagramThumbOffsetMs);
    if (!Number.isInteger(thumbOffsetMs) || thumbOffsetMs < 0 || thumbOffsetMs > 900000) {
      throw new AppError("instagramThumbOffsetMs must be an integer from 0 to 900000", {
        statusCode: 422,
        code: "instagram_thumb_offset_invalid"
      });
    }
  }

  if (settings.instagramShareToFeed !== undefined && typeof settings.instagramShareToFeed !== "boolean") {
    throw new AppError("instagramShareToFeed must be a boolean", {
      statusCode: 422,
      code: "instagram_share_to_feed_invalid"
    });
  }
  if (settings.instagramIsAiGenerated !== undefined && typeof settings.instagramIsAiGenerated !== "boolean") {
    throw new AppError("instagramIsAiGenerated must be a boolean", {
      statusCode: 422,
      code: "instagram_ai_disclosure_invalid"
    });
  }

  const trialStrategy = String(settings.instagramTrialReelGraduationStrategy || "").trim().toUpperCase();
  if (!INSTAGRAM_TRIAL_REEL_STRATEGIES.includes(trialStrategy)) {
    throw new AppError(`instagramTrialReelGraduationStrategy must be one of: ${INSTAGRAM_TRIAL_REEL_STRATEGIES.filter(Boolean).join(", ")}`, {
      statusCode: 422,
      code: "instagram_trial_reel_strategy_invalid"
    });
  }

  const locationId = String(settings.instagramLocationId || "").trim();
  if (locationId && !/^\d{1,32}$/.test(locationId)) {
    throw new AppError("instagramLocationId must be a numeric Meta Page location ID", {
      statusCode: 422,
      code: "instagram_location_id_invalid"
    });
  }

  return {
    ...(publishesToFeed && altTexts.some(Boolean) ? { instagramAltTexts: altTexts } : {}),
    ...(userTags.length ? { instagramUserTags: userTags } : {}),
    ...(publishesToFeed && collaborators.length ? { instagramCollaborators: collaborators } : {}),
    ...(publishesReel && coverUrl ? { instagramCoverUrl: coverUrl } : {}),
    ...(publishesToFeed && thumbOffsetMs !== null ? { instagramThumbOffsetMs: thumbOffsetMs } : {}),
    ...(publishesReel && settings.instagramShareToFeed !== undefined
      ? { instagramShareToFeed: settings.instagramShareToFeed }
      : {}),
    ...(publishesReel && audioName ? { instagramAudioName: audioName } : {}),
    ...(publishesReel && trialStrategy ? { instagramTrialReelGraduationStrategy: trialStrategy } : {}),
    ...(settings.instagramIsAiGenerated === true ? { instagramIsAiGenerated: true } : {}),
    ...(publishesToFeed && locationId ? { instagramLocationId: locationId } : {})
  };
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

  if (provider === "threads" || handle.startsWith("threads:")) return { provider: "threads", accountType: "threads_user" };

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

  if (provider === "snapchat" || handle.startsWith("snapchat:")) {
    return { provider: "snapchat", accountType: "snapchat_public_profile" };
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
  if (target.provider === "threads") return {
    supported: true, target,
    fields: [{ id: "replyControl", type: "enum", required: false, default: "everyone", options: ["everyone", "accounts_you_follow", "mentioned_only"], description: "Who can reply to this Threads post." }],
    discovery: { publishShape: "text_image_video_or_carousel", mediaDelivery: "provider_fetches_remote_media" }
  };

  if (target.provider === "x" && target.accountType === "x_user") {
    return {
      supported: true,
      target,
      fields: [
        {
          id: "replyControl",
          type: "enum",
          required: false,
          default: X_REPLY_DEFAULT,
          options: X_REPLY_OPTIONS,
          description: "Leave unset for everyone, or choose an X reply_settings restriction."
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
        },
        {
          id: "facebookVideoUploadMode",
          type: "enum",
          required: false,
          default: "native",
          options: FACEBOOK_VIDEO_UPLOAD_MODES,
          description: "Choose how Facebook Page videos are delivered. `native` uploads bytes from SocialClaw; `remote_url` asks Facebook to fetch the public media URL."
        }
      ],
      discovery: {
        publishShape: "single_page_post",
        mediaDelivery: "socialclaw_uploads_facebook_videos_natively"
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
        },
        {
          id: "facebookVideoUploadMode",
          type: "enum",
          required: false,
          default: "native",
          options: FACEBOOK_VIDEO_UPLOAD_MODES,
          description: "Choose how Facebook Page videos are delivered. `native` uploads bytes from SocialClaw; `remote_url` asks Facebook to fetch the public media URL."
        }
      ],
      discovery: {
        publishShape: "single_page_post",
        mediaDelivery: "socialclaw_uploads_facebook_videos_natively"
      }
    };
  }

  if (target.provider === "meta" && target.accountType === "instagram_business") {
    return {
      supported: true,
      target,
      fields: [
        {
          id: "instagramPlacement",
          type: "enum",
          required: false,
          default: "post",
          options: INSTAGRAM_PLACEMENTS,
          description: "Publish to the profile, to Stories only, or create independently tracked profile and Story publishes. Stories require one image or video."
        },
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
        publishShape: "profile_post_story_or_independent_post_and_story",
        mediaDelivery: "meta_fetches_public_media_url"
      }
    };
  }

  if (target.provider === "instagram_business" && target.accountType === "instagram_business_linked") {
    return {
      supported: true,
      target,
      fields: [
        {
          id: "instagramPlacement",
          type: "enum",
          required: false,
          default: "post",
          options: INSTAGRAM_PLACEMENTS,
          description: "Publish to the profile, to Stories only, or create independently tracked profile and Story publishes. Stories require one image or video."
        },
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
        publishShape: "profile_post_story_or_independent_post_and_story",
        mediaDelivery: "meta_fetches_public_media_url"
      }
    };
  }

  if (target.provider === "instagram" && target.accountType === "instagram_standalone") {
    return {
      supported: true,
      target,
      fields: [
        {
          id: "instagramPlacement",
          type: "enum",
          required: false,
          default: "post",
          options: INSTAGRAM_PLACEMENTS,
          description: "Publish to the profile, to Stories only, or create independently tracked profile and Story publishes. Stories require one image or video."
        },
        {
          id: "instagramPublishMode",
          type: "enum",
          required: false,
          default: "auto",
          options: INSTAGRAM_MODES,
          description: "Choose whether SocialClaw should publish the Instagram step as an image or reel. `auto` follows the media type."
        },
        {
          id: "instagramAltTexts",
          type: "media_alt_texts",
          required: false,
          default: [],
          description: "Alternative text for each image, aligned to the zero-based media order. Up to 1000 characters per image; Reels and Stories do not support alt text."
        },
        {
          id: "instagramUserTags",
          type: "instagram_user_tags",
          required: false,
          default: [],
          description: "Native people tags or Story mentions. Each entry accepts username, mediaIndex, and optional normalized x/y coordinates from 0 to 1."
        },
        {
          id: "instagramCollaborators",
          type: "string_list",
          required: false,
          default: [],
          description: "Up to three Instagram usernames invited as collaborators on a feed image, Reel, or carousel. Stories do not support collaborators."
        },
        {
          id: "instagramCoverUrl",
          type: "string",
          required: false,
          description: "Public HTTPS JPEG URL for a Reel cover."
        },
        {
          id: "instagramThumbOffsetMs",
          type: "number",
          required: false,
          min: 0,
          max: 900000,
          description: "Video or Reel thumbnail frame offset in milliseconds. For a carousel, the same value applies to each video item. Ignored on a Reel when a custom cover URL is present."
        },
        {
          id: "instagramShareToFeed",
          type: "boolean",
          required: false,
          default: true,
          description: "Allow a Reel to appear in both the Feed and Reels tabs."
        },
        {
          id: "instagramAudioName",
          type: "string",
          required: false,
          description: "Name the Reel's embedded original audio. This does not add music from Instagram's catalog."
        },
        {
          id: "instagramTrialReelGraduationStrategy",
          type: "enum",
          required: false,
          default: "",
          options: INSTAGRAM_TRIAL_REEL_STRATEGIES,
          description: "Publish as a Trial Reel and graduate it manually or automatically when Meta predicts strong performance. Meta exposes this only to accounts that meet its Trial Reels eligibility threshold."
        },
        {
          id: "instagramIsAiGenerated",
          type: "boolean",
          required: false,
          default: false,
          description: "Self-disclose that AI was used to generate the media."
        },
        {
          id: "instagramLocationId",
          type: "string",
          required: false,
          description: "Numeric Meta Page ID for a physical location tagged on feed media. Story location stickers are not supported."
        }
      ],
      discovery: {
        publishShape: "profile_post_story_or_independent_post_and_story",
        mediaDelivery: "instagram_fetches_public_media_url",
        advancedPublishing: "standalone_instagram_container_options"
      }
    };
  }

  if (target.provider === "snapchat" && target.accountType === "snapchat_public_profile") {
    return {
      supported: true,
      target,
      fields: [
        {
          id: "snapchatPublishMode",
          type: "enum",
          required: false,
          default: "spotlight",
          options: SNAPCHAT_MODES,
          description: "Choose whether SocialClaw should publish this Snapchat step as a Spotlight, a Public Story, or a Saved Story."
        },
        {
          id: "locale",
          type: "string",
          required: false,
          default: "en_US",
          description: "Optional Snapchat locale for Spotlight publishing."
        },
        {
          id: "skipSaveToProfile",
          type: "boolean",
          required: false,
          default: false,
          description: "Skip saving the Spotlight to the Snapchat public profile feed. This applies to Spotlight mode only."
        }
      ],
      discovery: {
        publishShape: "single_video_post",
        mediaDelivery: "socialclaw_fetches_encrypts_and_uploads_video_to_snapchat"
      }
    };
  }

  if (target.provider === "tiktok" && target.accountType === "tiktok_user") {
    return {
      supported: true,
      target,
      fields: [
        {
          id: "tiktokPostMode",
          type: "enum",
          required: false,
          default: "direct_post",
          options: TIKTOK_POST_MODES,
          description: "Choose `direct_post` to publish to TikTok at the scheduled time, or `draft` to send the media through TikTok's inbox notification flow so the creator can finish and post it in the app. Inbox uploads ignore audience, interaction, and disclosure settings because the creator chooses those in TikTok, and they require the connection to include the video.upload scope."
        },
        {
          id: "privacyLevel",
          type: "enum",
          required: true,
          options: TIKTOK_PRIVACY_OPTIONS,
          description: "Choose who can view this TikTok post before you publish. Required for direct_post mode; ignored when tiktokPostMode is draft."
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
          description: "Allow comments on the published TikTok post."
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
        },
        {
          id: "autoAddMusic",
          type: "boolean",
          required: false,
          default: false,
          description: "For TikTok photo posts, let TikTok automatically add recommended music."
        },
        {
          id: "photoCoverIndex",
          type: "number",
          required: false,
          default: 0,
          min: 0,
          description: "For TikTok photo posts, choose the zero-based image index to use as the cover."
        }
      ],
      discovery: {
        publishShape: "single_video_or_photo_gallery",
        mediaDelivery: "tiktok_pulls_public_media_url"
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

  if (target.provider === "threads") {
    assertNoUnknownSettings(normalizedSettings, ["replyControl"], "threads_settings_unsupported");
    const replyControl = normalizedSettings.replyControl || "everyone";
    if (!["everyone", "accounts_you_follow", "mentioned_only"].includes(replyControl)) throw new AppError("Invalid Threads replyControl", { statusCode: 422, code: "threads_reply_control_invalid" });
    return { replyControl };
  }

  if (target.provider === "x" && target.accountType === "x_user") {
    assertNoUnknownSettings(normalizedSettings, ["replyControl"], "x_settings_unsupported");

    if (!normalizedSettings.replyControl || normalizedSettings.replyControl === X_REPLY_LEGACY_DEFAULT) {
      return {};
    }

    if (!X_REPLY_RESTRICTIVE_OPTIONS.includes(normalizedSettings.replyControl)) {
      throw new AppError(`Invalid X replyControl: ${normalizedSettings.replyControl}`, {
        statusCode: 422,
        code: "x_reply_control_invalid",
        details: {
          supportedValues: X_REPLY_RESTRICTIVE_OPTIONS
        }
      });
    }

    return {
      replyControl: normalizedSettings.replyControl
    };
  }

  if (target.provider === "meta" && target.accountType === "facebook_page") {
    assertNoUnknownSettings(
      normalizedSettings,
      ["pagePostMode", "facebookVideoUploadMode"],
      "facebook_page_settings_unsupported"
    );
    const pagePostMode = String(normalizedSettings.pagePostMode || "auto");
    const facebookVideoUploadMode = normalizedSettings.facebookVideoUploadMode === undefined ||
      normalizedSettings.facebookVideoUploadMode === null ||
      normalizedSettings.facebookVideoUploadMode === ""
      ? null
      : String(normalizedSettings.facebookVideoUploadMode);

    if (!FACEBOOK_PAGE_MODES.includes(pagePostMode)) {
      throw new AppError(`Invalid Facebook pagePostMode: ${pagePostMode}`, {
        statusCode: 422,
        code: "facebook_page_mode_invalid",
        details: {
          supportedValues: FACEBOOK_PAGE_MODES
        }
      });
    }

    if (facebookVideoUploadMode && !FACEBOOK_VIDEO_UPLOAD_MODES.includes(facebookVideoUploadMode)) {
      throw new AppError(`Invalid Facebook facebookVideoUploadMode: ${facebookVideoUploadMode}`, {
        statusCode: 422,
        code: "facebook_video_upload_mode_invalid",
        details: {
          supportedValues: FACEBOOK_VIDEO_UPLOAD_MODES
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
      pagePostMode,
      ...(facebookVideoUploadMode ? { facebookVideoUploadMode } : {})
    };
  }

  if (target.provider === "facebook" && target.accountType === "facebook_page") {
    assertNoUnknownSettings(
      normalizedSettings,
      ["pagePostMode", "facebookVideoUploadMode"],
      "facebook_page_settings_unsupported"
    );
    const pagePostMode = String(normalizedSettings.pagePostMode || "auto");
    const facebookVideoUploadMode = normalizedSettings.facebookVideoUploadMode === undefined ||
      normalizedSettings.facebookVideoUploadMode === null ||
      normalizedSettings.facebookVideoUploadMode === ""
      ? null
      : String(normalizedSettings.facebookVideoUploadMode);

    if (!FACEBOOK_PAGE_MODES.includes(pagePostMode)) {
      throw new AppError(`Invalid Facebook pagePostMode: ${pagePostMode}`, {
        statusCode: 422,
        code: "facebook_page_mode_invalid",
        details: {
          supportedValues: FACEBOOK_PAGE_MODES
        }
      });
    }

    if (facebookVideoUploadMode && !FACEBOOK_VIDEO_UPLOAD_MODES.includes(facebookVideoUploadMode)) {
      throw new AppError(`Invalid Facebook facebookVideoUploadMode: ${facebookVideoUploadMode}`, {
        statusCode: 422,
        code: "facebook_video_upload_mode_invalid",
        details: {
          supportedValues: FACEBOOK_VIDEO_UPLOAD_MODES
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
      pagePostMode,
      ...(facebookVideoUploadMode ? { facebookVideoUploadMode } : {})
    };
  }

  if (target.provider === "meta" && target.accountType === "instagram_business") {
    assertNoUnknownSettings(
      normalizedSettings,
      ["instagramPublishMode", "instagramPlacement"],
      "instagram_settings_unsupported"
    );
    const instagramPublishMode = String(normalizedSettings.instagramPublishMode || "auto");
    const instagramPlacement = String(normalizedSettings.instagramPlacement || "post");

    if (!INSTAGRAM_MODES.includes(instagramPublishMode)) {
      throw new AppError(`Invalid Instagram instagramPublishMode: ${instagramPublishMode}`, {
        statusCode: 422,
        code: "instagram_publish_mode_invalid",
        details: {
          supportedValues: INSTAGRAM_MODES
        }
      });
    }

    if (!INSTAGRAM_PLACEMENTS.includes(instagramPlacement)) {
      throw new AppError(`Invalid Instagram instagramPlacement: ${instagramPlacement}`, {
        statusCode: 422,
        code: "instagram_placement_invalid",
        details: {
          supportedValues: INSTAGRAM_PLACEMENTS
        }
      });
    }

    const effectiveInstagramPublishMode = instagramPlacement === "story" ? "auto" : instagramPublishMode;

    if (mediaLink && isVideoMedia(mediaLink) && !["auto", "reel"].includes(effectiveInstagramPublishMode)) {
      throw new AppError("Instagram instagramPublishMode must be `reel` or `auto` for video media", {
        statusCode: 422,
        code: "instagram_publish_mode_mismatch"
      });
    }

    if (mediaLink && isImageMedia(mediaLink) && !["auto", "image"].includes(effectiveInstagramPublishMode)) {
      throw new AppError("Instagram instagramPublishMode must be `image` or `auto` for image media", {
        statusCode: 422,
        code: "instagram_publish_mode_mismatch"
      });
    }

    return {
      instagramPublishMode: effectiveInstagramPublishMode,
      instagramPlacement
    };
  }

  if (target.provider === "instagram_business" && target.accountType === "instagram_business_linked") {
    assertNoUnknownSettings(
      normalizedSettings,
      ["instagramPublishMode", "instagramPlacement"],
      "instagram_settings_unsupported"
    );
    const instagramPublishMode = String(normalizedSettings.instagramPublishMode || "auto");
    const instagramPlacement = String(normalizedSettings.instagramPlacement || "post");

    if (!INSTAGRAM_MODES.includes(instagramPublishMode)) {
      throw new AppError(`Invalid Instagram instagramPublishMode: ${instagramPublishMode}`, {
        statusCode: 422,
        code: "instagram_publish_mode_invalid",
        details: {
          supportedValues: INSTAGRAM_MODES
        }
      });
    }

    if (!INSTAGRAM_PLACEMENTS.includes(instagramPlacement)) {
      throw new AppError(`Invalid Instagram instagramPlacement: ${instagramPlacement}`, {
        statusCode: 422,
        code: "instagram_placement_invalid",
        details: {
          supportedValues: INSTAGRAM_PLACEMENTS
        }
      });
    }

    const effectiveInstagramPublishMode = instagramPlacement === "story" ? "auto" : instagramPublishMode;

    if (mediaLink && isVideoMedia(mediaLink) && !["auto", "reel"].includes(effectiveInstagramPublishMode)) {
      throw new AppError("Instagram instagramPublishMode must be `reel` or `auto` for video media", {
        statusCode: 422,
        code: "instagram_publish_mode_mismatch"
      });
    }

    if (mediaLink && isImageMedia(mediaLink) && !["auto", "image"].includes(effectiveInstagramPublishMode)) {
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
      instagramPublishMode: effectiveInstagramPublishMode,
      instagramPlacement
    };
  }

  if (target.provider === "instagram" && target.accountType === "instagram_standalone") {
    assertNoUnknownSettings(
      normalizedSettings,
      INSTAGRAM_STANDALONE_SETTING_KEYS,
      "instagram_settings_unsupported"
    );
    const instagramPublishMode = String(normalizedSettings.instagramPublishMode || "auto");
    const instagramPlacement = String(normalizedSettings.instagramPlacement || "post");

    if (!INSTAGRAM_MODES.includes(instagramPublishMode)) {
      throw new AppError(`Invalid Instagram instagramPublishMode: ${instagramPublishMode}`, {
        statusCode: 422,
        code: "instagram_publish_mode_invalid",
        details: {
          supportedValues: INSTAGRAM_MODES
        }
      });
    }

    if (!INSTAGRAM_PLACEMENTS.includes(instagramPlacement)) {
      throw new AppError(`Invalid Instagram instagramPlacement: ${instagramPlacement}`, {
        statusCode: 422,
        code: "instagram_placement_invalid",
        details: {
          supportedValues: INSTAGRAM_PLACEMENTS
        }
      });
    }

    const effectiveInstagramPublishMode = instagramPlacement === "story" ? "auto" : instagramPublishMode;

    if (mediaLink && isVideoMedia(mediaLink) && !["auto", "reel"].includes(effectiveInstagramPublishMode)) {
      throw new AppError("Instagram instagramPublishMode must be `reel` or `auto` for video media", {
        statusCode: 422,
        code: "instagram_publish_mode_mismatch"
      });
    }

    if (mediaLink && isImageMedia(mediaLink) && !["auto", "image"].includes(effectiveInstagramPublishMode)) {
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
      instagramPublishMode: effectiveInstagramPublishMode,
      instagramPlacement,
      ...normalizeInstagramStandaloneAdvancedSettings(normalizedSettings, {
        mediaLink,
        placement: instagramPlacement
      })
    };
  }

  if (target.provider === "snapchat" && target.accountType === "snapchat_public_profile") {
    assertNoUnknownSettings(
      normalizedSettings,
      ["snapchatPublishMode", "locale", "skipSaveToProfile"],
      "snapchat_settings_unsupported"
    );

    const snapchatPublishMode = String(normalizedSettings.snapchatPublishMode || "spotlight").trim().toLowerCase();
    if (!SNAPCHAT_MODES.includes(snapchatPublishMode)) {
      throw new AppError(`Invalid Snapchat snapchatPublishMode: ${snapchatPublishMode}`, {
        statusCode: 422,
        code: "snapchat_publish_mode_invalid",
        details: {
          supportedValues: SNAPCHAT_MODES
        }
      });
    }

    if (!mediaLink) {
      throw new AppError("Snapchat publishing requires a media link", {
        statusCode: 422,
        code: "snapchat_media_required"
      });
    }

    if (!isMp4Media(mediaLink)) {
      throw new AppError("Snapchat publishing currently requires a .mp4 video media link", {
        statusCode: 422,
        code: "snapchat_video_required"
      });
    }

    return snapchatPublishMode === "spotlight"
      ? {
          snapchatPublishMode,
          locale: String(normalizedSettings.locale || "en_US").trim() || "en_US",
          skipSaveToProfile: Boolean(normalizedSettings.skipSaveToProfile)
        }
      : {
          snapchatPublishMode
        };
  }

  if (target.provider === "tiktok" && target.accountType === "tiktok_user") {
    assertNoUnknownSettings(
      normalizedSettings,
      [
        "tiktokPostMode",
        "privacyLevel",
        "duetEnabled",
        "commentEnabled",
        "stitchEnabled",
        "commercialContentToggle",
        "brandOrganicToggle",
        "brandContentToggle",
        "autoAddMusic",
        "photoCoverIndex"
      ],
      "tiktok_settings_unsupported"
    );

    const tiktokPostMode = String(normalizedSettings.tiktokPostMode || "direct_post").trim();
    if (!TIKTOK_POST_MODES.includes(tiktokPostMode)) {
      throw new AppError(`Invalid TikTok tiktokPostMode: ${tiktokPostMode}`, {
        statusCode: 422,
        code: "tiktok_post_mode_invalid",
        details: {
          supportedValues: TIKTOK_POST_MODES
        }
      });
    }

    if (tiktokPostMode === "draft") {
      // Draft uploads land in the creator's TikTok inbox; audience, interaction,
      // and disclosure choices happen inside the TikTok app, so any values sent
      // for those fields are dropped rather than rejected.
      const draftPhotoCoverIndex =
        normalizedSettings.photoCoverIndex === undefined || normalizedSettings.photoCoverIndex === null || normalizedSettings.photoCoverIndex === ""
          ? 0
          : Number(normalizedSettings.photoCoverIndex);
      if (!Number.isInteger(draftPhotoCoverIndex) || draftPhotoCoverIndex < 0) {
        throw new AppError("TikTok photoCoverIndex must be a non-negative integer", {
          statusCode: 422,
          code: "tiktok_photo_cover_index_invalid"
        });
      }
      return {
        tiktokPostMode,
        photoCoverIndex: draftPhotoCoverIndex
      };
    }

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
    const autoAddMusic =
      normalizedSettings.autoAddMusic === undefined ? false : Boolean(normalizedSettings.autoAddMusic);
    const photoCoverIndex =
      normalizedSettings.photoCoverIndex === undefined || normalizedSettings.photoCoverIndex === null || normalizedSettings.photoCoverIndex === ""
        ? 0
        : Number(normalizedSettings.photoCoverIndex);
    const commercialContentToggle =
      normalizedSettings.commercialContentToggle === undefined
        ? brandOrganicToggle || brandContentToggle
        : Boolean(normalizedSettings.commercialContentToggle);

    if (!Number.isInteger(photoCoverIndex) || photoCoverIndex < 0) {
      throw new AppError("TikTok photoCoverIndex must be a non-negative integer", {
        statusCode: 422,
        code: "tiktok_photo_cover_index_invalid"
      });
    }

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
      tiktokPostMode,
      privacyLevel,
      duetEnabled,
      commentEnabled,
      stitchEnabled,
      commercialContentToggle,
      brandOrganicToggle,
      brandContentToggle,
      autoAddMusic,
      photoCoverIndex
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
