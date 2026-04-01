#!/usr/bin/env node
// Synced from ../socialclaw via tools/sync-public-cli.mjs. Edit the private repo, then re-run this sync.
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import { createId } from "./lib/ids.mjs";
import { readAndValidateScheduleFile } from "./lib/schedule.mjs";
import { inferAssetMimeType } from "./lib/mime.mjs";

const CONFIG_DIR = path.join(os.homedir(), ".socialclaw");
const CONFIG_PATH = path.join(CONFIG_DIR, "config.json");
const DEFAULT_BASE_URL = process.env.SC_BASE_URL || "https://getsocialclaw.com";
const PRIMARY_COMMAND = "socialclaw";
const COMMAND_ALIAS = "social";
const PROVIDER_CHOICES =
  "x|facebook|instagram_business|instagram|linkedin|linkedin_page|pinterest|youtube|reddit|discord|meta|tiktok|telegram|wordpress";
const HELP_DIVIDER = "+------------------------------------------------------------------------------+";
const HELP_WIDTH = 76;
const HELP_LOGO = String.raw`
     ____             _       _      ____ _
    / ___|  ___   ___(_) __ _| |    / ___| | __ ___      __
    \___ \ / _ \ / __| |/ _\` | |   | |   | |/ _\` \ \ /\ / /
     ___) | (_) | (__| | (_| | |   | |___| | (_| |\ V  V /
    |____/ \___/ \___|_|\__,_|_|    \____|_|\__,_| \_/\_/
`;

function wrapHelpLine(line) {
  const source = String(line ?? "");
  if (!source) {
    return [""];
  }

  const chunks = [];
  let remaining = source;

  while (remaining.length > HELP_WIDTH) {
    const slice = remaining.slice(0, HELP_WIDTH + 1);
    const breakAt = Math.max(slice.lastIndexOf(" "), slice.lastIndexOf("] "), slice.lastIndexOf("> "));
    const index = breakAt > 24 ? breakAt : HELP_WIDTH;
    chunks.push(remaining.slice(0, index).trimEnd());
    remaining = remaining.slice(index).trimStart();
  }

  chunks.push(remaining);
  return chunks;
}

function renderHelpSection(title, lines) {
  return [
    HELP_DIVIDER,
    `| ${title.padEnd(HELP_WIDTH, " ")} |`,
    HELP_DIVIDER,
    ...lines.flatMap((line) => wrapHelpLine(line).map((part) => `| ${part.padEnd(HELP_WIDTH, " ")} |`)),
    HELP_DIVIDER
  ].join("\n");
}

function printUsage() {
  const sections = [
    renderHelpSection("SOCIALCLAW CLI", [
      "Agent-ready social publishing from your terminal.",
      "",
      `Primary command : ${PRIMARY_COMMAND}`,
      `Short alias      : ${COMMAND_ALIAS}`,
      `Docs             : ${DEFAULT_BASE_URL}`
    ]),
    renderHelpSection("QUICK START", [
      `${PRIMARY_COMMAND} login`,
      `${PRIMARY_COMMAND} login --api-key <key> [--base-url ${DEFAULT_BASE_URL}]`,
      `${PRIMARY_COMMAND} accounts list --json`,
      `${PRIMARY_COMMAND} assets upload --file ./image.png --json`,
      `${PRIMARY_COMMAND} validate -f schedule.json --json`,
      `${PRIMARY_COMMAND} apply -f schedule.json --json`
    ]),
    renderHelpSection("AUTH", [
      `${PRIMARY_COMMAND} login`,
      `${PRIMARY_COMMAND} login --api-key <key> [--base-url <url>]`
    ]),
    renderHelpSection("SCHEDULES AND CAMPAIGNS", [
      `${PRIMARY_COMMAND} validate -f <schedule.(yaml|yml|json)> [--json]`,
      `${PRIMARY_COMMAND} apply -f <schedule.(yaml|yml|json)> [--idempotency-key <key>] [--json]`,
      `${PRIMARY_COMMAND} campaigns preview -f <schedule.(yaml|yml|json)> [--json]`,
      `${PRIMARY_COMMAND} campaigns inspect --run-id <id> [--json]`,
      `${PRIMARY_COMMAND} campaigns clone --run-id <id> [--output <file>] [--json]`,
      `${PRIMARY_COMMAND} publish-draft --run-id <id> [--start-at <iso8601>] [--json]`
    ]),
    renderHelpSection("POSTS AND RUNS", [
      `${PRIMARY_COMMAND} posts list [--run-id <id>] [--status <status>] [--account <handle>] [--provider <provider>] [--campaign-id <id>] [--limit <n>] [--json]`,
      `${PRIMARY_COMMAND} posts get --post-id <id> [--json]`,
      `${PRIMARY_COMMAND} posts attempts --post-id <id> [--json]`,
      `${PRIMARY_COMMAND} posts reconcile --post-id <id> [--json]`,
      `${PRIMARY_COMMAND} status --run-id <id> [--json]`,
      `${PRIMARY_COMMAND} runs inspect --run-id <id> [--json]`,
      `${PRIMARY_COMMAND} retry --post-id <id> [--json]`,
      `${PRIMARY_COMMAND} cancel --post-id <id> [--json]`,
      `${PRIMARY_COMMAND} view --run-id <id> [--format terminal|html] [--output <file>]`
    ]),
    renderHelpSection("ACCOUNTS", [
      `${PRIMARY_COMMAND} accounts list [--provider <provider>] [--json]`,
      `${PRIMARY_COMMAND} accounts capabilities [--account-id <id>] [--provider <provider>] [--json]`,
      `${PRIMARY_COMMAND} accounts settings --account-id <id> [--json]`,
      `${PRIMARY_COMMAND} accounts actions --account-id <id> [--json]`,
      `${PRIMARY_COMMAND} accounts action --account-id <id> --action <action-id> [--body <json> | --input <file>] [--json]`,
      `${PRIMARY_COMMAND} accounts connect --provider <provider> [--open] [--json]`,
      `${PRIMARY_COMMAND} accounts connect --provider telegram --bot-token <token> --chat-id <@channel|chat_id> [--json]`,
      `${PRIMARY_COMMAND} accounts connect --provider discord --webhook-url <url> [--json]`,
      `${PRIMARY_COMMAND} accounts status --connection-id <id> [--json]`,
      `${PRIMARY_COMMAND} accounts disconnect --account-id <id> [--json]`
    ]),
    renderHelpSection("MEDIA AND WORKSPACE", [
      `${PRIMARY_COMMAND} assets upload --file <path> [--json]`,
      `${PRIMARY_COMMAND} assets delete --asset-id <id> [--retention-days <days>] [--json]`,
      `${PRIMARY_COMMAND} analytics post --post-id <id> [--window <window>] [--json]`,
      `${PRIMARY_COMMAND} analytics account --account-id <id> [--window <window>] [--json]`,
      `${PRIMARY_COMMAND} analytics run --run-id <id> [--window <window>] [--json]`,
      `${PRIMARY_COMMAND} analytics refresh --post-id <id> [--window <window>] [--json]`,
      `${PRIMARY_COMMAND} usage [--json]`,
      `${PRIMARY_COMMAND} workspace health [--json]`,
      `${PRIMARY_COMMAND} connections health [--provider <provider>] [--json]`,
      `${PRIMARY_COMMAND} jobs list [--status <status>] [--provider <provider>] [--account <handle>] [--run-id <id>] [--limit <n>] [--json]`
    ]),
    renderHelpSection("SUPPORTED PROVIDERS", [
      PROVIDER_CHOICES.replaceAll("|", " | ")
    ]),
    renderHelpSection("INTEGRATIONS", [
      `${PRIMARY_COMMAND} install --claude`
    ])
  ];

  console.log([HELP_LOGO.trimEnd(), "", ...sections].join("\n\n"));
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token.startsWith("--")) {
      const key = token.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith("-")) {
        args[key] = true;
      } else {
        args[key] = next;
        i += 1;
      }
      continue;
    }
    if (token.startsWith("-")) {
      const key = token.slice(1);
      const next = argv[i + 1];
      if (!next || next.startsWith("-")) {
        args[key] = true;
      } else {
        args[key] = next;
        i += 1;
      }
      continue;
    }
    args._.push(token);
  }
  return args;
}

