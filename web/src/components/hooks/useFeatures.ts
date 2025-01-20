import * as React from 'react';
import { proxiedFetch } from '../proxied-fetch';

type features = {
  'acm-alerting': boolean;
  'perses-dashboards': boolean;
  incidents: boolean;
};

type featuresResponse = {
  'acm-alerting'?: boolean;
  'perses-dashboards'?: boolean;
  incidents?: boolean;
};

const noFeatures: features = {
  'acm-alerting': false,
  'perses-dashboards': false,
  incidents: false,
};
// monitoring-console-plugin proxy via. cluster observability operator
// https://github.com/rhobs/observability-operator/blob/28ac1ba9e179d25cae60e8223bcf61816e23a311/pkg/controllers/uiplugin/monitoring.go#L44
const MCP_PROXY_PATH = '/api/proxy/plugin/monitoring-console-plugin/backend';
const featuresEndpoint = `${MCP_PROXY_PATH}/features`;

export const useFeatures = () => {
  const [features, setFeatures] = React.useState<features>(noFeatures);
  const dashboardsAbort = React.useRef<() => void | undefined>();
  const getFeatures = React.useCallback(async () => {
    try {
      if (dashboardsAbort.current) {
        dashboardsAbort.current();
      }

      const response = await proxiedFetch<featuresResponse>(featuresEndpoint);
      setFeatures({ ...noFeatures, ...response });
    } catch (error) {
      setFeatures(noFeatures);
    }
  }, []);

  // Use useEffect to call getFeatures only once after the component mounts
  React.useEffect(() => {
    getFeatures();
  }, [getFeatures]);

  return {
    features,
    isAcmAlertingActive: features['acm-alerting'],
    arePersesDashboardsActive: features['perses-dashboards'],
    areIncidentsActive: features.incidents,
  };
};
