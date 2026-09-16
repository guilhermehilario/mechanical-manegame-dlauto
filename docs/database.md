# Banco de dados

## Convenções (spec §17, §18, §34, §35)

| Convenção | Regra |
|---|---|
| Dinheiro | **Sempre `Int` em centavos** — nunca float (§18). Helpers em `packages/shared/src/money.ts` |
| Timestamps | `createdAt`/`updatedAt` em todas as tabelas (UTC) |
| PKs | `cuid()` client-generated — pré-requisito para sync futuro |
| Soft delete | `deletedAt` + `active` em cadastros (clientes, veículos, serviços, produtos, fornecedores) |
| Snapshot histórico | Itens da OS copiam nome/preço/quantidade no momento da execução — alterar cadastro **nunca** reescreve OS antiga (§35) |
| Migrations | Única forma de mudar o schema (`prisma migrate dev`) — nunca ALTER manual |

## Modelo atual (Fases 1–5)

```
users ──< refresh_tokens
users ──< audit_logs
users ──< stock_movements
customers ──< vehicles
customers ──< appointments ──> vehicles, services
customers ──< work_orders ──> vehicles
work_orders ──< work_order_service_items  (snapshot)
work_orders ──< work_order_product_items  (snapshot)
suppliers ──< products ──< stock_movements
services (catálogo)
sync_outbox (fila para sync futuro)
```

### customers
`name`, `cpf` (unique, armazenado como 11 dígitos normalizados), `phone`,
`email?`, `address?`, `notes?` + convenções de soft delete (`active`/`deletedAt`)
e timestamps. Índice em `name` para busca.

### vehicles
`customerId` FK → customers (**onDelete: Restrict** — não se apaga cliente com
veículos), `plate` (unique, normalizada para maiúsculas sem máscara — aceita
formato antigo `AAA9999` e Mercosul `AAA9A99`), `brand`, `model`, `year?`,
`color?`, `mileage?` + soft delete e timestamps. Índice em `customerId`.

### Regras da Fase 2
- CPF validado com dígitos verificadores; duplicata → `409 CPF_ALREADY_EXISTS`.
- Placa validada/normalizada no schema Zod compartilhado; duplicata →
  `409 VEHICLE_PLATE_ALREADY_EXISTS`.
- `DELETE /customers/:id` e `DELETE /vehicles/:id` fazem **soft delete**
  (`deletedAt` + `active=false`), preservando histórico de OS futura (§35).
- Busca em clientes por nome/CPF/telefone; em veículos por placa/marca/modelo.
  Paginação com limite máximo de 100 (§25).

### services (catálogo — Fase 3)
`name`, `description?`, `priceCents` (**Int em centavos**, §18),
`estimatedMinutes?` + soft delete e timestamps. Índice em `name`. Editar o
catálogo nunca reescreve OS antiga — os itens da OS carregam snapshot
próprio (§35).

### suppliers (Fase 3)
`name`, `cnpj` (unique, armazenado como 14 dígitos, validado com dígitos
verificadores), `phone`, `email?`, `address?`, `notes?` + soft delete e
timestamps. Duplicata → `409 CNPJ_ALREADY_EXISTS`.

### products (Fase 3)
`code` (unique, normalizado para maiúsculas), `name`, `description?`,
`costPriceCents`, `salePriceCents`, `stockQuantity` (Int ≥ 0), `minStock`,
`location?`, `supplierId?` FK (**onDelete: SetNull**) + soft delete e
timestamps. Duplicata de código → `409 PRODUCT_CODE_ALREADY_EXISTS`.

### Regras da Fase 3 (estoque — §36)
- `stockQuantity` **nunca** é editado direto: toda mudança passa por
  `POST /products/movements` dentro de transação (grava a movimentação e
  atualiza o produto atomicamente).
- Tipos de movimentação: `IN` (entrada), `OUT` (saída), `ADJUSTMENT`
  (define o total absoluto). Cada registro guarda `previousStock`/`newStock`
  (trilha audível) e `userId`.
