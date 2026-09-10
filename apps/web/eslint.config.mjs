import { baseConfig, reactConfig } from '@mechanic-system/eslint-config';

export default [
  ...baseConfig,
  reactConfig,
  {
    ignores: ['dist/**', 'node_modules/**', 'vite.config.ts', '**/*.config.js'],
  },
];
