# TODO MVP — Caminho até o Produto Viável

> Objetivo deste documento: listar **todas as tarefas pendentes** até que o
> sistema seja um **produto viável** para funcionamento real no dia a dia da
> oficina — instalável, usável por uma equipe e seguro contra perda de dados.
>
> Baseado na análise de 2026-09-16: código, `docs/roadmap.md`, schema Prisma
> e quality gates executados (typecheck ✅, testes ✅ — 100 API + 17 web,
> build ✅). As Fases 1–10 estão concluídas; o que falta para o MVP são
> lacunas de **fluxo financeiro, impressão, distribuição, sessão e validação
> ponta a ponta**.
>
> Revisão posterior (2026-09-17): auditoria prática de todos os fluxos
> encontrou e corrigiu 2 bugs críticos de inicialização (DI), 1 bug de
> exclusão financeira e 4 bugs de integridade/sessão encontrados na revisão
> de código — ver seção "Revisão 2026-09-17" abaixo.

---

## Estado atual (o que já funciona)

- ✅ CRUD completo: clientes, veículos, serviços, produtos, fornecedores
- ✅ Agendamentos com conflito verificado no backend + agenda com transições
- ✅ Ordens de Serviço: máquina de estados, snapshots de preço, itens de
  serviço/peça, reserva/estorno de estoque transacional (inclusive **estorno
  registrado como movimento `IN` ao excluir a OS** — 2026-09-17),
  imagens com dedup
- ✅ Histórico derivado por veículo
- ✅ Retirada/entrega de veículos com comprovante + assinatura em canvas
- ✅ Dashboard (KPIs do dia) + relatórios com períodos
- ✅ Auth (Argon2id + JWT + refresh rotativo), RBAC 4 papéis, guard global
- ✅ Backup/restauração local manual + permissões 0700/0600
- ✅ Empacotamento autocontido Linux (API sidecar + renderer offline)
- ✅ Qualidade: 117 testes verdes, typecheck/lint/build passando, E2E básico
- ✅ Revisão 2026-09-17: **137 testes API + 29 testes web** verdes +
  typecheck/lint/build + smoke (`ALL CHECKS PASSED`), além de **verificação
  ao vivo** do estorno de estoque na exclusão de OS e do estorno
  cross-order (404) contra a API real — seção própria abaixo.

**Gaps para MVP:** a oficina consegue operar o "chão de fábrica" (agendar →
executar → entregar), mas **não fecha o caixa** (sem pagamentos), **não
imprime documentos**, exige **login a cada inicialização** e o binário
empacotado ainda não foi revalidado após as mudanças de segurança (R2/R6).

---

## Revisão 2026-09-17 — auditoria de fluxos (bugs corrigidos e achados)

Auditoria prática (API real + revisão de código + web) que fechou os gaps
de **funcionamento** encontrados após a Fase 11. Todos com teste.

### Correções aplicadas ✅

- **Estorno de estoque na exclusão de OS** 🔴 (bug de dados): `DELETE
  /work-orders/:id` devolvia peças reservadas mas **sem registrar movimento
  `IN`** — divergência de trilha e de saldo no backup/restauração.
  `WorkOrdersService.delete(id, userId)` agora roda em `$transaction`,
  cria um movimento `IN` (`Estorno de estoque por exclusão da OS <id>`)
  por item antes do delete. **Verificado ao vivo**: produto 5 → reserva 2
  → OS excluída → estoque volta a 5 e movimentos mostram o estorno.
- **Estorno cross-order** 🔴 (bug de segurança): `DELETE
  /work-orders/:id/payments/:paymentId` validava o pagamento por id, mas
  não **conferia se o `workOrderId` da rota batia com o do pagamento** —
  dava para estornar pagamento de outra OS passando outro id na URL.
  `PaymentsService.refund(paymentId, workOrderId, actingUserId)` agora
  garante a correspondência (`404 PAYMENT_NOT_FOUND`). **Verificado ao
  vivo**: estorno via rota de OS estranha → 404.
