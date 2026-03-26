// Synced from ../socialclaw via tools/sync-public-cli.mjs. Edit the private repo, then re-run this sync.
import fs from "node:fs/promises";
import path from "node:path";
import { AppError } from "./errors.mjs";
import { validatePublishSettingsForTarget } from "./publish-settings.mjs";
import { canonicalProvider, providerFromAccount, validateProviderPayload } from "./providers.mjs";

function stripQuotes(value) {
  const v = String(value).trim();
  if ((v.startsWith("\"") && v.endsWith("\"")) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1);
  }
  return v;
}

function parseSimpleYaml(content) {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.replace(/\t/g, "  "))
    .filter((line) => !line.trim().startsWith("#"));

  const doc = { posts: [] };
  let inPosts = false;
  let current = null;

  for (const rawLine of lines) {
    if (!rawLine.trim()) {
      continue;
    }

    const line = rawLine;
    const trimmed = line.trim();

    if (!inPosts && trimmed.startsWith("timezone:")) {
      doc.timezone = stripQuotes(trimmed.slice("timezone:".length));
      continue;
    }

    if (trimmed === "posts:") {
      inPosts = true;
      continue;
    }

    if (inPosts && trimmed.startsWith("- ")) {
      current = {};
      doc.posts.push(current);
      const inline = trimmed.slice(2).trim();
      if (inline) {
        const sep = inline.indexOf(":");
        if (sep > 0) {
          const key = inline.slice(0, sep).trim();
          const value = stripQuotes(inline.slice(sep + 1));
          current[key] = value;
        }
      }
      continue;
    }

    if (inPosts && current && /^\s+[A-Za-z_][A-Za-z0-9_\-]*:/.test(line)) {
      const inner = trimmed;
      const sep = inner.indexOf(":");
      const key = inner.slice(0, sep).trim();
      const value = stripQuotes(inner.slice(sep + 1));
      current[key] = value;
    }
  }

  return doc;
}

function parseScheduleContent(raw, extHint) {
  const ext = (extHint || "").toLowerCase();
  if (ext === ".json") {
    return JSON.parse(raw);
  }
  if (ext === ".yaml" || ext === ".yml") {
    return parseSimpleYaml(raw);
  }

  try {
    return JSON.parse(raw);
  } catch {
    return parseSimpleYaml(raw);
  }
}

function parseMode(value) {
  const mode = String(value || "scheduled").trim().toLowerCase();
  if (mode === "scheduled" || mode === "draft") {
    return mode;
  }
  throw new AppError(`Unsupported schedule mode: ${value}`, {
    code: "schedule_mode_invalid",
    statusCode: 422
  });
}

function parseIsoDate(value, fieldName) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new AppError(`Invalid publish time for ${fieldName}: ${value}`, {
      code: "invalid_publish_time",
      statusCode: 422
    });
  }
  return parsed;
}

function parseDelayMs(step, stepIndex) {
  const rawMs = step.delay_ms ?? step.delayMs;
  if (rawMs !== undefined && rawMs !== null && rawMs !== "") {
    const value = Number(rawMs);
    if (!Number.isFinite(value) || value < 0) {
      throw new AppError(`Invalid delay_ms for step ${stepIndex + 1}: ${rawMs}`, {
        code: "invalid_step_delay",
        statusCode: 422
      });
    }
    return Math.floor(value);
  }

  const rawSeconds = step.delay_seconds ?? step.delaySeconds;
  if (rawSeconds !== undefined && rawSeconds !== null && rawSeconds !== "") {
    const value = Number(rawSeconds);
    if (!Number.isFinite(value) || value < 0) {
      throw new AppError(`Invalid delay_seconds for step ${stepIndex + 1}: ${rawSeconds}`, {
        code: "invalid_step_delay",
        statusCode: 422
      });
    }
    return Math.floor(value * 1_000);
  }

  const rawMinutes = step.delay_minutes ?? step.delayMinutes;
  if (rawMinutes !== undefined && rawMinutes !== null && rawMinutes !== "") {
    const value = Number(rawMinutes);
    if (!Number.isFinite(value) || value < 0) {
      throw new AppError(`Invalid delay_minutes for step ${stepIndex + 1}: ${rawMinutes}`, {
        code: "invalid_step_delay",
        statusCode: 422
      });
    }
    return Math.floor(value * 60_000);
  }

  return 0;
}

