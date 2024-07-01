import { consoleFetchJSON, PrometheusRulesResponse } from '@openshift-console/dynamic-plugin-sdk';

// Merges Prometheus monitoring alerts with external sources
export const fetchAlerts = async (
  prometheusURL: string,
  externalAlertsFetch?: Array<{
    id: string;
    getAlertingRules: () => Promise<PrometheusRulesResponse>;
  }>,
): Promise<PrometheusRulesResponse> => {
  if (!externalAlertsFetch || externalAlertsFetch.length === 0) {
    return consoleFetchJSON(prometheusURL);
  }

  const resolvedExternalAlertsSources = externalAlertsFetch.map((extensionProperties) => ({
    id: extensionProperties.id,
    fetch: extensionProperties.getAlertingRules,
  }));

  const sourceIds = ['prometheus', ...resolvedExternalAlertsSources.map((source) => source.id)];

  try {
    const groups = await Promise.allSettled([
      consoleFetchJSON(prometheusURL),
      ...resolvedExternalAlertsSources.map((source) => source.fetch()),
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
    return consoleFetchJSON(prometheusURL);
  }
};