- **401/refresh morto** 🔴 (bug de sessão): o access token expira em 15 min
  (`JWT_ACCESS_EXPIRES`) mas o interceptor que deveria refrescar **não
  existia** — a sessão caía no meio do uso. `apps/web/src/services/api-client.ts`
  reescrito com `fetchWithAuth()` + `refreshAndRetry()` (single-flight,
  guarda anti-recursão) e `auth.service.ts` liga `onUnauthorized` →
  `refreshSession()`; se o refresh falha, limpa a store e volta ao login.
  Tests: 401 → 1 refresh + retry com token novo; sem retry em refresh
  mal-sucedido.
- **Painel de pagamentos sem lista** 🟡 (bug de UI): o `payments.service.ts`
  do web quebrou na refatoração do contrato (chamava `{ data }` onde a API
  responde `{ data: { items, totals, summary } }`) e a lista de pagamentos
  ficava **vazia para sempre**. DTO corrigido para `PaymentListResult` +
  painel consome `query.data.items` com `enabled` condicionado ao summary.
- **Edição de agendamento desconectada** 🟡 (bug de UI): o botão "Editar"
  abria o formulário em **modo criação** (`openForm()` sem os dados);
  `editingAppointment` + `openForm(appointment|null)` passam o agendamento
  real → o form pré-popula e chama `updateAppointment` no salvar.
- **Arquivos do storage com permissões demais** 🟡 (reforço R2): uploads e
  diretórios criados com modo padrão do umask; agora `mkdir` 0700 e
  `writeFile` 0600 (pastas já usavam 0700 no backup).
- **Ações da página de usuários sem gate de papel** 🟡 (bug de UI): a página
  listava para ADMIN/MANAGER (`GET /users` libera os dois), mas os botões
  "Novo usuário", "Redefinir senha" e "Desativar" apareciam para qualquer
  papel — e "Redefinir senha" também nos alvos MECHANIC/ATTENDANT, que o
  backend rejeita (`400`). Agora a UI espelha o backend: ações visíveis só
  para ADMIN e reset apenas em alvos ADMIN/MANAGER; MANAGER/MECHANIC veem a
  lista somente-leitura. Coberto por `users-page.test.tsx` (3 testes).

### Achados que NÃO são bug

- `pnpm --filter @mechanic-system/api start` falha ao subir: os `workspace:`
  dos `apps/desktop/staging` não compilam. **Limbo de env — caminho `start`
  está documentado errado** (o smoke usa `ts-node src/platform.ts`, que é o
  correto). Ajustar script no futuro.
- Boot anterior preso em `swc` (DI não resolveu) era o boundary de
  compilação cruzando os workspaces. Revertido para `ts-node` (funciona).
- Endpoint de veículos é `POST /vehicles` (body com `customerId`), não
  `POST /customers/:id/vehicles` — verificação ao vivo confirmou.
- E2E não roda com o dev server do usuário na porta 3001 (conflito de
  porta, `Error: ... is already used`).
- Artefato acidental `apps/api/apps/desktop/staging` removido (56K, não
  versionado).

### Ainda pendente

- **E2E completo** segue bloqueado (porta 3001 ocupada) e o **binário
  empacotado** ainda não foi revalidado (C1) — não retroceder essas duas
  tarefas do Bloco G / Bloco C.

---

## Bloco A — Fechamento do ciclo financeiro (Fase 11) 🔴 Crítico

Sem isso a OS não vira recebimento — é o maior bloqueio de produto.

- [x] **A1. Modelo `Payment` no schema** ✅ 2026-09-16: migration Prisma
  aplicada; `workOrderId` FK Restrict (1─N), `amountCents` (Int, §18),
  `method` (enum `PaymentMethod`: `CASH`, `PIX`, `DEBIT_CARD`,
  `CREDIT_CARD`, `TRANSFER`), `paidAt`, `receivedBy` (SetNull),
  `notes?` + timestamps.
- [x] **A2. Regras de negócio no service** ✅ 2026-09-16: soma dos
  pagamentos ≤ total da OS — check de saldo **dentro da mesma transação**
  do insert (`409 PAYMENT_EXCEEDS_BALANCE`, imune a overpay concorrente);
  múltiplos pagamentos parciais; recebimento só em OS pagável
  (`isPayableWorkOrderStatus` no pacote shared: `COMPLETED`/
  `AWAITING_PICKUP`/`DELIVERED` → `409 WORK_ORDER_NOT_PAYABLE`); estorno
  ADMIN/MANAGER com trilha `PAYMENT_REFUND` em `audit_logs` (primeiro uso
  real da tabela, atômico com o delete). **2026-09-17:** estorno agora
  valida o `workOrderId` da rota contra o do pagamento
  (`404 PAYMENT_NOT_FOUND` — antes dava para estornar pagamento de outra
  OS) + teste de estorno cross-order na suíte.
