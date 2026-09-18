# ADR-007 — Política de assinatura do recibo de retirada e expiração de sessão (R8/SEC-08)

- **Status**: Aceito (2026-09-18, revisão pós-Fase 11)
- **Contexto**: `docs/security/findings.md` SEC-08 (informativo) — o campo
  `signatureData` do recibo de retirada é um **PNG capturado** (data URL
  base64, assinado no `signature pad` em tela), não um artefato criptográfico;
  a sessão usa access de 15 min + refresh rotativo de 7 dias. O plano de
  remediação pedia uma **decisão definitiva** sobre integridade verificável da
  assinatura e sobre as políticas de expiração.

## Decisão

1. **A assinatura é EVIDÊNCIA (registro de consentimento na retirada), não
   valor legal certificado nem artefato criptográfico.** A imagem capturada
   acompanha o recibo impresso (B2) como reconhecimento do cliente de que
   recebeu o veículo naquele dia/estado. **Não** se adiciona hash nem
   assinatura digital sobre `signatureData`.

2. **A expiração de sessão fica mantida exatamente como implementada**: access
   JWT 15 min (`JWT_ACCESS_EXPIRES`) + refresh rotativo reutilizável 7 dias
   (`JWT_REFRESH_EXPIRES`), com revogação total em `PATCH /users/me/password`
   e no reset de senha — política já verificada em D4 (todo-mvp). Sem
   "single active session" forçado (perfil single-user desktop documentado).

## Por que imagem-cheia basta (razões da decisão)

- **Valor legal**: uma assinatura capturada por tela, sem certificado ICP-Brasil,
  tem força **probatória/evidencial** (não garante presunção jurídica plena do
  art. 10 da MP 2.200-2/2001). Adicionar um hash sobre a imagem daria
  integridade do arquivo, mas **não** identidade nem valor legal certificado —
  a imagem foi capturada num touchscreen sem vínculo criptográfico com o
  signatário (a senha do dono da oficina não é a identidade do cliente).
- **Modelo de adversário**: taxa toda a PII como "adversário aceito = root da
  máquina" (ADR-006). Criptografia/assinatura adicionaria provisionamento de
  certificado, gestão de chave e cadeia de custódia para uma oficina sem TI —
  sem ganho prático de evidência no recibo em papel que já é o instrumento
  confiado pelo negócio.
- **Fricção**: assinatura por certificado (ou validação criptográfica) tornaria
  a retirada inviável no balcão; o recibo é impresso no momento (gravação local
  em `vehicle_pickups.signatureData`), preservando a evidência contextual.

## Consequências

- Positivas: recibo continua entregável no papel como hoje; zero infra nova
  (certificado/chave/hash); alinhado ao ADR-006 (sem cifragem em repouso) e ao
  perfil offline-first; rotas do recibo seguem autenticadas e a imagem tratada
  como PII (0700/0600).
- Negativas / gatilhos de reavaliação: a assinatura **não é verificável
  criptograficamente**. Revisitar esta decisão (mesmo gatilho do ADR-006) se:
  exigência contratual/judicial de assinatura digital com certificado;
  sincronização para nuvem (Fase 12); máquina compartilhada/multi-oficina;
  contestação formal que exija rastreabilidade além do recibo impresso.

## Referências

- `docs/security/findings.md` SEC-08 (decisão agora registrada); R8 em
  `docs/security/remediation-plan.md`; `docs/roadmap.md` tabela de pendências.
- D4 (expiração de sessão) e B2 (recibo) em `docs/todo-mvp.md`.