function parseInteractionType(value) {
  const interactionType = String(value || "post").trim().toLowerCase();
  if (["post", "reply", "comment"].includes(interactionType)) {
    return interactionType;
  }

  throw new AppError(`Unsupported interaction_type: ${value}`, {
    code: "interaction_type_invalid",
    statusCode: 422
  });
}

function normalizeAssets(post) {
  const explicitMediaLink = post.media_link || post.mediaLink || null;
  const rawAssets = Array.isArray(post.assets) ? post.assets : [];
  const assets = rawAssets.map((item, index) => {
    if (typeof item === "string") {
      const url = item.trim();
      if (!url) {
        throw new AppError(`assets[${index}] must be a non-empty URL`, {
          code: "asset_url_required",
          statusCode: 422
        });
      }
      return {
        id: `asset_${index + 1}`,
        url,
        managed: false
      };
    }

    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new AppError(`assets[${index}] must be a string URL or object`, {
        code: "asset_invalid",
        statusCode: 422
      });
    }

    const url = String(item.url || item.media_link || item.mediaLink || "").trim();
    if (!url) {
      throw new AppError(`assets[${index}] is missing a URL`, {
        code: "asset_url_required",
        statusCode: 422
      });
    }

    return {
      id: String(item.id || `asset_${index + 1}`).trim(),
      url,
      managed: Boolean(item.managed),
      originalFilename: item.originalFilename ? String(item.originalFilename).trim() : null,
      mime: item.mime ? String(item.mime).trim() : null,
      kind: item.kind ? String(item.kind).trim().toLowerCase() : null,
      size: Number.isFinite(Number(item.size)) ? Number(item.size) : null,
      altText: item.altText ? String(item.altText).trim() : null
    };
  });

  if (explicitMediaLink && assets.length > 0 && assets[0].url !== explicitMediaLink) {
    throw new AppError("media_link must match assets[0].url when both are provided", {
      code: "asset_media_conflict",
      statusCode: 422
    });
  }

  if (explicitMediaLink && assets.length === 0) {
    assets.push({
      id: "asset_1",
      url: explicitMediaLink,
      managed: false
    });
  }

  return {
    assets,
    mediaLink: assets[0]?.url || null
  };
}

function normalizePost(post, rootTimezone, metadata = {}) {
  const account = post.account || post.channel || "";
  const explicitProvider = canonicalProvider(post.provider);
  const inferredProvider = providerFromAccount(account);
  if (explicitProvider && inferredProvider && explicitProvider !== inferredProvider) {
    throw new AppError(`Provider ${explicitProvider} does not match account ${account}`, {
      code: "provider_account_mismatch",
      statusCode: 422
    });
  }
  const provider = explicitProvider || inferredProvider;

  if (!provider) {
    throw new AppError(`Cannot infer provider for account: ${account}`, {
      code: "provider_required",
      statusCode: 422
    });
  }

  const publishAtRaw = post.publish_at || post.publishAt;
  const publishDate = parseIsoDate(publishAtRaw, metadata.stepId || account || "post");
  const interactionType = parseInteractionType(
    post.interaction_type || post.interactionType || metadata.interactionType || "post"
  );
  const { assets, mediaLink } = normalizeAssets(post);
  const replyToStepId = String(
    post.reply_to_step_id ||
    post.replyToStepId ||
    post.parent_step_id ||
    post.parentStepId ||
    metadata.replyToStepId ||
    metadata.parentStepId ||
    ""
  ).trim() || null;

  const normalized = {
    provider,
    account,
    name: String(post.name || "").trim(),
    description: String(post.description || "").trim(),
    interactionType,
    assets,
    mediaLink,
    settings: validatePublishSettingsForTarget({
      provider,
      account,
      mediaLink,
      settings: post.settings || {}
    }),
    timezone: post.timezone || rootTimezone || "UTC",
    publishAtUtc: publishDate.toISOString(),
    parentStepId: replyToStepId,
    ...metadata
  };

  if (!normalized.account) {
    throw new AppError("Each post must include an account", {
      code: "account_required",
      statusCode: 422
    });
  }

  if (!normalized.name && !normalized.description && !normalized.mediaLink) {
    throw new AppError("Each post must include text, a title, or media", {
      code: "post_content_required",
      statusCode: 422
    });
  }

  validateProviderPayload(normalized);
  return normalized;
}

