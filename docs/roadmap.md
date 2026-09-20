# Roadmap — Trabalho Pendente

> Status de referência: **Fases 1–8 concluídas** (ver [README](../README.md) —
> plano de fases). Este documento lista **tudo que está pendente** para
> planejarmos as próximas fases de desenvolvimento.
>
> Fontes: `docs/security/remediation-plan.md` (auditoria de segurança),
> `docs/architecture.md` (evolução planejada), análise do código atual.
> Última atualização: 2026-09-20.

---

## 1. Pendências da auditoria de segurança (correção prioritária)

A auditoria (`docs/security/findings.md`, 8 achados + 1 funcional) gerou um
plano em `docs/security/remediation-plan.md`. **R1–R4 e R6 foram aplicados na
Fase 9** (2026-09-11 — ver changelog do plano); restam:

| Ref | Item | Prioridade | Status |
|---|---|---|---|
| R1 | ✅ **Aplicado (Fase 9):** overrides + bumps (`multer≥2.3`, `qs`, `body-parser`, `file-type`, `deepmerge-ts`, `react-router`) — 18 vulns → 1 resíduo aceito (CVE-2026-35515 `@nestjs/core`, exige `@Sse()` que a API não usa; fix = migração Nest 10→11) | 1 — imediato | ✔ Concluído (resíduo aceito) |
| R2 | ✅ **Aplicado (Fase 9):** preload síncrono via `additionalArguments`, bridge tipada `() => string`, `CORS_ORIGIN` injetada no processo da API. *Pendente: revalidar o binário empacotado de ponta a ponta* | 1 — imediato | ✔ Aplicado (revalidação de binário pendente) |
| R3 | ✅ **Aplicado (Fase 9):** `@RequireRoles('ADMIN','MANAGER')` em `/users/:id`, `/dashboard/*`, `/reports/*` + verificação E2E no smoke (ATTENDANT → 403) | 1 — imediato | ✔ Concluído |
| R4 | ✅ **Aplicado (Fase 9):** sem credenciais padrão — seed/smoke exigem `SEED_ADMIN_*` do env; e2e gera senha aleatória por execução (`.e2e-admin-password` gitignored); first-run admin do empacotado sem default | 1 — imediato | ✔ Concluído |
| R5 | ✅ **Aplicado (Fase 9):** `JwtAuthGuard` global (`APP_GUARD`, deny-by-default) + `@Public()` com allowlist explícita (`/health`, `/auth/login`, `/auth/refresh`); `RolesGuard` permanece por rota | 2 — curto prazo | ✔ Concluído |
| R6 | ✅ **Aplicado (Fase 9):** Electron 33.2.1 → **43.7.0** (linha estável atual). *Pendente: revalidar o binário empacotado* | 2 — curto prazo | ✔ Aplicado (revalidação de binário pendente) |
| R7 | ✅ **Parcialmente aplicado (Fase 10):** permissões 0700/0600 em toda a área de dados (API boot + app empacotado); backup/restore locais funcionais; **cifragem rejeitada por ora** com justificativa (ADR-006) — reavaliar quando houver backup em nuvem (Fase 12) | 3 — médio prazo | ✔ Permissões concluídas · cifragem: decisão documentada |
| R8 | ✅ **Aplicado (decisão 2026-09-18):** assinatura do recibo é evidência (imagem capturada, sem valor criptográfico nem certificado) — decisão registrada em `ADR-007`; expiração de sessão mantida em 15 min/7 dias (D4) | 4 — futuro | ✔ Concluído (decisão documentada) |

> **Nota:** com R5 e R8 fechados, da auditoria restam apenas R7 (Permissões
> concluídas; cifragem rejeitada com justificativa no ADR-006) e a
> revalidação do binário empacotado (R2+R6), que exige rodar `pnpm --filter
> @mechanic-system/desktop package` e testar login/render na máquina alvo.

---

## 2. Offline-first: sync (spec §39) — fundamentos prontos, worker ausente

A infraestrutura existe, mas **nenhum código de sincronização foi escrito**
(0 referências a `syncOutbox` fora do schema):

- ❌ **Escrita no outbox:** os services de domínio ainda não registram
  operações na `sync_outbox` (tabela existe no schema, sem uso).
- ❌ **Worker de sync:** drenar o outbox para um servidor central.
- ❌ **Resolução de conflitos:** LWW em `updatedAt` + regras por entidade
  crítica (especificar em **ADR próprio** — ver `docs/architecture.md` §Offline-first).
- ❌ **Servidor central / API de sincronização** (contrato, autenticação, lote).

Pré-requisitos já no lugar: PKs `cuid` client-generated, timestamps UTC,
soft delete, `sync_outbox` no schema.

---

## 3. Evolução planejada (spec — "não implementado")

Listados em `docs/architecture.md` como evolution planejada; a arquitetura foi
desenhada para acomodá-los sem rewrites:

- ✅ **Backup/restauração** do banco SQLite — **feito (Fase 10, 2026-09-11)**:
  `VACUUM INTO` + storage com manifest sha256 e restore verificado (Bloco E em
  `docs/todo-mvp.md`); nota do checkpoint WAL permanece em `ADR-001`.
