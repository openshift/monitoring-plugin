/* eslint-disable max-len */

import { PrometheusResult } from '@openshift-console/dynamic-plugin-sdk';
import { Alert, Incident, Severity } from './model';
import { sortObjectsByEarliestTimestamp } from './processIncidents';

/**
 * Groups alert objects by their `alertname`, `namespace`, and `component` fields and merges their values
 * while removing duplicates. Alerts with the same combination of `alertname`, `namespace`, and `component`
 * are combined, with values being deduplicated.
 *
 * @param {Array<Object>} objects - Array of alert objects to be grouped. Each object contains a `metric` field
 * with properties such as `alertname`, `namespace`, `component`, and an array of `values`.
 * @param {Object} objects[].metric - The metric information of the alert.
 * @param {string} objects[].metric.alertname - The name of the alert.
 * @param {string} objects[].metric.namespace - The namespace in which the alert is raised.
 * @param {string} objects[].metric.component - The component associated with the alert.
 * @param {Array<Array<Number | string>>} objects[].values - The array of values corresponding to the alert, where
 * each value is a tuple containing a timestamp and a value (e.g., [timestamp, value]).
 *
 * @returns {Array<Object>} - An array of grouped alert objects. Each object contains a unique combination of
 * `alertname`, `namespace`, and `component`, with deduplicated values.
 * @returns {Object} return[].metric - The metric information of the grouped alert.
 * @returns {Array<Array<Number | string>>} return[].values - The deduplicated array of values for the grouped alert.
 *
 * @example
 * const alerts = [
 *   { metric: { alertname: "Alert1", namespace: "ns1", component: "comp1" }, values: [[12345, "2"], [12346, "2"]] },
 *   { metric: { alertname: "Alert1", namespace: "ns1", component: "comp1" }, values: [[12346, "2"], [12347, "2"]] }
 * ];
 * const groupedAlerts = groupAlerts(alerts);
 * // Returns an array where the two alerts are grouped together with deduplicated values.
 */
export function groupAlerts(objects: Array<PrometheusResult>): Array<PrometheusResult> {
  // Step 1: Filter out all non firing alerts
  const filteredObjects = objects.filter((obj) => obj.metric.alertstate === 'firing');
  const groupedObjects = new Map();
  // Group by 3 values to make sure were not losing data'component'
  for (const obj of filteredObjects) {
    const key =
      obj.metric.alertname + obj.metric.namespace + obj.metric.component + obj.metric.severity;

    // If the key already exists in the map, merge the values after deduplication
    if (groupedObjects.has(key)) {
      const existingObj = groupedObjects.get(key);

      // Deduplicate the incoming obj.values before concatenating
      const existingValuesSet = new Set(existingObj.values.map((v) => JSON.stringify(v)));
      const newValues = obj.values.filter((v) => !existingValuesSet.has(JSON.stringify(v)));

      // Concatenate non-duplicate values
      existingObj.values = existingObj.values.concat(newValues);

      // Ensure metric uniqueness based on fields like alertname, severity, etc.
      const existingMetricsSet = new Set(JSON.stringify(existingObj.metric));
      if (!existingMetricsSet.has(JSON.stringify(obj.metric))) {
        groupedObjects.set(key, {
          ...existingObj,
          values: existingObj.values,
        });
      }
    } else {
      // Otherwise, create a new entry with deduplicated values
      groupedObjects.set(key, {
        metric: obj.metric,
        values: [...new Set(obj.values.map((v) => JSON.stringify(v)))].map((v) => JSON.parse(v)),
      });
    }
  }

  return Array.from(groupedObjects.values());
}

