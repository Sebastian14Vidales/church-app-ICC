// ESLint flat config (ESLint v9+).
// Backend is CommonJS (no "type": "module" in package.json), so we use .mjs
// to keep ESM import syntax consistent with the frontend config without
// touching package.json "type" (which would affect ts-node/nodemon).
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import prettierConfig from 'eslint-config-prettier'
import globals from 'globals'

export default tseslint.config(
  // Global ignores
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      '**/*.js',
      '**/*.d.ts',
    ],
  },
  // Base TS rules
  {
    files: ['src/**/*.ts'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
    ],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      // Allow iteration while quality-engineer repairs existing `any`.
      // Will be promoted to 'error' once cleanup completes.
      '@typescript-eslint/no-explicit-any': 'warn',
      // Warn on console in feature code; overridden for scripts/config below.
      'no-console': 'warn',
    },
  },
  // Relax console for migrations, seed, db setup and config helpers.
  {
    files: [
      'src/config/**/*.ts',
      'src/config/migrations/**/*.ts',
    ],
    rules: {
      'no-console': 'off',
    },
  },
  // Disable Prettier-conflicting rules; Prettier owns formatting.
  prettierConfig,
)