# Handoff — Instruções para o próximo agente

> Leia isto ao iniciar qualquer sessão neste repositório. Última atualização:
> 2026-09-20. As pendências de produto estão em `docs/todo-mvp.md`; a visão
> de fases em `docs/roadmap.md`. Este arquivo é o **passo a passo
> operacional**: onde o trabalho parou e o que fazer em seguida.

---

## 1. Estado imediato (leia primeiro)

O trabalho de **filtros/ordenação em todas as tabelas** foi implementado e
**verificado**, mas **NÃO foi commitado**:

- **Busca textual (server-side)** nas listagens que faltavam: OS, Agendamentos
  e Retiradas. A API passou a aceitar `search` em `GET /work-orders`,
  `GET /appointments` e `GET /vehicle-pickups` (controller → service →
  repository, filtro `OR` em cliente/veículo/placa/nº; schemas de query já
  aceitavam `search` via `paginationQuerySchema`). Web: `listWorkOrders`/
  `listAppointments`/`listVehiclePickups` ganharam `search?` e os 3 pages
  ganharam o formulário de busca (padrão da página de Clientes).
- **Ordenação de colunas (cliente-side)** completada em: Backups (Data/Total),
  painel de Pagamentos da OS (Forma/Data/Valor) e Histórico do veículo
  (seletor data/total).
- **Correção extra de lint**: `apps/api/src/modules/customers/customers.repository.ts` —
  2 erros pré-existentes (`| undefined` desnecessário em `sortBy`/`sortDir`).

Arquivos alterados (sem commit): veja `git status`. Commits já feitos antes
dessa leva: `7d92aa8` (datas DD/MM/AAAA), `4bb5644` (aba "Data e hora"),
`8fed78a` (formato de data configurável).

**Gates verificados neste estado:** API **154/154**, web **60/60** (10 desktop
e 10 E2E à parte), `tsc --noEmit` limpo em API e web, `lint` limpo na API e
web (só warnings pré-existentes de fast-refresh em `icon-button.tsx` e
`work-orders-page.tsx`).

---

## 2. Como rodar os gates (não pule)

Os dev servers do usuário ficam no ar (API 3001, web 5173) — **não os
derrube**. E2E usa portas isoladas.

```bash
npm run typecheck --prefix apps/web
npm run typecheck --prefix apps/api
npm test --prefix apps/web        # vitest run
npm test --prefix apps/api
npm run lint --prefix apps/web
npm run lint --prefix apps/api
# E2E (portas isoladas, sobe o stack sozinho):
E2E_API_PORT=3101 E2E_WEB_PORT=5174 pnpm --filter @mechanic-system/e2e test:e2e
```

Credenciais de dev: `admin@oficina.local` / `admin-local-dev-2026`.

## 3. Convenções (resumo — detalhe em `docs/development.md`)

- Botar a regra de negócio **só no backend**; React = UI + estado de
  apresentação. Nunca confiar em validação de frontend.
- Envelope da API: `{ success, data }`; erros com `code` (ex.:
  `ApiClientError.code === 'PAYMENT_EXCEEDS_BALANCE'`).
- Dinheiro em **centavos inteiros** (`formatBRL`, `@mechanic-system/shared/money`).
- **Datas**: fonte única `apps/web/src/utils/datetime.ts` + hook
  `useDateTime()` (dá `dateFormat`/`timeFormat` da Configuração). Nunca
  formatar data com outra função. Utensílios: `formatDate(iso, dateFormat)`,
  `formatDateTime(iso, dateFormat, timeFormat)`. Datas "só de dia" usam
  getters UTC para não sofrer shift de fuso.
- **Impressão**: templates (`apps/web/src/utils/print.ts`) **nunca fazem
  fetch** — recebem os dados (ex.: `printWorkOrder(data, dateFormat)`) e
  imprimem via `window.print()` + `#print-root`.
- Testes web: **sem jest-dom** (use `toBeTruthy`/`toBeNull`), vitest sem
  globals, `Paginated` exige `limit`. Feedbacks visuais via
  `getByText`/`getByPlaceholderText`.
- Pacote `validation` compartilha os schemas Zod (API + formulários).
- Sem `any`, sem `any` implícito; cada arquivo = uma responsabilidade
  (< ~300 linhas).

## 4. Pendências prioritárias (do `docs/todo-mvp.md`)

| # | Item | Dica de onde mexer |
|---|---|---|
| P1 | **Commitar filtros/ordenação** (aguarda o usuário pedir) | `git status` + mensagem no estilo: `feat(web): search + column sorting on all tables` |
| P2 | **Testes web** das páginas novas (`*.test.tsx` para work-orders-page, appointments-page, vehicle-pickups-page, backups-page, painel de pagamentos) | espelhar `settings-page.test.tsx`/`services-page.test.tsx` |
| P3 | **Cobertura da busca na API** (work-orders/appointments/vehicle-pickups `search`) | `apps/api/tests/*.spec.ts`, padrão de mock de repo existente |
| P4 | **E2E pagamento parcial** → saldo → PAGO | `apps/e2e/tests/work-order-flow.spec.ts` |
| P5 | **Script `start` da API** documentado errado (`node dist` vs `ts-node src/platform.ts`) | `apps/api/package.json` + `docs/development.md` |
| P6 | Ordenação em sub-tabelas (veículos do cliente, itens da OS, receita dos relatórios, agenda do dashboard) | opcional |
| P7 | Limpeza do hook legado `use-time-format.ts` | opcional |

## 5. Bloqueios que dependem do usuário (não crie trabalho paralelo)

- **C1/C2/C3 e E3**: homologação do binário na **máquina alvo da oficina**
  (AppImage Linux vs instalador Windows — **decidir o SO alvo primeiro**).
- **G4**: dar **push** e habilitar **GitHub Actions** no remote
  (`git@github.com:guilhermehilario/mechanical-manegame-dlauto.git`) — o
  workflow já está em `.github/workflows/ci.yml` (4 jobs validados localmente).

## 6. Fazer quando uma tarefa acabar

1. Rodar os gates da seção 2 (incl. lint nas duas apps).
2. Commitar no padrão Conventional (mensagens curtas e descritivas).
3. Atualizar `docs/todo-mvp.md` (marcar `[x]`, mover para "Estado atual",
   atualizar contagens de teste) e este `handoff.md` — é a memória de
   trabalho da próxima sessão.