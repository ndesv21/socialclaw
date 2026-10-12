// Build the focused Claude directory bundle from the public package sources.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'plugins/socialclaw');
for (const dir of ['.claude-plugin', 'skills/socialclaw']) mkdirSync(resolve(out, dir), { recursive: true });
const manifest = JSON.parse(readFileSync(resolve(root, '.claude-plugin/plugin.json'), 'utf8'));
manifest.icon = './logo.png';
writeFileSync(resolve(out, '.claude-plugin/plugin.json'), JSON.stringify(manifest, null, 2) + '\n');
for (const file of ['.mcp.json', 'LICENSE', 'skills/socialclaw/SKILL.md']) copyFileSync(resolve(root, file), resolve(out, file));
copyFileSync(resolve(root, '.github/readme/logo.png'), resolve(out, 'logo.png'));
console.log('Built plugins/socialclaw (README maintained in that folder).');
