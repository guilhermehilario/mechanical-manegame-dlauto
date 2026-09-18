import { describe, expect, it, vi, beforeEach } from 'vitest';

/**
 * C4 — friendly startup failure dialogs. Electron is mocked; the pure message
 * builders and the retry decision are what we assert.
 */

const showErrorBox = vi.hoisted(() => vi.fn());
const showMessageBoxSync = vi.hoisted(() => vi.fn());

vi.mock('electron', () => ({
  dialog: { showErrorBox, showMessageBoxSync },
}));

import { STARTUP_ERRORS, reportStartupFailure } from '../src/main/startup-dialogs';

describe('startup dialogs (C4)', () => {
  beforeEach(() => {
    showErrorBox.mockReset();
    showMessageBoxSync.mockReset();
  });

  it('offers a retry for a failed API sidecar and reports the choice', () => {
    showMessageBoxSync.mockReturnValueOnce(0);
    expect(reportStartupFailure('apiFailure')).toBe(true);

    showMessageBoxSync.mockReturnValueOnce(1);
    expect(reportStartupFailure('apiFailure')).toBe(false);

    const options = showMessageBoxSync.mock.calls[0]?.[0] as {
      buttons: string[];
      message: string;
    };
    expect(options.buttons).toEqual(['Tentar novamente', 'Fechar']);
    expect(options.message).toMatch(/tente novamente/i);
  });

  it('shows a simple error box (no retry) when the app build is missing', () => {
    expect(reportStartupFailure('webBuildMissing')).toBe(false);
    expect(showErrorBox).toHaveBeenCalledTimes(1);
    expect(showMessageBoxSync).not.toHaveBeenCalled();
  });

  it('never leaks technical details to the user', () => {
    for (const { title, message } of Object.values(STARTUP_ERRORS)) {
      expect(title.length).toBeGreaterThan(5);
      expect(message).not.toMatch(/Error|\.js\b|127\.0\.0\.1|exit code|stack/i);
    }
  });
});
