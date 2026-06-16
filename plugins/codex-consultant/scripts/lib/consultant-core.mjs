import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync
} from 'node:fs';
import { homedir } from 'node:os';
import {
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep
} from 'node:path';

const SECRET_PATTERN =
  /(^|[/\\])(\.env(\.|$)|.*\.(pem|p12|pfx|key)$|id_rsa|id_dsa|credentials?|secrets?|tokens?|auth\.json)([/\\]|$)/i;

const SKIP_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.next',
  '.nuxt',
  '.cache',
  '.turbo',
  '.venv',
  'venv',
  'target'
]);

export function defaultStateRoot(env = process.env) {
  const codexHome = env.CODEX_HOME || join(homedir(), '.codex');
  return join(codexHome, 'codex-consultant');
}

export function normalizePath(path) {
  return path.split(sep).join('/');
}

export function safeReadJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

export function readFlagValue(rest, flag) {
  const value = rest.shift();
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${flag}.`);
  }
  return value;
}

function runGit(args, cwd) {
  try {
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    }).trim();
  } catch {
    return null;
  }
}

export function resolveProjectRoot(projectPath) {
  const start = resolve(projectPath || '.');
  const gitRoot = runGit(['rev-parse', '--show-toplevel'], start);
  return gitRoot ? resolve(gitRoot) : start;
}

export function isSubpathOrSame(child, parent) {
  const rel = relative(resolve(parent), resolve(child));
  return rel === '' || (rel && !rel.startsWith('..') && !isAbsolute(rel));
}

export function assertStateOutsideProject(stateRoot, projectRoot) {
  if (isSubpathOrSame(stateRoot, projectRoot)) {
    throw new Error(
      `Consultant state root must be outside the target project: ${stateRoot}`
    );
  }
}

export function projectKey(project) {
  const identity = `${project.remote || 'no-remote'}\n${project.root}`;
  const digest = createHash('sha256').update(identity).digest('hex').slice(0, 16);
  return `${project.name}-${digest}`.replace(/[^a-z0-9._-]/gi, '-').toLowerCase();
}

export function collectProjectFiles(root, maxFiles = 800) {
  const files = [];

  function walk(dir) {
    if (files.length >= maxFiles) {
      return;
    }

    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    entries.sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      const absolute = join(dir, entry.name);
      const rel = normalizePath(relative(root, absolute));

      if (SECRET_PATTERN.test(rel)) {
        continue;
      }

      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) {
          walk(absolute);
        }
        continue;
      }

      if (entry.isFile()) {
        files.push(rel);
      }

      if (files.length >= maxFiles) {
        return;
      }
    }
  }

  walk(root);
  return files;
}

function listDirFiles(root, relDir) {
  const dir = join(root, relDir);
  if (!existsSync(dir)) {
    return [];
  }

  const out = [];
  const stack = [dir];

  while (stack.length > 0 && out.length < 100) {
    const current = stack.pop();
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const absolute = join(current, entry.name);
      const rel = normalizePath(relative(root, absolute));
      if (SECRET_PATTERN.test(rel)) {
        continue;
      }
      if (entry.isDirectory()) {
        stack.push(absolute);
      } else if (entry.isFile()) {
        out.push(rel);
      }
    }
  }

  return out.sort();
}

function packageSignals(root) {
  const pkg = safeReadJson(join(root, 'package.json'));
  if (!pkg || typeof pkg !== 'object') {
    return null;
  }

  const scripts = pkg.scripts && typeof pkg.scripts === 'object' ? pkg.scripts : {};
  const scriptNames = Object.keys(scripts).sort();

  return {
    packageManager: pkg.packageManager || null,
    scripts: scriptNames,
    likelyVerificationCommands: scriptNames.filter((name) =>
      /^(test|lint|typecheck|type-check|build|check|ci)(:|$)/i.test(name)
    )
  };
}

function latestFiles(root, relDir, max = 5) {
  const dir = join(root, relDir);
  if (!existsSync(dir)) {
    return { exists: false, count: 0, latest: [] };
  }

  const seen = [];
  const stack = [dir];

  while (stack.length > 0 && seen.length < 2000) {
    const current = stack.pop();
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const absolute = join(current, entry.name);
      if (SECRET_PATTERN.test(relative(root, absolute))) {
        continue;
      }
      if (entry.isDirectory()) {
        stack.push(absolute);
      } else if (entry.isFile()) {
        const stat = statSync(absolute);
        seen.push({
          path: normalizePath(relative(root, absolute)),
          modifiedAt: stat.mtime.toISOString(),
          bytes: stat.size
        });
      }
    }
  }

  seen.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
  return { exists: true, count: seen.length, latest: seen.slice(0, max) };
}

function sanitizedConfigPreview(path) {
  if (!existsSync(path)) {
    return null;
  }

  const lines = readFileSync(path, 'utf8')
    .split(/\r?\n/)
    .slice(0, 200)
    .map((line) => {
      const key = line.split('=', 1)[0]?.trim() || '';
      if (isSensitiveConfigKey(key)) {
        return line.replace(/=.*/, '= "<redacted>"');
      }
      return line;
    })
    .filter((line) => line.trim() && !line.trim().startsWith('#'));

  return lines.slice(0, 80);
}

export function isSensitiveConfigKey(key) {
  return /(^|[._-])(token|secret|password|api[_-]?key|auth|credential|credentials)([._-]|$)/i.test(
    key
  );
}

export function collectCodexLocalState(env = process.env) {
  const codexHome = env.CODEX_HOME || join(homedir(), '.codex');
  const agentsHome = join(homedir(), '.agents');

  return {
    codexHome,
    configToml: {
      exists: existsSync(join(codexHome, 'config.toml')),
      preview: sanitizedConfigPreview(join(codexHome, 'config.toml'))
    },
    sessions: latestFiles(codexHome, 'sessions'),
    memories: latestFiles(codexHome, 'memories'),
    plugins: latestFiles(codexHome, 'plugins'),
    userSkills: latestFiles(agentsHome, 'skills'),
    personalMarketplace: {
      exists: existsSync(join(agentsHome, 'plugins', 'marketplace.json'))
    }
  };
}

export function collectGit(root, previousHead = null) {
  const head = runGit(['rev-parse', 'HEAD'], root);
  const branch = runGit(['branch', '--show-current'], root);
  const remote = runGit(['remote', 'get-url', 'origin'], root);
  const statusShort = runGit(['status', '--short'], root);
  const recentCommits = runGit(['log', '--oneline', '-n', '20'], root);
  const commitsSincePrevious =
    previousHead && head
      ? runGit(['log', '--oneline', '-n', '20', `${previousHead}..HEAD`], root)
      : null;

  return {
    isGitRepository: Boolean(head),
    head,
    branch,
    remote,
    dirty: Boolean(statusShort),
    statusShort: statusShort ? statusShort.split(/\r?\n/) : [],
    recentCommits: recentCommits ? recentCommits.split(/\r?\n/) : [],
    previousHead,
    commitsSincePrevious: commitsSincePrevious
      ? commitsSincePrevious.split(/\r?\n/)
      : []
  };
}

export function buildInventory(options = {}) {
  const now = options.now || new Date().toISOString();
  const root = resolveProjectRoot(options.project || '.');
  const stateRoot = resolve(options.stateRoot || defaultStateRoot());
  assertStateOutsideProject(stateRoot, root);

  const previousState = loadStateForProject({ root, stateRoot });
  const git = collectGit(root, previousState?.git?.head || null);
  const project = {
    root,
    name: root.split(/[\\/]/).filter(Boolean).at(-1) || 'project',
    remote: git.remote
  };
  const key = projectKey(project);
  const files = collectProjectFiles(root);
  const codexFiles = files.filter((file) =>
    /(^|\/)(AGENTS(\.override)?\.md|\.codex\/|\.agents\/)/.test(file)
  );
  const ciFiles = listDirFiles(root, '.github/workflows');

  return {
    schemaVersion: 1,
    run: {
      startedAt: now
    },
    project: {
      ...project,
      key
    },
    state: {
      root: stateRoot,
      projectDir: join(stateRoot, key),
      previousRunAt: previousState?.lastRunAt || null,
      previousReport: previousState?.reports?.at(-1) || null,
      priorRecommendations: previousState?.recommendations || []
    },
    git,
    signals: {
      fileCountSampled: files.length,
      codexFiles,
      ciFiles,
      package: packageSignals(root),
      makefile: files.includes('Makefile'),
      docker: files.some((file) => /(^|\/)(Dockerfile|docker-compose\.ya?ml)$/.test(file)),
      devcontainer: files.some((file) => file.startsWith('.devcontainer/')),
      readme: files.find((file) => /^readme\.md$/i.test(file)) || null
    },
    projectFiles: files,
    codexLocalState: collectCodexLocalState(options.env || process.env),
    suggestedInterview: [
      'What changed since the last consultant run that git cannot show?',
      'Which remote systems matter for delivery: GitHub, CI, deploys, databases, docs, or incidents?',
      'Which Codex tasks still feel like repeated prompt/response work instead of agentic delivery?',
      'What is the status of any prior recommendations?'
    ]
  };
}

export function statePathFor(projectDir) {
  return join(projectDir, 'state.json');
}

export function loadStateForProject({ root, stateRoot }) {
  const git = collectGit(root);
  const project = {
    root,
    name: root.split(/[\\/]/).filter(Boolean).at(-1) || 'project',
    remote: git.remote
  };
  const key = projectKey(project);
  return safeReadJson(statePathFor(join(stateRoot, key)));
}

export function saveInventory(inventory) {
  const projectDir = inventory.state.projectDir;
  const runsDir = join(projectDir, 'runs');
  mkdirSync(runsDir, { recursive: true });

  const stamp = inventory.run.startedAt.replace(/[:.]/g, '-');
  const inventoryPath = join(runsDir, `${stamp}.inventory.json`);
  writeFileSync(inventoryPath, `${JSON.stringify(inventory, null, 2)}\n`, 'utf8');

  const previousState = safeReadJson(statePathFor(projectDir)) || {};
  const nextState = {
    schemaVersion: 1,
    project: inventory.project,
    lastRunAt: inventory.run.startedAt,
    lastInventoryFile: normalizePath(relative(projectDir, inventoryPath)),
    git: inventory.git,
    reports: previousState.reports || [],
    recommendations: previousState.recommendations || [],
    notes: previousState.notes || []
  };

  writeFileSync(statePathFor(projectDir), `${JSON.stringify(nextState, null, 2)}\n`, 'utf8');

  return {
    projectDir,
    inventoryPath,
    statePath: statePathFor(projectDir)
  };
}

export async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

export function saveReport({ projectRoot, stateRoot, title, markdown, now = new Date().toISOString() }) {
  const root = resolveProjectRoot(projectRoot || '.');
  const resolvedStateRoot = resolve(stateRoot || defaultStateRoot());
  assertStateOutsideProject(resolvedStateRoot, root);

  const git = collectGit(root);
  const project = {
    root,
    name: root.split(/[\\/]/).filter(Boolean).at(-1) || 'project',
    remote: git.remote
  };
  const key = projectKey(project);
  const projectDir = join(resolvedStateRoot, key);
  const reportsDir = join(projectDir, 'reports');
  mkdirSync(reportsDir, { recursive: true });

  const stamp = now.replace(/[:.]/g, '-');
  const fileName = `${stamp}.report.md`;
  const reportPath = join(reportsDir, fileName);
  writeFileSync(reportPath, markdown.trimEnd() + '\n', 'utf8');

  const statePath = statePathFor(projectDir);
  const previousState = safeReadJson(statePath) || {
    schemaVersion: 1,
    project,
    recommendations: [],
    notes: []
  };

  const nextState = {
    ...previousState,
    schemaVersion: 1,
    project,
    lastReportAt: now,
    reports: [
      ...(previousState.reports || []),
      {
        title: title || 'Codex Consultant Report',
        createdAt: now,
        path: normalizePath(relative(projectDir, reportPath))
      }
    ]
  };

  writeFileSync(statePath, `${JSON.stringify(nextState, null, 2)}\n`, 'utf8');

  return {
    projectDir,
    reportPath,
    statePath
  };
}

export function ensureParentDir(path) {
  mkdirSync(dirname(path), { recursive: true });
}
