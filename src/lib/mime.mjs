// Synced from ../socialclaw via tools/sync-public-cli.mjs. Edit the private repo, then re-run this sync.
import path from "node:path";

const MIME_BY_EXTENSION = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".m4v": "video/x-m4v"
};

export function inferAssetMimeType(filename, fallback = "application/octet-stream") {
  const ext = path.extname(String(filename || "")).toLowerCase();
  return MIME_BY_EXTENSION[ext] || fallback;
}
