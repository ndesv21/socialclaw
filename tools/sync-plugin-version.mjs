#!/usr/bin/env node
// Reads version from package.json and writes it to .claude-plugin/plugin.json
// and .claude-plugin/marketplace.json. Run via `npm version` lifecycle or manually.

import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const { version } = pkg;

function syncJson(filePath) {
  const data = JSON.parse(readFileSync(filePath, "utf8"));
  let changed = false;

  if (data.version !== version) {
    data.version = version;
    changed = true;
  }

  // marketplace.json: also update version inside plugins[]
  if (Array.isArray(data.plugins)) {
    for (const plugin of data.plugins) {
      if (plugin.version !== version) {
        plugin.version = version;
        changed = true;
      }
    }
  }

  if (changed) {
    writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n");
    console.log(`Updated ${filePath.replace(root + "/", "")} → ${version}`);
  } else {
    console.log(`${filePath.replace(root + "/", "")} already at ${version}`);
  }
}

syncJson(resolve(root, ".claude-plugin/plugin.json"));
syncJson(resolve(root, ".claude-plugin/marketplace.json"));
