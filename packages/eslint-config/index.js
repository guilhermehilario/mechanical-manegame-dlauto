// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';

/**
 * Shared ESLint flat config.
 * Usage in an app: import { baseConfig } from '@mechanic-system/eslint-config'
 * and spread it into your eslint.config.js array.
 */
export const baseConfig = tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        { allowNumber: true, allowBoolean: false },
      ],
      // NestJS modules/controllers are decorated classes by framework design.
      '@typescript-eslint/no-extraneous-class': [
        'error',
        { allowWithDecorator: true, allowEmpty: false },
      ],
      '@typescript-eslint/explicit-module-boundary-types': 'off',
    },
  },
  {
    ignores: ['**/dist/**', '**/build/**', '**/node_modules/**', '**/*.cjs', '**/*.mjs'],
  },
);

/** Additional config for React/TSX code. */
export const reactConfig = {
  files: ['**/*.{ts,tsx}'],
  plugins: {
    'react-hooks': reactHooks,
    'react-refresh': reactRefresh,
  },
  languageOptions: {
    globals: { ...globals.browser },
  },
  rules: {
    ...reactHooks.configs.recommended.rules,
    'react-refresh/only-export-components': 'warn',
  },
};

/** Additional config for Node code (API, Electron main). */
export const nodeConfig = {
  files: ['**/*.ts'],
  languageOptions: {
    globals: { ...globals.node },
  },
};