function normalizeLegacyPosts(posts, timezone) {
  return {
    sourceModel: "posts_v1",
    campaigns: [],
    normalizedPosts: posts.map((post, index) =>
      normalizePost(post, timezone, {
        sourceModel: "posts_v1",
        stepId: `post_${index + 1}`,
        stepIndex: 0,
        targetIndex: index,
        campaignId: null,
        campaignName: null
      })
    )
  };
}

function normalizeCampaigns(campaigns, timezone) {
  const normalizedPosts = [];
  const campaignSummaries = [];

  campaigns.forEach((campaign, campaignIndex) => {
    if (!campaign || typeof campaign !== "object") {
      throw new AppError(`Campaign ${campaignIndex + 1} must be an object`, {
        code: "campaign_invalid",
        statusCode: 422
      });
    }

    const campaignId = String(campaign.id || `campaign_${campaignIndex + 1}`).trim();
    const campaignName = String(campaign.name || campaign.title || campaignId).trim();
    const targets = Array.isArray(campaign.targets) ? campaign.targets : [];

    if (!targets.length) {
      throw new AppError(`Campaign ${campaignName} must include at least one target`, {
        code: "campaign_targets_required",
        statusCode: 422
      });
    }

    const summary = {
      id: campaignId,
      name: campaignName,
      targetCount: targets.length,
      postCount: 0,
      accounts: []
    };

    targets.forEach((target, targetIndex) => {
      if (!target || typeof target !== "object") {
        throw new AppError(`Campaign ${campaignName} target ${targetIndex + 1} must be an object`, {
          code: "campaign_target_invalid",
          statusCode: 422
        });
      }

      const account = String(target.account || target.channel || "").trim();
      if (!account) {
        throw new AppError(`Campaign ${campaignName} target ${targetIndex + 1} must include an account`, {
          code: "campaign_target_account_required",
          statusCode: 422
        });
      }

      const targetTimezone = String(target.timezone || campaign.timezone || timezone || "UTC").trim();
      const steps = Array.isArray(target.steps) ? target.steps : [];

      if (!steps.length) {
        throw new AppError(`Campaign ${campaignName} target ${account} must include at least one step`, {
          code: "campaign_steps_required",
          statusCode: 422
        });
      }

      summary.accounts.push(account);

      let cursorDate = null;
      const targetPublishAt = target.publish_at || target.publishAt || campaign.publish_at || campaign.publishAt;

      steps.forEach((step, stepIndex) => {
        if (!step || typeof step !== "object") {
          throw new AppError(`Campaign ${campaignName} step ${stepIndex + 1} for ${account} must be an object`, {
            code: "campaign_step_invalid",
            statusCode: 422
          });
        }

        const previousCursorDate = cursorDate ? new Date(cursorDate.getTime()) : null;
        const stepPublishAt = step.publish_at || step.publishAt;
        if (stepPublishAt) {
          cursorDate = parseIsoDate(stepPublishAt, `${campaignName} step ${stepIndex + 1}`);
        } else if (stepIndex === 0) {
          if (!targetPublishAt) {
            throw new AppError(`Campaign ${campaignName} target ${account} must include publish_at on the target or first step`, {
              code: "campaign_publish_time_required",
              statusCode: 422
            });
          }
          cursorDate = parseIsoDate(targetPublishAt, `${campaignName} target ${account}`);
        } else {
          cursorDate = new Date(cursorDate.getTime() + parseDelayMs(step, stepIndex));
        }

        const stepId = String(step.id || `${campaignId}_target_${targetIndex + 1}_step_${stepIndex + 1}`).trim();
        const derivedName =
          String(step.name || "").trim() || `${campaignName} Step ${stepIndex + 1}`;
        const interactionType = parseInteractionType(
          step.interaction_type || step.interactionType || target.interaction_type || target.interactionType || "post"
        );
        const inferredParentStepId = interactionType === "post"
          ? null
          : String(
            step.reply_to_step_id ||
            step.replyToStepId ||
            step.parent_step_id ||
            step.parentStepId ||
            (stepIndex > 0
              ? steps[stepIndex - 1]?.id || `${campaignId}_target_${targetIndex + 1}_step_${stepIndex}`
              : "")
          ).trim() || null;

        normalizedPosts.push(
          normalizePost(
            {
              ...step,
              account,
              provider: step.provider || target.provider || campaign.provider,
              name: derivedName,
              publish_at: cursorDate.toISOString(),
              timezone: targetTimezone
            },
            targetTimezone,
            {
              sourceModel: "campaigns_v2",
              campaignId,
              campaignName,
              campaignIndex,
              targetIndex,
              stepId,
              stepIndex,
              sequencePosition: stepIndex + 1,
              interactionType,
              parentStepId: inferredParentStepId,
              stepDelayMs: previousCursorDate
                ? cursorDate.getTime() - previousCursorDate.getTime()
                : 0
            }
          )
        );

        summary.postCount += 1;
      });
    });

    campaignSummaries.push(summary);
  });

  return {
    sourceModel: "campaigns_v2",
    campaigns: campaignSummaries,
    normalizedPosts
  };
}

