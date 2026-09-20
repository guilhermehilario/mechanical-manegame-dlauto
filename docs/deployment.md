# Guia do operador — Implantação e uso diário

> **C3** de `docs/todo-mvp.md`. Este guia é escrito para quem **usa** o
> aplicativo na oficina (não para quem desenvolve).
>
> **Status das seções:** o passo-a-passo abaixo descreve o comportamento
> implementado. A *validação final na máquina alvo* (navegar o fluxo completo
> dentro do aplicativo empacotado) é a tarefa **C1**; o instalador para
> Windows (**C2**) está definido como **NSIS** — SO alvo confirmado
> (2026-09-20) —, faltando gerar o executável (`package:win` ou CI) e validá-lo
> na máquina da oficina.

---

## 1. O que é o aplicativo

- Sistema de **gestão de oficina mecânica** que funciona **100% offline**:
  o banco de dados e as imagens ficam **na própria máquina**, sem servidor
  externo e sem internet.
- Atende o "chão de fábrica": clientes, veículos, serviços, peças,
  agendamentos, **ordens de serviço** (com máquina de estados), retirada e
  entrega de veículos, **relatórios** (imprimir / exportar CSV) e
  **backup/restauração** local.
- No computador, ele abre como um **programa comum**. Em segundo plano, o
  próprio programa sobe um atendimento local (porta interna) para o banco de
  dados — nada disso exige configuração do operador.

---

## 2. Instalação

### Linux (AppImage)

1. Receba o arquivo do instalador: `mechanic-dlauto-<versão>-x86_64.AppImage`.
2. Dê permissão de execução e abra:
   ```bash
   chmod +x mechanic-dlauto-<versão>-x86_64.AppImage
   ./mechanic-dlauto-<versão>-x86_64.AppImage
   ```
   (ou clique com o botão direito → *Permitir execução* / *Fazer executável*,
   dependendo do seu gerenciador de arquivos).
3. Se o computador pedir permissão do firewall para o próprio aplicativo,
   **recuse/bloqueie**: o programa só fala com a própria máquina
   (`127.0.0.1`) e nunca precisa da rede externa.
4. Primeira execução: o programa cria sozinho a pasta de dados (ver §5).

> **Nota:** se o AppImage não abrir por falta do componente FUSE no seu
> Linux, rode com `./mechanic-dlauto-<versão>-x86_64.AppImage
> --appimage-extract-and-run`.

### Windows (NSIS) — sistema alvo da oficina

A oficina roda **Windows** (i5-5300U · 8 GB RAM · HDD 460 GB — definido em
2026-09-20). Este é o foco da homologação (**C2**).

1. Receba o instalador: `mechanic-dlauto-<versão>-setup.exe`.
2. Dê dois cliques e siga o assistente de instalação.
3. Se o **SmartScreen** alertar que o arquivo "não é reconhecido", clique em
   **Mais informações → Executar assim mesmo** — o instalador ainda **não tem
   certificado de assinatura** (item pós-MVP); o app em si não fala com a
   internet.
4. Se o firewall pedir permissão para o próprio aplicativo, **recuse/bloqueie**:
   o programa só fala com a própria máquina (`127.0.0.1`) e nunca precisa da
   rede externa.
5. Primeira execução: o programa cria sozinho a pasta de dados (ver §5) em
   `%APPDATA%\Mechanic DLAuto`.

---

## 3. Primeiro acesso (configuração inicial)

Na primeira execução, o banco está vazio — então o aplicativo mostra a tela
**"Bem-vindo! Crie o acesso do administrador"**:

1. Preencha **seu nome**, **e-mail** e crie uma **senha forte** (confirme a
   senha no campo abaixo).
2. Salve. O programa cria o **administrador** e **entra automaticamente**.

> **Não existe senha padrão.** O acesso inicial é sempre criado por você,
> nesta tela. Guarde essas credenciais em lugar seguro — elas são a chave da
> oficina (só o administrador gerencia usuários e backups).

Depois de criado o primeiro acesso, essa tela não aparece mais: o login passa
a ser a **tela normal de acesso** (e-mail + senha).

---

## 4. Uso diário

- **Cadastros:** clientes, veículos, serviços, fornecedores e peças.
- **Ordens de serviço (OS):** o status segue um fluxo fixo —
  *Aberta → Em avaliação → Aguardando aprovação → Aprovada → Em execução →
  Concluída → Aguardando retirada → Entregue*.
- **Retirada/entrega:** registrar quando o cliente leva o veículo.
- **Relatórios:** cada aba tem os botões **Imprimir** e **Exportar CSV**
  (abre no Excel/LibreOffice com separador `;` e acentuação correta).
- **Configurações da oficina:** nome, telefone, endereço e rodapé que saem
  nos documentos impressos.

---

## 5. Onde ficam os dados e o backup

Todos os dados ficam numa pasta **do usuário** do computador:

