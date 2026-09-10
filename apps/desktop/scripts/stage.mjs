/**
 * Staging para o electron-builder (Fase 8 — empacotamento).
 *
 * Monta apps/desktop/staging/ com um app autocontido e offline-first:
 *   - renderer/  → build do web (apps/web/dist)
 *   - api/       → API autocontida (bundle esbuild + node_modules prod via
 *                  `pnpm deploy` + schema/migrations Prisma + client gerado)
 *
 * Requisitos: `pnpm build` (web + api) executado previamente.
 */
import { mkdir, cp, rm, readFile, writeFile, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build as esbuild } from 'esbuild';

const selfDir = dirname(fileURLToPath(import.meta.url));
const desktopDir = resolve(selfDir, '..');
const repoRoot = resolve(desktopDir, '..', '..');
const stagingDir = join(desktopDir, 'staging');
const deployDir = join(stagingDir, 'api');

const webDist = join(repoRoot, 'apps', 'web', 'dist');
const apiSrc = join(repoRoot, 'apps', 'api', 'src', 'platform.ts');
const prismaDir = join(repoRoot, 'database', 'prisma');

async function ensureDir(path) {
  await mkdir(path, { recursive: true });
}

async function assertExists(path, hint) {
  try {
    await stat(path);
  } catch {
    throw new Error(`staging: "${path}" não existe. ${hint}`);
  }
}

async function main() {
  await assertExists(webDist, 'Rode "pnpm build" (web) antes.');
  await assertExists(apiSrc, 'Fonte da API ausente.');

  await rm(stagingDir, { recursive: true, force: true });
  await ensureDir(stagingDir);

  // 1. API autocontida: node_modules de produção (sem symlinks de workspace).
  //    node-linker=hoisted → layout plano (sem virtual store / symlinks), o que
  //    preserva a resolução relativa do Prisma (.prisma/client, @prisma/engines).
  console.log('[staging] pnpm deploy --prod @mechanic-system/api …');
  execFileSync(
    'pnpm',
    [
      '--filter',
      '@mechanic-system/api',
      'deploy',
      '--prod',
      '--config.node-linker=hoisted',
      deployDir,
    ],
    { cwd: repoRoot, stdio: 'inherit' },
  );

  // 2. Descarta os arquivos de projeto (o deploy copia a fonte da API); o
  //    runtime usa apenas dist/ + prisma/ + node_modules/ + package.json.
  for (const junk of [
    'src',
    'tests',
    'data',
    'smoke.ts',
    'vitest.config.ts',
    'eslint.config.mjs',
    'tsconfig.json',
    'tsconfig.build.json',
  ]) {
    await rm(join(deployDir, junk), { recursive: true, force: true });
  }

  // Schema + migrations embarcadas (primeira execução: `migrate deploy`).
  await ensureDir(join(deployDir, 'prisma'));
  await cp(join(prismaDir, 'schema.prisma'), join(deployDir, 'prisma', 'schema.prisma'));
  await cp(join(prismaDir, 'migrations'), join(deployDir, 'prisma', 'migrations'), {
    recursive: true,
  });

// 3. Regenera o Prisma Client dentro do deploy (o postinstall não tem schema).
  console.log('[staging] prisma generate (deploy) …');
  execFileSync(
    'node',
    [
      join(deployDir, 'node_modules', 'prisma', 'build', 'index.js'),
      'generate',
      '--schema',
      join(deployDir, 'prisma', 'schema.prisma'),
    ],
    { stdio: 'inherit' },
  );

  // 4. Bundle da API com esbuild: inlina os pacotes TS do workspace
  //    (@mechanic-system/*, consumidos como fonte), mantém as dependências
  //    de node_modules externas. Roda no Node embutido do Electron.
  console.log('[staging] esbuild bundle da API …');
  const apiPkg = JSON.parse(await readFile(join(repoRoot, 'apps', 'api', 'package.json'), 'utf8'));
  const external = Object.keys(apiPkg.dependencies).filter(
    (dep) => !dep.startsWith('@mechanic-system/'),
  );
  await esbuild({
    entryPoints: [apiSrc],
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'cjs',
    outfile: join(deployDir, 'dist', 'platform.js'),
    external,
  });

  // 6. Renderer (build do web) fora do asar (resources).
  console.log('[staging] copiando renderer …');
  await cp(webDist, join(stagingDir, 'renderer'), { recursive: true });

  const apiPkgInfo = await stat(join(deployDir, 'dist', 'platform.js'));
  const meta = {
    renderedAt: new Date().toISOString(),
    apiBundleBytes: apiPkgInfo.size,
  };
  await writeFile(join(stagingDir, 'meta.json'), JSON.stringify(meta, null, 2));

  console.log(`[staging] pronto em ${stagingDir}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? `staging: ${error.message}` : error);
  process.exit(1);
});