jest.mock('@openshift-console/dynamic-plugin-sdk', () => ({
  ...jest.requireActual('@openshift-console/dynamic-plugin-sdk/lib/api/common-types'),
}));

import { getCreateAlertRuleUrl } from '@/shared/hooks/usePerspective';

describe('getCreateAlertRuleUrl', () => {
  const query = 'up{job="prometheus"}';
  const encodedQuery = 'query=up%7Bjob%3D%22prometheus%22%7D';

  it('builds the admin url', () => {
    expect(getCreateAlertRuleUrl('admin', query)).toBe(
      `/monitoring/v2/alertrule/create?${encodedQuery}`,
    );
  });

  it('builds the virtualization url', () => {
    expect(getCreateAlertRuleUrl('virtualization-perspective', query)).toBe(
      `/virt-monitoring/v2/alertrule/create?${encodedQuery}`,
    );
  });

  it('builds the acm url', () => {
    expect(getCreateAlertRuleUrl('acm', query)).toBe(
      `/multicloud/monitoring/v2/alertrule/create?${encodedQuery}`,
    );
  });

  it('builds the dev url with the namespace in the path', () => {
    expect(getCreateAlertRuleUrl('dev', query, 'my-project')).toBe(
      `/dev-monitoring/ns/my-project/v2/alertrule/create?${encodedQuery}`,
    );
  });

  it('falls back to the admin url for an unknown perspective', () => {
    expect(getCreateAlertRuleUrl('unknown' as never, query)).toBe(
      `/monitoring/v2/alertrule/create?${encodedQuery}`,
    );
  });

  it('defaults to an empty query when none is provided', () => {
    expect(getCreateAlertRuleUrl('admin')).toBe('/monitoring/v2/alertrule/create?query=');
  });

  it('url-encodes the query parameter', () => {
    expect(getCreateAlertRuleUrl('admin', 'a b&c=d')).toBe(
      '/monitoring/v2/alertrule/create?query=a+b%26c%3Dd',
    );
  });
});
