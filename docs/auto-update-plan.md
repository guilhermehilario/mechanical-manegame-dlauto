# Plano — Instalador com Atualização Automática

> Objetivo: permitir que o instalador do app desktop (Electron) receba
> **atualizações automáticas** na máquina da oficina, sem acesso técnico no
> local e **sem jamais tocar nos dados locais** (banco SQLite, uploads,
> backups — tudo em `userData`).
>
> Contexto atual (2026-09-18): Electron 43.7.0 + electron-builder 26
> (`apps/desktop/package.json`), sidecar API autocontida
> (`scripts/stage.mjs`), dados em `~/.config/Mechanic DLAuto` (Linux) /
> `%APPDATA%/Mechanic DLAuto` (Windows). Não há `electron-updater` no
> projeto (0 referências). App offline-first com lockdown de navegação no
> renderer (`main.ts`) e IPC estrita via preload.

---

## 0. Princípios não negociáveis

1. **Dados locais intocados**: atualizar o app nunca pode migrar/apagar
   `userData` (banco, storage, backups). Toda a estratégia abaixo assume que
   só o código/binário é substituído.
2. **Offline-first continua valendo**: o app abre e funciona 100% sem
   internet. A checagem de atualização é *best-effort* — falha de rede
   nunca bloqueia o boot nem gera erro visível.
3. **Consentimento do operador**: por padrão o app **avisa** que existe
   atualização e só baixa/instala quando o usuário aceitar (a oficina pode
   ter internet fraca/limitada). Auto-download opcional em Configurações.
4. **Renderer continua isolado**: o download é feito no processo *main*
   pelo `electron-updater`; o renderer só recebe eventos via IPC
   (progresso, "reiniciar para instalar"). Nenhuma URL externa nova é
   carregada no renderer — o CSP e o lockdown não mudam.

---

## 1. Decisões (✅ definidas em 2026-09-18)

| # | Decisão | Escolha | Implicações |
|---|---|---|---|
| D1 | **SO alvo da oficina** | **Windows (NSIS)** | Foco do empacotamento, testes e homologação (C2 do todo-mvp destravado). O alvo `win.nsis` já está configurado no electron-builder; AppImage permanece como secundário sem garantia. **Confirmado com o hardware real (2026-09-20):** i5-5300U · 8 GB RAM · HDD 460 GB |
| D2 | **Feed de atualização** | **GitHub Releases** (provider `github`) | Zero infraestrutura. ⚠️ Se o repo for **privado**, o electron-updater exige token embutido no app (risco) — nesse caso, migrar para provider `generic` ou tornar o repo público. O G4 (CI remota) usa o mesmo repo, um destrava o outro |
| D3 | **Cadência de checagem** | **Só no boot** (+ botão manual "Verificar atualizações") | Sem timer periódico; checagem ~10s após abrir a janela, best-effort. Operador sempre pode forçar em Configurações |
| D4 | **Assinatura de código (Windows)** | **Sem assinatura por ora** | SmartScreen vai alertar na 1ª instalação — incluir orientação no `docs/deployment.md` ("Mais informações → Executar assim mesmo"). Reavaliar quando houver volume de máquinas |

---

## 2. Fases de implementação

### Fase 1 — Feed de atualização e metadados (½ a 1 dia)

- [ ] **1.1** Adicionar `electron-updater` ao `apps/desktop` (mesma versão
      do `electron-builder` instalada — 26.x).
- [ ] **1.2** Configurar `publish` no bloco `build` do
      `apps/desktop/package.json` (D2 = GitHub Releases):
      ```json
      "publish": { "provider": "github", "owner": "<org>", "repo": "<repo>" }
      ```
      Antes de começar: confirmar se o repo será público ou privado —
      privado exige token no app (ver D2 nas decisões) e nesse caso
      reabrir a escolha do feed.
