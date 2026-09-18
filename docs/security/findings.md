# Achados — Auditoria de Segurança (mechanic-dlauto)

Detalhamento individual de cada achado com evidência. Cada finding segue o
formato: **Título, Severidade, Categoria, Local, Arquivo, Linha, Descrição,
Evidência, Impacto, Probabilidade, Exploração, Correção recomendada,
Prioridade**.

Classificações: **Confirmado** (evidência direta no código/execução),
**Potencial** (padrão de risco, sem exploração atual), **Não identificado**.

Índice:

| ID | Severidade | Achado |
| --- | --- | --- |
| [SEC-01](#sec-01) | MÉDIO | Dependências com CVEs em produtos usados |
| [SEC-02](#sec-02) | MÉDIO | Controle de acesso inconsistente (users/:id, dashboard, reports) |
| [SEC-03](#sec-03) | MÉDIO | CORS não habilita origin `null` do renderer empacotado |
| [SEC-04](#sec-04) | MÉDIO | Credenciais padrão versionadas no código-fonte |
| [SEC-05](#sec-05) | BAIXO | Autenticação por convenção (sem `APP_GUARD` global) |
| [SEC-06](#sec-06) | BAIXO | Electron 33.2.1 desatualizado |
| [SEC-07](#sec-07) | BAIXO | Sem cifragem em repouso para PII/arquivos |
| [SEC-08](#sec-08) | INFORMATIVO | Fricções de sessão e limites (jornada) |
| [REL-01](#rel-01) | ALTO (funcional) | Bridge de preload assíncrona quebra renderer empacotado |

---

## SEC-01 — Dependências com CVEs em produtos usados

- **Severidade**: MÉDIO
- **Categoria**: Supply chain / Dependências
- **Local**: dependências de produção da API e do renderer
- **Arquivo**: `apps/api/package.json` (multer 2.0.2), `apps/web/package.json`,
  lockfile `pnpm-lock.yaml`
- **Linha**: `apps/api/package.json` → `@nestjs/platform-express@10.4.22` (dependência
  transitiva multer 2.0.2); upload usa `FileInterceptor`/`memoryStorage` em
  `work-order-images.controller.ts:73-77`

**Descrição**: `pnpm audit --prod` reporta **18 vulnerabilidades
(7 high, 9 moderate, 2 low)**. As mais relevantes para produtos **em uso
real** pela aplicação: multer 2.0.2 (6 CVEs de DoS — campos sobressalentes,
multipart profundamente aninhado, bypass de limite via `fileFilter`),
file-type (loop infinito no parser ASF e ZIP bomb), qs (DoS `stringify`,
bypass de array-limit — usado no parsing de query strings de todos os
endpoints), body-parser (DoS de limite), deepmerge-ts (stack exhaustion) e
react-router (open redirect/constructor injection via `Link`).

**Evidência**:

```
$ pnpm audit --prod
18 vulnerabilities found
Severity: 2 low | 9 moderate | 7 high
```
```
│ high │ Multer vulnerable to Denial of Service via incomplete [multipart]  │
│ high │ Multer Vulnerable to Denial of Service via ...  (6 advisories)     │
│ moderate │ file-type: Infinite loop in ASF parser / ZIP Decompression Bomb │
│ moderate │ qs DoS / array-limit bypass; react-router open redirect        │
```

- Upload de imagens exercita multer em `apps/api/src/modules/work-orders/work-order-images.controller.ts:73-77`
  (`FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 5*1024*1024 } })`);
  bucket permite JPEG/PNG/WebP/GIF (magic bytes em `storage.service.ts:14-40`).
- Parsing de query strings exercita qs em **todos** os endpoints paginados.

**Impacto**: DoS/indisponibilidade do serviço local se uma dessas rotas for
alcançada por um agente autenticado com payloads malformados. No contexto
(banco e API no mesmo processo local, single-tenant), o valor prático do
ataque é baixo, mas a superfície existe e é exercitada por código em uso
(não é dependência morta).

**Probabilidade**: baixa (exige agente autenticado e cenário local/offline).

**Exploração**: demonstração padrão das CVEs acima contra `/api/v1/...`
(envio de multipart malformado em upload, `qs` com arrays aninhados).

**Correção recomendada**: atualizar multer para **≥ 2.3.0** (patched para
todos os CVEs), `@nestjs/platform-express` para versão que resolva multer
atualizado, e revisar `file-type`, `qs`/`body-parser` e `react-router` para
versões com patch (ver `remediation-plan.md`).

**Prioridade**: 1 (imediato — correção barata, baixo risco de regressão;
revalidar com a suíte de testes).

---

## SEC-02 — Controle de acesso inconsistente (users/:id, dashboard, reports)

- **Severidade**: MÉDIO
- **Categoria**: Autorização / menor privilégio
- **Local**: módulos `users`, `dashboard`, `reports`
- **Arquivo**: `apps/api/src/modules/users/users.controller.ts:42-49`,
  `apps/api/src/modules/dashboard/dashboard.controller.ts:7-9`,
  `apps/api/src/modules/reports/reports.controller.ts:17-19`
- **Linha**: `users.controller.ts:42` (`@Get(':id')` sem `@RequireRoles`),
  `dashboard.controller.ts:7-9`, `reports.controller.ts:17-19` (só
  `@UseGuards(JwtAuthGuard, RolesGuard)`, sem `@RequireRoles`)

**Descrição**: o padrão correto (documentado em `docs/security.md`
"Autorização") exige `@RequireRoles(...)` junto com os guards. Três rotas
fogem disso:

1. `GET /api/v1/users/:id` — qualquer role autenticado (inclusive ATTENDANT
   e MECHANIC) enumera usuários por id e lê `name`, `email` e `role`.
   Inconsistente com `GET /users` (que exige `ADMIN`/`MANAGER`).
2. `GET /api/v1/dashboard/*` — sem restrição de papel: qualquer autenticado
   vê **indicadores financeiros/de receita**.
3. `GET /api/v1/reports/*` — sem restrição de papel: qualquer autenticado
   gera **relatórios financeiros** (receita, imposto, etc.).

**Evidência**:

```ts
// users.controller.ts:42-49
@Get(':id')
async getById(...) { ... }                      // sem @RequireRoles

// dashboard.controller.ts:7-9
@UseGuards(JwtAuthGuard, RolesGuard)            // sem @RequireRoles
@Controller('dashboard')
export class DashboardController { ... }

// reports.controller.ts:17-19
@UseGuards(JwtAuthGuard, RolesGuard)            // sem @RequireRoles
@Controller('reports')
export class ReportsController { ... }
```

**Impacto**: exposição além do mínimo necessário — dados de PII (e-mail) de
todos os usuários e dados financeiros do negócio disponíveis a qualquer
funcionário autenticado. Não é IDOR (sem violação de propriedade), mas é
**violação do princípio de menor privilégio** e da regra da spec §20.

**Probabilidade**: alta — qualquer funcionário com login real na oficina
acessa os dados.

**Exploração**: `curl -H "Authorization: Bearer <token de ATTENDANT>"
http://127.0.0.1:3001/api/v1/reports/...` → 200 com dados financeiros.

**Correção recomendada**: adicionar `@RequireRoles` apropriado nas 3 rotas
(`users/:id` → `ADMIN`, `MANAGER`; `dashboard`/`reports` → conforme a regra
de negócio, ex. `ADMIN`, `MANAGER`). Decidir explicitamente se ATTENDANT/
MECHANIC devem ver qualquer métrica financeira (recomendado: não).

**Prioridade**: 1 (imediato — correção pontual, coberta por testes).

---

## SEC-03 — CORS não habilita a origin `null` (file://) do renderer empacotado

- **Severidade**: MÉDIO
- **Categoria**: Configuração / disponibilidade do produto empacotado
- **Local**: bootstrap da API e processo filho do desktop
- **Arquivo**: `apps/api/src/app/bootstrap.ts:36-39`,
  `apps/desktop/src/main/api-process.ts:36-49`,
  `packages/config/src/index.ts:17`
- **Linha**: `bootstrap.ts:36-39` (`app.enableCors({ origin: env.CORS_ORIGIN.split(','), credentials: true })`);
  `api-process.ts` **não injeta** `CORS_ORIGIN` no ambiente do processo filho
  no modo empacotado; default em `packages/config/src/index.ts:17`
  (`CORS_ORIGIN: z.string().default('http://localhost:5173')`)

**Descrição**: no build empacotado o renderer é servido de `file://`
(origin `null`), e o Chrome bloqueia a leitura de respostas cross-origin sem
`Access-Control-Allow-Origin: null`. Como a API só autoriza origens listadas
(nunca `null`) e o processo filho herda apenas o env passado em
`api-process.ts:36-49`, **o renderer empacotado não consegue ler as respostas**
mesmo depois de corrigido o REL-01. No dev (Vite em `localhost:5173`) funciona
porque `localhost:5173` está na allowlist.

**Evidência**:

```ts
// bootstrap.ts:36-39
app.enableCors({
  origin: env.CORS_ORIGIN.split(',').map((o) => o.trim()),
  credentials: true,
});

// api-process.ts:36-49 — pacote completo: NÃO define CORS_ORIGIN
env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', NODE_ENV: 'production',
       API_PORT: '0', DATABASE_URL: ..., STORAGE_DIR: ..., JWT_*_SECRET: ... }
```

**Impacto**: o produto empacotado fica inoperável mesmo após a correção do
REL-01 (disponibilidade); a superfície de CORS também **não restringe por
origem** a comunicação entre processos locais (mitigado pelo bind 127.0.0.1
e token Bearer).

**Probabilidade**: certa no fluxo empacotado (config), após REL-01 corrigido.

**Exploração**: abrir o app empacotado após corrigir o preload → todas as
requisições `http://127.0.0.1:<porta>/api/v1/*` retornam sem header
`Access-Control-Allow-Origin` → console marca "blocked by CORS policy".

**Correção recomendada**: no desktop empacotado não há necessidade de CORS
browser (mesmo processo, mesma máquina). Opções: (a) habilitar CORS apenas
quando uma origin explícita for fornecida e, no fluxo desktop, permitir a
origin específica usada (ou injetar `CORS_ORIGIN=null` no filho);
(b) preferir injeção via env com header `Access-Control-Allow-Origin: <origin>`
autenticado pelo Bearer. Manter `credentials: true` somente com lista
explícita.

**Prioridade**: 1 (imediato, junto com REL-01 — restaura o produto).

---

## SEC-04 — Credenciais padrão versionadas no código-fonte

- **Severidade**: MÉDIO
- **Categoria**: Higiene de credenciais
- **Local**: scripts de seed/smoke/e2e
- **Arquivo**: `database/prisma/seed.ts:17-18`, `apps/api/smoke.ts:75`,
  `apps/e2e/scripts/prepare-e2e-db.mjs:27`
- **Linha**: `seed.ts:17-18` (`email: 'admin@oficina.local'`, senha
  `'admin1234'`); `smoke.ts:75`; `prepare-e2e-db.mjs:27`

**Descrição**: o par `admin@oficina.local` / `admin1234` (hash Argon2id
gerado em runtime) está **commitado** no repositório, usado por seed,
smoke test e preparação do banco e2e.

**Importante (mitigação real)**: o fluxo **empacotado não executa seed** —
apenas `prisma migrate deploy` no first-run (`api-process.mjs:141-175`), e o
banco de produção começa **vazio** (sem usuário admin). O risco real é de
**padrão frágil**: uso inadvertido em dev/CI e o risco de alguém replicar o
par em um banco de produção/importação manual.

**Evidência**:

```ts
// database/prisma/seed.ts:17-18
const adminPassword = 'admin1234';
// ... create({ email: 'admin@oficina.local', passwordHash: await hash(adminPassword) })

// api-process.mjs:159 — first-run só faz migrate deploy (sem seed)
spawn(..., [prismaCli, 'migrate', 'deploy', '--schema', schemaPath], ...)
```

**Impacto**: se o seed for reproduzido em qualquer ambiente real, acesso
administrativo trivial compromete toda a instalação local (dados financeiros
e PII). Probabilidade de exploração real: baixa no fluxo atual.

**Exploração**: reproduzir `seed.ts` (ou CI) contra um banco em uso →
login `admin@oficina.local`/`admin1234`.

**Correção recomendada**: obter senhas padrão de **variáveis de ambiente**
(com falha se ausentes), exigir senha no primeiro boot no fluxo desktop e
restringir o seed obrigatoriamente a ambientes de dev/test.

**Prioridade**: 1 (correção simples e de baixo risco).

---

## SEC-05 — Autenticação por convenção (sem `APP_GUARD` global)

- **Severidade**: BAIXO
- **Categoria**: Arquitetura / defesa em profundidade
- **Local**: estrutura de guards da API
- **Arquivo**: `apps/api/src/modules/auth/roles.guard.ts:20-29`,
  `apps/api/src/app/app.module.ts` (providers sem `APP_GUARD`)
- **Linha**: `roles.guard.ts:24` (`if (!required || required.length === 0) return true;`)

**Descrição**: a proteção das rotas depende de cada controller declarar
`@UseGuards(JwtAuthGuard, RolesGuard)`. Não há `APP_GUARD` global. O
`RolesGuard` **permite por padrão** quando o handler não declara
`@RequireRoles` (linha 24). Auditados todos os controllers atuais → **todos
possuem `JwtAuthGuard`** (nenhuma rota pública desprotegida encontrada
hoje — status **Potencial**), mas o padrão estrutura o sistema para que um
novo controller "esquecido" nasça público. O erro já aconteceu na prática:
3 rotas nasceram com guard mas sem role (SEC-02).

**Evidência**:

```ts
// roles.guard.ts:20-29
const required = this.reflector.getAllAndOverride(ROLES_KEY, [handler, klass]);
if (!required || required.length === 0) return true;   // allow-by-default
```

**Impacto**: regressão futura silenciosa (rota nova acessível sem
autenticação). Sem impacto hoje.

**Probabilidade**: potencial — exige erro de desenvolvimento futuro.

**Correção recomendada**: registrar `JwtAuthGuard` como `APP_GUARD` global e
manter um mecanismo explícito (ex. `@Public()` com decorator dedicado) para
as rotas públicas (`/health`, `/auth/login`, `/auth/refresh`). Para o
`RolesGuard`, inverter para *deny-by-default* quando a rota declara `@RequireRoles`
(manter o atual, mas incentivar declarar roles em toda rota que acessa
recurso sensível) ou exigir `@RequireRoles` nas rotas de módulos sensíveis.

**Prioridade**: 2 (curto prazo — sem exploração atual).

---

## SEC-06 — Electron 33.2.1 desatualizado

- **Severidade**: BAIXO
- **Categoria**: Supply chain / versão de runtime
- **Local**: `apps/desktop/package.json`
- **Arquivo**: `apps/desktop/package.json` (`"electron": "^33.2.1"`)
- **Linha**: campo `dependencies`/`devDependencies`

**Descrição**: o Electron 33.x saiu de suporte; várias correções de
segurança do Chromium/Node/V8 (incluindo CVEs) foram lançadas em releases
posteriores (34/35/36...). O app desktop entrega esse runtime embarcado.

**Impacto neste contexto**: mitigado por `contextIsolation:true`,
`sandbox:true`, `nodeIntegration:false`, API restrita ao loopback e ausência
de conteúdo remoto confiável. Risco residual de CVEs no runtime do Chromium
(processamento local de arquivos, WebSockets, etc.).

**Probabilidade**: baixa (sem conteúdo remoto; superfície restrita).

**Correção recomendada**: atualizar para a versão estável atual (ex. linha
36.x/maior) e revalidar o pacote do desktop e a suíte e2e.

**Prioridade**: 2 (curto prazo).

---

## SEC-07 — Sem cifragem em repouso para PII/arquivos em userData

- **Severidade**: BAIXO
- **Categoria**: Dados / privacidade
- **Local**: armazenamento local (`userData`)
- **Arquivo**: `packages/config/src/index.ts` (`STORAGE_DIR`),
  `apps/desktop/src/main/api-process.ts:36-49` (storage em `userData`)
- **Linha**: `api-process.ts` (`STORAGE_DIR: join(userDataDir(), 'storage')`)

**Descrição**: o banco SQLite contém PII em texto plano — CPF, telefones,
e-mails, e a **assinatura digital** capturada no recibo (base64 PNG) —
armazenada na coluna `signatureData`
(`vehicle-pickups.repository.ts:64`, `vehicle-pickups.service.ts:74`).
Arquivos de imagem ficam content-addressed em `userData/storage`. As
permissões de arquivo/diretório são as padrão do sistema operacional.

**Impacto**: um segundo usuário/processo local com acesso ao diretório lê
todos os dados da oficina **sem autenticação**. Para um desktop single-user
típico o impacto é reduzido; em máquinas compartilhadas ou com backup em
nuvem, eleva o risco de vazamento de PII e da assinatura.

**Probabilidade**: baixa-média (depende do ambiente de implantação).

**Correção recomendada**: (a) criar o diretório `userData`/`storage` com
modo `0700`; (b) avaliar cifragem dos arquivos de imagem/assinatura
(ex. AES-GCM com chave derivada localmente); (c) opcionalmente cifrar o
banco (SQLCipher). Documentar a análise de risco no rollback de desempenho
local.

**Prioridade**: 3 (médio prazo).

---

## SEC-08 — Fricções de sessão e limites (informativo)

- **Severidade**: INFORMATIVO
- **Categoria**: Sessão / UX de segurança
- **Arquivo**: `apps/api/src/modules/auth/token.service.ts`,
  `apps/api/src/modules/auth/auth.controller.ts:31-38`
- **Linha**: `token.service.ts:41-99`

**Descrição**: itens que **não** são vulnerabilidades, mas merecem registro:

- Refresh token tem `expiresIn` lido de `process.env.JWT_REFRESH_EXPIRES`
  com default de 7 dias; a revogação por reuso já é sólida (nada a corrigir,
  apenas observação de política).
- O access token de 15 min é reprovado apenas por guard; não há controle de
  "single active session" — esperado em desktop single-user.
- O assinatura no campo `signatureData` não é armazenado como artefato
  criptográfico verificável (é uma imagem); para fins de recibo a imagem é
  suficiente, mas se houver requisito legal de integridade deve-se adicionar
  hash ou assinatura digital.
- As telas de relatório não sinalizam no UI que exigem papel restrito; o
  renderer filtra por role declarada no perfil.

**Impacto**: nenhum (bom design em quase toda a superfície).

**Correção recomendada**: revisar políticas de expiração (15 min / 7 dias) e
decidir se a assinatura digital exige integridade verificável.

**Status (2026-09-18)**: decisão registrada em
[`ADR-007`](../decisions/ADR-007-signature-evidence-policy.md) — a assinatura
do recibo é evidência (imagem capturada), sem hash/assinatura digital; a
expiração de sessão (15 min/7 dias) é mantida (D4).

**Prioridade**: 4 (futuro / decisão de produto).

---

## REL-01 — Bridge de preload assíncrona quebra o renderer empacotado

- **Severidade**: ALTO (**funcional** / disponibilidade)
- **Categoria**: Arquitetura (não é vulnerabilidade de segurança)
- **Local**: preload + resolução de URL no renderer
- **Arquivo**: `apps/desktop/src/preload/preload.ts:9-11`,
  `apps/web/src/services/api-url.ts:8-14`
- **Linha**: `preload.ts:9-11` (`getApiBaseUrl(): Promise<string>` via
  `ipcRenderer.invoke`); `api-url.ts:8-14` (espera `bridge?.getApiBaseUrl?.()`
  retornar **string síncrona**)

**Descrição**: o preload expõe `getApiBaseUrl` que devolve uma **Promise**
(IPC assíncrono via `invoke`). O web (`resolveApiBaseUrl`) trata o retorno
como string síncrona; como `invoke` retorna sempre um objeto *truthy*
(Promise), o valor usado vira `"[object Promise]"`
(`fromDesktop = bridge?.getApiBaseUrl?.()` → truthy → retorna). Resultado:
todas as chamadas `fetch` no app empacotado apontam para
`[object Promise]/api/v1/...` e falham. Em dev é mascarado porque não há
`desktopApi` e o fallback `127.0.0.1:3001` é usado.

**Evidência**:

```ts
// preload.ts:9-11
getApiBaseUrl(): Promise<string> {
  return ipcRenderer.invoke('api:get-base-url');
}

// api-url.ts:8-14
const bridge = (window as unknown as { desktopApi?: DesktopBridge }).desktopApi;
const fromDesktop = bridge?.getApiBaseUrl?.();   // → Promise (truthy)
if (fromDesktop) return fromDesktop;             // → "[object Promise]"
```

**Impacto**: o app empacotado **não carrega dados** (login/renderer inoperante).
Também mascara o SEC-03 (só é percebido após corrigir esta falha).

**Exploração**: executar o binário empacotado → devtools mostra
`GET [object Promise]/api/v1/...` → falha de rede.

**Correção recomendada**: tornar a resolução **síncrona e sem IPC round-trip**:
passar a base URL ao preload via `additionalArguments`/`process.argv`
(webPreferences) ou, se mantido IPC, usar `ipcRenderer.sendSync` (suportado
em preload com sandbox) e tipar corretamente a bridge
(`getApiBaseUrl?: () => string` em vez de `Promise<string>`).

**Prioridade**: 1 (imediato — restaura o produto empacotado).