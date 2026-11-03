vi.mock('@openshift-console/dynamic-plugin-sdk', () => ({}));

import {
  getPerspectiveForPath,
  PerspectiveName,
  UrlRootName,
} from '@/shared/constants/perspective';
import { getAlertRulesUrl } from '@/shared/hooks/usePerspective';

describe('getPerspectiveForPath', () => {
  it.each(Object.values(PerspectiveName))('resolves %s routes', (perspective) => {
    const root = UrlRootName[perspective];

    expect(
      getPerspectiveForPath(`/${root}`),
      `The root route /${root} should resolve to the ${perspective} perspective`,
    ).toBe(perspective);
    expect(
      getPerspectiveForPath(`/${root}/alerts`),
      `The nested route /${root}/alerts should resolve to the ${perspective} perspective`,
    ).toBe(perspective);
  });

  it('round-trips a multicloud alert rules URL through its perspective', () => {
    const url = '/multicloud/monitoring/alertrules';
    const perspective = getPerspectiveForPath(url);

    expect(
      perspective,
      `The multicloud alert rules route ${url} should resolve to the ACM perspective`,
    ).toBe(PerspectiveName.ACM);
    expect(
      getAlertRulesUrl(perspective),
      'The ACM perspective should produce the original multicloud alert rules URL',
    ).toBe(url);
  });
});
