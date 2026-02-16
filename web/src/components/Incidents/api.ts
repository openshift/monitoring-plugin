/* eslint-disable max-len */

import {
  consoleFetchJSON,
  PrometheusEndpoint,
  PrometheusResponse,
} from '@openshift-console/dynamic-plugin-sdk';
import { getPrometheusBasePath, buildPrometheusUrl } from '../utils';
import { PROMETHEUS_QUERY_INTERVAL_SECONDS } from './utils';

const MAX_URL_LENGTH = 2048;

/**
 * Creates a single Prometheus alert query string from a grouped alert value.
 * @param {Object} query - Single grouped alert object with src_ prefixed properties and layer/component.
 * @returns {string} - A string representing a single Prometheus alert query.
 */
const createSingleAlertQuery = (query) => {
  // Dynamically get all keys starting with "src_"
  const srcKeys = Object.keys(query).filter(
    (key) => key.startsWith('src_') && key != 'src_silenced',
  );

  // Create the alertParts array using the dynamically discovered src_ keys,
  // but remove the "src_" prefix from the keys in the final query string.
  const alertParts = srcKeys
    .filter((key) => query[key]) // Only include keys that are present in the query object
    .map((key) => `${key.replace('src_', '')}="${query[key]}"`) // Remove "src_" prefix from keys
    .join(', ');

  // Construct the query string for each grouped alert
  return `ALERTS{${alertParts}}`;
};

/**
 * Creates a Prometheus alerts query string from grouped alert values.
 * The function dynamically includes any properties in the input objects that have the "src_" prefix,
 * but the prefix is removed from the keys in the final query string.
 *
 * @param {Object[]} groupedAlertsValues - Array of grouped alert objects.
 * Each alert object should contain various properties, including "src_" prefixed properties
 *
 * @param {string} groupedAlertsValues[].layer - The layer of the alert, used in the absent condition.
 * @param {string} groupedAlertsValues[].component - The component of the alert, used in the absent condition.
 * @returns {string[]} - An array of strings representing the combined Prometheus alerts query.
 * Each alert query is formatted as `(ALERTS{key="value", ...} and multiple queries are joined by "or".
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
 * // ['ALERTS{alertname="AlertmanagerReceiversNotConfigured", namespace="openshift-monitoring", severity="warning"} or
 * //  ALERTS{alertname="AnotherAlert", namespace="default", severity="critical"}']
 */
export const createAlertsQuery = (groupedAlertsValues, max_url_length = MAX_URL_LENGTH) => {
  const queries = [];
  const alertsMap = new Map<string, boolean>();

  let currentQueryParts = [];
  let currentQueryLength = 0;

  for (const alertValue of groupedAlertsValues) {
    const singleAlertQuery = createSingleAlertQuery(alertValue);
    if (alertsMap.has(singleAlertQuery)) {
      continue;
    }
    alertsMap.set(singleAlertQuery, true);
    const newQueryLength = currentQueryLength + singleAlertQuery.length + 4; // 4 for ' or '

    if (newQueryLength <= max_url_length) {
      currentQueryParts.push(singleAlertQuery);
      currentQueryLength = newQueryLength;
      continue;
    }
    queries.push(currentQueryParts.join(' or '));
    currentQueryParts = [singleAlertQuery];
    currentQueryLength = singleAlertQuery.length;
  }

  if (currentQueryParts.length > 0) {
    queries.push(currentQueryParts.join(' or '));
  }

  return queries;
};

export const fetchDataForIncidentsAndAlerts = async (
  fetch: (url: string) => Promise<PrometheusResponse>,
  range: { endTime: number; duration: number },
  customQuery: string | string[],
) => {
  // Calculate samples to ensure step=PROMETHEUS_QUERY_INTERVAL_SECONDS (300s / 5 minutes)
  // For 24h duration: Math.ceil(86400000 / 288 / 1000) = 300 seconds
  const samples = Math.floor(range.duration / (PROMETHEUS_QUERY_INTERVAL_SECONDS * 1000));
  const queries = Array.isArray(customQuery) ? customQuery : [customQuery];

  const promises = queries.map((query) => {
    const url = buildPrometheusUrl({
      prometheusUrlProps: {
        endpoint: PrometheusEndpoint.QUERY_RANGE,
        endTime: range.endTime,
        query,
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
        status: 'success',
        data: {
          resultType: 'matrix',
          result: [],
        },
      } as PrometheusResponse);
    }

    return consoleFetchJSON(url);
  });

  const responses = await Promise.all(promises);

  // Merge responses
  const combinedResult = responses.flatMap((r) => r.data?.result || []);

  // Construct a synthetic response
  return {
    status: 'success',
    data: {
      resultType: responses[0]?.data?.resultType || 'matrix',
      result: combinedResult,
    },
  } as PrometheusResponse;
};