```
Windows:  %APPDATA%\Mechanic DLAuto\
Linux:    ~/.config/Mechanic DLAuto/
├── mechanic.db      banco principal (clientes, OS, estoque, financeiro)
├── storage/         fotos/arquivos anexados
├── backups/         backups automáticos e manuais (veja §6)
├── secrets.json     chaves internas do programa (não edite)
└── session.json     sessão do último login (não edite)
```

> **Para cópia de segurança externa**, o caminho mais seguro é copiar a
> pasta inteira (`%APPDATA%\Mechanic DLAuto` no Windows /
> `~/.config/Mechanic DLAuto` no Linux) para um pen drive ou serviço de
> nuvem, com o programa **fechado**.

---

## 6. Backup (a rede de segurança)

Como tudo fica **só** na máquina, o backup é o principal seguro contra
perda:

- **Automático:** a cada **24 horas**, se ainda não houver backup recente, o
  programa cria um **automaticamente**, guardando os **14 mais recentes**
  (os mais antigos são apagados). Nada precisa ser feito.
- **Aviso no painel:** se o último backup passar de **24h** sem atualização,
  aparece no painel: **"⚠️ Backup dos dados atrasado"** com o botão
  *"Fazer backup agora"*.
- **Manual:** menu **Backups** → *"Criar backup agora"* a qualquer momento.
  A tela lista os backups com data, tamanho, e permite **restaurar** ou
  **excluir**.

**Como se proteger de verdade:** com o programa fechado, copie a pasta
`backups/` (ou a pasta de dados inteira, §5) para um **pen drive ou nuvem**
periodicamente. Único backup físico = único ponto de falha.

---

## 7. Restauração

1. Menu **Backups**.
2. Escolha o backup desejado e clique em **Restaurar**.
3. O programa pede **confirmação** (digitar a palavra pedida) — de propósito:
   a restauração **substitui os dados atuais** (banco + imagens) pelos do
   backup.
4. Terminada a restauração, **feche e reabra o aplicativo** para garantir
   que tudo carregue do ponto restaurado.

> Antes de restaurar, confirme a data do backup — os dados atuais serão
> sobrescritos.

---

## 8. Problemas comuns

| Situação | O que fazer |
|---|---|
| O aplicativo **não abre ou trava no início** | Aparece uma janela de erro com **"Tentar novamente"** e **"Fechar"**. Clique em *Tentar novamente*. Se continuar, *Fechar*, reabra o aplicativo e, se persistir, procure assistência levando o arquivo de log. |
| **"Esqueci minha senha"** | Um usuário **Administrador** pode redefinir em **Usuários**. Se o único administrador perdeu o acesso, a via é restaurar um backup antigo ou reinstalar — o suporte deve ser acionado (e isso reforça manter backups bons). |
| Aviso de **backup atrasado** no painel | Crie um backup manual (*"Fazer backup agora"*) e copie a pasta `backups/` para outro dispositivo. |
| **Troca de computador** | Instale o aplicativo na máquina nova, feche-o, copie a pasta inteira de dados (§5) e abra. Fazer isso com o programa fechado nos dois lados. |

---

## 9. Atualização do aplicativo

1. **Faça um backup manual** antes (menu Backups).
2. Feche o aplicativo.
3. Substitua o arquivo do instalador pela versão nova e abra.
4. Os dados **não são perdidos** — a pasta de dados do usuário
   (`%APPDATA%\Mechanic DLAuto` no Windows / `~/.config/Mechanic DLAuto` no
   Linux) permanece intacta.

---

## 10. Segurança (resumo)

- **Sem credenciais padrão**: o primeiro acesso é sempre criado na tela
  "Bem-vindo!" (§3).
- O aplicativo **não fala com a internet** — só com a própria máquina; o
  firewall pode (e deve) bloquear qualquer saída.
- Dados e backups ficam em pastas com **permissões restritas** (só o usuário
  do computador consegue ler).
- O login mantém a sessão do último uso ao reabrir, no mesmo computador.

---

## Apêndice — para quem gera o instalador

```bash
# Pré-requisito: builds de produção de web + API + pacotes
pnpm build

# Instalador Linux (AppImage) em apps/desktop/release/
pnpm --filter @mechanic-system/desktop package

# Instalador Windows (NSIS) — no Linux este comando exige Wine instalado;
# o caminho recomendado é o job `windows-build` do GitHub Actions (G4), que
# gera o arquivo em um runner Windows sem dependência local.
pnpm --filter @mechanic-system/desktop package:win
# Pasta de teste rápida (sem instalador): package:win:dir
```

- Artefato Linux: `apps/desktop/release/mechanic-dlauto-<versão>-x86_64.AppImage`;
  Windows: `apps/desktop/release/mechanic-dlauto-<versão>-setup.exe`.
- As pastas `linux-unpacked/` / `win-unpacked/` permitem testar antes de
  gerar o instalador.
- **Validar na máquina real (C1/C2):** primeiro acesso (§3), OS completa com
  impressão, upload de imagem, backup/restauração e migração da primeira
  execução devem ser conferidos no binário final antes de distribuir.