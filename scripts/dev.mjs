#!/usr/bin/env node
/**
 * Dev orchestrator — starts API + Web with a single command.
 *
 *   pnpm dev          (from the repo root)
 *   node scripts/dev.mjs [--api-only|--web-only] [--no-wait]
 *
 * Why a script instead of `turbo run dev --parallel`:
 *  - prefixes each line with [api] / [web] so logs never mix;
 *  - waits for the API health check before declaring "ready";
 *  - guarantees BOTH children die on Ctrl+C (orphan-free, Windows-safe).
 *
 * Note: the API runs with ts-node (ADR-003: esbuild/tsx breaks NestJS DI).
 */

import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

// ─────────────────────────────────────────────────────────────
// CLI flags
// ─────────────────────────────────────────────────────────────

const args = new Set(process.argv.slice(2));
const API_ONLY = args.has('--api-only');
const WEB_ONLY = args.has('--web-only');
const NO_WAIT = args.has('--no-wait');

const API_PORT = Number(process.env.API_PORT ?? 3001);
const WEB_PORT = Number(process.env.WEB_PORT ?? 5173);
const HEALTH_URL = `http://127.0.0.1:${API_PORT}/api/v1/health`;
const HEALTH_TIMEOUT_MS = 60_000;

// ─────────────────────────────────────────────────────────────
// Child processes
// ─────────────────────────────────────────────────────────────

const COLORS = { api: '\x1b[36m', web: '\x1b[35m', root: '\x1b[2m' };
const RESET = '\x1b[0m';

function label(name) {
  return `${COLORS[name] ?? ''}[${name}]${RESET}`;
}

/** Logs child output with a colored prefix; long JSON lines stay intact. */
function pipe(child, name) {
  const prefix = label(name);
  const onChunk = (chunk) => {
    for (const line of String(chunk).split('\n')) {
      if (line.length > 0) console.log(`${prefix} ${line}`);
    }
  };
  child.stdout?.setEncoding('utf8');
  child.stderr?.setEncoding('utf8');
  child.stdout?.on('data', onChunk);
  child.stderr?.on('data', onChunk);
}

/** Spawns a pnpm task inside an app folder, cross-platform (pnpm.cmd on win). */
function startTask(name, cwd, scriptCommand) {
  const isWindows = process.platform === 'win32';
  const child = spawn(isWindows ? 'pnpm.cmd' : 'pnpm', ['exec', ...scriptCommand], {
    cwd,
    env: { ...process.env, FORCE_COLOR: '1' },
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  pipe(child, name);
  return child;
}

const children = [];

function startApi() {
  console.log(`${label('root')} starting API (ts-node)…`);
  const child = startTask('api', 'apps/api', ['ts-node', 'src/platform.ts']);
  children.push({ name: 'api', child });
}

function startWeb() {
  console.log(`${label('root')} starting Web (vite)…`);
  const child = startTask('web', 'apps/web', ['vite']);
  children.push({ name: 'web', child });
}

// ─────────────────────────────────────────────────────────────
// Shutdown — must be idempotent and kill ALL children
// ─────────────────────────────────────────────────────────────

let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n${label('root')} received ${signal}, stopping services…`);

  await Promise.all(
    children.map(
      ({ name, child }) =>
        new Promise((resolve) => {
          if (child.exitCode !== null || child.signalCode !== null) return resolve();
          child.once('exit', resolve);
          // tree-kill is overkill here: children are direct (no grand-children
          // survive vite/ts-node in practice); TERM then KILL as fallback.
          child.kill('SIGTERM');
          setTimeout(() => {
            if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
            resolve();
          }, 3000).unref();
        }),
    ),
  );
  console.log(`${label('root')} bye 👋`);
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
// Ctrl+C on Windows emits this instead of a signal:
process.on('SIGHUP', () => void shutdown('SIGHUP'));
process.on('exit', () => {
  for (const { child } of children) {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
  }
});

// ─────────────────────────────────────────────────────────────
// Health wait — "ready" only when the API actually answers
// ─────────────────────────────────────────────────────────────

async function waitUntilApiReady() {
  const startedAt = Date.now();
  console.log(`${label('root')} waiting for API on ${HEALTH_URL} …`);
  while (Date.now() - startedAt < HEALTH_TIMEOUT_MS) {
    try {
      const response = await fetch(HEALTH_URL, { signal: AbortSignal.timeout(1500) });
      if (response.ok) {
        const body = await response.json();
        if (body?.data?.status === 'ok') {
          const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
          console.log(`${label('root')} API ready in ${seconds}s ✓`);
          return;
        }
      }
    } catch {
      // not up yet — keep polling
    }
    await delay(500);
  }
  console.error(`${label('root')} API did not become healthy in ${HEALTH_TIMEOUT_MS / 1000}s`);
  console.error(`${label('root')} check ${label('api')} output above for the actual error.`);
  await shutdown('timeout');
}

// ─────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────

async function main() {
  if (WEB_ONLY) {
    startWeb();
  } else {
    startApi();
    if (!NO_WAIT) await waitUntilApiReady();
    if (!API_ONLY) startWeb();
  }

  if (!WEB_ONLY && !API_ONLY) {
    console.log(`${label('root')} ──────────────────────────────────────`);
    console.log(`${label('root')} API  → http://127.0.0.1:${API_PORT}/api/v1`);
    console.log(`${label('root')} Web  → http://localhost:${WEB_PORT}`);
    console.log(`${label('root')} Ctrl+C encerra os dois.`);
    console.log(`${label('root')} ──────────────────────────────────────`);
  }

  // If any child dies unexpectedly, shut everything down (fail fast, §27).
  for (const { name, child } of children) {
    child.once('exit', (code, signal) => {
      if (shuttingDown) return;
      console.error(`${label(name)} exited unexpectedly (code=${code ?? ''} signal=${signal ?? ''})`);
      void shutdown(`child-${name}`);
    });
  }
}

void main();
