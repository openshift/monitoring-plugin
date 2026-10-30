import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Resolve the `@/*` path alias from tsconfig.json natively (Vite 8+).
    tsconfigPaths: true,
  },
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.spec.{ts,tsx}', 'eslint-rules/**/*.spec.ts'],
    exclude: [...configDefaults.exclude, 'src/**/*.browser.spec.tsx'],
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.spec.{ts,tsx}', 'src/**/*.d.ts', 'src/**/test-utils/**'],
    },
  },
});
