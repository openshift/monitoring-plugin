import { consoleFetchJSON, PrometheusRulesResponse } from '@openshift-console/dynamic-plugin-sdk';

// Disable client-side timeout (-1) to let the backend control query timeouts
const NO_TIMEOUT = -1;

// Merges Prometheus monitoring alerts with external sources
export const fetchAlerts = async (
  prometheusURL: string,
  externalAlertsFetch?: Array<{
    id: string;
    getAlertingRules: (namespace?: string) => Promise<PrometheusRulesResponse>;
  }>,
  namespace?: string,
): Promise<PrometheusRulesResponse> => {
  if (!externalAlertsFetch || externalAlertsFetch.length === 0) {
    return consoleFetchJSON(prometheusURL, 'GET', {}, NO_TIMEOUT);
  }

  const resolvedExternalAlertsSources = externalAlertsFetch.map((extensionProperties) => ({
    id: extensionProperties.id,
    fetch: extensionProperties.getAlertingRules,
  }));

  const sourceIds = ['prometheus', ...resolvedExternalAlertsSources.map((source) => source.id)];

  try {
    const groups = await Promise.allSettled([
      consoleFetchJSON(prometheusURL, 'GET', {}, NO_TIMEOUT),
      ...resolvedExternalAlertsSources.map((source) => source.fetch(namespace)),
    ]).then((results) =>
      results
        .map((result, i) => ({ sourceId: sourceIds[i], alerts: result }))
        .flatMap((result) =>
          result.alerts.status === 'fulfilled' && result.alerts.value?.data?.groups
            ? result.alerts.value.data.groups.map((group) => ({
                ...group,
                rules: [...group.rules.map((rule) => ({ ...rule, sourceId: result.sourceId }))],
              }))
            : [],
        ),
    );

    return { data: { groups }, status: 'success' };
  } catch {
    return consoleFetchJSON(prometheusURL, 'GET', {}, NO_TIMEOUT);
  }
};
