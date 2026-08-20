import prettier from 'eslint-config-prettier';
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';
import simpleImportSort from 'eslint-plugin-simple-import-sort';

export default [
  {ignores: ['**/public/**', '**/node_modules/**', '**/.next/**', '**/dist/**', '**/build-tsc/**']},
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    plugins: {
      'simple-import-sort': simpleImportSort,
    },
    languageOptions: {
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
        ecmaVersion: 2020,
        sourceType: 'module',
      },
    },
    settings: {
      react: {
        pragma: 'React',
        version: 'detect',
      },
    },
    rules: {
      'react/display-name': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
      '@typescript-eslint/member-ordering': [
        'warn',
        {
          interfaces: ['signature', 'method', 'constructor', 'field'],
          typeLiterals: ['signature', 'method', 'constructor', 'field'],
        },
      ],
      'import/first': 'error',
      'import/newline-after-import': 'error',
      'import/no-duplicates': 'error',
      'no-irregular-whitespace': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', {argsIgnorePattern: '^_'}],
      'object-curly-spacing': ['error', 'never'],
      'react/jsx-curly-brace-presence': [2, 'never'],
      'react/jsx-no-duplicate-props': 'error',
      'react/jsx-sort-props': 'error',
      'react/react-in-jsx-scope': 'off',
      'react/no-unescaped-entities': 'off',
      'simple-import-sort/exports': 'error',
      'simple-import-sort/imports': 'error',
      'jsx-a11y/no-onchange': 'off',
      'jsx-a11y/no-autofocus': 'off',
      '@next/next/no-img-element': 'off',
    },
  },
  {
    files: ['**/*.tsx'],
    rules: {
      'react/prop-types': 'off',
    },
  },
  prettier,
];