/**
 * Processes a list of alert data, filters out 'Watchdog' alerts, groups them by component,
 * and converts their timestamps to JavaScript `Date` objects. Additionally, it computes
 * the start and end times for when the alerts started and ended firing.
 *
 * @param {Array} data - An array of alert objects containing metric and values information.
 * @param {Object} data[].metric - The metric object containing alert metadata.
 * @param {string} data[].metric.alertname - The name of the alert.
 * @param {string} data[].metric.namespace - The namespace from which the alert originated.
 * @param {string} data[].metric.severity - The severity level of the alert (e.g., "warning", "critical").
 * @param {string} data[].metric.component - The component associated with the alert.
 * @param {string} data[].metric.layer - The layer to which the alert belongs.
 * @param {string} data[].metric.name - The name of the alert.
 * @param {string} data[].metric.alertstate - The current state of the alert (e.g., "firing").
 * @param {Array<Array<number, string>>} data[].values - An array of values, where each value is an array
 *                                                       containing a timestamp (as a number) and a string value.
 *
 * @returns {Array} - An array of processed alert objects, where each object includes metadata and processed values.
 *                    Each alert object also contains the start and end firing times of the alert, as well as an `x` field
 *                    representing its position in the firing list.
 *
 * @example
 * const data = [
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
 *     values: [[1627897545, "2"], [1627897545, "3"]]
 *   },
 *   {
 *     metric: {
 *       alertname: "Watchdog",
 *       namespace: "openshift-monitoring",
 *       severity: "info",
 *       component: "monitoring",
 *       layer: "monitoring",
 *       name: "watchdog",
 *       alertstate: "firing"
 *     },
 *     values: [[1627897545, "1"]]
 *   }
 * ];
 *
 * const result = processAlerts(data);
 * // Output:
 * // [
 * //   {
 * //     alertname: "ClusterOperatorDegraded",
 * //     namespace: "openshift-cluster-version",
 * //     severity: "warning",
 * //     component: "machine-config",
 * //     layer: "compute",
 * //     name: "machine-config",
 * //     alertstate: "firing",
 * //     values: [[Date, "2"], [Date, "3"]],
 * //     alertsStartFiring: Date,
 * //     alertsEndFiring: Date,
 * //     x: 1
 * //   }
 * // ]
 */

export function processAlerts(
  data: Array<PrometheusResult>,
  selectedIncidents: Array<Partial<Incident>>,
): Array<Alert> {
  const firing = groupAlerts(data).filter((alert) => alert.metric.alertname !== 'Watchdog');

  // Extract the first and last timestamps from selectedIncidents
  const timestamps = selectedIncidents.flatMap(
    (incident) => incident.values?.map((value) => value[0]) ?? [],
  );

  const firstTimestamp = Math.min(...timestamps);
  const lastTimestamp = Math.max(...timestamps);

  return sortObjectsByEarliestTimestamp(firing)
    .map((alert, index) => {
      // Filter values based on firstTimestamp and lastTimestamp keep only values within range
      const processedValues: Array<[number, string]> = alert.values.filter(
        ([date]) => date >= firstTimestamp && date <= lastTimestamp,
      );

      const sortedValues = processedValues.sort((a, b) => a[0] - b[0]);

      if (sortedValues.length === 0) {
        return null;
      }

      const alertsStartFiring = sortedValues[0][0] * 1000;
      const alertsEndFiring = sortedValues[sortedValues.length - 1][0] * 1000;
      const resolved = Date.now() - alertsEndFiring > 10 * 60 * 1000;

      return {
        alertname: alert.metric.alertname,
        namespace: alert.metric.namespace,
        severity: alert.metric.severity as Severity,
        component: alert.metric.component,
        layer: alert.metric.layer,
        name: alert.metric.name,
        alertstate: resolved ? 'resolved' : 'firing',
        values: sortedValues,
        alertsStartFiring,
        alertsEndFiring,
        resolved,
        x: firing.length - index,
      };
    })
    .filter((alert) => alert !== null);
}

export const groupAlertsForTable = (alerts: Array<Alert>, alertingRulesData): Array<Alert> => {
  // group alerts by the component and coun
  const groupedAlerts: Array<Alert> = alerts.reduce((acc, alert) => {
    const { component, alertstate, severity, layer, alertname } = alert;
    const existingGroup = acc.find((group) => group.component === component);
    let rule;
    if (alertingRulesData) {
      rule = alertingRulesData.find((rule) => alertname === rule.name);
    }
    if (existingGroup) {
      existingGroup.alertsExpandedRowData.push({ ...alert, rule });
      if (severity === 'warning') existingGroup.warning += 1;
      else if (severity === 'info') existingGroup.info += 1;
      else if (severity === 'critical') existingGroup.critical += 1;
    } else {
      acc.push({
        component,
        alertstate,
        layer,
        warning: severity === 'warning' ? 1 : 0,
        info: severity === 'info' ? 1 : 0,
        critical: severity === 'critical' ? 1 : 0,
        alertsExpandedRowData: [{ ...alert, rule }],
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

    if (hasFiring) {
      group.alertstate = 'firing';
    } else if (allResolved) {
      group.alertstate = 'resolved';
    }
  });

  return groupedAlerts;
};
