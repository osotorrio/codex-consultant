import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const pluginRoot = join(process.cwd(), 'plugins/codex-consultant');
const manifestPath = join(pluginRoot, '.codex-plugin/plugin.json');
const marketplacePath = join(process.cwd(), '.agents/plugins/marketplace.json');
const skillPath = join(pluginRoot, 'skills/codex-consultant/SKILL.md');

test('plugin manifest follows the expected local plugin shape', () => {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  assert.equal(manifest.name, 'codex-consultant');
  assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
  assert.equal(manifest.skills, './skills/');
  assert.equal(manifest.author.name, 'Codex Consultant');
  assert.equal(manifest.interface.displayName, 'Codex Consultant');
  assert.equal(manifest.interface.category, 'Productivity');
  assert.equal(existsSync(join(pluginRoot, manifest.skills)), true);
  assert.equal(JSON.stringify(manifest).includes('[TODO:'), false);
});

test('repo marketplace points at the local plugin', () => {
  const marketplace = JSON.parse(readFileSync(marketplacePath, 'utf8'));
  const entry = marketplace.plugins.find((plugin) => plugin.name === 'codex-consultant');
  assert.ok(entry);
  assert.equal(entry.source.source, 'local');
  assert.equal(entry.source.path, './plugins/codex-consultant');
  assert.equal(entry.policy.installation, 'AVAILABLE');
  assert.equal(entry.policy.authentication, 'ON_INSTALL');
  assert.equal(entry.category, 'Productivity');
});

test('skill declares read-only project behavior and outside-repo state', () => {
  const skill = readFileSync(skillPath, 'utf8');
  assert.match(skill, /Never create, modify, move, or delete files in the target project/);
  assert.match(skill, /\$CODEX_HOME\/codex-consultant/);
  assert.match(skill, /consultant-audit\.mjs inventory/);
  assert.match(skill, /save-report\.mjs/);
  assert.equal(skill.includes('[TODO:'), false);
});
