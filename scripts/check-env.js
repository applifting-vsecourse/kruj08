#!/usr/bin/env node
// Creates apps/backend/.env and apps/frontend/.env from their .env.example
// files when they are missing, then prints where the app will listen.
//
// Ports come in "slots" so that a second checkout of this repo (a git
// worktree) can run its whole dev stack — Postgres container, backend,
// frontend — next to the main one without a single host-port collision:
//
//   slot 0 (main checkout):  frontend 3050, backend 4050, Postgres 5433
//   slot n (a worktree):     each of those + 100 * n
//
// The main checkout always takes slot 0 and its .env files are plain copies
// of the examples, exactly as before. A worktree gets the lowest slot that
// no sibling worktree has claimed in its own .env and whose three ports are
// free right now. The slot is written into the .env files once and read
// back on every later run, so it stays stable for the life of the worktree.
//
// Everything the slot touches lives in the two .env files, which are the
// single source of truth: PORT / BACKEND_URL / FRONTEND_URL (CORS and
// BetterAuth trusted origins), DATABASE_URL + DB_HOST_PORT (compose port
// mapping), COMPOSE_PROJECT_NAME (separate container, network and volume
// per worktree — compose would otherwise name every checkout's project
// "backend" after the apps/backend directory and reuse the main container),
// and VITE_PORT / VITE_API_URL / VITE_BETTER_AUTH_URL on the frontend.
const fs = require('fs');
const net = require('net');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const BACKEND_ENV = 'apps/backend/.env';
const FRONTEND_ENV = 'apps/frontend/.env';
const envFiles = [
  { env: BACKEND_ENV, example: 'apps/backend/.env.example' },
  { env: FRONTEND_ENV, example: 'apps/frontend/.env.example' },
];

const BASE = { frontend: 3050, backend: 4050, db: 5433 };
const SLOT_STEP = 100;
const MAX_SLOT = 9;

const slotPorts = (slot) => ({
  frontend: BASE.frontend + SLOT_STEP * slot,
  backend: BASE.backend + SLOT_STEP * slot,
  db: BASE.db + SLOT_STEP * slot,
});

// --- small .env helpers (no dependency: dotenv is an app concern) ---------

function readEnvValue(file, key) {
  if (!fs.existsSync(file)) return undefined;
  const match = fs
    .readFileSync(file, 'utf8')
    .match(new RegExp(`^${key}=(.*)$`, 'm'));
  return match ? match[1].trim() : undefined;
}

function setEnvValue(content, key, value) {
  const line = `${key}=${value}`;
  const re = new RegExp(`^${key}=.*$`, 'm');
  if (re.test(content)) return content.replace(re, line);
  return `${content.replace(/\n*$/, '\n')}${line}\n`;
}

// --- where are we? ---------------------------------------------------------

// A linked worktree has a `.git` *file* pointing at the main repository; the
// main checkout has a `.git` directory.
function isLinkedWorktree() {
  try {
    return fs.statSync(path.join(root, '.git')).isFile();
  } catch {
    return false;
  }
}

function siblingWorktrees() {
  try {
    const out = execFileSync('git', ['worktree', 'list', '--porcelain'], {
      cwd: root,
      encoding: 'utf8',
    });
    return out
      .split('\n')
      .filter((line) => line.startsWith('worktree '))
      .map((line) => line.slice('worktree '.length))
      .filter((dir) => path.resolve(dir) !== root);
  } catch {
    return [];
  }
}

function slotFromBackendPort(port) {
  const n = Number(port);
  if (!Number.isInteger(n) || n < BASE.backend) return undefined;
  const slot = (n - BASE.backend) / SLOT_STEP;
  return Number.isInteger(slot) ? slot : undefined;
}

// Slot this checkout already uses, if its .env files exist.
function existingSlot() {
  const fromBackend = slotFromBackendPort(
    readEnvValue(path.join(root, BACKEND_ENV), 'PORT'),
  );
  if (fromBackend !== undefined) return fromBackend;
  const vitePort = readEnvValue(path.join(root, FRONTEND_ENV), 'VITE_PORT');
  if (vitePort === undefined) return undefined;
  const slot = (Number(vitePort) - BASE.frontend) / SLOT_STEP;
  return Number.isInteger(slot) && slot >= 0 ? slot : undefined;
}

