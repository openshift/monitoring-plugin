import { consoleFetchJSON } from '@openshift-console/dynamic-plugin-sdk';
import { useCallback, useEffect, useRef, useState } from 'react';

type features = {
  alerting: boolean;
  'acm-alerting': boolean;
  'perses-dashboards': boolean;
  'legacy-dashboards': boolean;
  metrics: boolean;
  targets: boolean;
  'cluster-health-analyzer': boolean;
  incidents: boolean;
};

type FeaturesResponse = {
  alerting?: boolean;
  'acm-alerting'?: boolean;
  'perses-dashboards'?: boolean;
  'legacy-dashboards'?: boolean;
  metrics?: boolean;
  targets?: boolean;
  'cluster-health-analyzer'?: boolean;
  incidents?: boolean;
};

const noFeatures: features = {
  alerting: false,
  'acm-alerting': false,
  'perses-dashboards': false,
  'legacy-dashboards': false,
  metrics: false,
  targets: false,
  'cluster-health-analyzer': false,
  incidents: false,
};
// monitoring-console-plugin proxy via. cluster observability operator
// https://github.com/rhobs/observability-operator/blob/28ac1ba9e179d25cae60e8223bcf61816e23a311/pkg/controllers/uiplugin/monitoring.go#L44
const MCP_PROXY_PATH = '/api/proxy/plugin/monitoring-console-plugin/backend';
const featuresEndpoint = `${MCP_PROXY_PATH}/features`;

export const useFeatures = () => {
  const [features, setFeatures] = useState<features>(noFeatures);
  const dashboardsAbort = useRef<() => void | undefined>();
  const getFeatures = useCallback(async () => {
    try {
      if (dashboardsAbort.current) {
        dashboardsAbort.current();
      }

      const response: FeaturesResponse = await consoleFetchJSON(featuresEndpoint);
      setFeatures({ ...noFeatures, ...response });
    } catch {
      setFeatures(noFeatures);
    }
  }, []);

  // Use useEffect to call getFeatures only once after the component mounts
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    getFeatures();
  }, [getFeatures]);

  return {
    features,
  };
};
