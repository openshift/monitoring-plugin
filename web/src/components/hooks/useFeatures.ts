import * as React from 'react';
import { cancellableFetch } from '../cancellable-fetch';

type features = {
  'acm-alerting': boolean;
  incidents: boolean;
};
type featuresResponse = {
  'acm-alerting'?: boolean;
  incidents?: boolean;
};

const noFeatures: features = {
  'acm-alerting': false,
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
      const { request, abort } = cancellableFetch<featuresResponse>(featuresEndpoint);
      dashboardsAbort.current = abort;

      const response = await request();
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
    areIncidentsActive: features.incidents,
  };
};
