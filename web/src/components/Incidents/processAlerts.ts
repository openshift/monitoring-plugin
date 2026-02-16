/* eslint-disable max-len */

import { PrometheusResult, PrometheusRule } from '@openshift-console/dynamic-plugin-sdk';
import { Alert, GroupedAlert, Incident, Severity } from './model';
import {
  insertPaddingPointsForChart,
  isResolved,
  PROMETHEUS_QUERY_INTERVAL_SECONDS,
} from './utils';

/**
 * Deduplicates alert objects by their `alertname`, `namespace`, `component`, and `severity` fields and merges their values
 * while removing duplicates. Only firing alerts are included. Alerts with the same combination of these four fields
 * are combined, with values being deduplicated.
 *
 * After deduplication, alerts are split into separate entries when there is a gap longer than 5 minutes
 * (PROMETHEUS_QUERY_INTERVAL_SECONDS) between consecutive datapoints. This means the same alert identity
 * can appear multiple times in the result, once per continuous firing interval.
 *
 * @param {Array<Object>} objects - Array of alert objects to be deduplicated. Each object contains a `metric` field
 * with properties such as `alertname`, `namespace`, `component`, `severity`, and an array of `values`.
 * @param {Object} objects[].metric - The metric information of the alert.
 * @param {string} objects[].metric.alertname - The name of the alert.
 * @param {string} objects[].metric.namespace - The namespace in which the alert is raised.
 * @param {string} objects[].metric.component - The component associated with the alert.
 * @param {string} objects[].metric.severity - The severity level of the alert.
 * @param {string} objects[].metric.alertstate - The current state of the alert (only 'firing' alerts are included).
 * @param {Array<Array<Number | string>>} objects[].values - The array of values corresponding to the alert, where
 * each value is a tuple containing a timestamp and a value (e.g., [timestamp, value]).
 *
 * @returns {Array<Object>} - An array of deduplicated firing alert objects, split by gaps. Each object contains
 * a combination of `alertname`, `namespace`, `component`, and `severity`, with values for one continuous interval.
 * @returns {Object} return[].metric - The metric information of the deduplicated alert.
 * @returns {Array<Array<Number | string>>} return[].values - The values for one continuous interval, sorted by timestamp.
 *
 * @example
 * const alerts = [
 *   { metric: { alertname: "Alert1", namespace: "ns1", component: "comp1", severity: "critical", alertstate: "firing" }, values: [[1000, "2"], [1300, "2"], [2000, "2"], [2300, "2"]] }
 * ];
 * const deduplicated = deduplicateAlerts(alerts);
 * // Returns two entries for Alert1: one with values [[1000, "2"], [1300, "2"]] and another with [[2000, "2"], [2300, "2"]]
 * // because the gap between 1300 and 2000 (700s) exceeds the 5-minute threshold (300s).
 */
