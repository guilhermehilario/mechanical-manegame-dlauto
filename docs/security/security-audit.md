# Auditoria de Segurança — mechanic-dlauto

> Relatório executivo. Para o detalhamento de cada achado veja
> [`findings.md`](./findings.md); para o plano de correção veja
> [`remediation-plan.md`](./remediation-plan.md).

- **Escopo**: aplicação completa — API (NestJS + Prisma + SQLite), renderer
  web (React/Vite), shell Electron (desktop), armazenamento local de uploads,
  banco de dados, autenticação/autorização, configuração de ambiente e
  dependências.
- **Data**: 2026-09-10
- **Metodologia**: revisão de código estática (com evidência arquivo:linha),
  verificação dinâmica (`pnpm audit --prod`, inspeção de configurações e
  guardas), e validação manual dos fluxos sensíveis (auth, upload, CORS,
  guards por rota). Nenhuma vulnerabilidade foi inventada; cada item abaixo é
  classificável em **Confirmado**, **Potencial** ou **Não identificado**.
- **Semante do contexto**: aplicação **single-tenant**, **offline-first**,
  com API vinculada a `127.0.0.1` (nunca exposta à rede) e banco SQLite local
  em `userData`. Isso reduz de forma decisiva a atratividade de exploração
  remota e o valor de grande parte dos vetores clássicos (XSS remoto, CSRF,
  SSRF, DoS na rede).

## Escopo coberto

| Área | Abrangência |
| --- | --- |
| Autenticação | Argon2id, JWT access, refresh rotativo com hash, detecção de roubo, resposta de login sem enumeração |
| Autorização | Guards por rota, `RolesGuard`/`@RequireRoles`, menor privilégio, IDOR/BOLA |
| Sessões/tokens | Vida curta (15 min), revogação, armazenamento em memória no renderer |
| Dados (PII) | CPF, telefones, e-mails, assinatura digital, relatórios financeiros |
| Uploads | Path traversal, type spoofing, limites, armazenamento content-addressed |
| Frontend/Electron | XSS, contexto isolado, bridge de preload, CORS do renderer empacotado |
| Infraestrutura/env | Segredos em git, `.env`, credenciais padrão, permissões de arquivo, versões do Electron |
| Dependências | `npm audit --prod`, versões críticas (multer, qs, file-type, body-parser) |

## Resumo executivo

A aplicação tem um **modelo de segurança bem estruturado e acima da média
para sistemas desktop single-tenant** (Argon2id segundo a baseline OWASP,
refresh tokens com hash e detecção de roubo, validação estrita de entrada via
Zod, uploads com verificação de magic bytes e armazenamento por hash, API
presa ao loopback). Nenhuma vulnerabilidade crítica ou alta foi confirmada
diante do contexto real de implantação.

As pendências mais relevantes são de **higiene de dependências** (CVEs em
pacotes em uso) e de **controle de acesso inconsistente** (rotas que leem
dados financeiros/PII sem restrição de papel), seguidas por um problema
**funcional do build de produção** que impede o renderer empacotado de se
comunicar com a API (disponibilidade), e por melhorias de postura
(guard global, Electron desatualizado, ausência de cifragem em repouso).

### Contagem por severidade

| Severidade | Security Findings |
| --- | --- |
| CRÍTICO | 0 |
| ALTO | 0 |
| MÉDIO | 4 |
| BAIXO | 3 |
| INFORMATIVO | 1 |

> Plus: **1 achado funcional (REL-01)** fora da classificação de segurança,
> mas com impacto na disponibilidade do produto empacotado e que mascara o
> achado SEC-03.

### Matriz de risco

