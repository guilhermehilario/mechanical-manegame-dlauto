import { baseConfig } from '@mechanic-system/eslint-config';

export default [
  ...baseConfig,
  {
    ignores: ['node_modules/**', 'test-results/**', 'playwright-report/**'],
  },
];