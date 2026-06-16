#!/usr/bin/env node
import {
  defaultStateRoot,
  readFlagValue,
  readStdin,
  saveReport
} from './lib/consultant-core.mjs';

function parseArgs(argv) {
  const args = {
    project: '.',
    stateRoot: defaultStateRoot(),
    title: 'Codex Consultant Report'
  };

  const rest = [...argv];
  while (rest.length > 0) {
    const flag = rest.shift();
    if (flag === '--project') {
      args.project = readFlagValue(rest, flag);
    } else if (flag === '--state-root') {
      args.stateRoot = readFlagValue(rest, flag);
    } else if (flag === '--title') {
      args.title = readFlagValue(rest, flag);
    } else if (flag === '--help' || flag === '-h') {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${flag}`);
    }
  }

  return args;
}

function printHelp() {
  console.log(`Usage:
  save-report.mjs [--project PATH] [--state-root PATH] [--title TITLE]

Reads a Markdown report from stdin and saves it under the outside-repo
consultant state root.`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const markdown = await readStdin();
  if (!markdown.trim()) {
    throw new Error('Refusing to save an empty report.');
  }

  const saved = saveReport({
    projectRoot: args.project,
    stateRoot: args.stateRoot,
    title: args.title,
    markdown
  });

  console.log(JSON.stringify(saved, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
