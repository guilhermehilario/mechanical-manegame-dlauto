import { BrowserWindow, app } from 'electron';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { registerIpcHandlers } from './ipc';
import { startApiProcess, type RunningApiProcess } from './api-process';

/**
 * Electron main process (spec §21 + offline-first ADR-001).
 * Security posture:
 *  - no nodeIntegration in the renderer;
 *  - contextIsolation + sandbox enabled;
 *  - ONLY local content is loaded (built files or explicit dev server URL);
 *  - external navigation and popups are blocked (offline lockdown);
 *  - the API URL is injected via the preload bridge, never via query params.
 */

let mainWindow: BrowserWindow | null = null;
let apiProcess: RunningApiProcess | null = null;

/** Locates the built web app. Returns null when not built yet. */
function resolveWebEntry(): string | null {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'renderer', 'index.html');
  }
  // main.js is at apps/desktop/dist/main/main.js → web build at apps/web/dist
  const devPath = join(__dirname, '..', '..', '..', 'web', 'dist', 'index.html');
  if (existsSync(devPath)) return devPath;
  return null;
}

function createWindow(apiBaseUrl: string): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    webPreferences: {
      preload: join(__dirname, '..', 'preload', 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      // R2 (REL-01): deliver the base URL synchronously to the preload —
      // it lands in process.argv, so getApiBaseUrl() never needs async IPC.
      additionalArguments: [
        `--mechanic-api-base-url=${encodeURIComponent(apiBaseUrl)}`,
      ],
    },
  });

  // Offline lockdown: the renderer never leaves local/app content.
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const allowedDev = process.env.VITE_DEV_SERVER_URL ?? '';
    const isLocalFile = url.startsWith('file://');
    const isDevServer = allowedDev !== '' && url.startsWith(allowedDev);
    if (!isLocalFile && !isDevServer) {
      event.preventDefault();
    }
  });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  mainWindow.once('ready-to-show', () => mainWindow?.show());

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    // Explicit opt-in for live-reload development (pnpm dev:web running).
    void mainWindow.loadURL(devServerUrl);
  } else {
    // Offline-first default: load the built web app from disk. No network.
    const webEntry = resolveWebEntry();
    if (!webEntry) {
      console.error(
        'Web app build not found. Run "pnpm build" (or set VITE_DEV_SERVER_URL for development).',
      );
      app.quit();
      return;
    }
    void mainWindow.loadFile(webEntry);
  }

  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow?.webContents.send('api:ready', { baseUrl: apiBaseUrl });
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

void app.whenReady().then(async () => {
  try {
    apiProcess = await startApiProcess();
  } catch (error) {
    // No dialog with technical details to the end user (spec §20).
    console.error('Failed to start the local API:', error instanceof Error ? error.message : error);
    app.quit();
    return;
  }

  const startedApi = apiProcess;
  registerIpcHandlers(() => startedApi.baseUrl);
  // R2: main also pushes the URL to the preload's argv via additionalArguments
  // (createWindow) and notifies listeners after every load (api:ready).
  createWindow(startedApi.baseUrl);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow(startedApi.baseUrl);
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  apiProcess?.stop();
});
