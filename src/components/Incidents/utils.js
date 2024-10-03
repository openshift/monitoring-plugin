/* eslint-disable max-len */
import global_danger_color_100 from '@patternfly/react-tokens/dist/esm/global_danger_color_100';
import global_info_color_100 from '@patternfly/react-tokens/dist/esm/global_info_color_100';
import global_warning_color_100 from '@patternfly/react-tokens/dist/esm/global_warning_color_100';

const currentDate = new Date(); // Get the current date and time in UTC
const currentDay = currentDate.getUTCDate();
const currentMonth = currentDate.getUTCMonth();
const currentYear = currentDate.getUTCFullYear();
const currentHour = currentDate.getUTCHours();

/**
 * Groups and deduplicates an array of objects based on a specified key type.
 *
 * @param {Array<Object>} objects - The array of objects to group and deduplicate.
 * @param {string} keyType - The key type used for grouping. Can be either:
 *   - `'alertname+namespace'`: Groups by concatenating the `alertname` and `namespace` fields in `metric`.
 *   - `'group_id'`: Groups by the `group_id` field in `metric`.
 *
 * @returns {Array<Object>} An array of grouped and deduplicated objects. Each object contains:
 *   - `metric`: The metric object from one of the original entries in the group.
 *   - `values`: An array of deduplicated values from all objects in the group.
 *
 * @description
 * This function processes an array of objects by grouping them according to a key derived from `keyType`.
 * - If `keyType` is `'alertname+namespace'`, objects are grouped by concatenating the `alertname` and `namespace` fields in the `metric` object.
 * - If `keyType` is `'group_id'`, objects are grouped by the `group_id` field in the `metric` object.
 *
 * For each group, the values from all grouped objects are merged, and duplicates are removed based on the serialized form of each value.
 *
 * The result is an array of objects, each containing the `metric` from one of the grouped objects and the deduplicated `values`.
 */
export function groupAndDeduplicate(objects, keyType) {
  const groupedObjects = new Map();
  for (const obj of objects) {
    let key;
    // Determine the key based on keyType
    if (keyType === 'alertname+namespace') {
      key = obj.metric.alertname + obj.metric.namespace;
    } else if (keyType === 'group_id') {
      key = obj.metric.group_id;
    }

    // If the key already exists in the map, merge the values
    if (groupedObjects.has(key)) {
      const existingObj = groupedObjects.get(key);
      existingObj.values = existingObj.values.concat(obj.values);
    } else {
      // Otherwise, create a new entry
      groupedObjects.set(key, {
        metric: obj.metric,
        values: obj.values.slice(),
      });
    }
  }

  // Remove duplicates in each grouped object
  for (const [key, obj] of groupedObjects.entries()) {
    const deduplicatedValues = [];
    const seen = new Set();

    for (const value of obj.values) {
      const valueString = JSON.stringify(value);
      if (!seen.has(valueString)) {
        seen.add(valueString);
        deduplicatedValues.push(value);
      }
    }
    obj.values = deduplicatedValues;
  }

  return Array.from(groupedObjects.values());
}

export function processAlertTimestamps(data) {
  const firing = groupAndDeduplicate(data, 'alertname+namespace').filter(
    (alert) => alert.metric.alertname !== 'Watchdog',
  );
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

export const createAlertsChartBars = (alert) => {
  const data = [];
  for (let i = 0; i < alert.values.length - 1; i++) {
    data.push({
      y0: new Date(alert.values[i].at(0)),
      y: new Date(alert.values[i + 1].at(0)),
      x: alert.x,
      severity: alert.severity[0].toUpperCase() + alert.severity.slice(1),
      name: alert.alertname,
      namespace: alert.namespace,
      layer: alert.layer,
      component: alert.component,
      fill:
        alert.severity === 'critical'
          ? global_danger_color_100.var
          : alert.severity === 'warning'
          ? global_warning_color_100.var
          : global_info_color_100.var,
    });
  }

  return data;
};

export const createIncidentsChartBars = (incident) => {
  const data = [];
  for (let i = 0; i < incident.values.length - 1; i++) {
    data.push({
      y0: new Date(incident.values[i].at(0)),
      y: new Date(incident.values[i + 1].at(0)),
      x: incident.x,
      name: incident.severity[0].toUpperCase() + incident.severity.slice(1),
      component: incident.component,
      group_id: incident.group_id,
      fill:
        incident.values[i].at(1) === '2'
          ? global_danger_color_100.var
          : incident.values[i].at(1) === '1'
          ? global_warning_color_100.var
          : global_info_color_100.var,
    });
  }

  return data;
};

export const formatDate = (date, isTime) => {
  const dateString = date?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const timeString = date?.toLocaleTimeString('en-US', { hour12: false });
  return isTime ? `${dateString} ${timeString}` : dateString;
};

/**
 * Generates an array of dates, each representing midnight (00:00:00) of the past `days` number of days, starting from today.
 *
 * @param {number} days - The number of days for which to generate the date array. The array will contain dates starting from `days` ago up to today.
 * @returns {Array<Date>} An array of `Date` objects, each set to midnight (00:00:00) in UTC, for the past `days` number of days.
 *
 * @description
 * This function creates an array of `Date` objects, starting from `days` ago up to the current day. Each date in the array is set to midnight (00:00:00) to represent the start of the day.
 *
 * The function works by subtracting days from the current date and setting the time to 00:00:00 for each day.
 *
 * @example
 * // Generate an array of 7 days (last 7 days including today)
 * const dateArray = generateDateArray(7);
 * // Output example:
 * // [
 * //   2024-09-06T00:00:00.000Z,
 * //   2024-09-07T00:00:00.000Z,
 * //   2024-09-08T00:00:00.000Z,
 * //   2024-09-09T00:00:00.000Z,
 * //   2024-09-10T00:00:00.000Z,
 * //   2024-09-11T00:00:00.000Z,
 * //   2024-09-12T00:00:00.000Z
 * // ]
 */
export function generateDateArray(days) {
  const currentDate = new Date();

  const dateArray = [];
  for (let i = 0; i < days; i++) {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() - (days - 1 - i));
    newDate.setHours(0, 0, 0, 0);
    dateArray.push(newDate);
  }

  return dateArray;
}

