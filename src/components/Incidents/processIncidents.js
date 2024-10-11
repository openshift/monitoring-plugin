/* eslint-disable max-len */
const currentDate = new Date(); // Get the current date and time in UTC
const currentDay = currentDate.getUTCDate();
const currentMonth = currentDate.getUTCMonth();
const currentYear = currentDate.getUTCFullYear();
const currentHour = currentDate.getUTCHours();

/**
 * Processes an array of incident data by grouping, filtering, and transforming it into a structured format.
 * The function removes the "Watchdog" alerts, deduplicates entries by `group_id`, and calculates various properties
 * such as `longStanding`, `informative`, and `inactive` based on the data.
 *
 * @param {Array<Object>} data - Array of incident objects to be processed. Each object contains metric details and values.
 * @param {Object} data[].metric - Metric information of the incident.
 * @param {string} data[].metric.src_alertname - Name of the source alert associated with the incident.
 * @param {string} data[].metric.src_severity - Severity level of the alert (e.g., "warning", "info").
 * @param {string} data[].metric.src_namespace - Namespace in which the alert is triggered.
 * @param {string} data[].metric.src_name - Name of the source metric.
 * @param {string} data[].metric.component - Component associated with the alert.
 * @param {string} data[].metric.layer - Layer in the architecture to which the alert belongs.
 * @param {string} data[].metric.group_id - Unique identifier for the group of incidents.
 * @param {Array<Array<number|string>>} data[].values - Array of values for the incident, where each value is a tuple containing:
 *   - `timestamp` (number) - Unix timestamp representing when the value was recorded.
 *   - `value` (string) - Value recorded at the timestamp.
 * @param {Array<string>} [data[].componentsList] - List of components associated with the incident.
 * @param {Array<string>} [data[].layerList] - List of layers associated with the incident.
 *
 * @returns {Array<Object>} - Array of processed incident objects, each containing the following properties:
 * @returns {string} return[].component - Component associated with the incident.
 * @returns {string} return[].group_id - Group ID of the incident.
 * @returns {string} return[].severity - Severity level of the incident.
 * @returns {string} return[].alertname - Name of the alert associated with the incident.
 * @returns {string} return[].namespace - Namespace in which the alert was triggered.
 * @returns {string} return[].name - Name of the source metric.
 * @returns {string} return[].layer - Layer in the architecture to which the alert belongs.
 * @returns {Array<string>} return[].componentsList - List of components associated with the incident.
 * @returns {Array<string>} return[].layerList - List of layers associated with the incident.
 * @returns {Array<Array<Date|string>>} return[].values - Array of processed values, where each value is a tuple containing:
 *   - `Date` object representing the date and time of the original timestamp.
 *   - Original value recorded at that time.
 * @returns {number} return[].x - Index value calculated based on the number of incidents for positioning.
 * @returns {boolean} return[].informative - Indicates if the incident's severity is "info".
 * @returns {boolean} return[].longStanding - Indicates if the incident has been active for less than 7 days.
 * @returns {boolean} return[].inactive - Indicates if the incident is inactive (no matching values for the current date and hour).
 *
 * @example
 * const data = [
 *   {
 *     metric: {
 *       src_alertname: "DiskUsageHigh",
 *       src_severity: "warning",
 *       src_namespace: "system",
 *       src_name: "disk_usage",
 *       component: "storage",
 *       layer: "infrastructure",
 *       group_id: "abc-123",
 *     },
 *     values: [
 *       [1727947755.428, "1"],
 *       [1727951355.428, "2"]
 *     ]
 *   }
 * ];
 *
 * const processedData = processIncidents(data);
 * console.log(processedData);
 * // Output:
 * // [
 * //   {
 * //     component: "storage",
 * //     group_id: "abc-123",
 * //     severity: "warning",
 * //     alertname: "DiskUsageHigh",
 * //     namespace: "system",
 * //     name: "disk_usage",
 * //     layer: "infrastructure",
 * //     componentsList: undefined,
 * //     layerList: undefined,
 * //     values: [[Date, "1"], [Date, "2%"]],
 * //     x: 1,
 * //     informative: false,
 * //     longStanding: true,
 * //     inactive: true
 * //   }
 * // ]
 */

