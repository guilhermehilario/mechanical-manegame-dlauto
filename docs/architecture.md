# Arquitetura

## Visão geral

Sistema em camadas com comunicação estrita e unidirecional:

```
React (Renderer)            ← UI apenas, zero regra de negócio
   ↓
API Client (fetch tipado)   ← envelope unwrap, erros tipados
   ↓
NestJS Controller           ← validação de entrada (Zod pipes)
   ↓
Service / Use Case          ← REGRAS DE NEGÓCIO (único lugar)
   ↓
Repository                  ← único acesso ao banco
   ↓
SQLite (Prisma)             ← migrations versionadas
```

## Organização por domínio (não por tipo)

Cada módulo de negócio terá seu próprio conjunto de controller/service/
repository/dto/schemas/testes:

```
apps/api/src/modules/
  auth/        (implementado)
  users/       (implementado)
  customers/   (implementado — Fase 2)
  vehicles/    (implementado — Fase 2)
  services/    (implementado — Fase 3)
  products/    (implementado — Fase 3, inclui StockService)
  suppliers/   (implementado — Fase 3)
  appointments/(implementado — Fase 4, conflito no backend)
  work-orders/ (implementado — Fase 5/6, snapshots + estoque transacional,
               imagens com StorageService, histórico derivado por veículo)
  vehicle-pickups/ (implementado — Fase 7, comprovante 1─1 + → DELIVERED
               transacional)
```

Código transversal fica em `apps/api/src/common/` (erros, pipes, filtros,
interceptors, logging, **storage** — Fase 6) e em `apps/api/src/prisma/`
(acesso ao banco).

## Comunicação Electron ↔ React ↔ NestJS

1. O **main process** inicia a API como processo filho usando o runtime do
   próprio Electron (`ELECTRON_RUN_AS_NODE=1`) — a oficina não precisa de
   Node instalado. A API escuta em `127.0.0.1` com porta efêmera
   (`API_PORT=0`).
2. O main aguarda a API imprimir a porta final e carrega o renderer
   (dev server em dev, arquivos empacotados em produção).
3. O **preload** (contextBridge, sandbox) expõe apenas `getApiBaseUrl()` e
   `onApiReady()` — nenhuma API perigosa atravessa a ponte (spec §21).
4. O renderer conversa com a API por HTTP REST (`/api/v1`), exatamente como
   um web app faria — o que mantém a porta aberta para uma futura implantação
   cliente-servidor (spec §38).

## Pacotes compartilhados

| Pacote | Responsabilidade |
|---|---|
| `@mechanic-system/types` | Contratos de DTO/erros/códigos de erro (fonte única) |
| `@mechanic-system/shared` | Money em centavos, máquinas de estado (OS e agendamentos), regras de itens da OS |
| `@mechanic-system/validation` | Schemas Zod usados pela API **e** pelos formulários |
| `@mechanic-system/config` | Env validada no startup (a app não sobe inválida) |

Dependências entre pacotes (grafo acíclico):

```
config ← (independente)
types  ← validation ← shared
api/web/desktop ← todos acima
```

## Offline-first (spec §39)

- **v1:** tudo local (SQLite + API embutida). Funciona sem internet.
- **Fundamentos já no lugar:** PKs client-generated (cuid), timestamps UTC,
  soft delete, tabela `sync_outbox` onde os services de domínio registrarão
  operações para a futura fila de sincronização.
- **Futuro:** worker de sync drena o outbox para um servidor central;
  resolução de conflitos por LWW em `updatedAt` + regras específicas por
  entidade crítica (a ser detalhado em ADR próprio).

## Evolução planejada (não implementado)

Múltiplos usuários/filiais, estoque avançado, emissão de nota, pagamentos,
integrações (WhatsApp/mapas), armazenamento S3, backup/restauração e
impressão. A arquitetura (interfaces de storage, módulos por domínio,
envelope de erros estável) foi desenhada para acomodar esses itens sem
rewrites.