export function processIncidents(data) {
  // Deduplicate and group the data by group_id
  const incidents = groupAndDeduplicate(data, 'group_id').filter(
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

    return {
      component: incident.metric.component,
      group_id: incident.metric.group_id,
      severity: incident.metric.src_severity,
      alertname: incident.metric.src_alertname,
      namespace: incident.metric.src_namespace,
      name: incident.metric.src_name,
      layer: incident.metric.layer,
      values: processedValues,
      x: incidents.length - index,
      informative: incident.metric.src_severity === 'info' ? true : false,
      longStanding: dayDifference < 7 ? true : false,
      inactive: !hasMatchingDayAndHour ? true : false,
    };
  });
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

/**
 * Filters a single incident based on the selected filter criteria.
 *
 * @param {Object} incident - The incident object to check against the filters.
 * @param {Object} filters - An object containing all and selected filters.
 * @param {Array<string>} filters.all - An array of all available filters.
 * @param {Array<string>} filters.selected - An array of selected filters.
 *
 * @returns {boolean} Returns true if the incident matches all the selected filters, otherwise false.
 *
 * @description
 * The function checks the incident against the following filter criteria:
 * - if the informative filter is selected it checks the informative prop of the incident object
 * - If the "long-standing" filter is selected, it checks the longStanding property of the incident object
 * - If the "inactive" filter is selected, it checks it checks that the incident is active in the most recent hour
 *
 * @example
 * const filters = {
 *   "selected": ["informative", "longStanding", "inactive"],
 *   "all": ["longStanding", "informative", "inactive"]
 * };
 *
 * const incident = {
 *   "component": "compute",
 *   "group_id": "73850a6a-e39e-4601-8910-3b4f60f4d53e",
 *   "severity": "info",
 *   "type": "alert",
 *   "values": [
 *     ["2024-09-01T00:00:00.000Z", "1"],
 *     ["2024-09-08T00:00:00.000Z", "1"]
 *   ],
 *   "x": 7,
 *    informative: boolean,
      longStanding: boolean,
      inactive: boolean,
 * };
 *
 */
export function filterIncident(filters, incident) {
  const conditions = {
    informative: 'informative',
    longStanding: 'longStanding',
    inactive: 'inactive',
  };

  if (!filters.selected.length) return true;

  // Check if at least one filter passes
  return filters.selected.some((key) => incident[conditions[key]] === true);
}

/**
 * Groups alerts by the "component" property and adds counts for different severity levels.
 *
 * Each object in the returned array contains a unique component, an array of alerts
 * associated with that component, alertstate, and counts of alerts for each severity level:
 * "warning", "info", and "critical".
 *
 * @param {Array<Object>} alerts - An array of alert objects to be grouped.
 * @param {string} alerts[].alertname - The name of the alert.
 * @param {string} alerts[].namespace - The namespace of the alert.
 * @param {string} alerts[].severity - The severity level of the alert.
 * @param {string} alerts[].component - The component associated with the alert.
 * @param {string} alerts[].layer - The layer of the component.
 * @param {string} alerts[].alertsEndFiring - The end firing time of the alert.
 * @param {string} alerts[].alertsStartFiring - The start firing time of the alert.
 * @param {Array<Array<string>>} alerts[].values - The timestamp and value pairs of the alert data.
 * @param {number} alerts[].x - Additional metadata associated with the alert.
 *
 * @returns {Array<Object>} - An array of objects grouped by the "component" property,
 * where each object contains a unique component, an array of alerts, and the counts
 * of alerts with "warning", "info", and "critical" severities.
 *
 * @example
 * const alerts = [
 *   {
 *     alertname: "AlertmanagerReceiversNotConfigured",
 *     namespace: "openshift-monitoring",
 *     severity: "warning",
 *     component: "monitoring",
 *     layer: "core",
 *     alertstate: "firing",
 *     alertsEndFiring: "2024-09-27T18:14:06.929Z",
 *     alertsStartFiring: "2024-09-20T19:14:06.929Z",
 *     values: [...],
 *     x: 3
 *   },
 *   {
 *     alertname: "ClusterNotUpgradeable",
 *     namespace: "openshift-cluster-version",
 *     severity: "info",
 *     component: "version",
 *     layer: "core",
 *     alertstate: "firing",
 *     alertsEndFiring: "2024-09-27T18:14:06.929Z",
 *     alertsStartFiring: "2024-09-20T19:14:06.929Z",
 *     values: [...],
 *     x: 2
 *   }
 * ];
 *
 * const result = groupAlertsByComponent(alerts);
 * console.log(result);
 * // Output:
 * // [
 * //   {
 * //     component: "monitoring",
 * //     alertstate: "firing",
 * //     alerts: [ {  data from AlertmanagerReceiversNotConfigured alert } ],
 * //     warning: 1,
 * //     info: 0,
 * //     critical: 0
 * //   },
 * //   {
 * //     component: "version",
 * //     alertstate: "firing",
 * //     alerts: [ { data from ClusterNotUpgradeable alert  } ],
 * //     warning: 0,
 * //     info: 1,
 * //     critical: 0
 * //   }
 * // ]
 */
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