export function deduplicateAlerts(objects: Array<PrometheusResult>): Array<PrometheusResult> {
  // Step 1: Filter out all non firing alerts
  const filteredObjects = objects.filter((obj) => obj.metric.alertstate === 'firing');
  const groupedObjects = new Map();
  // Group by alertname, namespace, component, and severity to ensure no data loss
  for (const obj of filteredObjects) {
    const key = [
      obj.metric.alertname,
      obj.metric.namespace,
      obj.metric.component,
      obj.metric.severity,
    ].join('|');

    // If the key already exists in the map, merge the values after deduplication
    if (groupedObjects.has(key)) {
      const existingObj = groupedObjects.get(key);

      // Deduplicate the incoming obj.values before concatenating
      const existingValuesSet = new Set(existingObj.values.map((v) => JSON.stringify(v)));
      const newValues = obj.values.filter((v) => !existingValuesSet.has(JSON.stringify(v)));

      // Concatenate non-duplicate values
      existingObj.values = existingObj.values.concat(newValues);
    } else {
      // Otherwise, create a new entry with deduplicated values
      groupedObjects.set(key, {
        metric: obj.metric,
        values: [...new Set(obj.values.map((v) => JSON.stringify(v)))].map((v) => JSON.parse(v)),
      });
    }
  }

  // Step 2: Split alerts with gaps longer than 5 minutes into separate entries
  const result: Array<PrometheusResult> = [];
  for (const alert of groupedObjects.values()) {
    const sortedValues = alert.values.sort(
      (a: [number, string], b: [number, string]) => a[0] - b[0],
    );

    if (sortedValues.length <= 1) {
      result.push({ metric: alert.metric, values: sortedValues });
      continue;
    }

    let currentInterval: Array<[number, string]> = [sortedValues[0]];

    for (let i = 1; i < sortedValues.length; i++) {
      const delta = sortedValues[i][0] - sortedValues[i - 1][0];

      if (delta > PROMETHEUS_QUERY_INTERVAL_SECONDS) {
        // Gap detected: save current interval and start a new one
        result.push({ metric: { ...alert.metric }, values: currentInterval });
        currentInterval = [sortedValues[i]];
      } else {
        currentInterval.push(sortedValues[i]);
      }
    }

    // Push the last interval
    result.push({ metric: { ...alert.metric }, values: currentInterval });
  }

  return result;
}

/**
 * Merges incidents that have the same (group_id, src_alertname, src_namespace, src_severity).
 * This handles cases where the same incident data is distributed across multiple items
 * due to multiple queries or silence status varying over time.
 *
 * Generated by Claude
 *
 * @param incidents - Array of incidents to merge
 * @returns Array of merged incidents with deduplicated values and latest silenced/severity values
 */
function mergeIncidentsByKey(incidents: Array<Partial<Incident>>): Array<Partial<Incident>> {
  const groupedMap = new Map<
    string,
    {
      incident: Partial<Incident>;
      values: Array<[number, string]>;
      latestTimestamp: number;
      latestSilenced: boolean;
      latestSrcSeverity: string;
    }
  >();

  for (const incident of incidents) {
    // Create composite key for grouping
    const key = [
      incident.group_id,
      incident.src_alertname,
      incident.src_namespace,
      incident.src_severity,
    ].join('|');

    const existing = groupedMap.get(key);

    if (existing) {
      // Merge values (deduplicate)
      const existingValuesSet = new Set(existing.values.map((v) => JSON.stringify(v)));
      const newValues = (incident.values || []).filter(
        (v) => !existingValuesSet.has(JSON.stringify(v)),
      );
      existing.values = existing.values.concat(newValues);

      // Find the latest timestamp in this incident
      if (incident.values && incident.values.length > 0) {
        const maxTimestamp = Math.max(...incident.values.map((v) => v[0]));
        // Update silenced and src_severity if this incident has a more recent timestamp
        if (maxTimestamp > existing.latestTimestamp) {
          existing.latestTimestamp = maxTimestamp;
          existing.latestSilenced = incident.silenced ?? false;
          existing.latestSrcSeverity = incident.src_severity || '';
        }
      }
    } else {
      // New group
      const maxTimestamp =
        incident.values && incident.values.length > 0
          ? Math.max(...incident.values.map((v) => v[0]))
          : -Infinity;

      groupedMap.set(key, {
        incident,
        values: [...(incident.values || [])],
        latestTimestamp: maxTimestamp,
        latestSilenced: incident.silenced ?? false,
        latestSrcSeverity: incident.src_severity || '',
      });
    }
  }

  // Convert map to array with merged data
  return Array.from(groupedMap.values()).map((group) => ({
    ...group.incident,
    values: group.values.sort((a, b) => a[0] - b[0]), // Sort by timestamp
    silenced: group.latestSilenced,
    src_severity: group.latestSrcSeverity,
  }));
}

