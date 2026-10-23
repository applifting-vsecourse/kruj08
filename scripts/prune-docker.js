#!/usr/bin/env node
// Removes the Docker Compose projects that deleted worktrees of this repo
// left behind.
//
// Each worktree runs its own dev Postgres as a compose project named
// `backend-<worktree-dir>` (see scripts/check-env.js). When a worktree is
// removed without `pnpm dev:down` first — the Claude desktop app does exactly
// that — the container keeps running (`restart: always`), holds its host port
// and makes check-env.js skip that slot for every later worktree.
//
// A project is pruned only when all of these hold, so nothing else on the
// machine is touched:
//   - its compose file is an `apps/backend/docker-compose.yml`,
//   - it is not `backend`, the main checkout's project,
//   - the checkout directory that compose file belonged to no longer exists,
//   - and `git worktree list` does not know that directory either.
//
// Usage: pnpm docker:prune [--dry-run]
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const dryRun = process.argv.includes('--dry-run');
const MAIN_PROJECT = 'backend';
const COMPOSE_FILE = path.join('apps', 'backend', 'docker-compose.yml');

function composeProjects() {
  const out = execFileSync(
    'docker',
    ['compose', 'ls', '--all', '--format', 'json'],
    { encoding: 'utf8' },
  );
  return JSON.parse(out || '[]');
}

function knownWorktrees() {
  try {
    const out = execFileSync('git', ['worktree', 'list', '--porcelain'], {
      cwd: root,
      encoding: 'utf8',
    });
    return new Set(
      out
        .split('\n')
        .filter((line) => line.startsWith('worktree '))
        .map((line) => path.resolve(line.slice('worktree '.length))),
    );
  } catch {
    return new Set();
  }
}

// The checkout a project's compose file belonged to, or undefined when the
// project is not one of ours.
function checkoutOf(project) {
  // Several files are comma-separated; the base file comes first.
  const configFile = path.resolve((project.ConfigFiles || '').split(',')[0]);
  const suffix = path.sep + COMPOSE_FILE;
  if (!configFile.endsWith(suffix)) return undefined;
  return configFile.slice(0, -suffix.length);
}

function orphans() {
  const worktrees = knownWorktrees();
  return composeProjects().flatMap((project) => {
    if (project.Name === MAIN_PROJECT) return [];
    const checkout = checkoutOf(project);
    if (checkout === undefined) return [];
    if (fs.existsSync(checkout) || worktrees.has(checkout)) return [];
    return [{ name: project.Name, status: project.Status, checkout }];
  });
}

function removeProject(name) {
  // `-p` because the compose file is gone with the worktree.
  execFileSync(
    'docker',
    ['compose', '-p', name, 'down', '--volumes', '--remove-orphans'],
    { stdio: 'inherit' },
  );
}

function main() {
  const found = orphans();
  if (found.length === 0) {
    console.log('✔  No Docker stacks left behind by removed worktrees.');
    return;
  }
  for (const { name, status, checkout } of found) {
    console.log(
      `${dryRun ? '○' : '✖'}  ${name}  (${status}; worktree ${checkout} is gone)`,
    );
    if (!dryRun) removeProject(name);
  }
  console.log(
    dryRun
      ? `ℹ  Dry run: ${found.length} stack(s) would be removed. Run without --dry-run to remove them.`
      : `✔  Removed ${found.length} stack(s).`,
  );
}

try {
  main();
} catch (error) {
  console.error(`✖  ${error.message}`);
  process.exit(1);
}
