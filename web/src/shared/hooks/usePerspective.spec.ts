vi.mock('@openshift-console/dynamic-plugin-sdk', () => ({}));

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

  it('returns empty string for the acm perspective', () => {
    expect(getCreateAlertRuleUrl('acm', query)).toBe('');
  });

  it('returns empty string for the dev perspective', () => {
    expect(getCreateAlertRuleUrl('dev', query)).toBe('');
  });

  it('returns empty string for an unknown perspective', () => {
    expect(getCreateAlertRuleUrl('unknown' as never, query)).toBe('');
  });

  it('url-encodes the query parameter', () => {
    expect(getCreateAlertRuleUrl('admin', 'a b&c=d')).toBe(
      '/monitoring/v2/alertrule/create?query=a+b%26c%3Dd',
    );
  });
});