export function processIncidents(data) {
  // Deduplicate and group the data by group_id
  const incidents = groupById(data).filter(
    (incident) => incident.metric.src_alertname !== 'Watchdog',
  );

  return incidents.map((incident, index) => {
    const processedValues = incident.values.map((value) => {
      const timestamp = value[0];
      const date = new Date(timestamp * 1000);
      return [date, value[1]];
    });

    // Calculate the difference in days between the first and last date for the long standing prop
    const firstDate = incident.values[0];
    const lastDate = incident.values[incident.values.length - 1];
    const dayDifference = (lastDate - firstDate) / (1000 * 60 * 60 * 24);

    const hasMatchingDayAndHour = incident.values.some((v) => {
      const valueDate = new Date(v[0]);
      return (
        valueDate.getUTCDate() === currentDay &&
        valueDate.getUTCMonth() === currentMonth &&
        valueDate.getUTCFullYear() === currentYear &&
        valueDate.getUTCHours() === currentHour
      );
    });

    const getSrcProperties = (metric) => {
      return Object.keys(metric)
        .filter((key) => key.startsWith('src_'))
        .reduce((acc, key) => {
          acc[key] = metric[key];
          return acc;
        }, {});
    };
    const srcProperties = getSrcProperties(incident.metric);
    return {
      component: incident.metric.component,
      group_id: incident.metric.group_id,
      layer: incident.metric.layer,
      values: processedValues,
      x: incidents.length - index,
      informative: incident.metric.src_severity === 'info' ? true : false,
      longStanding: dayDifference < 7 ? true : false,
      inactive: !hasMatchingDayAndHour ? true : false,
      ...srcProperties,
    };
  });
}

/**
 * Groups a list of alert objects by their `group_id` field, merges their values, and tracks associated components and layers.
 * For each unique `group_id`, the function creates a combined object that contains deduplicated values and lists of components and layers.
 * The second index of the `values` array should only contain `0`, `1`, or `2`, representing different status codes or states.
 *
 * @param {Array<Object>} objects - Array of alert objects to be grouped by `group_id`.
 * @param {Object} objects[].metric - Metric information of the alert object.
 * @param {string} objects[].metric.group_id - Unique identifier for the group of alerts.
 * @param {string} [objects[].metric.component] - Component associated with the alert.
 * @param {string} [objects[].metric.layer] - Layer in the architecture associated with the alert.
 * @param {Array<Array<number | 0 | 1 | 2>>} objects[].values - Array of values for the alert, where each value is a tuple containing:
 *   - `timestamp` (number) - Unix timestamp representing when the value was recorded.
 *   - `status` (0 | 1 | 2) - Status value representing different states:
 *     - `0` indicates normal state.
 *     - `1` indicates warning state.
 *     - `2` indicates critical state.
 *
 * @returns {Array<Object>} - Array of grouped alert objects, each containing the following properties:
 * @returns {Object} return[].metric - The combined metric information of the grouped alert.
 * @returns {Array<Array<number | 0 | 1 | 2>>} return[].values - The deduplicated array of values for the grouped alert.
 *
 * @example
 * const alerts = [
 *   {
 *     metric: {
 *       group_id: "1234",
 *       component: "compute",
 *       layer: "application",
 *     },
 *     values: [
 *       [1627947755.428, 1],
 *       [1627951355.428, 2]
 *     ]
 *   },
 *   {
 *     metric: {
 *       group_id: "1234",
 *       component: "network",
 *       layer: "infrastructure",
 *     },
 *     values: [
 *       [1627947755.428, 0],
 *       [1627954955.428, 2]
 *     ]
 *   }
 * ];
 *
 * const groupedAlerts = groupById(alerts);
 * console.log(groupedAlerts);
 * // Output:
 * // [
 * //   {
 * //     metric: { group_id: "1234", component: "compute", layer: "application" },
 * //     values: [
 * //       [1627947755.428, 0],
 * //       [1627951355.428, 2],
 * //       [1627954955.428, 2]
 * //     ]
 * //   }
 * // ]
 */

export function groupById(objects) {
  const groupedObjects = new Map();

  for (const obj of objects) {
    const key = obj.metric.group_id;
    const component = obj.metric?.component;
    const layer = obj.metric?.layer;

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
      groupedObjects.set(key, {
        metric: obj.metric,
        values: [...new Set(obj.values.map((v) => JSON.stringify(v)))].map((v) => JSON.parse(v)),
      });
    }
  }

  return Array.from(groupedObjects.values());
}

const QUERY_CHUNK_SIZE = 24 * 60 * 60 * 1000;
export const getIncidentsTimeRanges = (timespan, maxEndTime = Date.now()) => {
  const startTime = maxEndTime - timespan;
  const timeRanges = [{ endTime: startTime + QUERY_CHUNK_SIZE, duration: QUERY_CHUNK_SIZE }];
  while (timeRanges.at(-1).endTime < maxEndTime) {
    const nextEndTime = timeRanges.at(-1).endTime + QUERY_CHUNK_SIZE;
    timeRanges.push({ endTime: nextEndTime, duration: QUERY_CHUNK_SIZE });
  }
  return timeRanges;
};
