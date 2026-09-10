import { baseConfig, nodeConfig } from '@mechanic-system/eslint-config';

export default [
  ...baseConfig,
  nodeConfig,
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
];
