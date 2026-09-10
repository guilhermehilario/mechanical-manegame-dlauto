# Mechanic System — Sistema de Gestão para Oficina Mecânica

Aplicação desktop **offline-first** para gerenciamento de oficinas mecânicas,
construída como monorepo TypeScript com foco em segurança, manutenibilidade,
testabilidade e evolução incremental.

> **Status: Fases 1–6 concluídas (infraestrutura; clientes + veículos; catálogos + estoque; agendamentos; ordens de serviço com máquina de estados e snapshots; histórico de manutenção derivado + imagens com StorageService).**
> Módulos de domínio restantes (serviços, produtos, ordens de serviço etc.)
> serão implementados nas fases 3–8. Veja [Plano de fases](#plano-de-fases).

## Objetivo

Gerenciar o dia a dia de uma oficina: clientes, veículos, serviços, peças,
fornecedores, agendamentos, ordens de serviço (com snapshot de preços e
máquina de estados), histórico de manutenção, imagens e retirada/entrega de
veículos — funcionando **100% offline** na máquina da oficina.

## Arquitetura

```
Electron Main ── inicia ──► NestJS API (in-process, 127.0.0.1, porta efêmera)
     │                            ▲
  Preload (contextBridge)         │ HTTP REST /api/v1
     ▼                            │
  React Renderer ──► API Client ──┘
                         │
   Controller → Service (regras de negócio) → Repository → SQLite (Prisma)
```

- **Offline-first:** o backend roda embutido no Electron (loopback), com
  banco SQLite local. Sem internet, sem servidor externo.
- **Sync-ready (não implementado ainda):** todas as PKs são `cuid`
  (client-generated), todas as tabelas têm `createdAt/updatedAt`, e existe a
  tabela `sync_outbox` para a futura fila de sincronização (spec §39).
- **Frontend nunca acessa o banco** — apenas a API REST (spec §22).

Monorepo (pnpm + Turborepo):

```
apps/
  desktop/     Electron (main + preload seguro)
  web/         React 18 + Vite + Tailwind
  api/         NestJS 10 (API REST /api/v1)
packages/
  shared/      Money (centavos), máquina de estados da OS
  types/       Contratos DTO compartilhados FE↔BE
  validation/  Schemas Zod (usados pela API e pelos formulários)
  config/      Env validada no startup (§30)
  eslint-config/, tsconfig/, prettier-config/
database/      Prisma schema + migrations + seed
docs/          Documentação de arquitetura e ADRs
```

## Tecnologias

| Camada | Tecnologia |
|---|---|
| Linguagem | TypeScript 5 (strict + noUncheckedIndexedAccess) |
| Frontend | React 18, Vite 5, Tailwind, TanStack Query, React Router |
| Backend | NestJS 10, Prisma 6, Zod, pino, helmet, @nestjs/throttler |
| Auth | Argon2id + JWT de acesso + refresh tokens rotativos (hash SHA-256) |
| Desktop | Electron 33 (contextIsolation, sandbox, sem nodeIntegration) |
| Banco | SQLite (offline-first) via Prisma, migrations versionadas |
| Testes | Vitest (API + web + pacotes), Testing Library |
| Qualidade | ESLint 9 (flat config, strict-type-checked), Prettier, Husky, lint-staged, Turborepo |

## Instalação

Requisitos: **Node.js ≥ 22** e **pnpm ≥ 9** (ou `corepack enable`).

```bash
pnpm install
cp .env.example .env            # ajuste os segredos (JWT_ACCESS_SECRET etc.)
pnpm db:migrate                 # cria database/prisma/dev.db + aplica migrations
pnpm db:seed                    # cria o usuário admin inicial
```

> O seed usa `SEED_ADMIN_PASSWORD` (env) ou o padrão de desenvolvimento
> `admin1234` — **apenas para ambiente local**. O Prisma CLI lê
> `database/prisma/.env` (caminho relativo ao schema).

## Execução

```bash
pnpm dev          # API + web em paralelo (turbo)
pnpm dev:api      # somente API (http://127.0.0.1:3001/api/v1)
pnpm dev:web      # somente web (http://localhost:5173)
pnpm dev:desktop  # Electron carregando o web app (API precisa estar buildada)
```

No Electron, a API sobe **em-processo** (runtime do próprio Electron, sem
Node instalado na máquina) em `127.0.0.1:<porta efêmera>`; o renderer recebe
a URL apenas via preload bridge (menor privilégio).

## Banco de dados

- Schema: `database/prisma/schema.prisma`
- Migrations: `database/prisma/migrations/` (nunca altere o banco à mão)
- Money é **sempre inteiro em centavos** (`Int`, nunca float) — spec §18

```bash
pnpm db:migrate   # prisma migrate dev (desenvolvimento)
pnpm db:seed      # seed (admin user)
pnpm db:studio    # Prisma Studio
```

## Testes e qualidade

```bash
pnpm lint         # ESLint (flat config, strict-type-checked)
pnpm typecheck    # tsc --noEmit em todos os pacotes
pnpm test         # Vitest (140 testes: money, state machines, auth, DI, UI, catálogos, estoque, agendamentos, OS)
pnpm build        # builds de produção
pnpm --filter @mechanic-system/api smoke   # smoke test ponta a ponta da API
```

## Variáveis de ambiente

Veja `.env.example`. Variáveis obrigatórias são validadas no startup
(`packages/config`) — a aplicação **recusa-se a subir** com configuração
inválida (spec §30). Nunca versione `.env` real.

## Empacotamento (Electron)

```bash
pnpm build        # compila api + desktop (tsc)
cd apps/desktop && pnpm start
```

Empacotamento com electron-builder será adicionado na Fase 8
(distribuição para a oficina). A entry da API em produção é
`apps/api/dist/platform.js` (configurável via `MECHANIC_API_ENTRY`).

## Plano de fases

- [x] **Fase 1** — Monorepo, tooling, NestJS, React, Electron, banco, auth,
      envelope de erros, logs estruturados, rate limit, CI de qualidade local
- [x] **Fase 2** — Clientes + Veículos (CRUD, CPF/placa únicos, soft delete,
      busca, paginação, UI de listagem e formulários)
- [x] **Fase 3** — Serviços + Produtos (estoque centralizado) + Fornecedores
      (CRUD dos catálogos, CNPJ/código únicos, movimentações de estoque
      transacionais com trilha audível, alerta de estoque mínimo, UI completa)
- [x] **Fase 4** — Agendamento (regras de conflito no backend: um veículo não
      pode ter dois agendamentos ativos no mesmo horário; máquina de estados
      compartilhada; UI de agenda com transições de status)
- [x] **Fase 5** — Ordens de Serviço (state machine §11, snapshots de preço
      §35, reserva/estorno de estoque em transação §36, UI completa com gestão
      de itens e totais)
- [x] **Fase 6** — Histórico de manutenção **derivado** (consulta sobre OS
      por veículo, §14 — sem tabela própria) + Imagens (StorageService local
      com sha256/dedup, magic bytes, limite de 5 MB; upload multipart,
      download autenticado e galeria na OS)
- [ ] **Fase 7** — Retirada/Entrega de veículos
- [ ] **Fase 8** — Dashboard, relatórios, empacotamento, E2E (Playwright)

## Documentação

- [docs/architecture.md](docs/architecture.md) — arquitetura e comunicação
- [docs/security.md](docs/security.md) — modelo de segurança
- [docs/database.md](docs/database.md) — modelagem e convenções
- [docs/development.md](docs/development.md) — guia de desenvolvimento
- [docs/decisions/](docs/decisions/) — ADRs (decisões arquiteturais)
