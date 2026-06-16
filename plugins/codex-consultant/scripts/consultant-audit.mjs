#!/usr/bin/env node
import {
  buildInventory,
  defaultStateRoot,
  readFlagValue,
  saveInventory
} from './lib/consultant-core.mjs';

function parseArgs(argv) {
  const args = {
    command: 'inventory',
    project: '.',
    stateRoot: defaultStateRoot(),
    save: false
  };

  const rest = [...argv];
  if (rest[0] && !rest[0].startsWith('--')) {
    args.command = rest.shift();
  }

  while (rest.length > 0) {
    const flag = rest.shift();
    if (flag === '--project') {
      args.project = readFlagValue(rest, flag);
    } else if (flag === '--state-root') {
      args.stateRoot = readFlagValue(rest, flag);
    } else if (flag === '--save') {
      args.save = true;
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
  consultant-audit.mjs inventory [--project PATH] [--state-root PATH] [--save]

Produces JSON inventory for a read-only Codex consultant audit.
--save writes inventory state under the outside-repo consultant state root.`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  if (args.command !== 'inventory') {
    throw new Error(`Unsupported command: ${args.command}`);
  }

  const inventory = buildInventory({
    project: args.project,
    stateRoot: args.stateRoot
  });

  if (args.save) {
    inventory.saved = saveInventory(inventory);
  }

  console.log(JSON.stringify(inventory, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
