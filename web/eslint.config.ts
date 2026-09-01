import { defineConfig } from 'eslint/config';
import { fixupConfigRules, fixupPluginRules } from '@eslint/compat';
import prettier from 'eslint-plugin-prettier';
import react from 'eslint-plugin-react';
import typescriptEslint from '@typescript-eslint/eslint-plugin';
import globals from 'globals';
import tsParser from '@typescript-eslint/parser';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import js from '@eslint/js';
import { FlatCompat } from '@eslint/eslintrc';
import importPlugin from 'eslint-plugin-import';
import { importBoundaryZones } from './eslint-rules/import-boundary-zones';
import { fileNaming } from './eslint-rules/file-naming';
import { requireFeatureOwners } from './eslint-rules/require-feature-owners';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

export default defineConfig([
  {
    extends: fixupConfigRules(
      compat.extends(
        'eslint:recommended',
        'plugin:react/recommended',
        'plugin:react-hooks/recommended',
        'plugin:@typescript-eslint/recommended',
        'plugin:react/jsx-runtime',
        'prettier',
      ),
    ),
    linterOptions: {
      reportUnusedDisableDirectives: 'off',
    },

    plugins: {
      prettier,
      react: fixupPluginRules(react as any),
      '@typescript-eslint': fixupPluginRules(typescriptEslint as any),
    },

    languageOptions: {
      globals: {
        ...globals.browser,
      },

      parser: tsParser,
      ecmaVersion: 2021,
      sourceType: 'module',

      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },

    settings: {
      react: {
        version: 'detect',
      },
    },

    rules: {
      'prettier/prettier': ['error'],

      'max-len': [
        'error',
        {
          code: 100,
          ignoreStrings: true,
          ignoreUrls: true,
        },
      ],

      'no-console': ['error'],

      'sort-imports': [
        'error',
        {
          ignoreCase: true,
          ignoreDeclarationSort: true,
          ignoreMemberSort: false,
        },
      ],

      // Prevent directly importing react as a lint rule
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ImportDeclaration[source.value="react"] ImportDefaultSpecifier',
          message:
            'Do not directly import React. Add specific named imports instead (`import { useState, FC } from "react"`).',
        },
        {
          selector: 'ImportDeclaration[source.value="react"] ImportNamespaceSpecifier',
          message:
            'Do not directly namespace import React (`import * as React`). Add specific named imports instead (`import { useState, FC } from "react"`).',
        },
      ],
    },
  },
  {
    files: ['cypress/**/*'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    files: ['cypress/**/*.ts', 'cypress/**/*.tsx'],
    plugins: {
      import: fixupPluginRules(importPlugin as any),
    },
    settings: {
      'import/resolver': {
        node: { extensions: ['.js', '.jsx', '.ts', '.tsx'] },
      },
    },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^(\\.\\./)+src/',
              message:
                'Use the @ alias instead of relative imports into src/ (e.g. `@/shared/constants/data-test`).',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    plugins: {
      import: fixupPluginRules(importPlugin as any),
    },
    settings: {
      'import/resolver': {
        node: { extensions: ['.js', '.jsx', '.ts', '.tsx'] },
      },
    },
    rules: {
      // Disallow relative imports — use the @ alias instead (e.g. `@/shared/hooks/useAlerts`).
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^\\.', // matches ./ and ../
              message:
                'Use the @ alias instead of relative imports (e.g. `@/shared/hooks/useAlerts`).',
            },
          ],
        },
      ],
      'import/order': [
        'error',
        {
          groups: [['builtin', 'external'], 'internal'],
          pathGroups: [
            {
              pattern: '@/**',
              group: 'internal',
            },
          ],
          pathGroupsExcludedImportTypes: [],
          'newlines-between': 'always',
          alphabetize: {
            order: 'asc',
            caseInsensitive: true,
          },
        },
      ],
    },
  },
  {
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    ignores: ['cypress/**', 'src/**/*.d.ts'],
    plugins: {
      'local-rules': {
        rules: { 'file-naming': fileNaming, 'require-feature-owners': requireFeatureOwners },
      } as any,
    },
    rules: {
      'local-rules/file-naming': 'error',
      'local-rules/require-feature-owners': 'error',
    },
  },
  {
    files: ['src/features/**/*.ts', 'src/features/**/*.tsx'],
    plugins: {
      import: fixupPluginRules(importPlugin as any),
    },
    settings: {
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: './tsconfig.json',
        },
        node: { extensions: ['.js', '.jsx', '.ts', '.tsx'] },
      },
    },
    rules: {
      'import/no-restricted-paths': ['error', { zones: importBoundaryZones }],
    },
  },
]);
