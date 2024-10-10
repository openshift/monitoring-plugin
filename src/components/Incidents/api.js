/* eslint-disable max-len */
/**
 * Collects incident data and groups it based on a unique key, which in this case is the `component`.
 * The function stores unique combinations of `alertname`, `severity`, and other relevant fields in a `Map`,
 * ensuring that each `component` is only included once. This is used for preparing incident data for API queries.
 *
 * @param {Array} objects - An array of incident objects, each containing relevant alert information.
 * @param {string} objects[].alertname - The name of the alert.
 * @param {string} objects[].severity - The severity level of the alert (e.g., "warning", "critical").
 * @param {string} objects[].component - The component involved in the alert (used as the unique key).
 * @param {string} objects[].group_id - The group ID of the alert.
 * @param {string} objects[].layer - The layer to which the alert belongs.
 * @param {string} objects[].namespace - The namespace where the alert originated.
 * @param {Array<string>} objects[].componentsList - A list of related components.
 * @param {Array<string>} objects[].layerList - A list of related layers.
 * @param {string} [objects[].name] - The optional name of the alert object (if provided).
 *
 * @returns {Array} - An array of deduplicated incident objects, grouped by the `component` key.
 *
 * @example
 * const incidentObjects = [
 *   {
 *     alertname: "ClusterOperatorDegraded",
 *     severity: "warning",
 *     component: "machine-config",
 *     group_id: "639763dd-cf99-466d-be56-ae8b39f1351c",
 *     layer: "compute",
 *     namespace: "openshift-cluster-version",
 *     componentsList: ["machine-config", "monitoring"],
 *     layerList: ["compute", "network"],
 *     name: "machine-config"
 *   },
 *   {
 *     alertname: "ClusterOperatorDegraded",
 *     severity: "critical",
 *     component: "monitoring",
 *     group_id: "639763dd-cf99-466d-be56-ae8b39f1351c",
 *     layer: "compute",
 *     namespace: "openshift-monitoring",
 *     componentsList: ["machine-config", "monitoring"],
 *     layerList: ["compute", "network"]
 *   }
 * ];
 *
 * const result = collectIncidentsDataForApiQuery(incidentObjects);
 * // Output: Array with unique incidents grouped by component.
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
      group_id: obj.group_id,
      layer: obj.layer,
      namespace: obj.namespace,
      componentsList: obj.componentsList,
      layerList: obj.layerList,
      name: obj.name,
    });
  }

  // Return the values from the map, which will automatically be deduplicated
  return Array.from(groupedAlertsValues.values());
};

/**
 * Generates a Prometheus query string for each combination of component and layer
 * from the provided `groupedAlertsValues`. The query checks for the absence of
 * specific metadata (`group_id`, `component`, `layer`) in the `meta` time series.
 *
 * @param {Array} groupedAlertsValues - An array of alert objects, where each object represents
 *                                      grouped alerts and contains fields like `group_id`,
 *                                      `componentsList`, and `layerList`.
 * @param {string} groupedAlertsValues[].group_id - The unique identifier for the alert group.
 * @param {Array<string>} groupedAlertsValues[].componentsList - An array of component names.
 * @param {Array<string>} groupedAlertsValues[].layerList - An array of layer names.
 *
 * @returns {string} A Prometheus query string that includes conditions for each
 *                   combination of `component` and `layer` in the `componentsList` and `layerList`.
 *                   The queries are joined by the logical `or` operator.
 *
 * @example
 * const groupedAlertsValues = [
 *   {
 *     group_id: "639763dd-cf99-466d-be56-ae8b39f1351c",
 *     componentsList: ["compute", "dns", "ingress"],
 *     layerList: ["compute", "dns"]
 *   }
 * ];
 *
 * const query = createAlertsQuery(groupedAlertsValues);
 * // Outputs:
 * // (ALERTS + on () group_left (component, group_id) (absent(meta{group_id="639763dd-cf99-466d-be56-ae8b39f1351c", component="compute", layer="compute"}))) or
 * // (ALERTS + on () group_left (component, group_id) (absent(meta{group_id="639763dd-cf99-466d-be56-ae8b39f1351c", component="compute", layer="dns"}))) or
 * // ...
 */
export const createAlertsQuery = (groupedAlertsValues) => {
  const alertsQuery = groupedAlertsValues
    .map((query) => {
      // Generate query for each combination of component and layer
      const componentLayerQueries = query.componentsList.map((component) => {
        return query.layerList
          .map((layer) => {
            return `(ALERTS + on () group_left (component, group_id, layer) (absent(meta{group_id="${query.group_id}", component="${component}", layer="${layer}"})))`;
          })
          .join(' or ');
      });

      // Flatten and join all queries for the current group
      return componentLayerQueries.join(' or ');
    })
    .join(' or ');

  return alertsQuery;
};
