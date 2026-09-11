# Guia de desenvolvimento

## Requisitos

- Node.js ≥ 22 (`node --version`)
- pnpm ≥ 9 (`corepack enable` + `corepack prepare pnpm@9.15.9 --activate`)

## Setup inicial

```bash
pnpm install
cp .env.example .env      # preencha os segredos JWT
pnpm db:migrate           # aplica migrations (cria database/prisma/dev.db)
pnpm db:seed              # cria o ADMIN — exige SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD no .env (R4: sem padrões)
```

## Comandos

| Comando | O que faz |
|---|---|
| `pnpm dev` | **API + Web juntos** — prefixos `[api]`/`[web]`, espera o health check e encerra os dois no Ctrl+C |
| `pnpm dev:api` / `pnpm dev:web` | um serviço por vez (mesmo script com flags) |
| `pnpm dev:desktop` | Electron (requer `pnpm build` prévio) |
| `pnpm lint` / `lint:fix` | ESLint em todos os pacotes |
| `pnpm format` | Prettier |
| `pnpm typecheck` | `tsc --noEmit` em todos |
| `pnpm test` | Vitest em todos |
| `pnpm build` | builds de produção (turbo, com cache) |
| `pnpm db:migrate` / `db:seed` / `db:studio` | banco |
| `pnpm --filter @mechanic-system/api smoke` | teste de fumaça da API |

## Regras do projeto (resumo da spec)

1. **Responsabilidade única** — um arquivo, uma responsabilidade; alvo < 300
   linhas (divida por responsabilidade, não artificialmente).
2. **Regra de negócio só no backend** (services). React: UI + estado de
   apresentação. Nunca confie em validação de frontend.
3. **Dinheiro em centavos inteiros** — use `@mechanic-system/shared/money`.
4. **Validação** por schemas Zod de `@mechanic-system/validation`
   (compartilhados entre API e formulários).
5. **Sem `any`** — ESLint bloqueia (`no-explicit-any`, strict-type-checked).
6. **DTOs na fronteira** — nunca exponha entidades do Prisma diretamente
   (veja `PublicUser` em `users.service.ts`).
7. **Snapshot em registros históricos** — OS copia preços/nomes no momento.
8. **Transações** para operações multi-etapa (ex.: item de OS + estoque).
9. Arquivo novo: analise onde a responsabilidade vive hoje (§46) — evite
   duplicar abstrações.

## Fluxo de trabalho por fase

Antes de considerar qualquer funcionalidade concluída:

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
pnpm --filter @mechanic-system/api smoke
```

Commits no padrão Conventional:

```
feat: add customer management
fix: prevent duplicate appointments
refactor: split work order service
test: add work order transition tests
```

Nunca comitar: `.env`, `*.db`, builds (`dist/`, `release/`), logs.

## Armadilhas conhecidas (lições da Fase 1)

- **Não rode a API com `tsx`**: esbuild não emite `design:paramtypes`, o que
  quebra a injeção de dependência do NestJS silenciosamente (constructor
  recebe `undefined`). Use `ts-node` (dev) ou `node dist/` (produção).
- **Transport do pino**: não use o transport `pino-pretty` in-process —
  o worker thread pode travar sob ts-node/tsx. Para logs bonitos:
  `pnpm dev:api | pnpm exec pino-pretty`.
- O Prisma CLI lê `database/prisma/.env` (não o `.env` da raiz) porque o
  caminho do SQLite é relativo ao `schema.prisma`.
- `vite` precisa estar na mesma major do `vitest` usado (v5 ↔ 2.x hoje).

## Debug

- API logs: JSON estruturado (pino) com request id por linha.
- Banco: `pnpm db:studio`.
- Electron: `pnpm dev:desktop` após `pnpm build` (API sidecar precisa do
  `apps/api/dist/platform.js`).
