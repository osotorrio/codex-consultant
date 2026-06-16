import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const auditScript = join(
  process.cwd(),
  'plugins/codex-consultant/scripts/consultant-audit.mjs'
);
const reportScript = join(
  process.cwd(),
  'plugins/codex-consultant/scripts/save-report.mjs'
);

function makeFixture() {
  const root = mkdtempSync(join(tmpdir(), 'codex-consultant-'));
  const project = join(root, 'project');
  const stateRoot = join(root, 'state');
  const codexHome = join(root, 'codex-home');
  mkdirSync(project, { recursive: true });
  mkdirSync(codexHome, { recursive: true });
  mkdirSync(join(project, '.github', 'workflows'), { recursive: true });
  writeFileSync(join(project, 'README.md'), '# Fixture\n');
  writeFileSync(join(project, 'AGENTS.md'), '# Instructions\n');
  writeFileSync(join(project, '.env'), 'SECRET=value\n');
  writeFileSync(
    join(project, 'package.json'),
    JSON.stringify({ scripts: { test: 'node --test', build: 'node build.js' } }, null, 2)
  );
  writeFileSync(join(project, '.github', 'workflows', 'ci.yml'), 'name: CI\n');
  return { root, project, stateRoot, codexHome };
}

test('inventory saves state outside the target project and skips secret-like files', () => {
  const { project, stateRoot } = makeFixture();
  const output = execFileSync(
    process.execPath,
    [auditScript, 'inventory', '--project', project, '--state-root', stateRoot, '--save'],
    { encoding: 'utf8' }
  );

  const inventory = JSON.parse(output);
  assert.equal(inventory.project.root, project);
  assert.equal(inventory.signals.codexFiles.includes('AGENTS.md'), true);
  assert.equal(inventory.projectFiles.includes('.env'), false);
  assert.deepEqual(inventory.signals.package.likelyVerificationCommands, [
    'build',
    'test'
  ]);
  assert.equal(existsSync(inventory.saved.statePath), true);
  assert.equal(existsSync(join(project, 'state.json')), false);
});

test('inventory rejects a state root inside the target project', () => {
  const { project } = makeFixture();
  assert.throws(() => {
    execFileSync(
      process.execPath,
      [
        auditScript,
        'inventory',
        '--project',
        project,
        '--state-root',
        join(project, '.codex-consultant'),
        '--save'
      ],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
    );
  }, /Command failed/);
});

test('save-report writes markdown outside the target project and updates state', () => {
  const { project, stateRoot } = makeFixture();
  const report = '# Codex Consultant Report\n\n## Snapshot\n- Project: fixture\n';
  const result = spawnSync(
    process.execPath,
    [reportScript, '--project', project, '--state-root', stateRoot, '--title', 'Fixture Report'],
    { input: report, encoding: 'utf8' }
  );

  assert.equal(result.status, 0, result.stderr);
  const saved = JSON.parse(result.stdout);
  assert.equal(existsSync(saved.reportPath), true);
  assert.match(readFileSync(saved.reportPath, 'utf8'), /fixture/);

  const projectEntries = readdirSync(project);
  assert.equal(projectEntries.includes('reports'), false);
  assert.equal(projectEntries.includes('state.json'), false);
});

test('audit CLI rejects missing flag values', () => {
  const result = spawnSync(
    process.execPath,
    [auditScript, 'inventory', '--project', '--state-root'],
    { encoding: 'utf8' }
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Missing value for --project/);
});

test('save-report CLI rejects missing flag values', () => {
  const result = spawnSync(
    process.execPath,
    [reportScript, '--project', '.', '--title', '--state-root'],
    { input: '# Report\n', encoding: 'utf8' }
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Missing value for --title/);
});

test('config preview redacts sensitive keys without redacting author', () => {
  const { project, stateRoot, codexHome } = makeFixture();
  writeFileSync(
    join(codexHome, 'config.toml'),
    [
      'author = "Oscar"',
      'auth = "token-value"',
      'api_key = "api-value"',
      'model = "gpt-5.5"'
    ].join('\n')
  );

  const output = execFileSync(
    process.execPath,
    [auditScript, 'inventory', '--project', project, '--state-root', stateRoot],
    {
      encoding: 'utf8',
      env: { ...process.env, CODEX_HOME: codexHome }
    }
  );

  const inventory = JSON.parse(output);
  assert.deepEqual(inventory.codexLocalState.configToml.preview, [
    'author = "Oscar"',
    'auth = "<redacted>"',
    'api_key = "<redacted>"',
    'model = "gpt-5.5"'
  ]);
});
