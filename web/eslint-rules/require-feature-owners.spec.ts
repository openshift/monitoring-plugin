import type { Rule } from 'eslint';
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

describe('require-feature-owners (stale cache regression)', () => {
  it('re-checks existsSync on each invocation instead of reusing a cached result', () => {
    let ownersExists = false;
    const rule = createRequireFeatureOwners(() => ownersExists);

    const reports: Rule.ReportDescriptor[] = [];
    const makeContext = (filename: string) =>
      ({
        filename,
        report: (descriptor: Rule.ReportDescriptor) => reports.push(descriptor),
      }) as unknown as Rule.RuleContext;

    const filename = '/repo/web/src/features/alerts/AlertList.tsx';

    // First invocation: OWNERS missing — expect one report.
    rule.create(makeContext(filename));
    expect(reports).toHaveLength(1);

    // OWNERS file now exists (e.g. created mid watch-mode session).
    ownersExists = true;
    reports.length = 0;

    // Second invocation with the same rule instance — must not return a stale result.
    rule.create(makeContext(filename));
    expect(reports).toHaveLength(0);
  });
});
