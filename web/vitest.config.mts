import { fileURLToPath } from 'node:url';

import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Resolve the `@/*` path alias from tsconfig.json natively (Vite 8+).
    tsconfigPaths: true,
    // Temporary: tsconfigPaths skips files tsconfig.json excludes (src/features/troubleshooting).
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.spec.{ts,tsx}'],
    exclude: [...configDefaults.exclude, 'src/**/*.browser.spec.tsx'],
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.spec.{ts,tsx}', 'src/**/*.d.ts', 'src/**/test-utils/**'],
    },
  },
});
