import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'
import boundaries from 'eslint-plugin-boundaries'

// See PRINCIPLES.md §"Module boundaries" for the rules this config enforces.

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  // Module boundaries — VSA layout enforcement (editor-time companion to
  // .dependency-cruiser.cjs which runs in CI).
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { boundaries },
    settings: {
      'boundaries/elements': [
        { type: 'app',       pattern: 'src/app/**' },
        { type: 'feature',   pattern: 'src/features/*', capture: ['slice'] },
        { type: 'core',      pattern: 'src/core/**' },
        { type: 'ui',        pattern: 'src/ui/**' },
        { type: 'test',      pattern: 'src/test/**' },
        { type: 'generated', pattern: 'src/generated/**' },
      ],
      'boundaries/include': ['src/**/*'],
    },
    rules: {
      'boundaries/element-types': [
        'error',
        {
          default: 'disallow',
          rules: [
            { from: 'app',       allow: ['feature', 'core', 'ui', 'generated'] },
            { from: 'feature',   allow: ['core', 'ui', 'generated'] },
            { from: 'core',      allow: ['core', 'generated'] },
            { from: 'ui',        allow: ['ui', 'core'] },
            { from: 'test',      allow: ['feature', 'core', 'ui', 'generated'] },
            { from: 'generated', allow: ['generated'] },
          ],
        },
      ],
      // Slices may not reach into another slice's internals.
      'boundaries/no-private': ['error', { allowUncles: false }],
    },
  },

  // Promote a11y rules from warn to error — see PRINCIPLES.md §"Accessibility"
  // (rules already loaded by eslint-config-next; this just elevates them).
  {
    files: ['src/**/*.tsx'],
    rules: {
      'jsx-a11y/alt-text': 'error',
      'jsx-a11y/aria-props': 'error',
      'jsx-a11y/aria-role': 'error',
      'jsx-a11y/anchor-has-content': 'error',
      'jsx-a11y/click-events-have-key-events': 'error',
      'jsx-a11y/no-static-element-interactions': 'error',
      'jsx-a11y/label-has-associated-control': 'error',
    },
  },

  // Forbid console.log outside of dev-only branches and scripts.
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },

  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    'src/generated/**',
    'scripts/**', // seed + utility scripts may use console
  ]),
])

export default eslintConfig
