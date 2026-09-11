# Segurança

Princípio: **validar tudo na fronteira, confiar em nada do frontend**
(spec §19, §20).

## Autenticação

- Senhas com **Argon2id** (19 MiB, t=2, p=1 — baseline OWASP), nunca texto
  puro ou hashes fracos.
- **Access token** JWT curto (15 min), carrega `sub/email/name/role`.
- **Refresh tokens**: aleatórios (48 bytes), armazenados **apenas como hash
  SHA-256**, rotativos a cada uso, revogáveis por usuário.
- **Detecção de roubo**: reuso de refresh token revogado revoga toda a
  família do usuário (testado em `apps/api/tests/auth.spec.ts`).
- Login retorna erro **genérico** (`INVALID_CREDENTIALS`) — sem enumeração
  de usuários.
- Renderer guarda tokens **somente em memória** (nunca localStorage),
  limitando o impacto de qualquer XSS.

## Autorização

- **Autenticação global (R5/SEC-05, deny-by-default):** `JwtAuthGuard` está
  registrado como `APP_GUARD` no `AppModule` — toda rota exige token Bearer,
  exceto as explicitamente marcadas com `@Public()` (allowlist atual:
  `/health`, `/auth/login`, `/auth/refresh`). Uma rota nova "esquecida" nunca
  nasce pública.
- `RolesGuard` + `@RequireRoles(...)` para permissões por papel
  (ADMIN, MANAGER, MECHANIC, ATTENDANT), declarado por rota/controller onde
  aplicável.
- Menor privilégio por padrão: papel inicial de novos usuários é ATTENDANT.

## Proteção da API

- **Validação de entrada** por Zod em body/query/param
  (`ZodValidationPipe`) — detalhes de campo no erro, sem vazamento interno.
- **Rate limiting** global (@nestjs/throttler); `/health` isento.
- **Helmet** com headers padrão (CSP, nosniff, frameguard...).
- **CORS** restrito às origens configuradas (`CORS_ORIGIN`).
- API vinculada **apenas a 127.0.0.1** — nunca exposta à rede.
- **Envelope de erro estável** (`{ success, error: { code, message } }`);
  erros internos viram `INTERNAL_ERROR` genérico, **sem stack trace** em
  produção (spec §27).

## Electron (spec §21)

- `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`,
  `webSecurity: true`.
- Preload expõe superfície mínima via `contextBridge` (URL da API + evento
  de prontidão). Renderer não tem acesso a Node/fs/shell.
- Conteúdo sempre local (dev server ou arquivos empacotados).

## Dados sensíveis e privacidade (spec §41)

- Nunca retornar `passwordHash`, tokens ou segredos nas respostas
  (`PublicUser` é a forma de saída; testes cobrem isso).
- Logs estruturados (pino) com **redação de PII**: cpf, phone, email,
  password, tokens e headers de autorização nunca aparecem.
- Logs incluem request id (UUID) para correlação.

## Segredos (spec §30)

- `.env` nunca versionado; `.env.example` documenta sem valores reais.
- `packages/config` valida variáveis no startup e **recusa boot inválido**.
- Em produção os segredos chegam via env do processo (na oficina: gerados
  no empacotamento/primeira execução — ADR a definir na Fase 8).