- [x] **A3. Endpoints** ✅ 2026-09-16: `POST /work-orders/:id/payments`,
  `GET /work-orders/:id/payments` (lista + summary),
  `GET /work-orders/:id/payments/summary`, `DELETE
  /work-orders/:id/payments/:paymentId` (RBAC: qualquer papel recebe;
  delete só ADMIN/MANAGER).
- [x] **A4. UI na OS** ✅ 2026-09-16: painel de pagamentos na tela de
  detalhe — badge (`PAGO`/`PARCIAL`/`AGUARDANDO`), total/pago/saldo,
  lista de pagamentos com estorno (ADMIN), formulário "Receber" com
  métodos + botão "Receber saldo" que preenche o restante. DTO da OS
  carrega `payment.paidCents/balanceCents/status` (null enquanto não
  pagável), então listas e dashboard mostram o estado financeiro.
  **2026-09-17:** corrigido o contrato do `payments.service.ts` do web
  (passou a consumir `data.items`/`totals`/`summary`) — a lista de
  pagamentos re-exibe em vez de ficar vazia.
- [x] **A5. Dashboard/relatórios** ✅ 2026-09-16: KPI "Recebido (caixa)"
  no dashboard — hoje e no mês, base `Payment.paidAt` (regime de caixa),
  ao lado da receita por OS entregue (competência). Novo relatório
  `GET /reports/payment-methods` (ADMIN/MANAGER) com receita por forma de
  pagamento no período + aba "Recebimentos" na página de relatórios
  (acessível via `/reports?tab=payments`). **Decisão documentada:** os
  relatórios da Fase 8 **não migram** — receita por OS entregue
  (competência) e recebimentos por `Payment` (caixa) são visões
  complementares; consultas em `AnalyticsRepository.paymentTotal` e
  `paymentTotalsByMethod` (group by method).
- [x] **A6 (parcial)** ✅ 2026-09-16: 13 testes unitários (11 do service
  de payments + 2 do relatório de formas) e KPIs cobertos nos testes do
  dashboard. Falta E2E do fluxo pagar parcial → saldo → PAGO (Bloco G).

## Bloco B — Impressão de documentos 🔴 Crítico

A oficina precisa entregar papel (OS, recibo). Hoje não existe fluxo algum.

- [x] **B1. Template de OS imprimível** ✅ 2026-09-16: botão "Imprimir OS"
  na tela de detalhe monta o documento (cabeçalho da oficina, cliente,
  veículo, serviços, peças com descontos, totais, observações, linhas de
  assinatura) via `printWorkOrder` (`apps/web/src/utils/print.ts`).
- [x] **B2. Recibo de retirada imprimível** ✅ 2026-09-16: botão "Recibo"
  em cada retirada (e na fila, para casos anteriores) busca o comprovante
  completo — novo endpoint `GET /vehicle-pickups/work-order/:id/receipt` com
  assinatura (data URL), modelo do veículo e total da OS — e imprime com
  termo de recebimento + assinatura renderizada.
- [x] **B3. Estratégia de impressão** ✅ 2026-09-16: `window.print()` +
  `#print-root` com CSS `@media print` dedicado (`index.css`) — zero
  dependências externas, funciona igual no navegador e no Electron
  empacotado (webContents imprime o mesmo DOM). Template removido do DOM
  no `afterprint`.
- [ ] **B4. Relatórios imprimíveis/exportáveis** (mínimo: imprimir a
  página; ideal: exportar CSV — sem libs externas).
- [ ] **B5. Teste E2E** que abre a versão de impressão da OS.

## Bloco C — Distribuição e operação na máquina da oficina 🔴 Crítico

- [ ] **C1. Revalidar o binário empacotado** (pendente desde R2/R6):
  `pnpm --filter @mechanic-system/desktop package:dir` → testar na máquina
  alvo: login, fluxo completo de OS, upload de imagem, assinatura, backup,
  impressão (B) e migração de primeira execução.