function sortCampaignSteps(a, b) {
  const byTargetIndex = (Number(a.targetIndex) || 0) - (Number(b.targetIndex) || 0);
  if (byTargetIndex !== 0) {
    return byTargetIndex;
  }

  const bySequence = (Number(a.sequencePosition) || 0) - (Number(b.sequencePosition) || 0);
  if (bySequence !== 0) {
    return bySequence;
  }

  return new Date(a.publishAtUtc).getTime() - new Date(b.publishAtUtc).getTime();
}

function assertCampaignSourceModel(sourceModel) {
  if (sourceModel !== "campaigns_v2") {
    throw new AppError("Campaign graph requires a campaigns_v2 schedule", {
      code: "campaign_graph_requires_campaigns",
      statusCode: 409
    });
  }
}

function mapStepNode(post, previousStep = null) {
  const previousPublishAt = previousStep ? new Date(previousStep.publishAtUtc).getTime() : null;
  const currentPublishAt = new Date(post.publishAtUtc).getTime();
  const offsetMs = previousPublishAt === null
    ? 0
    : Math.max(0, currentPublishAt - previousPublishAt);

  return {
    id: post.stepId || post.id || null,
    postId: post.id || null,
    provider: post.provider,
    account: post.account,
    interactionType: post.interactionType || "post",
    name: post.name,
    description: post.description,
    mediaLink: post.mediaLink || null,
    assets: Array.isArray(post.assets) ? post.assets : [],
    settings: post.settings || {},
    timezone: post.timezone,
    publishAtUtc: post.publishAtUtc,
    status: post.status || null,
    providerPostId: post.providerPostId || null,
    sequencePosition: Number.isInteger(post.sequencePosition)
      ? post.sequencePosition
      : (Number(post.stepIndex) || 0) + 1,
    stepIndex: Number.isInteger(post.stepIndex) ? post.stepIndex : 0,
    targetIndex: Number.isInteger(post.targetIndex) ? post.targetIndex : 0,
    parentStepId: post.parentStepId || null,
    stepDelayMs: Number.isFinite(Number(post.stepDelayMs))
      ? Number(post.stepDelayMs)
      : offsetMs,
    stepDelayMinutes: Number(((
      Number.isFinite(Number(post.stepDelayMs)) ? Number(post.stepDelayMs) : offsetMs
    ) / 60_000).toFixed(3))
  };
}

