import { RuleTester } from 'eslint';
import { createRequireFeatureOwners } from './require-feature-owners';

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 2021, sourceType: 'module' },
});

ruleTester.run(
  'require-feature-owners (OWNERS present)',
  createRequireFeatureOwners(() => true),
  {
    valid: [
      { code: '', filename: '/repo/web/src/features/alerts/components/AlertList.tsx' },
      { code: '', filename: '/repo/web/src/features/metrics/pages/MetricsPage.tsx' },
      { code: '', filename: '/repo/web/src/features/alerts/index.ts' },
      { code: '', filename: '/repo/web/src/shared/utils/format.ts' },
      { code: '', filename: '/repo/web/src/shared/hooks/useAlerts.ts' },
    ],
    invalid: [],
  },
);

ruleTester.run(
  'require-feature-owners (OWNERS absent)',
  createRequireFeatureOwners(() => false),
  {
    // Not in features folder
    valid: [
      { code: '', filename: '/repo/web/src/shared/utils/format.ts' },
      { code: '', filename: '/repo/web/src/shared/hooks/useAlerts.ts' },
    ],
    invalid: [
      {
        code: '',
        filename: '/repo/web/src/features/alerts/components/AlertList.tsx',
        errors: [{ messageId: 'missingOwners', data: { feature: 'alerts' } }],
      },
      {
        code: '',
        filename: '/repo/web/src/features/new-feature/NewFeature.tsx',
        errors: [{ messageId: 'missingOwners', data: { feature: 'new-feature' } }],
      },
    ],
  },
);