- [ ] **C2. Instalador Windows** (`electron-builder --win` já configurado
  no `package.json` do desktop): gerar NSIS e validar se o alvo da oficina
  é Windows — **decidir SO alvo antes**. (Se Linux, validar AppImage.)
- [ ] **C3. Doc de implantação** (`docs/deployment.md`): passo a passo do
  operador (instalar, primeiro acesso, backup diário, restauração) — sem
  jargão de desenvolvedor.
- [ ] **C4. Health check visível**: se a API sidecar falhar ao subir, o
  usuário hoje vê o app fechar silenciosamente (`console.error` + quit no
  main). Adicionar diálogo amigável "falha ao iniciar o sistema — tente
  novamente / contate o suporte".

## Bloco D — Sessão e operação multiusuário 🟡 Importante

- [x] **D1. Sessão persistente entre reinícios** ✅ 2026-09-16: o refresh
  token é espelhado no lado Node do Electron (`userData/session.json`,
  0600 — `apps/desktop/src/main/session-store.ts`) via IPC estreito
  (`session:save/clear/read` no preload); no boot o web faz silent refresh
  antes do primeiro paint (`restoreDesktopSession` em `main.tsx`). Tokens
  continuam fora do renderer/localStorage (anti-XSS, spec §20). Navegador
  sem bridge mantém o comportamento antigo (login por sessão).
- [x] **D2. UI de usuários (admin)** ✅ 2026-09-16: página `/users` (admin)
  com listar/buscar/paginar, criar usuário com papel, desativar e
  redefinir senha — `apps/web/src/modules/users/users-page.tsx`.
- [x] **D3. Redefinição de senha** ✅ 2026-09-16: `PATCH /users/me/password`
  (self-service, revoga sessões) + `PATCH /users/:id/password` (admin, só
  alvos ADMIN/MANAGER) + página `/change-password` no menu do usuário.
- [x] **D4. Politizar expiração** ✅ 2026-09-16: validado contra
  `packages/config` — access JWT 15 min (`JWT_ACCESS_EXPIRES`) e refresh
  rotativo 7 dias (`JWT_REFRESH_EXPIRES`), revogação total na troca/reset
  de senha. Comportamento documentado aqui e no `.env.example`.
- [x] **D5. Refresh automático no meio do uso** ✅ 2026-09-17: o interceptor
  de 401 existia só no papel — `api-client.ts` reescrito com
  `fetchWithAuth()` + `refreshAndRetry()` (single-flight, anti-recursão);
  expirar o access de 15 min no meio do dia nunca mais derruba o usuário
  (1 refresh + retry transparente). Se o refresh falhar (refresh expirado/
  revogado), limpa a store e volta ao login. Tests: refresh 1× com retry e
  sem retry em refresh falho.

## Bloco E — Proteção de dados em operação 🟡 Importante

- [x] **E1. Backup automático agendado** ✅ 2026-09-16:
  `BackupSchedulerService` na API (sweep no boot + intervalo
  `BACKUP_INTERVAL_HOURS`, cria só quando o mais novo está velho — restart
  não gera backup em cascata), retenção `BACKUP_KEEP` e logs estruturados.
  Env vars em `.env.example`; desativável com `BACKUP_AUTO_ENABLED=0`.
- [x] **E2. Alerta de backup ausente** ✅ 2026-09-16: `GET /backups/status`
  + banner no dashboard (`BackupAlertBanner`) quando não há backup ou o
  último tem mais de `BACKUP_ALERT_AFTER_HOURS`, com atalho "Fazer backup
  agora". Silencioso para papéis sem permissão.
- [ ] **E3. Teste de restauração em ambiente real**: restaurar um backup
  no binário empacotado e conferir integridade (o código tem testes, mas
  falta validação na máquina alvo).

## Bloco F — Onboarding e UX mínima 🟡 Importante

- [ ] **F1. First-run sem atrito**: `ensureFirstRunAdmin` exige
  `FIRST_RUN_ADMIN_*` via env/arquivo — no app empacotado isso significa
  edição manual de arquivo. Criar tela de "primeiro acesso" (definir
  senha do admin no primeiro login) ou assistente que escreve o segredo
  com permissão 0600. *(Verificar como o Electron main passa hoje essas
  vars ao sidecar e documentar.)*
