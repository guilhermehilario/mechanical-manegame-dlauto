# Plano de Correção — Auditoria de Segurança (mechanic-dlauto)

Cada correção segue o formato **Problema → Causa → Impacto → Correção →
Arquivos afetados → Testes → Validação (Antes → Correção → Teste →
Resultado)**. Ordem sugerida: **1 (crítico/imediato) → 2 (curto prazo) →
3 (médio prazo) → 4 (futuro)**.

> Regras de aplicação: nenhuma correção antes da conclusão da auditoria (docs
> `security-audit.md`, `findings.md` e este plano aprovados). Após corrigir,
> **não quebrar comportamento**: rodar suíte completa (lint, typecheck, testes
> 176 + 3 e2e, build, smoke) e revalidar o cenário empacotado. Atualizar este
> arquivo e o changelog ao final (seção [Changelog](#changelog)).

---

## Prioridade 1 — Imediato

### R1. Atualizar dependências com CVEs (SEC-01)

- **Problema**: `pnpm audit --prod` → 18 vulns (7 high / 9 moderate / 2 low)
  em multer 2.0.2 (uploads), file-type, qs, body-parser, deepmerge-ts,
  react-router.
- **Causa**: versões pinadas no lockfile anteriores aos patches
  (multer ≥ 2.3.0, qs ≥ 6.x patched, file-type patched, body-parser patched).
- **Impacto**: DoS/superfície conhecida em código em uso.
- **Correção**:
  - `apps/api`: mover para `@nestjs/platform-express` que resolva
    `multer@^2.3.0` (ou override explícito via `pnpm.overrides` no raiz);
  - revisar `file-type`, `qs`, `body-parser`, `deepmerge-ts`;
  - `apps/web`: atualizar `react-router` para versão sem CVEs;
  - rodar `pnpm audit --prod` até 0 (ou justificar resíduos com risco aceito).
- **Arquivos afetados**: `pnpm-workspace.yaml`/root `package.json`
  (overrides), `apps/api/package.json`, `apps/web/package.json`,
  `pnpm-lock.yaml`.
- **Testes**: suíte completa de testes da API + smoke (fluxo de upload
  incluído — `apps/api/tests/work-orders.spec.ts`).
- **Validação (Antes → Correção → Teste → Resultado)**:
  - Antes: `pnpm audit --prod` → 18 vulns.
  - Correção: bump de versões + `pnpm install`.
  - Teste: `pnpm audit --prod`; `pnpm test` (API), `pnpm build`, `pnpm smoke`.
  - Resultado: 0 ↛ vulns bloqueantes; suíte verde.

### R2. Habilitar o renderer empacotado (REL-01 + SEC-03)

- **Problema**: renderer empacotado não conversa com a API (`[object
  Promise]` na base URL e origem `null` não autorizada no CORS).
- **Causa**: preload assíncrono + contrato tipado errado no web
  (`preload.ts:9-11` vs `api-url.ts:8-14`); `api-process.ts` não injeta
  `CORS_ORIGIN` e default não inclui `null` (`bootstrap.ts:36-39`).
- **Impacto**: produto empacotado inoperante.
- **Correção**:
  - Passar a base URL ao preload de forma **síncrona** (via
    `webPreferences.additionalArguments` + `process.argv` no preload, ou
    `ipcRenderer.sendSync`) e tipar a bridge com `() => string` no web;
  - No `api-process.ts`, injetar `CORS_ORIGIN` explícita para o contexto
    empacotado **ou** condicionar `enableCors` a uma origin de loopback
    confiável (`null` só no fluxo desktop, com Bearer obrigatório).
- **Arquivos afetados**: `apps/desktop/src/main/*`, `apps/desktop/src/preload/*`,
  `apps/web/src/services/api-url.ts`, `apps/api/src/app/bootstrap.ts`,
  `packages/config/src/index.ts`.
- **Testes**: e2e empacotado (executar binário + validar login e render
  completo) + `pnpm test:e2e`.
- **Validação (Antes → Correção → Teste → Resultado)**:
  - Antes: binário abre, fetch → `[object Promise]/...`, CORS blocked.
  - Correção: base URL síncrona + CORS para a origin usada.
  - Teste: executar binário produzido; rodar `pnpm test:e2e`.
  - Resultado: login/render funcional do binário; CORS sem erro no devtools.

### R3. Aplicar menor privilégio nas rotas (SEC-02)

- **Problema**: `GET /users/:id`, `GET /dashboard/*`, `GET /reports/*`
  acessíveis a qualquer papel autenticado.
- **Causa**: ausência de `@RequireRoles` nessas rotas.
- **Impacto**: exposição de PII (e-mail/role de usuários) e dados financeiros
  a ATTENDANT/MECHANIC.
- **Correção**:
  - `users/:id` → `@RequireRoles('ADMIN', 'MANAGER')`;
  - `dashboard` → `@RequireRoles('ADMIN', 'MANAGER')` (validar regra de
    negócio com o dono do produto; se KPI operacional for aceitável para
    ATTENDANT, manter apenas o que não for financeiro);
  - `reports` → `@RequireRoles('ADMIN', 'MANAGER')`.
- **Arquivos afetados**: `apps/api/src/modules/users/users.controller.ts`,
  `apps/api/src/modules/dashboard/dashboard.controller.ts`,
  `apps/api/src/modules/reports/reports.controller.ts` + testes.
- **Testes**: novos casos 403 para ATTENDANT/MECHANIC nos 3 módulos.
- **Validação (Antes → Correção → Teste → Resultado)**:
  - Antes: token ATTENDANT → 200 em `reports/*` e `users/:id`.
  - Correção: adicionar `@RequireRoles` + testes de 403.
  - Teste: `pnpm test` (API), lint.
  - Resultado: ATTENDANT/MECHANIC recebem 403; ADMIN/MANAGER 200.

### R4. Remover credenciais padrão do código-fonte (SEC-04)

- **Problema**: `admin@oficina.local`/`admin1234` versionado em seed/smoke/e2e.
- **Causa**: necessidade de bootstrap local sem infraestrutura de secrets.
- **Impacto**: se o seed for reproduzido em ambiente real, comprometimento
  trivial. (Fluxo empacotado **não** executa seed — só `migrate deploy`.)
- **Correção**:
  - Ler senha/email do seed de variáveis de ambiente com **falha explícita**
    se ausentes (`process.env.SEED_ADMIN_*`);
  - nos scripts smoke/e2e, gerar senha aleatória por execução;
  - `.env.example` documenta as variáveis, sem valores.
- **Arquivos afetados**: `database/prisma/seed.ts`, `apps/api/smoke.ts`,
  `apps/e2e/scripts/prepare-e2e-db.mjs`, `database/prisma/seed.mjs` (se
  existir), `.env.example`.
- **Testes**: rerun de `pnpm seed`, smoke e `pnpm test:e2e` com a nova fonte
  de credenciais.
- **Validação (Antes → Correção → Teste → Resultado)**:
  - Antes: seed cria admin com senha fixa e commitada.
  - Correção: seed usa env; scripts geram senha aleatória.
  - Teste: `pnpm seed && pnpm smoke && pnpm test:e2e`.
  - Resultado: sem credencial padrão no repositório; fluxos verdes.

---

## Prioridade 2 — Curto prazo

### R5. Guard global de autenticação (SEC-05)

- **Problema**: ausência de `APP_GUARD` (rota nova "esquecida" nasce pública);
  `RolesGuard` allow-by-default.
- **Causa**: proteção por convenção (declaração manual em cada controller).
- **Impacto**: risco estrutural futuro (sem exploração atual).
- **Correção**: registrar `JwtAuthGuard` como `APP_GUARD` no `AppModule` e
  criar decorator `@Public()` com allowlist explícita (`/health`,
  `/auth/login`, `/auth/refresh`). Manter `RolesGuard` como está, mas exigir
  `@RequireRoles` nas rotas sensíveis.
- **Arquivos afetados**: `apps/api/src/app/app.module.ts`,
  `apps/api/src/modules/auth/*` (novo decorator), controllers com rotas
  públicas (health, auth), testes e2e de auth.
- **Testes**: e2e garantindo que rota sem `@Public()` exige token.
- **Validação**: antes → rota não guardada = pública; depois → 401 por
  padrão; resultado → mesmo comportamento público só via `@Public()`.

### R6. Atualizar Electron (SEC-06)

- **Problema**: Electron 33.2.1 fora de suporte.
- **Causa**: linha de versão antiga.
- **Correção**: atualizar para linha estável atual e revalidar o pacote.
- **Arquivos afetados**: `apps/desktop/package.json`, lockfile.
- **Testes**: `pnpm build && pnpm smoke`, abrir binário, `pnpm test:e2e`.
- **Validação**: antes → 33.2.1; depois → versão atual; teste → binário + e2e
  verdes.

---

## Prioridade 3 — Médio prazo

### R7. Permissões e cifragem em repouso (SEC-07)

- **Problema**: `userData`/`storage` em permissões padrão; PII e arquivos em
  texto plano.
- **Causa**: ausência de controle de permissões e cifragem.
- **Correção**: criar diretórios com `mode: 0o700`; avaliar AES-GCM para
  arquivos de imagem/assinatura e/ou SQLCipher; documentar trade-off de
  desempenho.
- **Arquivos afetados**: `apps/desktop/src/main/*`, `apps/api/src/common/storage/*`,
  decisão de arq. em `docs/decisions/`.
- **Testes**: unit (permissões) + revisão de desempenho local.

---

## Prioridade 4 — Futuro / decisão de produto

### R8. Políticas de sessão e integridade da assinatura (SEC-08)

- Revisar expiração (15 min/7 dias); decidir exigência legal de integridade
  da assinatura capturada (hash/assinatura digital sobre `signatureData`);
  se aplicável, sinalizar no UI o papel exigido para relatórios.

---

## Changelog (a preencher ao aplicar correções)

| Data | Item | Antes | Correção | Teste | Resultado |
| --- | --- | --- | --- | --- | --- |
| 2026-09-10 | Auditoria documentada | — | docs/security criado | — | 8 security findings + 1 funcional |
| 2026-09-11 | R1 (SEC-01) | 18 vulns (`pnpm audit --prod`) | overrides no root (`multer≥2.3`, `qs`, `body-parser`, `file-type`, `deepmerge-ts`) + `react-router` ≥ 7.18 no web | `pnpm audit --prod`, testes, build, smoke | 1 resíduo aceito: CVE-2026-35515 `@nestjs/core` (exige `@Sse()` — a API não possui; fix = migração major Nest 10→11, fora do escopo de estabilização) |
| 2026-09-11 | R2 (REL-01+SEC-03) | renderer empacotado quebrado (`[object Promise]` + CORS `null`) | preload síncrono via `additionalArguments`/`process.argv`; bridge tipada `() => string`; `api-process.ts` injeta `CORS_ORIGIN` da janela | typecheck desktop/web | bridge sincronizada; revalidação do binário pendente (R6) |
| 2026-09-11 | R3 (SEC-02) | `GET /users/:id`, `/dashboard/*`, `/reports/*` sem papel exigido | `@RequireRoles('ADMIN','MANAGER')` nos 3 controllers | smoke E2E: ATTENDANT → 403, ADMIN → 200 em rota financeira | menor privilégio aplicado |
| 2026-09-11 | R4 (SEC-04) | `admin@oficina.local`/`admin1234` versionados | seed EXIGE `SEED_ADMIN_*` do env (falha rápida); smoke usa as credenciais seedadas; e2e gera senha aleatória por execução (`.e2e-admin-password` gitignored); first-run admin do empacotado sem default | `pnpm db:seed` sem env falha; smoke/e2e verdes com env | nenhuma credencial padrão no repositório |
| 2026-09-11 | R6 (SEC-06) | Electron 33.2.1 (fora de suporte) | `electron@^43.7.0` (linha estável atual) | typecheck + build desktop | atualizado; revalidação do binário empacotado pendente |
| 2026-09-11 | R5 (SEC-05) | autenticação por convenção (`@UseGuards(JwtAuthGuard)` declarado por controller); rota nova esquecida nascia pública | `JwtAuthGuard` registrado como `APP_GUARD` (deny-by-default) + decorator `@Public()` com allowlist explícita (`/health`, `/auth/login`, `/auth/refresh`); guards redundantes removidos dos controllers (RolesGuard permanece por rota) | 6 unit tests do guard + smoke (health/login públicos, /users e /customers anônimos → 401) | rota nova só é pública com `@Public()` explícito |
|  |  |  |  |  |  |