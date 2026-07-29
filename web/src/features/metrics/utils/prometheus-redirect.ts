export const buildPrometheusRedirectUrl = (params: URLSearchParams, urlRoot: string): string => {
  const expr = params.get('g0.expr');
  return `/${urlRoot}/query-browser?query0=${expr ? encodeURIComponent(expr) : ''}`;
};
