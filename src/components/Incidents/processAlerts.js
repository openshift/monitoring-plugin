/* eslint-disable max-len */
/**
 * Groups objects by the `component` field within the `metric` object and deduplicates their `values`.
 * For each unique component, it merges any additional values that may come from multiple objects
 * and ensures no duplicates exist in the resulting grouped data.
 *
 * @param {Array} objects - An array of objects to be grouped by the `component` field.
 * @param {Object} objects[].metric - The metric object containing alert metadata.
 * @param {string} objects[].metric.component - The component field used as the key for grouping.
 * @param {Array} objects[].values - An array of values associated with the metric. Each value is deduplicated within its component group.
 *
 * @returns {Array} - An array of grouped objects, each with a unique `component` key and deduplicated `values`.
 *
 * @example
 * const objects = [
 *   {
 *     metric: { component: "compute", alertname: "Alert1", severity: "warning" },
 *     values: [[1627897545.267, "2"], [1627897545.267, "3"]]
 *   },
 *   {
 *     metric: { component: "compute", alertname: "Alert2", severity: "critical" },
 *     values: [[1627897545.267, "2"], [1627897545.267, "4"]]
 *   },
 *   {
 *     metric: { component: "network", alertname: "Alert3", severity: "warning" },
 *     values: [[1627897545.267, "2"], [1627897545.267, "3"]]
 *   }
 * ];
 *
 * const result = groupByComponent(objects);
 * // Output:
 * // [
 * //   {
 * //     metric: { component: "compute", alertname: "Alert1", severity: "warning" },
 * //     values: [[1627897545.267, "2"], [1627897545.267, "3"], [1627897545.267, "4"]]
 * //   },
 * //   {
 * //     metric: { component: "network", alertname: "Alert3", severity: "warning" },
 * //     values: [[1627897545.267, "2"], [1627897545.267, "3"]]
 * //   }
 * // ]
 */

export function groupByComponent(objects) {
  const groupedObjects = new Map();

  for (const obj of objects) {
    const key = obj.metric.component; // Group by 'component'

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

export function processAlerts(data) {
  const firing = groupByComponent(data).filter((alert) => alert.metric.alertname !== 'Watchdog');
  return firing.map((alert, index) => {
    // Process each value
    const processedValues = alert.values.map((value) => {
      const timestamp = value[0];

      // Convert timestamp to date
      const date = new Date(timestamp * 1000);
      return [date, value[1]];
    });

    return {
      alertname: alert.metric.alertname,
      namespace: alert.metric.namespace,
      severity: alert.metric.severity,
      component: alert.metric.component,
      layer: alert.metric.layer,
      name: alert.metric.name,
      alertstate: alert.metric.alertstate,
      values: processedValues,
      alertsStartFiring: processedValues.at(0)[0],
      alertsEndFiring: processedValues.at(-1)[0],
      x: firing.length - index,
    };
  });
}

export const groupAlertsForTable = (alerts) => {
  // group alerts by the component and coun
  return alerts.reduce((acc, alert) => {
    const { component, alertstate, severity } = alert;
    const existingGroup = acc.find((group) => group.component === component);
    if (existingGroup) {
      existingGroup.alertsExpandedRowData.push(alert);
      if (severity === 'warning') existingGroup.warning += 1;
      else if (severity === 'info') existingGroup.info += 1;
      else if (severity === 'critical') existingGroup.critical += 1;
    } else {
      acc.push({
        component,
        alertstate,
        warning: severity === 'warning' ? 1 : 0,
        info: severity === 'info' ? 1 : 0,
        critical: severity === 'critical' ? 1 : 0,
        alertsExpandedRowData: [alert],
      });
    }

    return acc;
  }, []);
};