- [ ] **1.3** Garantir que o build gere os artefatos de feed:
      `latest.yml` (Windows/NSIS) + `*.blockmap`. O electron-builder 26
      gera por padrão no alvo NSIS. Subir também o `*.blockmap` — habilita
      **download diferencial** (baixa só o que mudou; crítico para
      internet fraca). Manter o alvo AppImage gerando `latest-linux.yml`
      como secundário.
- [ ] **1.4** Criar script de release (`apps/desktop/scripts/release.mjs`
      ou task turbo): bump de versão → build → publicar no GitHub Release
      (`electron-builder --publish always` com `GH_TOKEN`, ou upload via
      `gh release upload`). A **versão do package.json é a fonte da
      verdade** — o updater só instala versões estritamente maiores.

### Fase 2 — Integração no app (main + IPC + UI) (1–2 dias)

- [ ] **2.1** Novo módulo `apps/desktop/src/main/updater.ts` encapsulando
      `autoUpdater`:
      - `setFeedURL` implícito via app-update.yml (gerado pelo builder);
      - `checkForUpdates()` **só no boot** (D3: ~10s após a janela pronta,
        para não competir com o boot da API) — sem timer periódico;
      - eventos → repassar ao renderer via `webContents.send`
        (`update:status`, `update:progress`, `update:available`,
        `update:not-available`, `update:error`);
      - `downloadUpdate()`, `quitAndInstall()` expostos sob demanda;
      - `autoUpdater.autoDownload = false` (padrão: só notifica) e
        `allowDowngrade = false`.
- [ ] **2.2** IPC no `preload` (`apps/desktop/src/preload/preload.ts`):
      canais `update:*` com a mesma tipagem estreita usada hoje
      (`session:*`). Nada de `ipcRenderer` genérico no renderer.
- [ ] **2.3** UI no web (`apps/web/src/modules/*`):
      - Banner discreto/snoozável quando há atualização
        ("Nova versão 0.2.0 disponível — Baixar agora / Depois");
      - Dialog de progresso (0–100%) e "Reiniciar e instalar";
      - Em Configurações: "Verificar atualizações" (manual, D3);
      - Estado de erro amigável (sem stack): "Não foi possível verificar
        agora — tentaremos mais tarde" (padrão spec §20).
- [ ] **2.4** Instalação segura do update: `quitAndInstall()` só pode
      rodar **depois que o sidecar morreu**. O `before-quit` de `main.ts`
      já chama `apiProcess?.stop()` — verificar a ordem e, se necessário,
      aguardar o stop do filho antes do install (o NSIS substitui
      arquivos, e o Node embutido segura o binário enquanto vivo).
- [ ] **2.5** Instância única: `app.requestSingleInstanceLock()` em
      `main.ts` — evita duas instâncias competindo durante o
      download/instalação.

### Fase 3 — Migrações de banco em atualizações (½ dia, crítico)

Hoje `migrateDatabaseIfNeeded()` (`apps/desktop/src/main/api-process.ts`)
**só roda na primeira execução** (`if (existsSync(dbPath)) return;`). Com
updates automáticos, novas versões trazem migrations novas que **nunca
seriam aplicadas** na máquina já instalada.

- [ ] **3.1** Trocar a condição: rodar `prisma migrate deploy` **em todo
      boot empacotado** (é idempotente — aplica só o que falta; continua
      barato porque é local).
- [ ] **3.2** Teste de regressão: banco criado na versão N, app atualizado
      para N+1 com migration nova → boot aplica e os dados sobrevivem.
      (Adicionar ao smoke/desktop tests.)
- [ ] **3.3** Backup de segurança pré-update: antes de aplicar
      `quitAndInstall()`, disparar o backup automático que já existe
      (Fase 10) — rede de segurança se a nova versão tiver problema.

### Fase 4 — Pipeline de release (1 dia)

