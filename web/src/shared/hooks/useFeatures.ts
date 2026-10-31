import { consoleFetchJSON } from '@openshift-console/dynamic-plugin-sdk';
import { useQuery } from '@tanstack/react-query';

type Features = {
  logging: boolean;
  alerting: boolean;
  'alert-management-api': boolean;
  'acm-alerting': boolean;
  'perses-dashboards': boolean;
  'perses-ui-customization': boolean;
  'legacy-dashboards': boolean;
  metrics: boolean;
  targets: boolean;
  'cluster-health-analyzer': boolean;
  troubleshooting: boolean;
  'agent-navigation': boolean;
};

type FeaturesResponse = Partial<Features>;

const defaultMonitoringConsolePluginFeatures: Features = {
  logging: false,
  alerting: false,
  'alert-management-api': false,
  'acm-alerting': false,
  'perses-dashboards': false,
  'perses-ui-customization': false,
  'legacy-dashboards': false,
  metrics: false,
  targets: false,
  'cluster-health-analyzer': false,
  troubleshooting: false,
  'agent-navigation': false,
};

const defaultMonitoringPluginFeatures: Features = {
  logging: false,
  alerting: true,
  'alert-management-api': false,
  'acm-alerting': false,
  'perses-dashboards': false,
  'perses-ui-customization': false,
  'legacy-dashboards': true,
  metrics: true,
  targets: true,
  'cluster-health-analyzer': false,
  troubleshooting: false,
  'agent-navigation': false,
};

const MP_PROXY_PATH = '/api/plugins/monitoring-plugin';
const MCP_PROXY_PATH = '/api/plugins/monitoring-console-plugin';

const fetchFeatures = async (proxyPath: string, defaults: Features): Promise<Features> => {
  try {
    const response: FeaturesResponse = await consoleFetchJSON(`${proxyPath}/features`);
    return { ...defaults, ...response };
  } catch {
    return defaults;
  }
};

export const useFeatures = () => {
  const { data: monitoringPluginFeatures } = useQuery({
    queryKey: ['features', 'monitoring-plugin'],
    queryFn: () => fetchFeatures(MP_PROXY_PATH, defaultMonitoringPluginFeatures),
    placeholderData: defaultMonitoringPluginFeatures,
    staleTime: Infinity,
  });

  const { data: monitoringConsolePluginFeatures } = useQuery({
    queryKey: ['features', 'monitoring-console-plugin'],
    queryFn: () => fetchFeatures(MCP_PROXY_PATH, defaultMonitoringConsolePluginFeatures),
    placeholderData: defaultMonitoringConsolePluginFeatures,
    staleTime: Infinity,
  });

  return {
    features: {
      'monitoring-plugin': monitoringPluginFeatures,
      'monitoring-console-plugin': monitoringConsolePluginFeatures,
    },
  };
};
