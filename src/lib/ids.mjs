// Synced from ../socialclaw via tools/sync-public-cli.mjs. Edit the private repo, then re-run this sync.
import crypto from "node:crypto";

export function createId(prefix) {
  const rand = crypto.randomBytes(6).toString("hex");
  return `${prefix}_${Date.now().toString(36)}_${rand}`;
}

export function hashSecret(secret) {
  return crypto.createHash("sha256").update(secret).digest("hex");
}

export function createApiKey(prefix = "sc_live") {
  const value = crypto.randomBytes(24).toString("base64url");
  return `${prefix}_${value}`;
}