function openUrl(url) {
  const platform = process.platform;
  if (platform === "darwin") {
    spawn("open", [url], { detached: true, stdio: "ignore" }).unref();
    return;
  }
  if (platform === "win32") {
    spawn("cmd", ["/c", "start", "", url], { detached: true, stdio: "ignore" }).unref();
    return;
  }
  spawn("xdg-open", [url], { detached: true, stdio: "ignore" }).unref();
}

function exitJson(code, payload) {
  console.log(JSON.stringify(payload, null, 2));
  process.exit(code);
}

async function ensureConfigDir() {
  await fs.mkdir(CONFIG_DIR, { recursive: true });
}

async function readConfig() {
  try {
    const raw = await fs.readFile(CONFIG_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function saveConfig(config) {
  await ensureConfigDir();
  await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2));
}

async function apiRequest(method, endpoint, { apiKey, body, baseUrl }) {
  const url = `${baseUrl.replace(/\/$/, "")}${endpoint}`;
  let response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`
      },
      body: body ? JSON.stringify(body) : undefined
    });
  } catch (error) {
    const fetchError = new Error(error?.message || "Network request failed");
    fetchError.payload = {
      ok: false,
      code: "network_error",
      message: error?.message || "Network request failed",
      details: {
        url,
        cause: error?.cause?.message || null,
        causeCode: error?.cause?.code || null,
        stack: error?.stack || null
      }
    };
    throw fetchError;
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    payload = { ok: false, code: "invalid_response", message: "API returned non-JSON response" };
  }

  if (!response.ok) {
    const error = new Error(payload.message || `Request failed (${response.status})`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

function requireArg(args, name, short) {
  const value = args[name] || (short ? args[short] : undefined);
  if (!value) {
    console.error(`Missing required flag: --${name}`);
    process.exit(2);
  }
  return String(value);
}

function formatTimelineTable(rows) {
  const headers = ["Time", "Account", "Campaign", "Step", "Post Name", "Description", "Media Link", "Timezone", "Status", "Post ID"];
  const printable = rows.map((row) => [
    String(row.time || ""),
    String(row.account || ""),
    String(row.campaign || ""),
    String(row.step || ""),
    String(row.postName || ""),
    String(row.description || ""),
    String(row.mediaLink || ""),
    String(row.timezone || ""),
    String(row.status || ""),
    String(row.postId || "")
  ]);

  const widths = headers.map((h, col) => {
    const maxCell = printable.reduce((max, row) => Math.max(max, row[col].length), h.length);
    return Math.min(Math.max(maxCell, h.length), 36);
  });

  const trimCell = (value, width) => (value.length > width ? `${value.slice(0, width - 1)}…` : value);

  const sep = `+${widths.map((w) => "-".repeat(w + 2)).join("+")}+`;
  const rowLine = (cells) =>
    `| ${cells
      .map((cell, i) => trimCell(cell, widths[i]).padEnd(widths[i], " "))
      .join(" | ")} |`;

  const lines = [sep, rowLine(headers), sep];
  for (const row of printable) {
    lines.push(rowLine(row));
  }
  lines.push(sep);
  return lines.join("\n");
}

function formatAttemptTable(attempts) {
  const headers = ["No", "Stage", "Worker", "Started", "Finished", "OK", "Code", "Retryable", "Provider Post ID"];
  const printable = (attempts || []).map((attempt) => [
    String(attempt.attemptNo || ""),
    String(attempt.stage || ""),
    String(attempt.workerId || ""),
    String(attempt.startedAt || ""),
    String(attempt.finishedAt || attempt.at || ""),
    attempt.ok ? "yes" : "no",
    String(attempt.code || ""),
    attempt.retryable ? "yes" : "no",
    String(attempt.providerPostId || "")
  ]);

  const widths = headers.map((h, col) => {
    const maxCell = printable.reduce((max, row) => Math.max(max, row[col].length), h.length);
    return Math.min(Math.max(maxCell, h.length), 32);
  });

  const trimCell = (value, width) => (value.length > width ? `${value.slice(0, width - 1)}…` : value);
  const sep = `+${widths.map((w) => "-".repeat(w + 2)).join("+")}+`;
  const rowLine = (cells) =>
    `| ${cells
      .map((cell, i) => trimCell(cell, widths[i]).padEnd(widths[i], " "))
      .join(" | ")} |`;

  const lines = [sep, rowLine(headers), sep];
  for (const row of printable) {
    lines.push(rowLine(row));
  }
  lines.push(sep);
  return lines.join("\n");
}

function timelineHtml(run, rows) {
  const escape = (value) =>
    String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");

  const renderedRows = rows
    .map(
      (row) => `<tr>
<td>${escape(row.time)}</td>
<td>${escape(row.account)}</td>
<td>${escape(row.campaign)}</td>
<td>${escape(row.step)}</td>
<td>${escape(row.postName)}</td>
<td>${escape(row.description)}</td>
<td>${escape(row.mediaLink)}</td>
<td>${escape(row.timezone)}</td>
<td>${escape(row.status)}</td>
<td>${escape(row.postId)}</td>
</tr>`
    )
    .join("\n");

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>SocialClaw Run ${escape(run.id)}</title>
<style>
body { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; margin: 24px; background: #0b0f1a; color: #e7edf7; }
h1 { margin: 0 0 8px 0; font-size: 18px; }
small { color: #9fb0c9; }
table { width: 100%; border-collapse: collapse; margin-top: 14px; background: #111b2e; }
th, td { border: 1px solid #273550; padding: 8px; text-align: left; vertical-align: top; }
th { background: #16243f; }
tr:nth-child(even) td { background: #0f182a; }
</style>
</head>
<body>
<h1>SocialClaw Timeline</h1>
<small>Run: ${escape(run.id)} | Status: ${escape(run.status)} | Timezone: ${escape(run.timezone)}</small>
<table>
<thead>
<tr>
<th>Time</th>
<th>Account</th>
<th>Campaign</th>
<th>Step</th>
<th>Post Name</th>
<th>Description</th>
<th>Media Link</th>
<th>Timezone</th>
<th>Status</th>
<th>Post ID</th>
</tr>
</thead>
<tbody>
${renderedRows}
</tbody>
</table>
</body>
</html>`;
}

function formatCapabilityBlock(capability) {
  const media = capability.input?.media || {};
  const settings = capability.publishSettings || { fields: [] };
  const discoveryActions = capability.discoveryActions || { actions: [] };
  const lines = [
    `${capability.handle} (${capability.accountType})`,
    `  Publishable: ${capability.publishable ? "yes" : "no"}`,
    `  Summary: ${capability.summary}`,
    `  Post model: ${capability.workflow?.currentPostModel || "unknown"} via ${capability.workflow?.executionModel || "unknown"}`,
    `  Interaction types: ${Array.isArray(capability.workflow?.supportedInteractionTypes) ? capability.workflow.supportedInteractionTypes.join(", ") : "post"}`,
    `  Drafts: ${capability.workflow?.draftSupport ? "supported" : "not supported"} | Campaigns: ${capability.workflow?.campaignSupport ? "supported" : "not supported"}`,
    `  Media: ${media.supported ? "supported" : "not supported"} | required=${media.required ? "yes" : "no"} | maxItems=${media.maxItems ?? (media.acceptsMultiple ? "many" : 1)} | transport=${media.transport || "n/a"} | nativeUpload=${media.nativeUpload ? "yes" : "no"}`
  ];

  if (Array.isArray(media.acceptedKinds) && media.acceptedKinds.length > 0) {
    lines.push(`  Accepted media kinds: ${media.acceptedKinds.join(", ")}`);
  }

  if (Array.isArray(settings.fields) && settings.fields.length > 0) {
    lines.push(
      `  Publish settings: ${settings.fields
        .map((field) => `${field.id} (${field.type}${field.default !== undefined ? ` default=${field.default}` : ""})`)
        .join(", ")}`
    );
  }

  if (Array.isArray(discoveryActions.actions) && discoveryActions.actions.length > 0) {
    lines.push(`  Discovery actions: ${discoveryActions.actions.map((action) => action.id).join(", ")}`);
  }

  if (Array.isArray(capability.limitations) && capability.limitations.length > 0) {
    lines.push("  Limitations:");
    for (const item of capability.limitations) {
      lines.push(`    - ${item}`);
    }
  }

  if (Array.isArray(capability.nextRecommendedActions) && capability.nextRecommendedActions.length > 0) {
    lines.push("  Recommended next actions:");
    for (const item of capability.nextRecommendedActions) {
      lines.push(`    - ${item}`);
    }
  }

  return lines.join("\n");
}

function formatPublishSettingsBlock(payload) {
  const fields = Array.isArray(payload.fields) ? payload.fields : [];
  const lines = [
    `Target: ${payload.target?.provider || "unknown"} / ${payload.target?.accountType || "unknown"}`,
    `Supported: ${payload.supported ? "yes" : "no"}`
  ];

  if (fields.length > 0) {
    lines.push("Fields:");
    for (const field of fields) {
      const details = [
        field.type ? `type=${field.type}` : null,
        field.required ? "required=yes" : "required=no",
        field.default !== undefined ? `default=${field.default}` : null,
        Array.isArray(field.options) && field.options.length > 0 ? `options=${field.options.join(",")}` : null
      ]
        .filter(Boolean)
        .join(" | ");
      lines.push(`  - ${field.id}: ${details}`);
      if (field.description) {
        lines.push(`    ${field.description}`);
      }
    }
  }

  return lines.join("\n");
}

function formatDiscoveryActionsBlock(payload) {
  const actions = Array.isArray(payload.actions) ? payload.actions : [];
  const lines = [`Supported: ${payload.supported ? "yes" : "no"}`];

  if (actions.length > 0) {
    lines.push("Actions:");
    for (const action of actions) {
      lines.push(`  - ${action.id}: ${action.description}`);
      const fields = Array.isArray(action.input?.fields) ? action.input.fields : [];
      if (fields.length > 0) {
        lines.push(
          `    Inputs: ${fields
            .map((field) => `${field.id} (${field.type}${field.required ? ", required" : ""})`)
            .join(", ")}`
        );
      }
    }
  }

  return lines.join("\n");
}

function formatDiscoveryActionResult(result) {
  if (result.actionId === "publish-preview") {
    const resolved = result.resolved || {};
    const lines = [
      `Action: ${result.actionId}`,
      `Account: ${result.account?.handle || "unknown"}`,
      `Valid: ${result.valid ? "yes" : "no"}`,
      `Interaction: ${result.input?.interactionType || "post"}`,
      `Asset count: ${Array.isArray(result.input?.assets) ? result.input.assets.length : (result.input?.mediaLink ? 1 : 0)}`,
      `Target mode: ${resolved.targetMode || "unknown"}`,
      `Media kind: ${resolved.mediaKind || "unknown"}`,
      `Publish shape: ${resolved.publishShape || "unknown"}`,
      `Media delivery: ${resolved.mediaDelivery || "unknown"}`
    ];

    if (resolved.effectiveSettings && Object.keys(resolved.effectiveSettings).length > 0) {
      lines.push(`Effective settings: ${JSON.stringify(resolved.effectiveSettings)}`);
    }

    if (result.error?.message) {
      lines.push(`Error: ${result.error.message}`);
    }

    if (Array.isArray(resolved.warnings) && resolved.warnings.length > 0) {
      lines.push("Warnings:");
      for (const item of resolved.warnings) {
        lines.push(`  - ${item}`);
      }
    }

    if (Array.isArray(resolved.notes) && resolved.notes.length > 0) {
      lines.push("Notes:");
      for (const item of resolved.notes) {
        lines.push(`  - ${item}`);
      }
    }

    return lines.join("\n");
  }

  if (result.actionId === "linked-targets") {
    const links = result.links || {};
    const lines = [
      `Action: ${result.actionId}`,
      `Account: ${result.account?.handle || "unknown"}`,
      `Current page: ${links.currentPage?.handle || "-"}`,
      `Current Instagram business: ${links.currentInstagramBusiness?.handle || "-"}`
    ];

    if (Array.isArray(links.linkedPages) && links.linkedPages.length > 0) {
      lines.push(`Linked pages: ${links.linkedPages.map((item) => item.handle).join(", ")}`);
    }

    if (Array.isArray(links.linkedInstagramAccounts) && links.linkedInstagramAccounts.length > 0) {
      lines.push(`Linked Instagram accounts: ${links.linkedInstagramAccounts.map((item) => item.handle).join(", ")}`);
    }

    if (Array.isArray(result.notes) && result.notes.length > 0) {
      lines.push("Notes:");
      for (const item of result.notes) {
        lines.push(`  - ${item}`);
      }
    }

    return lines.join("\n");
  }

  if (result.actionId === "subreddit-targets") {
    const subreddits = Array.isArray(result.subreddits) ? result.subreddits : [];
    const lines = [
      `Action: ${result.actionId}`,
      `Account: ${result.account?.handle || "unknown"}`,
      `Relationship: ${result.relationship || "subscriber"}`,
      `Results: ${subreddits.length}`
    ];

    if (result.listing?.after) {
      lines.push(`Next cursor: ${result.listing.after}`);
    }

    if (subreddits.length > 0) {
      lines.push("Subreddits:");
      for (const subreddit of subreddits) {
        lines.push(
          `  - r/${subreddit.name} | title=${subreddit.title || "-"} | subscribers=${subreddit.subscribers ?? "-"} | flair=${subreddit.linkFlairEnabled ? "yes" : "no"}`
        );
      }
    }

    if (Array.isArray(result.notes) && result.notes.length > 0) {
      lines.push("Notes:");
      for (const item of result.notes) {
        lines.push(`  - ${item}`);
      }
    }

    return lines.join("\n");
  }

  if (result.actionId === "post-requirements") {
    const lines = [
      `Action: ${result.actionId}`,
      `Account: ${result.account?.handle || "unknown"}`,
      `Subreddit: r/${result.subreddit || "-"}`,
      `Title length: ${result.summary?.titleMinLength ?? "-"}..${result.summary?.titleMaxLength ?? "-"}`,
      `Body restriction: ${result.summary?.bodyRestrictionPolicy || "-"}`,
      `Flair required: ${result.summary?.isFlairRequired === null ? "-" : (result.summary?.isFlairRequired ? "yes" : "no")}`
    ];

    if (Array.isArray(result.notes) && result.notes.length > 0) {
      lines.push("Notes:");
      for (const item of result.notes) {
        lines.push(`  - ${item}`);
      }
    }

    return lines.join("\n");
  }

  if (result.actionId === "link-flair-options") {
    const flairOptions = Array.isArray(result.flairOptions) ? result.flairOptions : [];
    const lines = [
      `Action: ${result.actionId}`,
      `Account: ${result.account?.handle || "unknown"}`,
      `Subreddit: r/${result.subreddit || "-"}`,
      `Available: ${result.available ? "yes" : "no"}`,
      `Flair options: ${flairOptions.length}`
    ];

    if (result.error?.message) {
      lines.push(`Error: ${result.error.message}`);
    }

    if (flairOptions.length > 0) {
      lines.push("Options:");
      for (const option of flairOptions) {
        lines.push(
          `  - ${option.id || "-"} | text=${option.text || "-"} | editable=${option.textEditable ? "yes" : "no"} | modOnly=${option.modOnly ? "yes" : "no"}`
        );
      }
    }

    if (Array.isArray(result.notes) && result.notes.length > 0) {
      lines.push("Notes:");
      for (const item of result.notes) {
        lines.push(`  - ${item}`);
      }
    }

    return lines.join("\n");
  }

  return JSON.stringify(result, null, 2);
}

function formatPostDetail(detail) {
  const post = detail.post || {};
  const lines = [
    `Post: ${post.id}`,
    `Run: ${post.runId}`,
    `Account: ${post.account}`,
    `Provider: ${post.provider}`,
    `Interaction: ${post.interactionType || "post"}`,
    `Status: ${post.status}`,
    `Publish at: ${post.publishAtUtc}`,
    `Published at: ${post.publishedAt || "-"}`,
    `Provider post id: ${post.providerPostId || "-"}`,
    `Parent step: ${post.parentStepId || "-"}`,
    `Resolved parent provider post id: ${post.resolvedParentProviderPostId || "-"}`,
    `Provider status: ${post.providerStatus || "-"}`,
    `Provider URL: ${post.providerUrl || "-"}`,
    `Assets: ${Array.isArray(post.assets) ? post.assets.length : (post.mediaLink ? 1 : 0)}`,
    `Attempts: ${post.attemptCount || 0}`
  ];

  if (post.lastError) {
    lines.push(`Last error: ${post.lastError}`);
  }

  if (detail.account?.displayName) {
    lines.push(`Connected account: ${detail.account.displayName} (${detail.account.handle})`);
  }

  if (detail.latestAttempt) {
    lines.push(
      `Latest attempt: #${detail.latestAttempt.attemptNo} ok=${detail.latestAttempt.ok ? "yes" : "no"} code=${detail.latestAttempt.code || "-"}`
    );
  }

  return lines.join("\n");
}

function formatRunDetail(detail) {
  const lines = [
    `Run: ${detail.run?.id || "unknown"}`,
    `Status: ${detail.run?.status || "unknown"}`,
    `Mode: ${detail.run?.mode || "scheduled"}`,
    `Model: ${detail.run?.sourceModel || "posts_v1"}`,
    `Posts: ${detail.summary?.total || 0}`,
    `Attempts: ${Array.isArray(detail.attempts) ? detail.attempts.length : 0}`
  ];

  return lines.join("\n");
}

function campaignGraphRows(graph) {
  const rows = [];

  for (const campaign of graph?.campaigns || []) {
    for (const target of campaign.targets || []) {
      for (const step of target.steps || []) {
        rows.push({
          campaign: campaign.name,
          campaignId: campaign.id,
          target: target.account || "-",
          provider: step.provider || target.provider || "-",
          interaction: step.interactionType || "post",
          step: step.sequencePosition || step.stepIndex + 1 || "-",
          stepId: step.id || "-",
          parentStepId: step.parentStepId || "-",
          publishAtUtc: step.publishAtUtc || "-",
          status: step.status || "-",
          assets: Array.isArray(step.assets) ? step.assets.length : (step.mediaLink ? 1 : 0),
          name: step.name || "-"
        });
      }
    }
  }

  return rows;
}

function formatCampaignGraph(graph, { label = "Campaign" } = {}) {
  return [
    `${label}: ${graph?.totalCampaigns || 0} campaign(s), ${graph?.totalTargets || 0} target(s), ${graph?.totalSteps || 0} step(s)`,
    `Mode: ${graph?.mode || "scheduled"} | Timezone: ${graph?.timezone || "UTC"} | Model: ${graph?.sourceModel || "campaigns_v2"}`,
    graph?.runId ? `Run: ${graph.runId} | Status: ${graph.runStatus || "-"}` : null
  ]
    .filter(Boolean)
    .join("\n");
}

function formatMetrics(metrics) {
  const keys = ["impressions", "reach", "views", "likes", "comments", "shares", "saves", "clicks"];
  return keys
    .map((key) => `${key}=${metrics?.[key] ?? "-"}`)
    .join(" | ");
}

function formatAnalyticsSnapshot(label, snapshot) {
  if (!snapshot) {
    return `${label}: no snapshot collected`;
  }

  return [
    `${label}: ${snapshot.status} | supported=${snapshot.supported ? "yes" : "no"} | window=${snapshot.metricWindow}`,
    `Collected: ${snapshot.collectedAt}`,
    `Metrics: ${formatMetrics(snapshot.metrics)}`,
    snapshot.message ? `Message: ${snapshot.message}` : null
  ]
    .filter(Boolean)
    .join("\n");
}

function formatWorkspaceHealth(health) {
  return [
    `Workspace: ${health.tenant?.name || "unknown"} (${health.tenant?.id || "-"})`,
    `Plan: ${health.tenant?.plan || "-"} | Subscription: ${health.tenant?.subscriptionStatus || "-"}`,
    `Connections: total=${health.connections?.total || 0} | publishable=${health.connections?.publishable || 0} | revoked=${health.connections?.revoked || 0}`,
    `Token refresh: ${JSON.stringify(health.connections?.tokenRefreshStatus || {})}`,
    `Runs: total=${health.runs?.total || 0} | statuses=${JSON.stringify(health.runs?.byStatus || {})}`,
    `Posts: total=${health.posts?.total || 0} | statuses=${JSON.stringify(health.posts?.byStatus || {})}`,
    `Jobs: total=${health.jobs?.total || 0} | ready=${health.jobs?.ready || 0} | blocked=${health.jobs?.blocked || 0} | failed=${health.jobs?.failed || 0} | stalled=${health.jobs?.stalled || 0}`,
    `Storage: assets=${health.storage?.assets || 0} | analyticsSnapshots=${health.storage?.analyticsSnapshots || 0}`
  ].join("\n");
}

function formatConnectionsHealth(payload) {
  return [
    `Workspace: ${payload.tenant?.name || "unknown"} (${payload.tenant?.id || "-"})`,
    `Connections: total=${payload.summary?.total || 0} | publishable=${payload.summary?.publishable || 0}`,
    `By provider: ${JSON.stringify(payload.summary?.byProvider || {})}`,
    `Token health: ${JSON.stringify(payload.summary?.tokenHealth || {})}`,
    `Token refresh: ${JSON.stringify(payload.summary?.tokenRefreshStatus || {})}`
  ].join("\n");
}

async function readOptionalJsonInput(args) {
  const hasBody = args.body !== undefined;
  const hasInput = args.input !== undefined;

  if (hasBody && hasInput) {
    throw new Error("Use either --body or --input, not both");
  }

  if (hasBody) {
    try {
      return JSON.parse(String(args.body));
    } catch {
      throw new Error("Failed to parse --body as JSON");
    }
  }

  if (hasInput) {
    const raw = await fs.readFile(String(args.input), "utf8");
    try {
      return JSON.parse(raw);
    } catch {
      throw new Error("Failed to parse --input file as JSON");
    }
  }

  return {};
}

async function withAuthConfig() {
  const config = await readConfig();
  if (!config?.apiKey) {
    const dashboardUrl = `${DEFAULT_BASE_URL.replace(/\/$/, "")}/dashboard`;
    console.error("No SocialClaw API key is configured.");
    console.error(`Open ${dashboardUrl}, sign in with Google, create an API key, then run:`);
    console.error(`  ${PRIMARY_COMMAND} login --api-key <key>`);
    process.exit(3);
  }
  return {
    apiKey: config.apiKey,
    baseUrl: config.baseUrl || DEFAULT_BASE_URL
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0];

  if (!command || args.help || args.h) {
    printUsage();
    process.exit(0);
  }

  try {
    if (command === "login") {
      const baseUrl = String(args["base-url"] || DEFAULT_BASE_URL);
      const apiKey = args["api-key"] ? String(args["api-key"]) : "";

      if (!apiKey) {
        const dashboardUrl = `${baseUrl.replace(/\/$/, "")}/dashboard`;
        if (args.json) {
          exitJson(0, {
            ok: true,
            action: "open_dashboard",
            dashboardUrl,
            message: "Sign in with Google, create an API key in the dashboard, then rerun login with --api-key."
          });
        }
        console.log(`Open ${dashboardUrl}`);
        console.log("Sign in with Google, create an API key, then rerun:");
        console.log(`  ${PRIMARY_COMMAND} login --api-key <key>`);
        openUrl(dashboardUrl);
        return;
      }

      const payload = await apiRequest("POST", "/v1/keys/validate", { apiKey, baseUrl });
      await saveConfig({ apiKey, baseUrl });

      if (args.json) {
        exitJson(0, { ok: true, message: "Logged in", tenant: payload.tenant, baseUrl });
      }

      console.log(`Connected to SocialClaw at ${baseUrl}`);
      console.log(`Workspace: ${payload.tenant.name}`);
      return;
    }

    if (command === "validate") {
      const filePath = requireArg(args, "file", "f");
      const auth = await withAuthConfig();
      const schedule = await readAndValidateScheduleFile(filePath);
      const response = await apiRequest("POST", "/v1/posts/validate", {
        ...auth,
        body: { schedule: schedule.parsed }
      });

      if (args.json) {
        exitJson(0, response);
      }

      const summary = response.totalCampaigns > 0
        ? `${response.totalCampaigns} campaign(s), ${response.totalPosts} post(s)`
        : `${response.totalPosts} post(s)`;
      console.log(`Schedule valid: ${summary} | mode=${response.mode} | model=${response.sourceModel}`);
      return;
    }

    if (command === "apply") {
      const filePath = requireArg(args, "file", "f");
      const auth = await withAuthConfig();
      const schedule = await readAndValidateScheduleFile(filePath);
      const idempotencyKey =
        String(args["idempotency-key"] || "").trim() || createId("run");

      const response = await apiRequest("POST", "/v1/posts/apply", {
        ...auth,
        body: {
          schedule: schedule.parsed,
          idempotencyKey
        }
      });

      if (args.json) {
        exitJson(0, response);
      }

      const noun = response.run.mode === "draft" ? "Draft run" : "Run";
      console.log(`${noun} ${response.run.id} created (${response.posts.length} post(s), model=${response.run.sourceModel})`);
      if (response.run.mode === "draft") {
        console.log(`Publish later with: ${PRIMARY_COMMAND} publish-draft --run-id ${response.run.id}`);
      }
      return;
    }

    if (command === "campaigns") {
      const subcommand = String(args._[1] || "").toLowerCase();
      const auth = await withAuthConfig();

      if (subcommand === "preview") {
        const filePath = requireArg(args, "file", "f");
        const schedule = await readAndValidateScheduleFile(filePath);
        const response = await apiRequest("POST", "/v1/campaigns/preview", {
          ...auth,
          body: { schedule: schedule.parsed }
        });

        if (args.json) {
          exitJson(0, response);
        }

        console.log(formatCampaignGraph(response.campaign, { label: "Campaign preview" }));
        console.log("");
        console.table(campaignGraphRows(response.campaign));
        return;
      }

      if (subcommand === "inspect") {
        const runId = requireArg(args, "run-id");
        const response = await apiRequest("GET", `/v1/runs/${runId}/campaign`, auth);

        if (args.json) {
          exitJson(0, response);
        }

        console.log(formatCampaignGraph(response.campaign, { label: "Stored campaign" }));
        console.log("");
        console.table(campaignGraphRows(response.campaign));
        return;
      }

      if (subcommand === "clone") {
        const runId = requireArg(args, "run-id");
        const response = await apiRequest("GET", `/v1/runs/${runId}/campaign`, auth);
        const payload = response.schedule;

        if (args.json) {
          exitJson(0, payload);
        }

        if (args.output) {
          await fs.writeFile(String(args.output), JSON.stringify(payload, null, 2));
          console.log(`Wrote ${args.output}`);
        } else {
          console.log(JSON.stringify(payload, null, 2));
        }
        return;
      }

      throw new Error(`Unknown campaigns subcommand: ${subcommand}`);
    }

    if (command === "publish-draft") {
      const runId = requireArg(args, "run-id");
      const auth = await withAuthConfig();
      const response = await apiRequest("POST", `/v1/runs/${runId}/publish`, {
        ...auth,
        body: {
          startAt: args["start-at"] ? String(args["start-at"]) : null
        }
      });

      if (args.json) {
        exitJson(0, response);
      }

      console.log(`Draft run ${response.run.id} published (${response.posts.length} post(s))`);
      return;
    }

    if (command === "posts") {
      const subcommand = String(args._[1] || "list").toLowerCase();
      const auth = await withAuthConfig();

      if (subcommand === "list") {
        const query = new URLSearchParams();
        if (args["run-id"]) {
          query.set("runId", String(args["run-id"]));
        }
        if (args.status) {
          query.set("status", String(args.status));
        }
        if (args.account) {
          query.set("account", String(args.account));
        }
        if (args.provider) {
          query.set("provider", String(args.provider));
        }
        if (args["campaign-id"]) {
          query.set("campaignId", String(args["campaign-id"]));
        }
        if (args.limit) {
          query.set("limit", String(args.limit));
        }

        const suffix = query.toString() ? `?${query.toString()}` : "";
        const response = await apiRequest("GET", `/v1/posts${suffix}`, auth);

        if (args.json) {
          exitJson(0, response);
        }

        console.table(
          (response.posts || []).map((post) => ({
            id: post.id,
            runId: post.runId,
            provider: post.provider,
            account: post.account,
            status: post.status,
            publishAtUtc: post.publishAtUtc,
            providerPostId: post.providerPostId || "-",
            attemptCount: post.attemptCount,
            campaign: post.campaignName || "-",
            step: post.sequencePosition || "-",
            name: post.name
          }))
        );
        return;
      }

      if (subcommand === "get") {
        const postId = requireArg(args, "post-id");
        const response = await apiRequest("GET", `/v1/posts/${postId}`, auth);

        if (args.json) {
          exitJson(0, response);
        }

        console.log(formatPostDetail(response));
        return;
      }

      if (subcommand === "attempts") {
        const postId = requireArg(args, "post-id");
        const response = await apiRequest("GET", `/v1/posts/${postId}/attempts`, auth);

        if (args.json) {
          exitJson(0, response);
        }

        if (!Array.isArray(response.attempts) || response.attempts.length === 0) {
          console.log(`No attempts recorded for post ${response.post.id}`);
          return;
        }

        console.log(formatAttemptTable(response.attempts));
        return;
      }

      if (subcommand === "reconcile") {
        const postId = requireArg(args, "post-id");
        const response = await apiRequest("POST", `/v1/posts/${postId}/reconcile`, auth);

        if (args.json) {
          exitJson(0, response);
        }

        console.log(
          `Reconciliation status: ${response.post.reconciliationStatus || "-"} | provider status: ${response.post.providerStatus || "-"}`
        );
        return;
      }

      throw new Error(`Unknown posts subcommand: ${subcommand}`);
    }

    if (command === "analytics") {
      const subcommand = String(args._[1] || "").toLowerCase();
      const auth = await withAuthConfig();
      const window = String(args.window || "lifetime");

      if (subcommand === "post") {
        const postId = requireArg(args, "post-id");
        const response = await apiRequest("GET", `/v1/analytics/posts/${postId}?window=${encodeURIComponent(window)}`, auth);

        if (args.json) {
          exitJson(0, response);
        }

        console.log(formatAnalyticsSnapshot(`Post ${response.post.id}`, response.latest));
        return;
      }

      if (subcommand === "account") {
        const accountId = requireArg(args, "account-id");
        const response = await apiRequest(
          "GET",
          `/v1/analytics/accounts/${accountId}?window=${encodeURIComponent(window)}`,
          auth
        );

        if (args.json) {
          exitJson(0, response);
        }

        console.log(formatAnalyticsSnapshot(`Account ${response.account.handle}`, response.snapshot));
        return;
      }

      if (subcommand === "run") {
        const runId = requireArg(args, "run-id");
        const response = await apiRequest(
          "GET",
          `/v1/analytics/runs/${runId}?window=${encodeURIComponent(window)}`,
          auth
        );

        if (args.json) {
          exitJson(0, response);
        }

        console.log(
          [
            `Run ${response.run.id} | status=${response.run.status} | window=${response.metricWindow}`,
            `Contributing posts: ${response.summary.contributingPostCount}/${response.summary.totalPosts}`,
            `Metrics: ${formatMetrics(response.summary.metrics)}`
          ].join("\n")
        );
        return;
      }

      if (subcommand === "refresh") {
        const postId = requireArg(args, "post-id");
        const response = await apiRequest("POST", "/v1/analytics/refresh", {
          ...auth,
          body: {
            postId,
            window
          }
        });

        if (args.json) {
          exitJson(0, response);
        }

        console.log(formatAnalyticsSnapshot(`Post ${response.post.id}`, response.snapshot));
        return;
      }

      throw new Error(`Unknown analytics subcommand: ${subcommand}`);
    }

    if (command === "runs") {
      const subcommand = String(args._[1] || "").toLowerCase();
      const auth = await withAuthConfig();

      if (subcommand === "inspect") {
        const runId = requireArg(args, "run-id");
        const response = await apiRequest("GET", `/v1/runs/${runId}`, auth);

        if (args.json) {
          exitJson(0, response);
        }

        console.log(formatRunDetail(response));
        console.log("");
        console.table(
          (response.posts || []).map((post) => ({
            id: post.id,
            account: post.account,
            status: post.status,
            publishAtUtc: post.publishAtUtc,
            providerPostId: post.providerPostId || "-",
            attemptCount: post.attemptCount,
            campaign: post.campaignName || "-",
            step: post.sequencePosition || "-"
          }))
        );
        return;
      }

      throw new Error(`Unknown runs subcommand: ${subcommand}`);
    }

    if (command === "status") {
      const runId = requireArg(args, "run-id");
      const auth = await withAuthConfig();
      const response = await apiRequest("GET", `/v1/runs/${runId}/status`, auth);

      if (args.json) {
        exitJson(0, response);
      }

      console.log(`Run ${response.run.id} | status=${response.run.status} | mode=${response.run.mode || "scheduled"} | model=${response.run.sourceModel || "posts_v1"}`);
      console.log(response.summary);
      return;
    }

    if (command === "retry") {
      const postId = requireArg(args, "post-id");
      const auth = await withAuthConfig();
      const response = await apiRequest("POST", `/v1/posts/${postId}/retry`, auth);
      if (args.json) {
        exitJson(0, response);
      }
      console.log(`Post ${response.post.id} queued for retry`);
      return;
    }

    if (command === "cancel") {
      const postId = requireArg(args, "post-id");
      const auth = await withAuthConfig();
      const response = await apiRequest("DELETE", `/v1/posts/${postId}`, auth);
      if (args.json) {
        exitJson(0, response);
      }
      console.log(`Post ${response.post.id} canceled`);
      return;
    }

    if (command === "usage") {
      const auth = await withAuthConfig();
      const response = await apiRequest("GET", "/v1/me/usage", auth);
      if (args.json) {
        exitJson(0, response);
      }
      console.log(response.usage);
      return;
    }

    if (command === "workspace") {
      const subcommand = String(args._[1] || "").toLowerCase();
      const auth = await withAuthConfig();

      if (subcommand === "health") {
        const response = await apiRequest("GET", "/v1/workspace/health", auth);
        if (args.json) {
          exitJson(0, response);
        }

        console.log(formatWorkspaceHealth(response.health));
        return;
      }

      throw new Error(`Unknown workspace subcommand: ${subcommand}`);
    }

    if (command === "connections") {
      const subcommand = String(args._[1] || "").toLowerCase();
      const auth = await withAuthConfig();

      if (subcommand === "health") {
        const query = new URLSearchParams();
        if (args.provider) {
          query.set("provider", String(args.provider));
        }
        const suffix = query.toString() ? `?${query.toString()}` : "";
        const response = await apiRequest("GET", `/v1/connections/health${suffix}`, auth);
        if (args.json) {
          exitJson(0, response);
        }

        console.log(formatConnectionsHealth(response));
        console.log("");
        console.table(
          (response.connections || []).map((connection) => ({
            id: connection.id,
            provider: connection.provider,
            handle: connection.handle,
            publishable: connection.publishable ? "yes" : "no",
            tokenHealth: connection.tokenHealth,
            tokenRefresh: connection.tokenRefreshStatus,
            refreshCode: connection.tokenRefreshFailureCode || "-",
            interactionTypes: (connection.supportedInteractionTypes || []).join(","),
            expiresAt: connection.expiresAt || "-"
          }))
        );
        return;
      }

      throw new Error(`Unknown connections subcommand: ${subcommand}`);
    }

    if (command === "jobs") {
      const subcommand = String(args._[1] || "list").toLowerCase();
      const auth = await withAuthConfig();

      if (subcommand === "list") {
        const query = new URLSearchParams();
        if (args.status) {
          query.set("status", String(args.status));
        }
        if (args.provider) {
          query.set("provider", String(args.provider));
        }
        if (args.account) {
          query.set("account", String(args.account));
        }
        if (args["run-id"]) {
          query.set("runId", String(args["run-id"]));
        }
        if (args.limit) {
          query.set("limit", String(args.limit));
        }
        const suffix = query.toString() ? `?${query.toString()}` : "";
        const response = await apiRequest("GET", `/v1/jobs${suffix}`, auth);
        if (args.json) {
          exitJson(0, response);
        }

        console.table(
          (response.jobs || []).map((job) => ({
            postId: job.postId,
            runId: job.runId,
            provider: job.provider,
            account: job.account,
            status: job.status,
            jobState: job.jobState,
            nextAction: job.nextAction,
            tokenHealth: job.accountTokenHealth,
            tokenRefresh: job.tokenRefreshStatus,
            latestCode: job.latestAttempt?.code || "-",
            interaction: job.interactionType,
            stepId: job.stepId || "-",
            parentStepId: job.parentStepId || "-",
            nextAttemptAt: job.nextAttemptAt || "-",
            publishAtUtc: job.publishAtUtc || "-"
          }))
        );
        return;
      }

      throw new Error(`Unknown jobs subcommand: ${subcommand}`);
    }

    if (command === "view") {
      const runId = requireArg(args, "run-id");
      const format = String(args.format || "terminal").toLowerCase();
      const output = args.output ? String(args.output) : null;
      const auth = await withAuthConfig();
      const response = await apiRequest("GET", `/v1/runs/${runId}/table`, auth);

      if (format === "terminal") {
        const table = formatTimelineTable(response.rows);
        console.log(table);
        if (args.json) {
          exitJson(0, response);
        }
        return;
      }

      if (format === "html") {
        const html = timelineHtml(response.run, response.rows);
        if (output) {
          await fs.writeFile(output, html);
          console.log(`Wrote ${output}`);
        } else {
          console.log(html);
        }
        if (args.json) {
          exitJson(0, response);
        }
        return;
      }

      throw new Error(`Unsupported format: ${format}`);
    }

    if (command === "assets") {
      const subcommand = String(args._[1] || "upload").toLowerCase();
      const auth = await withAuthConfig();

      if (subcommand === "upload") {
        const filePath = requireArg(args, "file", "f");
        const fileBuffer = await fs.readFile(filePath);
        const filename = path.basename(filePath);
        const response = await apiRequest("POST", "/v1/assets/upload", {
          ...auth,
          body: {
            filename,
            mime: inferAssetMimeType(filename),
            contentBase64: fileBuffer.toString("base64")
          }
        });

        if (args.json) {
          exitJson(0, response);
        }

        console.log(`Uploaded asset ${response.asset.id}`);
        console.log(`Storage: ${response.asset.storage}`);
        console.log(`Public URL: ${response.asset.publicUrl}`);
        console.log(`Use as media_link: ${response.asset.useAsMediaLink}`);
        return;
      }

      if (subcommand === "delete") {
        const assetId = requireArg(args, "asset-id");
        const retentionDays = Number(args["retention-days"] || 7);
        const response = await apiRequest("DELETE", `/v1/assets/${assetId}`, {
          ...auth,
          body: { retentionDays }
        });

        if (args.json) {
          exitJson(0, response);
        }

        console.log(`Marked asset ${response.asset.id} for deletion after ${response.asset.deleteAfter}`);
        return;
      }

      throw new Error(`Unknown assets subcommand: ${subcommand}`);
    }

    if (command === "accounts") {
      const subcommand = String(args._[1] || "list").toLowerCase();
      const auth = await withAuthConfig();

      if (subcommand === "list") {
        const provider = args.provider ? `?provider=${encodeURIComponent(String(args.provider))}` : "";
        const response = await apiRequest("GET", `/v1/accounts${provider}`, auth);
        if (args.json) {
          exitJson(0, response);
        }
        console.table(response.accounts || []);
        return;
      }

      if (subcommand === "capabilities") {
        const accountId = args["account-id"] ? String(args["account-id"]) : null;

        if (accountId) {
          const response = await apiRequest("GET", `/v1/accounts/${accountId}/capabilities`, auth);
          if (args.json) {
            exitJson(0, response);
          }
          console.log(formatCapabilityBlock(response.capabilities));
          return;
        }

        const provider = args.provider ? `?provider=${encodeURIComponent(String(args.provider))}` : "";
        const response = await apiRequest("GET", `/v1/accounts/capabilities${provider}`, auth);
        if (args.json) {
          exitJson(0, response);
        }

        const capabilities = response.capabilities || [];
        if (capabilities.length === 0) {
          console.log("No connected accounts found.");
          return;
        }

        console.log(capabilities.map(formatCapabilityBlock).join("\n\n"));
        return;
      }

      if (subcommand === "settings") {
        const accountId = requireArg(args, "account-id");
        const response = await apiRequest("GET", `/v1/accounts/${accountId}/settings`, auth);
        if (args.json) {
          exitJson(0, response);
        }

        console.log(formatPublishSettingsBlock(response.publishSettings));
        return;
      }

      if (subcommand === "actions") {
        const accountId = requireArg(args, "account-id");
        const response = await apiRequest("GET", `/v1/accounts/${accountId}/actions`, auth);
        if (args.json) {
          exitJson(0, response);
        }

        console.log(formatDiscoveryActionsBlock(response.actions));
        return;
      }

      if (subcommand === "action") {
        const accountId = requireArg(args, "account-id");
        const actionId = requireArg(args, "action");
        const body = await readOptionalJsonInput(args);
        const response = await apiRequest("POST", `/v1/accounts/${accountId}/actions/${actionId}`, {
          ...auth,
          body
        });
        if (args.json) {
          exitJson(0, response);
        }

        console.log(formatDiscoveryActionResult(response.result));
        return;
      }

      if (subcommand === "connect") {
        const provider = requireArg(args, "provider");
        const body = { provider };

        if (provider === "telegram") {
          body.botToken = requireArg(args, "bot-token");
          body.chatId = requireArg(args, "chat-id");
        } else if (provider === "discord") {
          body.webhookUrl = requireArg(args, "webhook-url");
        }

        const response = await apiRequest("POST", "/v1/connections/start", {
          ...auth,
          body
        });

        if (args.open && response.connection.authorizationUrl) {
          openUrl(response.connection.authorizationUrl);
        }

        if (args.json) {
          exitJson(0, response);
        }

        console.log(`Connection ID: ${response.connection.id}`);
        console.log(`Provider: ${response.connection.provider}`);
        if (response.connection.authorizationUrl) {
          console.log(`Open URL: ${response.connection.authorizationUrl}`);
        }
        if (provider === "telegram") {
          const account = Array.isArray(response.accounts) ? response.accounts[0] : null;
          if (account) {
            console.log(`Connected account: ${account.displayName} (${account.handle})`);
          }
          console.log("Telegram was connected directly using the supplied bot token and chat target.");
        } else if (provider === "discord") {
          const account = Array.isArray(response.accounts) ? response.accounts[0] : null;
          if (account) {
            console.log(`Connected account: ${account.displayName} (${account.handle})`);
          }
          console.log("Discord was connected directly using the supplied channel webhook URL.");
        } else if (!args.open) {
          console.log("Tip: add --open to launch browser automatically.");
        }
        return;
      }

      if (subcommand === "status") {
        const connectionId = requireArg(args, "connection-id");
        const response = await apiRequest("GET", `/v1/connections/${connectionId}`, auth);
        if (args.json) {
          exitJson(0, response);
        }
        console.log(response.connection);
        return;
      }

      if (subcommand === "disconnect") {
        const accountId = requireArg(args, "account-id");
        const response = await apiRequest("DELETE", `/v1/accounts/${accountId}`, auth);
        if (args.json) {
          exitJson(0, response);
        }
        console.log(`Disconnected account ${response.account.id}`);
        return;
      }

      throw new Error(`Unknown accounts subcommand: ${subcommand}`);
    }

    if (command === "install") {
      const target = args.claude ? "claude" : null;
      if (!target) {
        console.error("Usage: socialclaw install --claude");
        process.exit(2);
      }

      const pkgDir = new URL("..", import.meta.url).pathname;
      const skillSrc = path.join(pkgDir, "skill", "claude", "socialclaw.md");
      const destDir = path.join(os.homedir(), ".claude", "commands");
      const destFile = path.join(destDir, "socialclaw.md");

      await fs.mkdir(destDir, { recursive: true });
      await fs.copyFile(skillSrc, destFile);

      console.log(`SocialClaw skill installed for Claude Code.`);
      console.log(`Location: ${destFile}`);
      console.log(`Use /socialclaw in any Claude Code session to activate it.`);
      return;
    }

    console.error(`Unknown command: ${command}`);
    printUsage();
    process.exit(2);
  } catch (error) {
    const payload = error.payload || {
      ok: false,
      code: "cli_error",
      message: error.message || "CLI execution failed"
    };

    const isAuth = payload.code === "api_key_invalid" || payload.code === "auth_missing";
    const isSubscription = [
      "plan_required",
      "subscription_inactive",
      "subscription_past_due",
      "subscription_paused",
      "subscription_canceled"
    ].includes(payload.code);
    const exitCode = isAuth ? 3 : isSubscription ? 4 : 6;

    if (args.json) {
      exitJson(exitCode, payload);
    }

    console.error(`Error: ${payload.message || error.message}`);
    if (payload.code) {
      console.error(`Code: ${payload.code}`);
    }
    if (isSubscription && payload.details?.upgradePath) {
      console.error(`Upgrade: ${payload.details.upgradePath}`);
    }
    process.exit(exitCode);
  }
}

main();
