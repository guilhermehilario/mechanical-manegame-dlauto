import { dialog } from 'electron';

/**
 * C4 — user-facing startup failures.
 *
 * Spec §20: the end user never sees technical details (paths, exit codes,
 * stack traces). Every message here is a friendly, actionable sentence; the
 * technical cause is still logged to the main-process console for support.
 */

export const STARTUP_ERRORS = {
  apiFailure: {
    title: 'Não foi possível iniciar o sistema',
    message:
      'O serviço local da oficina não iniciou. Verifique se o aplicativo já não está aberto e tente novamente. Se o problema continuar, contate o suporte.',
  },
  webBuildMissing: {
    title: 'Aplicativo incompleto',
    message:
      'Os arquivos do sistema não foram encontrados. Reinstale o aplicativo ou contate o suporte.',
  },
} as const;

export type StartupErrorKind = keyof typeof STARTUP_ERRORS;

/**
 * Reports a startup failure to the user. Returns `true` when the user asked to
 * retry — only offered for recoverable failures (the API sidecar). The
 * missing-build case is not retryable, so it shows a simple error box.
 */
export function reportStartupFailure(kind: StartupErrorKind): boolean {
  const { title, message } = STARTUP_ERRORS[kind];

  if (kind !== 'apiFailure') {
    dialog.showErrorBox(title, message);
    return false;
  }

  const choice = dialog.showMessageBoxSync({
    type: 'error',
    title,
    message,
    buttons: ['Tentar novamente', 'Fechar'],
    defaultId: 0,
    cancelId: 1,
    noLink: true,
  });
  return choice === 0;
}
