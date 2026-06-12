// Synced from ../socialclaw via tools/sync-public-cli.mjs. Edit the private repo, then re-run this sync.
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import readline from "node:readline";
import { createId } from "./lib/ids.mjs";
import { inferAssetMimeType } from "./lib/mime.mjs";

const CONFIG_PATH = path.join(os.homedir(), ".socialclaw", "config.json");
const DEFAULT_BASE_URL = process.env.SC_BASE_URL || "https://getsocialclaw.com";
const SERVER_NAME = "socialclaw";
const SERVER_VERSION = "0.1.6";
const PROTOCOL_VERSION = "2025-06-18";
const SUPPORTED_PROTOCOL_VERSIONS = new Set(["2024-11-05", "2025-03-26", "2025-06-18"]);

const SCHEDULE_INPUT_SCHEMA = {
  type: "object",
  description:
    "SocialClaw schedule document. Minimal shape: { timezone, posts: [{ account, name, description, publish_at, media_link? }] }. Campaign documents use { timezone, campaigns: [...] }.",
  additionalProperties: true
};

const TOOLS = [
  {
    name: "list_accounts",
    description:
      "List connected social accounts in the SocialClaw workspace. Optionally filter by provider (x, facebook, instagram_business, instagram, linkedin, linkedin_page, pinterest, tiktok, telegram, discord, youtube, reddit, wordpress).",
    inputSchema: {
      type: "object",
      properties: {
        provider: { type: "string", description: "Optional provider filter." }
      }
    },
    run: async (api, input) => {
      const suffix = input.provider ? `?provider=${encodeURIComponent(input.provider)}` : "";
      return api("GET", `/v1/accounts${suffix}`);
    }
  },
  {
    name: "account_capabilities",
    description:
      "Get publish capabilities and provider rules for connected accounts: what media is allowed, text limits, and whether publishing is currently possible. Pass accountId for one account, or provider to filter, or neither for all.",
    inputSchema: {
      type: "object",
      properties: {
        accountId: { type: "string", description: "Optional account id." },
        provider: { type: "string", description: "Optional provider filter." }
      }
    },
    run: async (api, input) => {
      if (input.accountId) {
        return api("GET", `/v1/accounts/${encodeURIComponent(input.accountId)}/capabilities`);
      }
      const suffix = input.provider ? `?provider=${encodeURIComponent(input.provider)}` : "";
      return api("GET", `/v1/accounts/capabilities${suffix}`);
    }
  },
  {
    name: "connect_account",
    description:
      "Start connecting a new social account. For OAuth providers this returns an authorizeUrl the user must open in a browser. Telegram requires botToken and chatId; Discord requires webhookUrl.",
    inputSchema: {
      type: "object",
      properties: {
        provider: { type: "string", description: "Provider to connect." },
        botToken: { type: "string", description: "Telegram bot token (telegram only)." },
        chatId: { type: "string", description: "Telegram chat target, e.g. @yourchannel (telegram only)." },
        webhookUrl: { type: "string", description: "Discord channel webhook URL (discord only)." }
      },
      required: ["provider"]
    },
    run: async (api, input) => {
      const body = { provider: input.provider };
      if (input.botToken) body.botToken = input.botToken;
      if (input.chatId) body.chatId = input.chatId;
      if (input.webhookUrl) body.webhookUrl = input.webhookUrl;
      return api("POST", "/v1/connections/start", body);
    }
  },
  {
    name: "upload_asset",
    description:
      "Upload a local media file (image or video) to SocialClaw hosted storage. Returns an asset id and a public URL that can be used as media_link in schedules.",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Absolute or relative path to the media file." }
      },
      required: ["filePath"]
    },
    run: async (api, input) => {
      const fileBuffer = await fs.readFile(String(input.filePath));
      const filename = path.basename(String(input.filePath));
      return api("POST", "/v1/assets/upload", {
        filename,
        mime: inferAssetMimeType(filename),
        contentBase64: fileBuffer.toString("base64")
      });
    }
  },
  {
    name: "validate_schedule",
    description:
      "Validate a schedule document against provider rules, media limits, account state, and publish times WITHOUT creating any posts. Always run this before apply_schedule.",
    inputSchema: {
      type: "object",
      properties: { schedule: SCHEDULE_INPUT_SCHEMA },
      required: ["schedule"]
    },
    run: async (api, input) => api("POST", "/v1/posts/validate", { schedule: input.schedule })
  },
  {
    name: "preview_campaign",
    description:
      "Preview how a campaign schedule document expands into concrete posts and steps without creating anything.",
    inputSchema: {
      type: "object",
      properties: { schedule: SCHEDULE_INPUT_SCHEMA },
      required: ["schedule"]
    },
    run: async (api, input) => api("POST", "/v1/campaigns/preview", { schedule: input.schedule })
  },
  {
    name: "apply_schedule",
    description:
      "Create a publishing run from a schedule document. Posts are scheduled or published through connected accounts. Send an idempotencyKey so retries do not create duplicate runs; one is generated when omitted.",
    inputSchema: {
      type: "object",
      properties: {
        schedule: SCHEDULE_INPUT_SCHEMA,
        idempotencyKey: { type: "string", description: "Stable key to deduplicate retries." }
      },
      required: ["schedule"]
    },
    run: async (api, input) =>
      api("POST", "/v1/posts/apply", {
        schedule: input.schedule,
        idempotencyKey: String(input.idempotencyKey || "").trim() || createId("run")
      })
  },
  {
    name: "publish_draft",
    description: "Publish a previously created draft run, optionally at a given ISO-8601 start time.",
    inputSchema: {
      type: "object",
      properties: {
        runId: { type: "string", description: "Draft run id." },
        startAt: { type: "string", description: "Optional ISO-8601 publish start time." }
      },
      required: ["runId"]
    },
    run: async (api, input) =>
      api(
        "POST",
        `/v1/runs/${encodeURIComponent(input.runId)}/publish`,
        input.startAt ? { startAt: input.startAt } : {}
      )
  },
  {
    name: "list_posts",
    description: "List posts in the workspace with optional filters.",
    inputSchema: {
      type: "object",
      properties: {
        runId: { type: "string" },
        status: { type: "string", description: "e.g. scheduled, published, failed, canceled." },
        account: { type: "string", description: "Account handle filter." },
        provider: { type: "string" },
        campaignId: { type: "string" },
        limit: { type: "number" }
      }
    },
    run: async (api, input) => {
      const params = new URLSearchParams();
      if (input.runId) params.set("runId", String(input.runId));
      if (input.status) params.set("status", String(input.status));
      if (input.account) params.set("account", String(input.account));
      if (input.provider) params.set("provider", String(input.provider));
      if (input.campaignId) params.set("campaignId", String(input.campaignId));
      if (input.limit) params.set("limit", String(input.limit));
      const suffix = params.size > 0 ? `?${params}` : "";
      return api("GET", `/v1/posts${suffix}`);
    }
  },
  {
    name: "get_post",
    description: "Get one post including its delivery state and provider identifiers.",
    inputSchema: {
      type: "object",
      properties: { postId: { type: "string" } },
      required: ["postId"]
    },
    run: async (api, input) => api("GET", `/v1/posts/${encodeURIComponent(input.postId)}`)
  },
  {
    name: "post_attempts",
    description: "List publish attempts for a post, including provider errors. Use this to debug failed posts.",
    inputSchema: {
      type: "object",
      properties: { postId: { type: "string" } },
      required: ["postId"]
    },
    run: async (api, input) => api("GET", `/v1/posts/${encodeURIComponent(input.postId)}/attempts`)
  },
  {
    name: "retry_post",
    description: "Retry a failed post.",
    inputSchema: {
      type: "object",
      properties: { postId: { type: "string" } },
      required: ["postId"]
    },
    run: async (api, input) => api("POST", `/v1/posts/${encodeURIComponent(input.postId)}/retry`)
  },
  {
    name: "cancel_post",
    description: "Cancel a scheduled post before it publishes.",
    inputSchema: {
      type: "object",
      properties: { postId: { type: "string" } },
      required: ["postId"]
    },
    run: async (api, input) => api("DELETE", `/v1/posts/${encodeURIComponent(input.postId)}`)
  },
  {
    name: "run_status",
    description: "Get the status summary of a publishing run and its posts.",
    inputSchema: {
      type: "object",
      properties: { runId: { type: "string" } },
      required: ["runId"]
    },
    run: async (api, input) => api("GET", `/v1/runs/${encodeURIComponent(input.runId)}/status`)
  },
  {
    name: "get_analytics",
    description:
      "Get analytics snapshots for a post, an account, or a run. scope must be post, account, or run; id is the matching identifier.",
    inputSchema: {
      type: "object",
      properties: {
        scope: { type: "string", enum: ["post", "account", "run"] },
        id: { type: "string" },
        window: { type: "string", description: "Optional analytics window, e.g. 7d." }
      },
      required: ["scope", "id"]
    },
    run: async (api, input) => {
      const window = input.window ? `?window=${encodeURIComponent(input.window)}` : "";
      const scopePath = { post: "posts", account: "accounts", run: "runs" }[input.scope];
      if (!scopePath) throw new Error("scope must be post, account, or run");
      return api("GET", `/v1/analytics/${scopePath}/${encodeURIComponent(input.id)}${window}`);
    }
  },
  {
    name: "workspace_usage",
    description: "Get workspace usage counters and plan entitlement consumption.",
    inputSchema: { type: "object", properties: {} },
    run: async (api) => api("GET", "/v1/me/usage")
  },
  {
    name: "workspace_health",
    description:
      "Get workspace health, including connection state across providers. Pass provider to check one provider's connections.",
    inputSchema: {
      type: "object",
      properties: {
        provider: { type: "string", description: "Optional provider to check connection health for." }
      }
    },
    run: async (api, input) => {
      if (input.provider) {
        return api("GET", `/v1/connections/health?provider=${encodeURIComponent(input.provider)}`);
      }
      return api("GET", "/v1/workspace/health");
    }
  }
];

