import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const noMockData = {
  group: ['@/data/*', '@/data/**', '@/repositories/mock/*', '@/repositories/api/*'],
  message: 'UI code reaches data only through services (useServices / useQuery). See docs/ARCHITECTURE.md.',
};
const noDemo = {
  group: ['@/demo', '@/demo/*', '@/demo/**'],
  message: 'Demo code is optional: only src/app-shell/boot.ts and AppProviders.tsx may import it.',
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  // UI layers: no raw data, no mock/api repositories, no demo.
  {
    files: ['src/app/**', 'src/features/**', 'src/components/**', 'src/hooks/**'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [noMockData, noDemo] }],
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[property.name='isPrincipal']",
          message: 'Screens branch on journey capabilities, never on the role (brief §6).',
        },
      ],
      'max-lines': ['warn', { max: 300, skipBlankLines: true, skipComments: true }],
    },
  },
  // Domain and config are pure TypeScript.
  {
    files: ['src/domain/**', 'src/config/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [{ group: ['react', 'react-dom', 'next', 'next/*', '@/services/*', '@/repositories/*', '@/hooks/*', '@/components/*'], message: 'Domain and config must stay framework-free.' }] },
      ],
    },
  },
  // Services depend on repository interfaces, not implementations or mock data.
  {
    files: ['src/services/**'],
    ignores: ['src/services/container.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [noMockData, noDemo] }],
    },
  },
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts', 'test-results/**', 'playwright-report/**']),
]);

export default eslintConfig;
