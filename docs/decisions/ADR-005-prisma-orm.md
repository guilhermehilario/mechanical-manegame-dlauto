# ADR-005 — Prisma como ORM

**Status:** Aceito · **Data:** 2026-09-09 · **Fase:** 1

## Contexto

Necessidades: migrations versionadas (§17), consultas parametrizadas contra
SQL injection (§20), tipagem forte de ponta a ponta (§2.4), portabilidade
SQLite → Postgres (ADR-001).

## Decisão

- **Prisma 6** com schema único em `database/prisma/schema.prisma`.
- Acesso ao banco **somente** via `PrismaService` (`apps/api/src/prisma/`),
  injetado nos repositories — nenhum controller/service toca o client
  diretamente exceto via repository do domínio.
- Migrations com `prisma migrate dev` (dev) e `migrate deploy` (produção).

## Consequências

**Positivas**
- Client totalmente tipado gerado do schema; refactors seguros.
- Migrations SQL versionadas em Git (auditoria de schema).
- Troca de provider (sqlite→postgres) não muda o código de domínio.

**Negativas**
- Camada adicional de abstração sobre SQL — consultas muito específicas
  podem exigir `$queryRaw` (sempre tag-template parametrizado, nunca
  concatenação).
- `prisma generate` precisa rodar após mudanças de schema (script
  `pnpm db:generate` no turbo).