- Saída que deixaria o estoque negativo → `409 INSUFFICIENT_STOCK`.
- Filtro `lowStock=true` lista produtos com `stockQuantity <= minStock`
  (comparação entre colunas via raw SQL no SQLite).

### appointments (Fase 4)
`customerId` FK → customers (**Restrict**), `vehicleId` FK → vehicles
(**Restrict**), `serviceId` FK → services (**Restrict**), `scheduledAt`
(UTC), `status` (SCHEDULED/CONFIRMED/IN_PROGRESS/COMPLETED/CANCELLED),
`notes?` + timestamps. Índices em `(vehicleId, scheduledAt)` (conflito),
`customerId` e `scheduledAt`.

### Regras da Fase 4 (agendamentos — §13)
- O veículo deve pertencer ao cliente informado → senão `422
  VEHICLE_NOT_OWNED_BY_CUSTOMER`.
- Conflito verificado **no backend** (nunca confiar no frontend): um veículo
  não pode ter dois agendamentos **ativos** (SCHEDULED/CONFIRMED/IN_PROGRESS)
  no mesmo horário → `409 APPOINTMENT_CONFLICT` (com o id do agendamento
  conflitante em `details`). Cancelados/concluídos não bloqueiam.
- Transições de status seguem a máquina de estados compartilhada
  (`@mechanic-system/shared/appointment-status`) — transição inválida →
  `409 INVALID_APPOINTMENT_TRANSITION`. Endpoint dedicado
  `PATCH /appointments/:id/status` (mecânicos podem avançar status).
- Reagendar agendamento concluído/cancelado → 409.
- Sem soft delete: exclusão definitiva é limpeza administrativa (ADMIN/MANAGER).

### work_orders (Fase 5)
`orderNumber` (unique, sequencial gerado no service — MAX+1 na transação de
criação), FKs `customerId`/`vehicleId` (**Restrict**), `status` (máquina de
estados §11), `notes?`, `approvedAt?`, `completedAt?` + timestamps.

### work_order_service_items / work_order_product_items (snapshot — §35)
Cada linha **copia** `serviceName/productName` e `unitPriceCents` no momento
da inserção — alterar o catálogo nunca reescreve a OS. Itens de peça têm
`discountCents`. FKs para a OS (**Cascade** na exclusão da OS) e para o
catálogo (**Restrict**). A linha de total é `unitPriceCents × quantity −
discountCents` (nunca negativa).

### work_order_images (Fase 6)
Bytes no disco via `StorageService` (`STORAGE_DIR`, endereçamento por
sha256 → dedup de conteúdo); no banco ficam apenas metadados: `storageKey`,
`sha256`, `mimeType` (allowlist JPEG/PNG/WebP/GIF validada por **magic
bytes**, não pelo header), `sizeBytes` (máx. 5 MB), `caption?`, `uploadedBy`
(SetNull). DELETE da OS cascata nas imagens; bytes só são removidos quando a
última referência ao mesmo conteúdo desaparece. Download serve bytes crus
(`StreamableFile`, fora do envelope JSON) com Content-Type correto.

### vehicle_pickups (Fase 7)
Comprovante de retirada, **1─1** com a OS (`workOrderId @unique`). Guarda
`receiverName`, `receiverDoc` (CPF/CNH, 11 dígitos), `receiverPhone?`,
`mileageKm?`, `signatureData?` (PNG base64 do canvas — evidência, não valor
legal), `notes?` e `registeredBy` (SetNull). O DELETE da OS é bloqueado
(Restrict) enquanto o comprovante existir. O registro e a transição da OS
para `DELIVERED` acontecem **na mesma transação** — nunca existe retirada
"pela metade".

### Histórico de manutenção (Fase 6 — derivado, §14)
`GET /work-orders/vehicle/:vehicleId/history` — consulta derivada sobre
work orders + itens snapshot, mais recente primeiro. **Sem tabela própria**:
como os itens já carregam snapshot (§35), o histórico nunca diverge da OS.