function claimedSlots() {
  const claimed = new Set([0]); // the main checkout always owns slot 0
  for (const dir of siblingWorktrees()) {
    const slot = slotFromBackendPort(
      readEnvValue(path.join(dir, BACKEND_ENV), 'PORT'),
    );
    if (slot !== undefined) claimed.add(slot);
  }
  return claimed;
}

function portFree(port, host) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.once('error', () => resolve(false));
    server.listen({ port, host, exclusive: true }, () => {
      server.close(() => resolve(true));
    });
  });
}

async function allFree(ports) {
  for (const port of Object.values(ports)) {
    // Vite binds ::1, the backend and Docker bind every interface — check both.
    for (const host of ['127.0.0.1', '::1']) {
      if (!(await portFree(port, host))) return false;
    }
  }
  return true;
}

async function pickSlot() {
  const claimed = claimedSlots();
  for (let slot = 1; slot <= MAX_SLOT; slot += 1) {
    if (claimed.has(slot)) continue;
    if (await allFree(slotPorts(slot))) return slot;
  }
  throw new Error(
    `No free port slot (1-${MAX_SLOT}); every one is claimed by another worktree or in use.`,
  );
}

// Compose project names must be lowercase [a-z0-9_-] and start with a letter
// or digit; derive one from the checkout directory so it is recognisable in
// `docker compose ls`.
function composeProjectName() {
  const slug = path
    .basename(root)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^[^a-z0-9]+/, '');
  return `backend-${slug || 'worktree'}`;
}

// --- rendering the .env files ----------------------------------------------

function renderEnv(example, env, slot) {
  let content = fs.readFileSync(example, 'utf8');
  if (slot === 0) return content; // main checkout: untouched copy, as before

  const ports = slotPorts(slot);
  const backendUrl = `http://localhost:${ports.backend}`;
  const frontendUrl = `http://localhost:${ports.frontend}`;

  if (env === BACKEND_ENV) {
    content = setEnvValue(content, 'PORT', ports.backend);
    content = setEnvValue(content, 'BACKEND_URL', backendUrl);
    content = setEnvValue(content, 'FRONTEND_URL', frontendUrl);
    content = setEnvValue(
      content,
      'DATABASE_URL',
      `postgresql://quacker:quacker@localhost:${ports.db}/quacker`,
    );
    content = setEnvValue(content, 'DB_HOST_PORT', ports.db);
    content = setEnvValue(
      content,
      'COMPOSE_PROJECT_NAME',
      composeProjectName(),
    );
  } else if (env === FRONTEND_ENV) {
    content = setEnvValue(content, 'VITE_PORT', ports.frontend);
    content = setEnvValue(content, 'VITE_API_URL', `${backendUrl}/api`);
    content = setEnvValue(content, 'VITE_BETTER_AUTH_URL', backendUrl);
  }
  return content;
}

async function main() {
  const missing = envFiles.filter(
    ({ env }) => !fs.existsSync(path.join(root, env)),
  );

  let slot = existingSlot();
  if (slot === undefined) {
    slot = isLinkedWorktree() ? await pickSlot() : 0;
  }

  for (const { env, example } of missing) {
    const examplePath = path.join(root, example);
    if (!fs.existsSync(examplePath)) {
      console.warn(`⚠  No .env.example found at ${example}, skipping`);
      continue;
    }
    fs.writeFileSync(path.join(root, env), renderEnv(examplePath, env, slot));
    console.log(`✔  Created ${env} from ${example}`);
  }

  // Always print the live values so `pnpm dev` output shows where this
  // checkout actually listens — never assume the slot-0 ports.
  const backendEnv = path.join(root, BACKEND_ENV);
  const frontendUrl = readEnvValue(backendEnv, 'FRONTEND_URL');
  const backendUrl = readEnvValue(backendEnv, 'BACKEND_URL');
  const dbPort = readEnvValue(backendEnv, 'DB_HOST_PORT');
  const project = readEnvValue(backendEnv, 'COMPOSE_PROJECT_NAME');
  console.log(
    [
      `ℹ  Port slot ${slot}${slot === 0 ? ' (main checkout)' : ' (worktree)'}:`,
      `   frontend  ${frontendUrl}`,
      `   api       ${backendUrl}/api  (docs: ${backendUrl}/api/docs)`,
      `   postgres  localhost:${dbPort}${project ? `  (compose project ${project})` : ''}`,
    ].join('\n'),
  );
}

main().catch((error) => {
  console.error(`✖  ${error.message}`);
  process.exit(1);
});