async function resolveAuth() {
  const envKey = String(process.env.SOCIALCLAW_API_KEY || process.env.SC_API_KEY || "").trim();
  const envBase = String(process.env.SOCIALCLAW_BASE_URL || process.env.SC_BASE_URL || "").trim();
  if (envKey) {
    return { apiKey: envKey, baseUrl: envBase || DEFAULT_BASE_URL };
  }
  try {
    const raw = await fs.readFile(CONFIG_PATH, "utf8");
    const config = JSON.parse(raw);
    if (config?.apiKey) {
      return { apiKey: config.apiKey, baseUrl: envBase || config.baseUrl || DEFAULT_BASE_URL };
    }
  } catch {
    // fall through to the error below
  }
  throw new Error(
    `No SocialClaw API key found. Set SOCIALCLAW_API_KEY, or run \`socialclaw login --api-key <key>\`. Create a key at ${DEFAULT_BASE_URL}/dashboard.`
  );
}

function makeApiClient({ apiKey, baseUrl }) {
  return async function api(method, endpoint, body) {
    const url = `${baseUrl.replace(/\/$/, "")}${endpoint}`;
    const response = await fetch(url, {
      method,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`
      },
      body: body ? JSON.stringify(body) : undefined
    });
    let payload;
    try {
      payload = await response.json();
    } catch {
      payload = { ok: false, code: "invalid_response", message: "API returned non-JSON response" };
    }
    if (!response.ok) {
      const error = new Error(payload.message || `Request failed (${response.status})`);
      error.payload = payload;
      throw error;
    }
    return payload;
  };
}

function jsonRpcResult(id, result) {
  return { jsonrpc: "2.0", id, result };
}

function jsonRpcError(id, code, message) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

function toolResult(value) {
  return {
    content: [{ type: "text", text: JSON.stringify(value, null, 2) }]
  };
}

function toolError(message, payload) {
  const body = payload ? `${message}\n${JSON.stringify(payload, null, 2)}` : message;
  return {
    content: [{ type: "text", text: body }],
    isError: true
  };
}

export async function runMcpServer() {
  const write = (message) => {
    process.stdout.write(`${JSON.stringify(message)}\n`);
  };

  let apiClient = null;
  const getApi = async () => {
    if (!apiClient) {
      apiClient = makeApiClient(await resolveAuth());
    }
    return apiClient;
  };

  const handle = async (message) => {
    const { id, method, params } = message;
    const isNotification = id === undefined || id === null;

    if (method === "initialize") {
      const requested = params?.protocolVersion;
      write(
        jsonRpcResult(id, {
          protocolVersion: SUPPORTED_PROTOCOL_VERSIONS.has(requested) ? requested : PROTOCOL_VERSION,
          capabilities: { tools: {} },
          serverInfo: {
            name: SERVER_NAME,
            version: SERVER_VERSION,
            title: "SocialClaw"
          },
          instructions:
            "SocialClaw publishes social media posts through connected workspace accounts on X, LinkedIn, Instagram, Facebook Pages, TikTok, Discord, Telegram, YouTube, Reddit, WordPress, and Pinterest. Typical flow: list_accounts -> account_capabilities -> upload_asset (optional) -> validate_schedule -> apply_schedule -> run_status."
        })
      );
      return;
    }

    if (isNotification) {
      return;
    }

    if (method === "ping") {
      write(jsonRpcResult(id, {}));
      return;
    }

    if (method === "tools/list") {
      write(
        jsonRpcResult(id, {
          tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema }))
        })
      );
      return;
    }

    if (method === "tools/call") {
      const toolName = params?.name;
      const tool = TOOLS.find((candidate) => candidate.name === toolName);
      if (!tool) {
        write(jsonRpcError(id, -32602, `Unknown tool: ${toolName}`));
        return;
      }
      try {
        const api = await getApi();
        const result = await tool.run(api, params?.arguments || {});
        write(jsonRpcResult(id, toolResult(result)));
      } catch (error) {
        write(jsonRpcResult(id, toolError(error?.message || "Tool call failed", error?.payload)));
      }
      return;
    }

    write(jsonRpcError(id, -32601, `Method not found: ${method}`));
  };

  const rl = readline.createInterface({ input: process.stdin, terminal: false });
  rl.on("line", (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    let message;
    try {
      message = JSON.parse(trimmed);
    } catch {
      write(jsonRpcError(null, -32700, "Parse error"));
      return;
    }
    handle(message).catch((error) => {
      if (message?.id !== undefined && message?.id !== null) {
        write(jsonRpcError(message.id, -32603, error?.message || "Internal error"));
      }
    });
  });

  await new Promise((resolve) => {
    rl.on("close", resolve);
  });
}
