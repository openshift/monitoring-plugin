/* eslint-disable max-len */
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
export function groupAlerts(objects) {
  const groupedObjects = new Map();
  // Group by 3 values to make sure were not losing data'component'
  for (const obj of objects) {
    const key = obj.metric.alertname + obj.metric.namespace + obj.metric.component;

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
  const firing = groupAlerts(data).filter((alert) => alert.metric.alertname !== 'Watchdog');
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
      alertsStartFiring: processedValues[0][0],
      alertsEndFiring: processedValues[processedValues.length - 1][0],
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
