import type { FC } from 'react';
import { Navigate, useSearchParams } from 'react-router';

import { buildPrometheusRedirectUrl } from '@/features/metrics/utils/prometheus-redirect';
import { MonitoringProvider } from '@/shared/contexts/MonitoringContext';
import { usePerspective } from '@/shared/hooks/usePerspective';

// Handles links that have the Prometheus UI's URL format (expected for links in alerts sent by
// Alertmanager). The Prometheus UI specifies the PromQL query with the GET param `g0.expr`, so we
// use that if it exists. Otherwise, just go to the query browser page with no query.
const PrometheusRouterRedirect: FC = () => {
  const { urlRoot } = usePerspective();

  const [params] = useSearchParams();
  // leaving perspective redirect to future work
  return <Navigate to={buildPrometheusRedirectUrl(params, urlRoot)} />;
};

const PrometheusRedirectPage: FC = () => (
  <MonitoringProvider monitoringContext={{ plugin: 'monitoring-plugin', prometheus: 'cmo' }}>
    <PrometheusRouterRedirect />
  </MonitoringProvider>
);

export default PrometheusRedirectPage;
