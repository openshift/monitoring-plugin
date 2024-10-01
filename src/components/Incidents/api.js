/* eslint-disable max-len */
/**
 * Collects and groups objects by unique combinations of `alertname` and `severity`,
 * removing any duplicates based on this combination.
 *
 * @param {Array<Object>} objects - An array of objects, where each object contains `alertname` and `severity` properties.
 * @param {string} objects[].alertname - The name of the alert.
 * @param {string} objects[].severity - The severity level of the alert.
 * @returns {Array<Object>} An array of unique objects, each containing a unique combination of `alertname` and `severity`.
 *
 * @example
 * const alerts = [
 *   { alertname: 'CPUUsage', severity: 'info' },
 *   { alertname: 'MemoryUsage', severity: 'warning' },
 *   { alertname: 'CPUUsage', severity: 'info' },  // duplicate
 *   { alertname: 'DiskSpace', severity: 'critical' }
 * ];
 * const result = collectIncidentsDataForApiQuery(alerts);
 * // result will be:
 * // [
 * //   { alertname: 'CPUUsage', severity: 'info' },
 * //   { alertname: 'MemoryUsage', severity: 'warning' },
 * //   { alertname: 'DiskSpace', severity: 'critical' }
 * // ]
 */

export const collectIncidentsDataForApiQuery = (objects) => {
  // Create a map to hold unique alertname+severity combinations
  const groupedAlertsValues = new Map();

  for (const obj of objects) {
    // WHAT IS THE CORRECT UNIQUE IDENTIFIER FOR REQUESTING AND GROUPING ALERTS
    const key = obj.component;

    // If the key doesn't exist in the map, add the object
    groupedAlertsValues.set(key, {
      alertname: obj.alertname,
      severity: obj.severity,
      component: obj.component,
      layer: obj.layer,
      namespace: obj.namespace,
      name: obj.name,
    });
  }

  // Return the values from the map, which will automatically be deduplicated
  return Array.from(groupedAlertsValues.values());
};

/**
 * Creates a query string for alerts based on the provided grouped alert values.
 *
 * The function constructs individual alert strings by including only those fields
 * that are present in each alert object. The final query string is a combination
 * of these individual alert strings joined with `or`.
 *
 * @param {Array<Object>} groupedAlertsValues - An array of alert objects, where each object contains details such as `alertname`, `namespace`, `name`, `severity`, `component`, and `layer`.
 * @param {string} groupedAlertsValues[].alertname - The name of the alert.
 * @param {string} [groupedAlertsValues[].namespace] - The namespace of the alert. Optional.
 * @param {string} [groupedAlertsValues[].name] - The name associated with the alert. Optional.
 * @param {string} [groupedAlertsValues[].severity] - The severity level of the alert. Optional.
 * @param {string} groupedAlertsValues[].component - The component associated with the alert.
 * @param {string} groupedAlertsValues[].layer - The layer of the component.
 *
 * @returns {string} The constructed query string combining all provided alerts.
 *
 * @example
 * const groupedAlertsValues = [
 *   {
 *     alertname: "KubeNodeNotReady",
 *     severity: "warning",
 *     component: "compute",
 *     layer: "compute",
 *     namespace: "openshift-monitoring"
 *   },
 *   {
 *     alertname: "AlertmanagerReceiversNotConfigured",
 *     severity: "warning",
 *     component: "monitoring",
 *     layer: "core",
 *     namespace: "openshift-monitoring"
 *   },
 * ];
 *
 * const query = createAlertsQuery(groupedAlertsValues);
 * console.log(query);
 * // Outputs:
 * // (ALERTS{alertname="KubeNodeNotReady", namespace="openshift-monitoring", severity="warning"} + on () group_left (component, layer) (absent(meta{layer="compute", component="compute"}))) or
 * // (ALERTS{alertname="AlertmanagerReceiversNotConfigured", namespace="openshift-monitoring", severity="warning"} + on () group_left (component, layer) (absent(meta{layer="core", component="monitoring"})))
 */
export const createAlertsQuery = (groupedAlertsValues) => {
  // Map through the grouped alerts to create individual alert strings for the query
  const alertsQuery = groupedAlertsValues
    .map((query) => {
      const alertParts = ['alertname', 'namespace', 'name', 'severity', 'alertstate']
        .filter((key) => query[key]) // Only include keys that are present in the query object
        .map((key) => `${key}="${query[key]}"`)
        .join(', ');

      return `(ALERTS{${alertParts}} + on () group_left (component, layer) (absent(meta{layer="${query.layer}", component="${query.component}"})))`;
    })
    .join(' or ');

  return alertsQuery;
};