| ID | Vulnerabilidade | Severidade | Local | Status |
| --- | --- | --- | --- | --- |
| SEC-01 | Dependências com CVEs em produtos usados (multer, qs, file-type, body-parser) | MÉDIO | dependências da API/web | Confirmado |
| SEC-02 | Controle de acesso inconsistente (users/:id, dashboard e reports sem restrição de papel) | MÉDIO | users/dashboard/reports controllers | Confirmado |
| SEC-03 | CORS não habilita a origin `null` (file://) do renderer empacotado | MÉDIO | bootstrap da API + api-process | Confirmado |
| SEC-04 | Credenciais padrão `admin1234` versionadas no código-fonte | MÉDIO | seed/smoke/e2e | Confirmado |
| SEC-05 | Autenticação por convenção (sem `APP_GUARD` global; RolesGuard permite por padrão) | BAIXO | guards/estrutura da API | Potencial |
| SEC-06 | Electron 33.2.1 desatualizado (CVEs conhecidos) | BAIXO | desktop | Confirmado |
| SEC-07 | Sem cifragem em repouso para PII/arquivos em `userData` | BAIXO | banco/armazenamento | Confirmado |
| REL-01 | Bridge de preload assíncrona quebra o renderer empacotado (`[object Promise]`) | ALTO (funcional) | preload/web | Confirmado |

## O que foi verificado e está SEGURO (Não identificado)

Item explicitamente testado, sem vulnerabilidade encontrada (com evidência):

1. **Injeção SQL** — todos os acessos a dados via Prisma (parametrizado);
   nenhum `$queryRaw`/`prisma.$executeRaw` com entrada do usuário encontrado.
2. **Path traversal em uploads** — `memoryStorage` (sem escrita por nome de
   arquivo do cliente), validação de **magic bytes** reais
   (`storage.service.ts:14-40`), MIME na allowlist (JPEG/PNG/GIF/WebP), limite
   de 5 MB e armazenamento **content-addressed** por SHA-256 — o nome original
   nunca é usado em caminho de disco.
3. **XSS clássico no renderer** — uso consistente de React (sem
   `dangerouslySetInnerHTML`, `eval`, `innerHTML`); arquivos de imagem
   validados por magic bytes antes de servir; API com headers `helmet`
   (CSP/nosniff).
4. **Armazenamento de senhas** — Argon2id com parâmetros OWASP (m=19456,
   t=2, p=1) e salt aleatório de 16 bytes (`password-hasher.ts:11-15`);
   nenhum hash fraco ou senha em texto puro armazenada.
5. **Design de refresh tokens** — token aleatório de 48 bytes, armazenado
   **apenas** como hash SHA-256, rotativo a cada uso e com revogação da
   família em detecção de reuso (`token.service.ts:41-99`). Sólido.
6. **CSRF** — autenticação por Bearer **no header** (não cookie), renderer
   sem cookies/session; CORS com lista explícita. Vetor não aplicável.
7. **Enumeração de usuários via login** — resposta única e genérica
   `INVALID_CREDENTIALS`; nenhuma distinção usuário-inexistente/senha-errada.
8. **Segredos em git** — `.env` ignorado (`.gitignore:13`) e **nunca
   commitado**; `.env.example` contém apenas placeholders; segredos reais
   (JWT) são gerados no **primeiro boot e persistidos em `userData`**
   (nunca no bundle).
9. **Comando/argument injection** — processos filho via `spawn` com array de
   argumentos, sem `shell: true`.
10. **SSRF** — nenhuma funcionalidade com URL controlada pelo usuário.

## Hall de confirmações positivas (referência)

As mitigações da spec §19–§21 estão presentes e efetivas:
`contextIsolation:true`, `sandbox:true`, `nodeIntegration:false`;
envelope de erro estável sem stack trace em produção; rate limiting global;
API restrita a `127.0.0.1`; menor privilégio no papel inicial de usuário
(ATTENDANT); tokens do renderer só em memória.

## Encaminhamento

Prioridades de correção em [`remediation-plan.md`](./remediation-plan.md).

---

## §29 — Síntese final da auditoria

### Resumo geral

- **Total de security findings**: 8 (4 MÉDIO, 3 BAIXO, 1 INFORMATIVO) + 1
  achado funcional **ALTO** de disponibilidade. **Zero** CRÍTICO/ALTO de
  segurança.
- A base de segurança é **boa e adequada ao contexto offline/single-tenant**:
  autenticação com Argon2id, refresh tokens com hash e detecção de roubo,
  validação de entrada estrita (Zod), uploads com magic bytes content-addressed,
  API restrita ao loopback e segredos nunca versionados (são gerados e
  persistidos localmente no first-run).

### Principais riscos

1. **Dependências com CVEs em uso real** (SEC-01): multer 2.0.2 usado nos
   uploads de imagens e qs/body-parser no parsing das requests têm CVEs
   conhecidos (6 tratando de DoS em multer; mitigado por ser ambiente local
   e autenticado, mas de correção trivial).
2. **Autorização por papel inconsistente** (SEC-02): `GET /users/:id`,
   `GET /dashboard/*` e `GET /reports/*` não restringem papel — qualquer
   funcionário autenticado (inclusive ATTENDANT/MECHANIC) lê e-mail de
   qualquer usuário e **métricas financeiras e relatórios**.
3. **App empacotado não funciona** (REL-01 + SEC-03): o preload expõe
   `getApiBaseUrl` assíncrona enquanto o renderer espera síncrona
   (`[object Promise]`), e a API não autoriza a origin `null` (file://)
   do renderer empacotado. Juntos, impedem a comunicação renderer↔API no
   build de produção.
4. **Postura de longo prazo** (SEC-05/06/07): ausência de guard global,
   Electron desatualizado, ausência de cifragem em repouso em userData.

### Controle de acesso (ownership / IDOR / BOLA)

- **IDOR/BOLA**: não identificado — todos os acessos a recursos por id
  pertencem ao fluxo lógico e o uso é por papel, não por propriedade
  (ferramenta única de escritório). A respiração "qualquer id" é esperada
  neste modelo.
- **Mass assignment**: não identificado — Zod `.strict()` em todos os
  schemas; campos extras são rejeitados.
- **Privilégio insuficiente**: identificado em 3 rotas (SEC-02), por
  ausência de `@RequireRoles` — não por guard faltando (JwtAuthGuard está
  presente em todos os controllers auditados).

### Autenticação

- Design **confirmado como seguro**: Argon2id OWASP; access JWT 15 min;
  refresh 48 bytes hasheados, rotativos e com revogação de família por reuso;
  login sem enumeração; tokens só em memória no renderer.
- Ressalvas: credenciais padrão `admin1234` **versionadas** para uso
  dev/smoke/e2e (SEC-04) — o fluxo empacotado não executa seed, mas o padrão
  deve ser removido.

### Infraestrutura

- **Sem segredos reais em git** (`.env` ignorado, nunca commitado).
- API **somente em 127.0.0.1**, porta efêmera no desktop.
- Consolidação: `CORS_ORIGIN` não endereça o renderer empacotado (SEC-03);
  Electron desatualizado (SEC-06).

### Dados (CPF, e-mail, tokens, senhas, arquivos, banco, logs)

- Senhas: **nunca armazenadas** em formato recuperável (Argon2id).
- Tokens: access em memória no renderer; refresh **somente hash** no banco.
- Arquivos de upload: content-addressed por hash, sem nome original.
- CPF/telefone/e-mail/assinatura: **em texto plano no SQLite local** de
  `userData` — aceitável para o contexto desktop single-user, porém sem
  permissões restritas nem cifragem em repouso (SEC-07).
- Logs: sem stack traces nem objetos de requisição sensíveis em produção
  (envelope `INTERNAL_ERROR`).

### Plano de ação

| Janela | Ações |
| --- | --- |
| **Imediato** | Atualizar dependências vulneráveis (multer ≥ 2.3.0 etc.) e Electron; corrigir `getApiBaseUrl` síncrona + CORS do file:// — restaura o app empacotado. |
| **Curto prazo** | Adicionar `@RequireRoles` em `users/:id`, `dashboard` e `reports`; remover credenciais padrão do código (seed p/ env); instalar `APP_GUARD` global com allowlist de rotas públicas. |
| **Médio prazo** | Restringir permissões do diretório `userData` (0700) e cifragem dos arquivos de imagem/assinatura; documentar/avaliar hash para assinatura digital; revisar periodicamente CVEs com `pnpm audit`. |
| **Futuro** | Assinatura de JWT com rotação automática de segredos armazenados em userData; cifragem opcional do banco (SQLCipher); telemetria de anomalias locais.