### Regras da Fase 5 (OS — §11/§35/§36)
- Máquina de estados compartilhada (`work-order-status`); transição inválida
  ou a partir de status final → `409 INVALID_WORK_ORDER_TRANSITION`.
  `approvedAt` é carimbado em `→ APPROVED`; `completedAt` em `→ COMPLETED`.
- Itens editáveis **apenas** em OPEN/IN_ASSESSMENT; depois → `409
  WORK_ORDER_ITEMS_LOCKED`.
- Adicionar peça = inserir snapshot + movimentação `OUT` **na mesma
  transação** (§36) — estoque insuficiente reverte o item. Remover peça
  estorna com `IN` (mesma transação). Nunca escreva no Prisma global dentro
  de uma transação interativa (deadlock no SQLite).
- `orderNumber` gerado por MAX+1 dentro da transação de criação (SQLite não
  suporta autoincrement fora da PK).

### users
| Campo | Tipo | Notas |
|---|---|---|
| id | cuid PK | |
| name | string | |
| email | string unique | login |
| passwordHash | string | argon2id, nunca sai daqui |
| role | enum | ADMIN/MANAGER/MECHANIC/ATTENDANT |
| active | boolean | desativação lógica |
| createdAt/updatedAt | datetime | |

### refresh_tokens
`tokenHash` (SHA-256 único), `userId` FK cascade, `expiresAt`, `revokedAt`.
Rotação a cada uso; reuso de token revogado revoga a família toda.

### audit_logs
`userId` (SetNull), `action`, `entity`, `entityId`, `metadata` (JSON string,
sem PII), `createdAt`. Índices em `(entity, entityId)` e `userId`.

### sync_outbox
`entity`, `entityId`, `operation` (CREATE/UPDATE/DELETE), `payload` (JSON),
`createdAt`, `syncedAt` (null = pendente). Índice em `syncedAt`.

## Modelo planejado (fases 5–7)

```
work_orders *─1 customers, *─1 vehicles
work_orders 1─* work_order_service_items  (snapshot: name, price, qty)
work_orders 1─* work_order_product_items  (snapshot: name, price, qty, discount)
work_orders 1─* work_order_images         (storage key, mime, size, sha256)
work_orders 1─1 vehicle_pickups ✓ (Fase 7 — comprovante de retirada)
products *─1 suppliers
stock_movements (toda movimentação via StockService, dentro de transação — §36)
```

**Histórico de manutenção não terá tabela própria** — é uma consulta
derivada sobre work orders por veículo (§14, sem duplicação de dados).

## Índices e constraints (planejados)

- `customers.cpf` unique ✓ (Fase 2); `vehicles.plate` unique ✓ (Fase 2); `products.code` unique ✓ (Fase 3); `suppliers.cnpj` unique ✓ (Fase 3); `work_orders.orderNumber` unique
- `(vehicleId, scheduledAt)` para checagem de conflito de agendamento ✓ (Fase 4)
- FKs com `onDelete` explícito (Cascade em tokens, Restrict/Protect em
  registros históricos, SetNull em auditoria)

## Backup e restauração (Fase 10)

- **Backup** = pasta em `BACKUP_DIR` com `manifest.json` (sha256 do snapshot,
  contagens, migração vigente), `database.db` (snapshot consistente via
  `VACUUM INTO` — WAL-safe, fecha a nota do ADR-001) e `storage/` (cópia das
  imagens).
- **Restore** (admin-only, `confirm: true` obrigatório): valida sha256 +
  `PRAGMA integrity_check` (via `ATTACH`) ANTES de tocar os dados vivos;
  `$disconnect` → swap atômico (rename) → `$connect`. Restore sem backup
  prévio não tem volta — por isso a confirmação explícita.
- **Permissões (R7/SEC-07)**: toda a área de dados (banco + WAL/SHM,
  `STORAGE_DIR`, `BACKUP_DIR`) é criada 0700 com arquivos 0600 — API no boot
  (`HardeningModule`) e Electron empacotado no main. Cifragem em repouso
  rejeitada por ora (trade-off em `docs/decisions/ADR-006-…`).
