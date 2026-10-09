import js from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import hooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import refresh from 'eslint-plugin-react-refresh';
import globals from 'globals';

const separatedStatements = [
  'const',
  'let',
  'var',
  'block-like',
  'function',
  'class',
  'type',
  'interface',
  'export',
];

const restrictions = (layers, external = []) => [
  'error',
  {
    patterns: [
      {
        group: layers.map((layer) => `**/${layer}/**`),
        message: 'Нарушение направления зависимостей. См. AGENTS.md.',
      },
      ...(external.length
        ? [
            {
              group: external,
              message: 'Домен и сценарии не зависят от внешнего UI или хранилища.',
            },
          ]
        : []),
    ],
  },
];

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
    ],
  },
  js.configs.recommended,
  { files: ['*.{js,ts}', 'scripts/*.mjs'], languageOptions: { globals: globals.node } },
  ...tseslint.configs.recommendedTypeChecked.map((config) => ({
    ...config,
    files: ['**/*.{ts,tsx}'],
  })),
  prettier,
  {
    files: ['**/*.{js,mjs,ts,tsx}'],
    plugins: { '@stylistic': stylistic },
    rules: {
      'one-var': ['error', 'never'],
      '@stylistic/lines-between-class-members': ['error', 'always'],
      '@stylistic/padding-line-between-statements': [
        'error',
        { blankLine: 'always', prev: '*', next: separatedStatements },
        { blankLine: 'always', prev: separatedStatements, next: '*' },
        { blankLine: 'always', prev: '*', next: 'return' },
        { blankLine: 'always', prev: 'import', next: '*' },
        { blankLine: 'any', prev: 'import', next: 'import' },
      ],
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      eqeqeq: ['error', 'always'],
      curly: ['error', 'all'],
    },
  },
  {
    files: ['src/**/*.tsx'],
    plugins: { 'react-hooks': hooks, 'jsx-a11y': jsxA11y, 'react-refresh': refresh },
    rules: {
      ...hooks.configs.recommended.rules,
      ...jsxA11y.configs.recommended.rules,
      'react-hooks/exhaustive-deps': 'error',
      // The game receives keyboard input; its application region needs focus.
      'jsx-a11y/no-noninteractive-tabindex': ['error', { roles: ['application'] }],
      'react-refresh/only-export-components': ['error', { allowConstantExport: true }],
    },
  },
  {
    files: ['src/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': restrictions(
        ['use-cases', 'adapters', 'presentation', 'bootstrap', 'content'],
        ['react', 'react-dom', 'phaser'],
      ),
      'no-restricted-globals': [
        'error',
        'window',
        'document',
        'localStorage',
        'indexedDB',
        'fetch',
        'requestAnimationFrame',
        'setTimeout',
        'setInterval',
      ],
    },
  },
  {
    files: ['src/use-cases/**/*.ts'],
    rules: {
      'no-restricted-imports': restrictions(
        ['adapters', 'presentation', 'bootstrap', 'content'],
        ['react', 'react-dom', 'phaser'],
      ),
    },
  },
  {
    files: ['src/adapters/**/*.ts'],
    rules: { 'no-restricted-imports': restrictions(['presentation', 'bootstrap']) },
  },
  {
    files: ['src/presentation/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': restrictions([
        'adapters',
        'bootstrap',
        'content',
        'rules',
        'simulation',
      ]),
    },
  },
  {
    files: ['src/content/**/*.ts'],
    rules: {
      'no-restricted-imports': restrictions(['use-cases', 'adapters', 'presentation', 'bootstrap']),
    },
  },
  {
    files: ['tests/**/*.test.ts'],
    rules: {
      '@typescript-eslint/require-await': 'off',
    },
  },
  {
    // A synchronous data source deliberately implements an asynchronous port.
    files: ['src/adapters/content/local.ts'],
    rules: { '@typescript-eslint/require-await': 'off' },
  },
);
