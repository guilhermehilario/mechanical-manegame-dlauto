# ADR-003 — Runtime TS da API: ts-node (tsc), não tsx (esbuild)

**Status:** Aceito · **Data:** 2026-09-09 · **Fase:** 1

## Contexto

Durante a Fase 1, rodar a API com `tsx` produzia 500 silenciosos no login
apesar de os testes unitários passarem. Causa raiz: **esbuild (tsx) não
emite metadados de decorator (`design:paramtypes`)**, e o DI do NestJS
depende deles. Construtores recebiam `undefined` sem nenhum erro de
compilação. Além disso, o transport worker do `pino-pretty` travava o boot
sob runners esbuild.

## Decisão

1. API roda com **`ts-node`** em desenvolvimento (emitDecoratorMetadata
   correto) e `node dist/platform.js` em produção (tsc).
2. **Sem transport in-process do pino**; logs são JSON e o pretty-print é
   feito por pipe: `pnpm dev:api | pnpm exec pino-pretty`.
3. Bootstrap com `logger: ['error', 'warn']` — nunca `logger: false`, para
   o filtro de exceções sempre registrar erros não tratados (§26).

## Consequências

**Positivas**
- DI do NestJS funciona; falhas de injeção aparecem como erros explícitos
  de resolução no boot (como deve ser).
- Logs de erro sempre visíveis (a falha silenciosa não se repete).

**Negativas**
- `ts-node` é mais lento que tsx para iniciar (~2–4 s). Aceitável: é custo
  de desenvolvimento; produção usa JS compilado.

## Nota para o futuro

Se a velocidade de boot dev tornar-se problema, avaliar `swc` com
`emitDecoratorMetadata` habilitado (suportado pelo Nest CLI) — nunca esbuild
puro enquanto o DI usar reflect-metadata.
