/* eslint-disable max-len */

import { PrometheusEndpoint, PrometheusResponse } from '@openshift-console/dynamic-plugin-sdk';
import { getPrometheusBasePath, buildPrometheusUrl } from '../utils';
import { PROMETHEUS_QUERY_INTERVAL_SECONDS } from './utils';
/**
 * Creates a Prometheus alerts query string from grouped alert values.
 * The function dynamically includes any properties in the input objects that have the "src_" prefix,
 * but the prefix is removed from the keys in the final query string.
 *
 * @param {Object[]} groupedAlertsValues - Array of grouped alert objects.
 * Each alert object should contain various properties, including "src_" prefixed properties,
 * as well as "layer" and "component" for constructing the meta fields in the query.
 *
 * @param {string} groupedAlertsValues[].layer - The layer of the alert, used in the absent condition.
 * @param {string} groupedAlertsValues[].component - The component of the alert, used in the absent condition.
 * @returns {string} - A string representing the combined Prometheus alerts query.
 * Each alert query is formatted as `(ALERTS{key="value", ...} + on () group_left (component, layer) (absent(meta{layer="value", component="value"})))`
 * and multiple queries are joined by "or".
 *
 * @example
 * const alerts = [
 *   {
 *     src_alertname: "AlertmanagerReceiversNotConfigured",
 *     src_namespace: "openshift-monitoring",
 *     src_severity: "warning",
 *     layer: "core",
 *     component: "monitoring"
 *   },
 *   {
 *     src_alertname: "AnotherAlert",
 *     src_namespace: "default",
 *     src_severity: "critical",
 *     layer: "app",
 *     component: "frontend"
 *   }
 * ];
 *
 * const query = createAlertsQuery(alerts);
 * // Returns:
 * // '(ALERTS{alertname="AlertmanagerReceiversNotConfigured", namespace="openshift-monitoring", severity="warning"} + on () group_left (component, layer) (absent(meta{layer="core", component="monitoring"}))) or
 * //  (ALERTS{alertname="AnotherAlert", namespace="default", severity="critical"} + on () group_left (component, layer) (absent(meta{layer="app", component="frontend"})))'
 */
export const createAlertsQuery = (groupedAlertsValues) => {
  const alertsQuery = groupedAlertsValues
    .map((query) => {
      // Dynamically get all keys starting with "src_"
      const srcKeys = Object.keys(query).filter((key) => key.startsWith('src_'));

      // Create the alertParts array using the dynamically discovered src_ keys,
      // but remove the "src_" prefix from the keys in the final query string.
      const alertParts = srcKeys
        .filter((key) => query[key]) // Only include keys that are present in the query object
        .map((key) => `${key.replace('src_', '')}="${query[key]}"`) // Remove "src_" prefix from keys
        .join(', ');

      // Construct the query string for each grouped alert
      return `(ALERTS{${alertParts}} + on () group_left (component, layer) (absent(meta{layer="${query.layer}", component="${query.component}"})))`;
    })
    .join(' or '); // Join all individual alert queries with "or"

  // TODO: remove duplicated conditions, optimize query

  return alertsQuery;
};

export const fetchDataForIncidentsAndAlerts = (
  fetch: (url: string) => Promise<PrometheusResponse>,
  range: { endTime: number; duration: number },
  customQuery: string,
) => {
  // Calculate samples to ensure step=PROMETHEUS_QUERY_INTERVAL_SECONDS (300s / 5 minutes)
  // For 24h duration: Math.ceil(86400000 / 288 / 1000) = 300 seconds
  const samples = Math.floor(range.duration / (PROMETHEUS_QUERY_INTERVAL_SECONDS * 1000));

  const url = buildPrometheusUrl({
    prometheusUrlProps: {
      endpoint: PrometheusEndpoint.QUERY_RANGE,
      endTime: range.endTime,
      query: customQuery,
      samples,
      timespan: range.duration,
    },
    basePath: getPrometheusBasePath({
      prometheus: 'cmo',
      useTenancyPath: false,
    }),
  });

  if (!url) {
    // Return empty result when query is empty to avoid making invalid API calls
    return Promise.resolve({
      data: {
        result: [],
      },
    });
  }

  return fetch(url);
};
