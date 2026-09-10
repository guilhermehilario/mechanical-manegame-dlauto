import { baseConfig } from '@mechanic-system/eslint-config';

export default [
  ...baseConfig,
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
];
