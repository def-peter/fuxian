import js from '@eslint/js';
import { plugin as shadcn } from '@shadcn/lint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/coverage/**',
      '**/dist/**',
      '**/node_modules/**',
      '**/out/**',
      '**/playwright-report/**',
      '**/release/**',
      '**/test-results/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{js,mjs,ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    files: ['apps/desktop/src/renderer/**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.flat.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    // Shell components only: document rendering and third-party diagram styles
    // have their own CSS boundary and are not governed by the application theme.
    files: ['apps/desktop/src/renderer/src/**/*.tsx'],
    ignores: [
      '**/*.test.tsx',
      '**/PaperPreviewApp.tsx',
      '**/ExportApp.tsx',
      '**/paper-preview-frame.tsx',
    ],
    plugins: { shadcn },
    settings: {
      shadcn: {
        ui: '@/components/ui',
        note: 'Use Fuxian shell tokens and shared component variants. Document and diagram styles remain independent.',
      },
    },
    rules: {
      'shadcn/no-restyle': [
        'warn',
        {
          allow: ['layout'],
          // Collapsible is an unstyled behavior primitive; its callers own appearance.
          ignoreImports: ['(^|/)ui/collapsible$'],
          contracts: [
            // Existing document actions reveal themselves on hover or keyboard focus.
            { pattern: '^Button$', allow: ['layout', 'opacity-0', 'opacity-100'] },
          ],
        },
      ],
      'shadcn/no-raw-colors': 'warn',
      'shadcn/no-unknown-classes': 'warn',
      // Measured document widths, resize handles, and theme samples require
      // dynamic values. Introduce narrower contracts before checking these.
    },
  },
  {
    files: ['apps/desktop/src/renderer/src/components/ui/**/*.tsx'],
    rules: { 'shadcn/no-restyle': 'off' },
  },
  {
    files: ['apps/desktop/src/renderer/src/components/ui/tooltip.tsx'],
    // main.tsx injects this shared CSS from @fuxian/document-theme/tooltip-tokens.
    rules: { 'shadcn/no-unknown-classes': ['warn', { allow: ['tooltip-surface'] }] },
  },
);
