# ADR-004 — Dinheiro como inteiro em centavos

**Status:** Aceito · **Data:** 2026-09-09 · **Fase:** 1

## Contexto

Spec §18 proíbe float para valores monetários (erros de precisão binária:
`0.1 + 0.2 !== 0.3`). SQLite não tem tipo `DECIMAL` nativo confiável.

## Decisão

- Todo valor monetário é **`Int` de centavos** (`amountInCents`) no banco,
  na API e nos contratos compartilhados.
- Operações monetárias passam pelos helpers de
  `@mechanic-system/shared` (`sumCents`, `multiplyCents`,
  `applyDiscountCents`, `assertCents`) que validam limites e integridade
  inteira.
- Formatação BRL (`formatBRL`) existe apenas para a camada de apresentação.
- Entrada de usuário em reais (string decimal) → `parseToCents` na fronteira.

## Consequências

**Positivas**
- Aritmética exata; testes determinísticos; serialização JSON segura
  (números inteiros sem perda).

**Negativas**
- Campos de banco ficam em centavos (cuidado com relatórios/exportações —
  sempre converter na borda com `formatBRL`).
- Multiplicações que exijam frações de centavo (ex.: desconto percentual)
  devem calcular em centavos com arredondamento explícito documentado
  (half-up) — regra a centralizar no módulo de OS (Fase 5).
