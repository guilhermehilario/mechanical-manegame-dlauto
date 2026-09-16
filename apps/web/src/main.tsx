import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { restoreDesktopSession } from './services/auth.service';
import { isDesktop } from './services/desktop-bridge';
import { AppRouter } from './app/router';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

function assertRoot(): HTMLElement {
  const element = document.getElementById('root');
  if (!element) {
    throw new Error('Root element #root not found');
  }
  return element;
}

/**
 * Bloco D/D1: on the desktop app, restore the previous session before the
 * first paint (silent refresh against the local API). The browser flow has
 * no bridge and boots straight into the router (login screen).
 */
async function boot(): Promise<void> {
  if (isDesktop()) {
    await restoreDesktopSession().catch(() => false);
  }
  ReactDOM.createRoot(assertRoot()).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <HashRouter>
          <AppRouter />
        </HashRouter>
      </QueryClientProvider>
    </React.StrictMode>,
  );
}

void boot();
