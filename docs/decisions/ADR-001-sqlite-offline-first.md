# ADR-001 — SQLite + Offline-first

**Status:** Aceito · **Data:** 2026-09-09 · **Fase:** 1

## Contexto

A aplicação roda na máquina da oficina, usada por uma pessoa/equipe pequena.
O requisito do usuário (adicionado durante a Fase 1) é: **o sistema tem que
ser offline first**. Internet na oficina não é garantida.

## Decisão

1. **SQLite** como banco da v1, acessado via Prisma.
2. Arquitetura **offline-first**: API NestJS embutida no Electron
   (loopback, porta efêmera), zero dependência de rede para operar.
3. Fundamentos de sincronização futura desde o dia 1:
   - PKs client-generated (`cuid`) — sem colisão entre máquinas;
   - `createdAt/updatedAt` UTC em todas as tabelas;
   - soft delete em cadastros;
   - tabela `sync_outbox` para a futura fila de sincronização.

## Consequências

**Positivas**
- Instalação trivial (sem Docker/Postgres na oficina); backup = copiar um
  arquivo (com checkpoint WAL — ADR futuro); operação 100% offline.

**Negativas / mitigações**
- Sem `enum`/`decimal` nativos do Postgres → enums via strings + validação
  Zod; dinheiro como `Int` de centavos (que já é a regra §18).
- Numeração global de OS não é segura para multi-máquina futura → numeração
  por instalação + reconciliação no sync (a documentar em ADR de sync).
- Multiusuário simultâneo (múltiplas máquinas) exige servidor central →
  caminho planejado: mesmo schema Prisma com provider postgres; mudança
  isolada no datasource + migration (não afeta domínio).

## Alternativas descartadas

- **Postgres + Docker desde o início:** quebra o requisito offline e
  adiciona operação de infraestrutura na oficina.
- **Arquivos JSON locais:** sem integridade relacional, sem migrations.
