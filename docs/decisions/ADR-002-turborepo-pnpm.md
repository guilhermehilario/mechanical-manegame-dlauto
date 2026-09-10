# ADR-002 — pnpm workspaces + Turborepo

**Status:** Aceito · **Data:** 2026-09-09 · **Fase:** 1

## Contexto

Monorepo com 3 apps (desktop, web, api) e 8 pacotes compartilhados,
TypeScript end-to-end, múltiplos pipelines (lint, typecheck, test, build).

## Decisão

- **pnpm workspaces** para ligação estrita entre pacotes (sem hoisting
  indevido de dependências, disco eficiente).
- **Turborepo** para orquestrar tarefas com cache e grafo de dependências
  (`build` depende de `^build`; `dev` é não-cacheável e paralelo).

## Consequências

**Positivas**
- Pacotes compartilhados compilam para `dist/` e são consumidos normalmente
  em produção (Electron/node) sem transpilação no runtime.
- `pnpm build` incremental: só reconstrói o que mudou.
- Um único lockfile determinístico.

**Negativas**
- `turbo` como dependência extra — aceitável pelo ganho de DX/CI.