/**
 * Processes alert data from Prometheus results, filtering and deduplicating them within the time window
 * of selected incidents. Filters out 'Watchdog' alerts and computes the start and end firing times.
 * Timestamps remain in seconds (Unix epoch) format with padding points added for chart rendering.
 *
 * @param {Array} prometheusResults - An array of alert objects containing metric and values information.
 * @param {Object} prometheusResults[].metric - The metric object containing alert metadata.
 * @param {string} prometheusResults[].metric.alertname - The name of the alert.
 * @param {string} prometheusResults[].metric.namespace - The namespace from which the alert originated.
 * @param {string} prometheusResults[].metric.severity - The severity level of the alert (e.g., "warning", "critical").
 * @param {string} prometheusResults[].metric.component - The component associated with the alert.
 * @param {string} prometheusResults[].metric.layer - The layer to which the alert belongs.
 * @param {string} prometheusResults[].metric.name - The name of the alert.
 * @param {string} prometheusResults[].metric.alertstate - The current state of the alert (e.g., "firing").
 * @param {Array<Array<number, string>>} prometheusResults[].values - An array of [timestamp, severity] tuples.
 * @param {Array} selectedIncidents - Array of incident objects used to determine the time window for filtering alerts.
 *
 * @returns {Array} - An array of processed Alert objects with metadata, padded values for chart rendering,
 *                    start/end firing times in milliseconds, resolved status, silenced status, and x position.
 *
 * @example
 * const prometheusResults = [
 *   {
 *     metric: {
 *       alertname: "ClusterOperatorDegraded",
 *       namespace: "openshift-cluster-version",
 *       severity: "warning",
 *       component: "machine-config",
 *       layer: "compute",
 *       name: "machine-config",
 *       alertstate: "firing"
 *     },
 *     values: [[1627897545, "2"], [1627897600, "2"]]
 *   }
 * ];
 * const selectedIncidents = [
 *   {
 *     src_alertname: "ClusterOperatorDegraded",
 *     src_namespace: "openshift-cluster-version",
 *     src_severity: "warning",
 *     values: [[1627897545, "2"]],
 *     silenced: false
 *   }
 * ];
 *
 * const result = convertToAlerts(prometheusResults, selectedIncidents);
 * // Returns array of Alert objects with padded values, firing times in ms, and resolved/silenced status
 */

