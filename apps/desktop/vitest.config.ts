import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Electron main-process code — pure Node runtime in tests (electron is mocked).
    include: ['tests/**/*.spec.ts'],
    environment: 'node',
  },
});