- ✅ **Impressão** (OS, recibo de retirada, relatórios) — **feito (Bloco B,
  2026-09-16/17)**: `window.print()` + `#print-root` com CSS `@media print`,
  zero dependências (B1–B5 em `docs/todo-mvp.md`).
- ✅ **Pagamentos** (múltiplas formas, parcial, baixa de receita) — **feito
  (Fase 11 / Bloco A, 2026-09-16/17)**: entidade `Payment`, saldo validado
  dentro da transação, estorno com trilha, painel na OS + relatório por forma.
- ❌ **Emissão de nota fiscal** (NFSe/NFCe — dependerá de decisão de produto
  e certificado digital).
- ❌ **Estoque avançado** (entradas por compra/NF, reservas além do fluxo
  atual de itens de OS, inventário).
- ❌ **Múltiplos usuários/filiais** (multi-tenant, sync multi-oficina).
- ❌ **Integrações:** WhatsApp (confirmação de agendamento/OS pronta), mapas
  (endereço do cliente).
- ❌ **Armazenamento S3** para imagens (a interface `StorageService` já isola
  a implementação — troca planejada).

---

## 4. Melhorias de qualidade (oportunidades, não bloqueiam)

- **Usabilidade (2026-09-20):** busca textual em **todas** as listagens +
  ordenação de colunas em **todas** as tabelas + **data configurável**
  (DD/MM/AAAA · AAAA/MM/DD · MM/DD/AAAA via aba "Data e hora" das
  Configurações). Pendência: commit (P1) e testes web das páginas novas (P2)
  em `docs/todo-mvp.md`.
- **E2E:** hoje **10 testes / 4 suítes** (`core-flow`, `work-order-flow`,
  `print`, `seed-catalog`) em portas isoladas (`E2E_API_PORT`/`E2E_WEB_PORT`).
  Ampliar: fluxo de **pagamento parcial** → saldo → PAGO (P4) e upload de
  imagem dirigido pela UI.
- **Acessibilidade/UX:** auditoria de teclado/foco nos modais e no signature pad;
  estados de carregamento/vazio consistentes entre páginas.
- **Observabilidade:** pino já estruturado; adicionar correlação de requestId
  por operação de negócio (base para suporte da oficina).
- **CI remota (G4):** ✅ **implementado (2026-09-18)** — `.github/workflows/ci.yml`
  (audit + quality + e2e + smoke); falta apenas push/ativação no repositório.
  A "CI local" (husky + turbo) continua funcionando.

---

## 5. Dívida técnica conhecida (pequena)

- `pnpm audit` hoje conta **dependências de produção** com CVEs (ver R1) —
  gate automático adicionado: `pnpm audit --prod --audit-level=high` (G3),
  embarcado no job `audit` da CI remota (G4).
- Nem todas as decisões recentes têm ADR (ex.: StorageService content-addressed,
  padrão transacional de estoque/retirada, bridge síncrona do Electron quando
  R2 for feito). Criar ADR-006+ para as próximas decisões relevantes.

---

## 6. Sugerido para as próximas fases

Ordenação proposta (cada fase = ~1 entrega coesa, mantendo o padrão atual de
gates: lint + typecheck + testes + build + smoke/e2e):

| Fase | Escopo | Por quê primeiro |
|---|---|---|
| **Fase 9** | ✅ **Concluída (2026-09-11):** R1 + R2 + R3 + R4 + R5 + R6 aplicados (ver changelog do plano de remediação). Restam como acompanhamento: revalidar o binário empacotado | Fecha 5 achados de segurança de alta prioridade; rota nova só nasce pública com @Public() explícito |
| **Fase 10** | ✅ **Concluída (2026-09-11):** backup/restauração locais (SQLite `VACUUM INTO` + storage, manifest com sha256, restore verificado) + permissões 0700/0600 (R7, ADR-006) | Protege o dado mais valioso do negócio (local-only hoje) |
| **Fase 11** | ✅ **Concluída (2026-09-16/17):** Pagamentos na OS (Bloco A) — entidade `Payment`, painel na OS, estorno com trilha e relatório por forma | Fecha o ciclo financeiro: orçamento → execução → recebimento |
| **Fase 12** | Sync offline-first (§2): outbox nos services + worker + ADR de conflitos | O grande diferencial de produto; exige servidor central |
| **Fase 13+** | Impressão, nota fiscal, estoque avançado, integrações, S3 (§3) | Expansão, conforme demanda do produto |

> Atualize este documento ao concluir cada fase (mesmo padrão do README).

---

> **Nota (2026-09-16):** o detalhamento executável das tarefas pendentes até
> o **produto viável (MVP)** — pagamentos, impressão, empacotamento/homologação,
> sessão, backup automático e onboarding — está consolidado em
> [docs/todo-mvp.md](todo-mvp.md).
>
> **Nota (2026-09-20):** para o **passo a passo operacional** (estado do
> working tree, gates, convenções e pendências de código), ver
> [docs/handoff.md](handoff.md).
