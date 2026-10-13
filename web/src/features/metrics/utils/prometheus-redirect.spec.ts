import { buildPrometheusRedirectUrl } from './prometheus-redirect';

describe('buildPrometheusRedirectUrl', () => {
  it('maps g0.expr to query0 with the correct urlRoot', () => {
    const params = new URLSearchParams('g0.expr=vector(1)&g0.tab=1');
    expect(buildPrometheusRedirectUrl(params, 'monitoring')).toBe(
      '/monitoring/query-browser?query0=vector(1)',
    );
  });

  it('percent-encodes the PromQL expression', () => {
    const params = new URLSearchParams('g0.expr=up{job="prometheus"}&g0.tab=1');
    expect(buildPrometheusRedirectUrl(params, 'monitoring')).toBe(
      '/monitoring/query-browser?query0=up%7Bjob%3D%22prometheus%22%7D',
    );
  });

  it('produces an empty query0 when g0.expr is absent', () => {
    const params = new URLSearchParams('g0.tab=1');
    expect(buildPrometheusRedirectUrl(params, 'monitoring')).toBe(
      '/monitoring/query-browser?query0=',
    );
  });

  it('produces an empty query0 when g0.expr is an empty string', () => {
    const params = new URLSearchParams('g0.expr=&g0.tab=1');
    expect(buildPrometheusRedirectUrl(params, 'monitoring')).toBe(
      '/monitoring/query-browser?query0=',
    );
  });

  it('uses the urlRoot from the active perspective', () => {
    const params = new URLSearchParams('g0.expr=up&g0.tab=0');
    expect(buildPrometheusRedirectUrl(params, 'dev-monitoring')).toBe(
      '/dev-monitoring/query-browser?query0=up',
    );
  });
});
