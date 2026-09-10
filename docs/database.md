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

## Modelo atual (Fases 1–2)

```
users ──< refresh_tokens
users ──< audit_logs
customers ──< vehicles
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

## Modelo planejado (fases 3–7)

```
customers 1─* appointments *─1 vehicles, *─1 services
work_orders *─1 customers, *─1 vehicles
work_orders 1─* work_order_service_items  (snapshot: name, price, qty)
work_orders 1─* work_order_product_items  (snapshot: name, price, qty, discount)
work_orders 1─* work_order_images         (storage key, mime, size, sha256)
work_orders 1─1 vehicle_pickups
products *─1 suppliers
stock_movements (toda movimentação via StockService, dentro de transação — §36)
```

**Histórico de manutenção não terá tabela própria** — é uma consulta
derivada sobre work orders por veículo (§14, sem duplicação de dados).

## Índices e constraints (planejados)

- `customers.cpf` unique ✓ (Fase 2); `vehicles.plate` unique ✓ (Fase 2); `products.code` unique; `work_orders.orderNumber` unique
- `(vehicleId, scheduledAt)` para checagem de conflito de agendamento
- FKs com `onDelete` explícito (Cascade em tokens, Restrict/Protect em
  registros históricos, SetNull em auditoria)