- [ ] **4.1** CI/job de release: lint + typecheck + testes →
      `pnpm --filter @mechanic-system/desktop package` → publicar
      artefatos + `latest.yml` no GitHub Release (D2; `GH_TOKEN` no CI).
      Sinergia: o mesmo repo/pipeline atende o G4 (CI remota).
- [ ] **4.2** Versionamento semântico + changelog curto por release (o
      banner do app pode mostrar as novidades).
- [ ] **4.3** **Sem assinatura de código por ora (D4)**: documentar no
      `docs/deployment.md` o fluxo do SmartScreen na 1ª instalação
      ("Mais informações → Executar assim mesmo"). Reavaliar assinatura
      quando houver volume de máquinas (item pós-MVP).
- [ ] **4.4** Rollback documentado: manter a versão anterior disponível no
      feed; procedimento de "voltar" = instalar o setup antigo por cima
      (dados não são tocados).

### Fase 5 — Homologação na máquina alvo — Windows (extensão do C1/E3) (½–1 dia)

- [ ] **5.1** Instalar a versão N numa máquina Windows limpa (sem
      Node/internet) e atualizar para N+1 pelo app — validar o fluxo
      completo, incluindo o aviso do SmartScreen (D4).
- [ ] **5.2** Atualização com internet instável: matar o download no meio e
      reabrir o app (o updater deve retomar/limpar sem corromper).
- [ ] **5.3** Pós-update: login funciona, dados da versão N presentes,
      impressão OS/recibo ok, backup restaurável (cruza com E3).
- [ ] **5.4** Atualização diferencial (blockmap) — medir tamanho baixado.
- [ ] **5.5** Verificar antivírus/Windows Defender na máquina da oficina:
      sem falsos positivos no instalador não assinado (D4) e no sidecar
      da API.

---

## 3. Riscos e mitigação

| Risco | Impacto | Mitigação |
|---|---|---|
| Update corrompe a instalação com a API viva (arquivo travado) | App não abre | Ordem stop-API → quit → install (2.4); instaladores NSIS/AppImage já toleram substituição |
| Migration nova quebra dados antigos | Perda de dados | Migrations Prisma são imutáveis e revisadas; backup pré-update (3.3) + teste 3.2 |
| Internet ausente/limitada na oficina | Sem atualização | Checagem best-effort, download diferencial (blockmap), update manual via pendrive continua possível (instalador antigo por cima) |
| Renderer baixar/executar algo externo | Segurança | Download 100% no main via electron-updater; renderer só recebe IPC; lockdown e CSP intactos |
| Feed indisponível (GitHub bloqueado na rede local) | Sem atualização | Se ocorrer, migrar o feed para provider `generic` em domínio próprio (só muda `publish` no package.json); erro silencioso |
| Repo privado no GitHub (D2) | Token embutido no app = risco de segurança | Confirmar visibilidade do repo na Fase 1; se privado, reabrir D2 para `generic` |
| SmartScreen bloqueia instalador não assinado (D4) | Operador não consegue instalar | Orientação passo a passo no `docs/deployment.md`; reavaliar certificado com volume |
| Antivírus acusar falso positivo no sidecar/instalador | Bloqueio na máquina | Testar no Windows real (5.5); ajustar exceções via documento de implantação |

---

## 4. Ordem sugerida

1. ~~Decidir D1–D4~~ ✅ Feito (2026-09-18): Windows/NSIS, GitHub
   Releases, checagem só no boot, sem assinatura.
2. Pré-requisito imediato: confirmar a visibilidade do repo no GitHub
   (público/privado) — condição para D2.
3. Fase 1 (feed) → Fase 2 (integração) → Fase 3 (migrations) — o app já
   atualiza em ambiente de teste.
4. Fase 4 (pipeline) → Fase 5 (homologação em Windows real, junto com
   C1/E3 do todo-mvp).

Ao concluir, marcar um item novo "C5 — Atualização automática" no
`docs/todo-mvp.md` e atualizar `docs/deployment.md` (seção "Atualização")
com o comportamento visto pelo operador.