export function convertToAlerts(
  prometheusResults: Array<PrometheusResult>,
  selectedIncidents: Array<Partial<Incident>>,
  currentTime: number,
  daysSpanMs: number,
): Array<Alert> {
  // Merge selected incidents by composite key. Consolidates duplicates caused by non-key labels
  // like `pod` or `silenced` that aren't supported by cluster health analyzer.

  const incidents = mergeIncidentsByKey(selectedIncidents);

  // Extract the first and last timestamps of the selected incident
  const timestamps = incidents.flatMap(
    (incident) => incident.values?.map((value) => value[0]) ?? [],
  );

  const incidentFirstTimestamp = Math.min(...timestamps);
  const incidentLastTimestamp = Math.max(...timestamps);

  // Clip the incident window to the N-day span so we only show alerts within the selected range
  const nDaysStartSeconds = (currentTime - daysSpanMs) / 1000;
  const effectiveFirstTimestamp = Math.max(incidentFirstTimestamp, nDaysStartSeconds);

  // Watchdog is a heartbeat metric, not a real issue
  const validAlerts = prometheusResults.filter((alert) => alert.metric.alertname !== 'Watchdog');

  const deduplicatedAlerts = deduplicateAlerts(validAlerts);

  // Filter alerts to only include values within the effective time window
  const ALERT_WINDOW_PADDING_SECONDS = PROMETHEUS_QUERY_INTERVAL_SECONDS / 2;

  const alerts = deduplicatedAlerts
    .map((alert: PrometheusResult): Alert | null => {
      // Keep only values within the effective time range (with padding)
      const values: Array<[number, string]> = alert.values.filter(
        ([date]) =>
          date >= effectiveFirstTimestamp - ALERT_WINDOW_PADDING_SECONDS &&
          date <= incidentLastTimestamp + ALERT_WINDOW_PADDING_SECONDS,
      );

      // Exclude alerts with no values in this time window
      if (values.length === 0) {
        return null;
      }

      // Determine resolved status based on original values before padding
      const sortedValues = values.sort((a, b) => a[0] - b[0]);
      let lastTimestamp = sortedValues[sortedValues.length - 1][0];
      const resolved = isResolved(lastTimestamp, currentTime);

      // Find the associated incident, if it's one of the select ones
      // Since incidents are already merged by (group_id, src_alertname, src_namespace, src_severity),
      // there should be at most one matching incident
      const matchingIncident = incidents.find(
        (incident) =>
          incident.src_alertname === alert.metric.alertname &&
          incident.src_namespace === alert.metric.namespace &&
          incident.src_severity === alert.metric.severity,
      );

      // If no matching incident found, skip the alert
      if (!matchingIncident) {
        return null;
      }

      // Add padding points for chart rendering
      const paddedValues = insertPaddingPointsForChart(sortedValues, currentTime);
      // firstTimestamp is absolute over the full 15-day data (before N-day filtering),
      // with the padding offset applied to match chart rendering
      const alertFirstTimestamp = alert.values[0]?.[0] - PROMETHEUS_QUERY_INTERVAL_SECONDS;
      lastTimestamp = paddedValues[paddedValues.length - 1][0];

      return {
        alertname: alert.metric.alertname,
        namespace: alert.metric.namespace,
        severity: alert.metric.severity as Severity,
        firstTimestamp: alertFirstTimestamp,
        component: matchingIncident.component,
        layer: matchingIncident.layer,
        name: alert.metric.name,
        alertstate: resolved ? 'resolved' : 'firing',
        values: paddedValues,
        alertsStartFiring: alertFirstTimestamp,
        alertsEndFiring: lastTimestamp,
        resolved,
        x: 0, // Will be set after sorting
        silenced: matchingIncident.silenced ?? false,
      };
    })
    .filter((alert): alert is Alert => alert !== null)
    .sort((a, b) => a.alertsStartFiring - b.alertsStartFiring)
    .map((alert, index, sortedAlerts) => ({
      ...alert,
      x: sortedAlerts.length - index,
    }));

  return alerts;
}

export const groupAlertsForTable = (
  alerts: Array<Alert>,
  alertingRulesData: Array<PrometheusRule>,
): Array<GroupedAlert> => {
  const groupedAlerts = alerts.reduce((acc: Array<GroupedAlert>, alert) => {
    const { component, alertstate, severity, layer, alertname, silenced } = alert;
    const existingGroup = acc.find((group) => group.component === component);
    const rule = alertingRulesData?.find((rule) => alertname === rule.name);
    // Use silenced value from alert object (already sourced from cluster_health_components_map)
    if (existingGroup) {
      existingGroup.alertsExpandedRowData.push({ ...alert, rule, silenced } as any);
      if (severity === 'warning') existingGroup.warning += 1;
      else if (severity === 'info') existingGroup.info += 1;
      else if (severity === 'critical') existingGroup.critical += 1;
    } else {
      acc.push({
        component,
        alertstate: alertstate as 'firing' | 'resolved' | 'silenced',
        layer,
        warning: severity === 'warning' ? 1 : 0,
        info: severity === 'info' ? 1 : 0,
        critical: severity === 'critical' ? 1 : 0,
        alertsExpandedRowData: [{ ...alert, rule, silenced } as any],
      });
    }

    return acc;
  }, []);
  // Update alertstate for each grouped component
  groupedAlerts.forEach((group) => {
    const hasFiring = group.alertsExpandedRowData.some((alert) => alert.alertstate === 'firing');
    const allResolved = group.alertsExpandedRowData.every(
      (alert) => alert.alertstate === 'resolved',
    );
    const allSilenced = group.alertsExpandedRowData.every((alert) => alert.silenced === true);

    if (allSilenced) {
      group.alertstate = 'silenced';
    } else if (hasFiring) {
      group.alertstate = 'firing';
    } else if (allResolved) {
      group.alertstate = 'resolved';
    }
  });

  return groupedAlerts;
};