export function buildCampaignGraph(scheduleLike, { run = null } = {}) {
  const timezone = String(scheduleLike?.timezone || "UTC").trim();
  const mode = parseMode(scheduleLike?.mode || scheduleLike?.status || "scheduled");
  const sourceModel = String(scheduleLike?.sourceModel || "").trim();
  const normalizedPosts = Array.isArray(scheduleLike?.normalizedPosts) ? scheduleLike.normalizedPosts : [];
  const campaignSummaries = Array.isArray(scheduleLike?.campaigns) ? scheduleLike.campaigns : [];

  assertCampaignSourceModel(sourceModel);

  const postsByCampaignId = new Map();
  for (const post of normalizedPosts) {
    const campaignId = String(post.campaignId || "").trim();
    if (!campaignId) {
      throw new AppError("Campaign graph requires campaignId on every normalized post", {
        code: "campaign_graph_post_invalid",
        statusCode: 422
      });
    }

    if (!postsByCampaignId.has(campaignId)) {
      postsByCampaignId.set(campaignId, []);
    }
    postsByCampaignId.get(campaignId).push(post);
  }

  const orderedCampaignSummaries = campaignSummaries.length > 0
    ? campaignSummaries
    : [...postsByCampaignId.entries()]
      .sort((a, b) => sortCampaignSteps(a[1][0], b[1][0]))
      .map(([campaignId, posts], campaignIndex) => ({
        id: campaignId,
        name: String(posts[0]?.campaignName || campaignId).trim(),
        campaignIndex
      }));

  const campaigns = orderedCampaignSummaries.map((campaignSummary, campaignIndex) => {
    const campaignId = String(campaignSummary.id || "").trim();
    const steps = (postsByCampaignId.get(campaignId) || []).slice().sort(sortCampaignSteps);
    const targetsByIndex = new Map();

    for (const step of steps) {
      const targetIndex = Number.isInteger(step.targetIndex) ? step.targetIndex : 0;
      if (!targetsByIndex.has(targetIndex)) {
        targetsByIndex.set(targetIndex, []);
      }
      targetsByIndex.get(targetIndex).push(step);
    }

    const targets = [...targetsByIndex.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([targetIndex, targetSteps]) => {
        const orderedSteps = targetSteps.slice().sort(sortCampaignSteps);
        const stepNodes = [];

        for (const post of orderedSteps) {
          stepNodes.push(mapStepNode(post, stepNodes.at(-1) || null));
        }

        const firstStep = stepNodes[0] || null;
        const lastStep = stepNodes.at(-1) || null;

        return {
          id: `${campaignId}_target_${targetIndex + 1}`,
          targetIndex,
          account: firstStep?.account || null,
          provider: firstStep?.provider || null,
          timezone: firstStep?.timezone || timezone,
          stepCount: stepNodes.length,
          firstPublishAtUtc: firstStep?.publishAtUtc || null,
          lastPublishAtUtc: lastStep?.publishAtUtc || null,
          steps: stepNodes
        };
      });

    return {
      id: campaignId,
      name: String(campaignSummary.name || campaignId).trim(),
      campaignIndex,
      targetCount: targets.length,
      postCount: steps.length,
      accounts: [...new Set(targets.map((target) => target.account).filter(Boolean))],
      firstPublishAtUtc: targets[0]?.firstPublishAtUtc || null,
      lastPublishAtUtc: targets.at(-1)?.lastPublishAtUtc || null,
      targets
    };
  });

  return {
    runId: run?.id || null,
    runStatus: run?.status || null,
    timezone,
    mode,
    sourceModel,
    totalCampaigns: campaigns.length,
    totalTargets: campaigns.reduce((sum, campaign) => sum + campaign.targets.length, 0),
    totalSteps: campaigns.reduce((sum, campaign) => sum + campaign.postCount, 0),
    campaigns
  };
}

