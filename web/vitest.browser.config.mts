import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  optimizeDeps: {
    include: [
      '@openshift-console/dynamic-plugin-sdk',
      '@openshift-console/dynamic-plugin-sdk/lib/api/common-types',
      '@patternfly/react-core',
      '@patternfly/react-icons',
      '@perses-dev/spec',
      'react-router',
      'react-i18next',
      'vitest-browser-react',
    ],
  },
  define: {
    'process.env.I18N_NAMESPACE': JSON.stringify(
      `plugin__${process.env.CONSOLE_PLUGIN_NAME ?? 'monitoring-plugin'}`,
    ),
  },
  test: {
    globals: true,
    include: ['src/**/*.browser.spec.tsx'],
    setupFiles: ['./vitest.browser.setup.ts'],
    browser: {
      enabled: true,
      provider: playwright(),
      instances: [{ browser: 'chromium' }],
      headless: true,
      viewport: { width: 1000, height: 660 },
      locators: { testIdAttribute: 'data-test' },
      screenshotDirectory: './test-results/component',
    },
  },
});
