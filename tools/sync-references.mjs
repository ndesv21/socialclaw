#!/usr/bin/env node
// Copies reference files from skill/references/ (canonical, OpenClaw source)
// into skills/socialclaw/references/ (Claude Code plugin copy).
// Run after editing any reference file to keep both in sync.

import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { resolve, dirname, basename } from "path";
import { fileURLToPath } from "url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const src = resolve(root, "skill/references");
const dst = resolve(root, "skills/socialclaw/references");

const files = readdirSync(src).filter((f) => f.endsWith(".md"));

for (const file of files) {
  const srcPath = resolve(src, file);
  const dstPath = resolve(dst, file);
  const content = readFileSync(srcPath, "utf8");
  writeFileSync(dstPath, content);
  console.log(`Synced ${file}`);
}

console.log(`Done — synced ${files.length} file(s) from skill/references/ → skills/socialclaw/references/`);
