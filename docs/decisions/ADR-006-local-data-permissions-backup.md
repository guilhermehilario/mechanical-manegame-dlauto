# ADR-006 — Permissões de dados locais e cifragem em repouso (R7/SEC-07)

- **Status**: Aceito (2026-09-11, Fase 10)
- **Contexto**: `docs/security/findings.md` SEC-07 — banco SQLite, imagens e
  assinaturas vivem em texto plano no disco da máquina da oficina.

## Decisão

**Mitigação adotada: permissões restritivas (0700/0600) sem cifragem**, com
reavaliação de cifragem quando houver requisito concreto (máquinas
compartilhadas, backup em nuvem, exigência contratual).

1. **Diretórios 0700 / arquivos 0600** em toda a área de dados local
   (`database/prisma/` do SQLite + WAL/SHM, `STORAGE_DIR` de imagens/assinaturas,
   `BACKUP_DIR`), aplicada:
   - na API, no boot (`HardeningModule` → `PermissionsService`), inclusive
     endurecendo conteúdo pré-existente de fases anteriores;
   - no app empacotado, no main do Electron antes do sidecar subir
     (`hardenUserDataDirs()` — userData, storage e backups).
2. **Backups em texto plano, porém protegidos**: a pasta de backup é criada
   0700 e o manifest 0600; backups só existem em disco local (a Fase 12 de
   sync/nuvem deve reavaliar isto explicitamente).
3. **Cifragem (AES-GCM por arquivo, SQLCipher para o banco) fica
   explicitamente REJEITADA por ora**: custo de desempenho local (Argon2id já
   custa ~100 ms por login; SQLCipher cifraria cada página de cada query),
   complexidade de gestão de chave local (a chave teria de viver no mesmo
   disco — valor de proteção limitado contra o adversário modelado) e
   risco de corrupção/perda de chave para um pequeno negócio sem TI.

## Consequências

- Positivas: mitigação imediata e auditável do SEC-07; zero impacto de
  desempenho em runtime; backup/restore permanecem operações de arquivo
  simples (sem criptografia acoplada).
- Negativas / mitigações: um usuário root/admin da máquina ainda lê tudo
  (adversário aceito — single-user desktop); backup externo à máquina deve
  ser cifrado FORA do app (documentado no README da operação); reavaliar
  cifragem se o deploy mudar de perfil.

## Backups/restore (mesma fase)

- Snapshot consistente via `VACUUM INTO` (WAL-safe — fecha o ponto aberto do
  ADR-001: "backup = copiar um arquivo **com checkpoint WAL**").
- Restore defensivo: sha256 do snapshot + `PRAGMA integrity_check` (via
  `ATTACH`) **antes** de tocar o sistema vivo; `$disconnect` → swap atômico
  (rename no mesmo filesystem) → `$connect`.
- Superfície admin-only (`@RequireRoles('ADMIN')`), restore exige
  `confirm: true` no body.