- [x] **F2. Configurações da oficina** ✅ 2026-09-16: entidade singleton
  `shop_settings` (migration `add_shop_settings`) + módulo `settings` na API
  (`GET/PUT /settings`, leitura para todos, escrita ADMIN/MANAGER) + página
  "Configurações" no menu. Nome/telefone/endereço/rodapé alimentam o
  cabeçalho e rodapé dos documentos impressos (B1/B2).
- [ ] **F3. Dados de exemplo opcionais**: seed de catálogo básico
  (serviços comuns: troca de óleo, revisão...) desativado por padrão para
  facilitar a primeira semana de uso.
- [ ] **F4. Estados vazios consistentes**: revisar listagens sem dados
  (mensagem + CTA "criar primeiro registro").

## Bloco G — Qualidade e segurança remanescente 🟠 Desejável para MVP

- [ ] **G1. Ampliar E2E** (hoje: login, criar cliente, abas de relatórios):
  - Ciclo completo da OS: criar → itens → aprovar → executar → concluir →
    retirada com assinatura → pagamento (A6) → imprimir (B5).
  - Agendamento com conflito (409 visível na UI).
  - Estoque: venda de peça até estourar `INSUFFICIENT_STOCK`.
- [ ] **G2. R8 parcial**: assinatura como imagem já é aceito como
  evidência (não valor legal) — registrar decisão definitiva; expiração
  de sessão coberta em D4.
- [ ] **G3. Gate de `pnpm audit` no CI** quando houver pipeline remota.
- [ ] **G4. CI remota (GitHub Actions)**: lint + typecheck + testes + build
  + e2e + smoke (hoje é "CI local" via husky/turbo).

---

## Fora do escopo do MVP (não bloqueiam funcionamento)

Manter no `docs/roadmap.md` — pós-MVP: sync multi-oficina (Fase 12), nota
fiscal (NFSe/NFCe), integrações WhatsApp/mapas, storage S3, estoque
avançado (compras/inventário), multi-filiais, cifragem em repouso (ADR-006,
reavaliar com backup em nuvem).

---

## Ordem sugerida de execução

| # | Bloco | Entrega | Dependências |
|---|---|---|---|
| 1 | A — Pagamentos | Ciclo financeiro fechado | — |
| 2 | B — Impressão | Papel para cliente | F2 (dados da oficina) |
| 3 | E — Backup automático | Dados protegidos em produção | — |
| 4 | D — Sessão + usuários | Operação multiusuário viável | — |
| 5 | F — Onboarding + config | Instalação sem suporte técnico | B, F2 |
| 6 | C — Empacotamento/validação | Binário homologado na oficina | A, B, D, E |
| 7 | G — E2E completo + CI | Rede de segurança de regressão | A, B |

> C foi colocado por último de propósito: empacotar/homologar **depois** de
> o produto mudar de fato (A/B/D/F) evita revalidar o binário duas vezes.

---

## Checklist de aceite (Definition of Done do MVP)

Quando **todos** estiverem marcados, o sistema está apto a funcionamento real:

- [ ] Consigo criar OS, adicionar serviços/peças, receber pagamento
      (parcial e total) e ver "PAGO" na OS (A)
- [ ] Imprimo a OS e o recibo de retirada com dados da oficina (B, F2)
- [ ] Backup automático diário roda sozinho e o alerta de backup aparece
      quando atrasa (E)
- [ ] Funcionário (ATTENDANT) opera o dia inteiro sem ver rotas
      financeiras/admin; admin cria usuários e reseta senhas pela UI (D)
- [ ] Reabrir o app não exige login toda vez (ou decisão D1 documentada)
- [ ] Instalador (Windows/AppImage) instalado em máquina limpa **sem
      Node/internet** migra o banco, provisiona admin e opera offline (C)
- [ ] E2E do ciclo completo passa no binário empacotado (C1, G1)
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build && smoke && e2e`
      verdes na branch de release

---

*Manutenção: marcar `[x]` ao concluir e mover o bloco para o topo como
"Concluído". Atualizar também `docs/roadmap.md` (Fase 11) — mesmo padrão
das fases anteriores.*