export function buildCampaignClonePayload(campaignGraph, { mode = "draft" } = {}) {
  if (!campaignGraph || typeof campaignGraph !== "object") {
    throw new AppError("Campaign graph is required to build a clone payload", {
      code: "campaign_graph_required",
      statusCode: 422
    });
  }

  const cloneMode = parseMode(mode);

  return {
    timezone: campaignGraph.timezone || "UTC",
    mode: cloneMode,
    campaigns: (campaignGraph.campaigns || []).map((campaign) => ({
      id: campaign.id,
      name: campaign.name,
      targets: (campaign.targets || []).map((target) => ({
        account: target.account,
        timezone: target.timezone,
        steps: (target.steps || []).map((step) => {
          const payload = {
            id: step.id,
            provider: step.provider,
            name: step.name,
            description: step.description,
            publish_at: step.publishAtUtc
          };

          if (step.interactionType && step.interactionType !== "post") {
            payload.interaction_type = step.interactionType;
          }

          if (step.parentStepId) {
            payload.reply_to_step_id = step.parentStepId;
          }

          const serializedAssets = Array.isArray(step.assets)
            ? step.assets
                .map((asset) => {
                  if (!asset?.url) {
                    return null;
                  }
                  if (
                    asset.managed ||
                    asset.id ||
                    asset.altText ||
                    asset.mime ||
                    asset.kind ||
                    Number.isFinite(Number(asset.size)) ||
                    asset.originalFilename
                  ) {
                    return {
                      ...(asset.id ? { id: asset.id } : {}),
                      url: asset.url,
                      ...(asset.managed ? { managed: true } : {}),
                      ...(asset.originalFilename ? { originalFilename: asset.originalFilename } : {}),
                      ...(asset.mime ? { mime: asset.mime } : {}),
                      ...(asset.kind ? { kind: asset.kind } : {}),
                      ...(Number.isFinite(Number(asset.size)) ? { size: Number(asset.size) } : {}),
                      ...(asset.altText ? { altText: asset.altText } : {})
                    };
                  }
                  return asset.url;
                })
                .filter(Boolean)
            : [];

          if (serializedAssets.length > 1 || (serializedAssets.length === 1 && typeof serializedAssets[0] !== "string")) {
            payload.assets = serializedAssets;
          } else if (step.mediaLink) {
            payload.media_link = step.mediaLink;
          }

          if (step.settings && Object.keys(step.settings).length > 0) {
            payload.settings = step.settings;
          }

          return payload;
        })
      }))
    }))
  };
}

export function validateSchedule(schedule) {
  if (!schedule || typeof schedule !== "object") {
    throw new AppError("Schedule payload must be an object", {
      code: "schedule_invalid",
      statusCode: 422
    });
  }

  const timezone = String(schedule.timezone || "UTC").trim();
  const mode = parseMode(schedule.mode || schedule.status || "scheduled");
  const posts = Array.isArray(schedule.posts) ? schedule.posts : [];
  const campaigns = Array.isArray(schedule.campaigns) ? schedule.campaigns : [];

  if (posts.length > 0 && campaigns.length > 0) {
    throw new AppError("Use either posts or campaigns in one schedule payload, not both", {
      code: "schedule_shape_conflict",
      statusCode: 422
    });
  }

  if (!posts.length && !campaigns.length) {
    throw new AppError("Schedule must include at least one post or campaign", {
      code: "schedule_items_required",
      statusCode: 422
    });
  }

  const compiled = campaigns.length > 0
    ? normalizeCampaigns(campaigns, timezone)
    : normalizeLegacyPosts(posts, timezone);

  const result = {
    timezone,
    mode,
    sourceModel: compiled.sourceModel,
    campaigns: compiled.campaigns,
    normalizedPosts: compiled.normalizedPosts
  };

  if (compiled.sourceModel === "campaigns_v2") {
    result.campaignGraph = buildCampaignGraph(result);
  }

  return result;
}

export async function readAndValidateScheduleFile(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  const ext = path.extname(filePath);
  const parsed = parseScheduleContent(raw, ext);
  const validated = validateSchedule(parsed);
  return {
    ...validated,
    raw,
    parsed
  };
}

export function parseSchedulePayload(payload) {
  return validateSchedule(payload);
}
