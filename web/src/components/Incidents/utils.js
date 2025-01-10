/* eslint-disable max-len */
import global_danger_color_100 from '@patternfly/react-tokens/dist/esm/global_danger_color_100';
import global_info_color_100 from '@patternfly/react-tokens/dist/esm/global_info_color_100';
import global_warning_color_100 from '@patternfly/react-tokens/dist/esm/global_warning_color_100';
import { setIncidentsActiveFilters } from '../../actions/observe';

function consolidateAndMergeIntervals(data) {
  const severityRank = { 2: 2, 1: 1, 0: 0 };

  // Eliminate overlapping timestamps with lower severities
  const highestSeverityValues = data.values.reduce((acc, [timestamp, severity]) => {
    if (!acc[timestamp] || severityRank[severity] > severityRank[acc[timestamp]]) {
      acc[timestamp] = severity;
    }
    return acc;
  }, {});

  // Create an array of timestamps with their severities (retain order)
  const filteredValues = Object.entries(highestSeverityValues)
    .map(([timestamp, severity]) => [timestamp, severity])
    .sort((a, b) => new Date(a[0]) - new Date(b[0])); // Ensure order by time

  // Find intervals of constant severity
  const intervals = [];
  let currentStart = filteredValues[0][0];
  let currentSeverity = filteredValues[0][1];

  for (let i = 1; i < filteredValues.length; i++) {
    const [timestamp, severity] = filteredValues[i];

    // Adjust the end timestamp for seamless transition
    let adjustedEnd;
    if (currentSeverity !== severity) {
      const endDate = new Date(timestamp);
      endDate.setMilliseconds(endDate.getMilliseconds() - 1); // Subtract 1 ms
      adjustedEnd = endDate.toISOString();

      intervals.push([currentStart, adjustedEnd, currentSeverity]);
      currentStart = timestamp; // Start the new interval
      currentSeverity = severity;
    }
  }

  // Add the final interval
  intervals.push([currentStart, filteredValues[filteredValues.length - 1][0], currentSeverity]);

  return intervals;
}

/**
 * Creates an array of incident data for chart bars, ensuring that when two severities have the same time range, the lower severity is removed.
 *
 * @param {Object} incident - The incident data containing values with timestamps and severity levels.
 * @returns {Array} - An array of incident objects with `y0`, `y`, `x`, and `name` fields representing the bars for the chart.
 */
export const createIncidentsChartBars = (incident) => {
  const groupedData = consolidateAndMergeIntervals(incident);

  const data = [];
  const getSeverityName = (value) => {
    return value === '2' ? 'Critical' : value === '1' ? 'Warning' : 'Info';
  };

  for (let i = 0; i < groupedData.length; i++) {
    const severity = getSeverityName(groupedData[i][2]);

    data.push({
      y0: new Date(groupedData[i][0]),
      y: new Date(groupedData[i][1]),
      x: incident.x,
      name: severity,
      componentList: incident.componentList || [],
      group_id: incident.group_id,
      fill:
        severity === 'Critical'
          ? global_danger_color_100.var
          : severity === 'Warning'
          ? global_warning_color_100.var
          : global_info_color_100.var,
    });
  }

  return data;
};

export const createAlertsChartBars = (alert) => {
  const groupedData = consolidateAndMergeIntervals(alert);

  const data = [];
  for (let i = 0; i < groupedData.length; i++) {
    data.push({
      y0: new Date(groupedData[i][0]),
      y: new Date(groupedData[i][1]),
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

export const formatDate = (date, isTime) => {
  const userLocale = navigator.language || 'en-US';
  const dateString = date?.toLocaleDateString(userLocale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const timeString = date?.toLocaleTimeString(userLocale, {
    hour: '2-digit',
    minute: '2-digit',
  });
  return isTime ? `${dateString}, ${timeString}` : dateString;
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

/**
 * Filters incidents based on the specified filters.
 *
 * @param {Object} filters - An object containing filter criteria.
 * @param {string[]} filters.incidentFilters - An array of strings representing filter conditions such as "Persistent", "Recent", "Critical", etc.
 * @param {Array<Object>} incidents - An array of incidents to be filtered.
 * @returns {Array<Object>} A filtered array of incidents that match at least one of the specified filters.
 *
 * The `conditions` object maps filter keys to incident properties. If no filters are applied, all incidents are returned.
 * Filters are case-sensitive and must match the keys defined in the `conditions` object.
 *
 * Example usage:
 * ```javascript
 * const filters = { incidentFilters: ["Critical", "Firing"] };
 * const filteredIncidents = filterIncident(filters, incidents);
 * ```
 */
export function filterIncident(filters, incidents) {
  const conditions = {
    Persistent: 'Persistent',
    Recent: 'Recent',
    Critical: 'Critical',
    Warning: 'Warning',
    Informative: 'Informative',
    Firing: 'Firing',
    Resolved: 'Resolved',
  };

  return incidents.filter((incident) => {
    // If there are no incidentFilters filters applied, return all incidents
    if (!filters.incidentFilters.length) {
      return true;
    }

    // Check if at least one filter passes for the incident
    return filters.incidentFilters.some((key) => {
      const conditionKey = conditions[key]; // Match the key exactly as in conditions
      return incident[conditionKey.toLowerCase()] === true;
    });
  });
}

export const onDeleteIncidentFilterChip = (type, id, filters, setFilters) => {
  if (type === 'Filters') {
    setFilters(
      setIncidentsActiveFilters({
        incidentsActiveFilters: {
          incidentFilters: filters.incidentFilters.filter((fil) => fil !== id),
          days: filters.days,
        },
      }),
    );
  } else if (type === 'Days') {
    setFilters(
      setIncidentsActiveFilters({
        incidentsActiveFilters: {
          incidentFilters: filters.incidentFilters,
          days: filters.days.filter((fil) => fil !== id),
        },
      }),
    );
  } else {
    setFilters(
      setIncidentsActiveFilters({
        incidentsActiveFilters: {
          incidentFilters: ['Recent', 'Critical', 'Warning', 'Firing'],
          days: ['7 days'],
        },
      }),
    );
  }
};

export const onDeleteGroupIncidentFilterChip = (type, filters, setFilters) => {
  if (type === 'Filters') {
    setFilters(
      setIncidentsActiveFilters({
        incidentsActiveFilters: {
          incidentFilters: [],
          days: filters.days,
        },
      }),
    );
  } else if (type === 'Days') {
    setFilters(
      setIncidentsActiveFilters({
        incidentsActiveFilters: {
          incidentFilters: filters.incidentFilters,
          days: [],
        },
      }),
    );
  }
};

export const makeIncidentUrlParams = (params) => {
  const processedParams = Object.entries(params).reduce((acc, [key, value]) => {
    if (Array.isArray(value)) {
      if (value.length > 0) {
        acc[key] = value.join(',');
      }
    } else {
      acc[key] = value;
    }
    return acc;
  }, {});

  return new URLSearchParams(processedParams).toString();
};

export const updateBrowserUrl = (params) => {
  const queryString = makeIncidentUrlParams(params);

  // Construct the new URL with the query string
  const newUrl = `${window.location.origin}${window.location.pathname}?${queryString}`;

  window.history.replaceState(null, '', newUrl);
};

export const changeDaysFilter = (days, dispatch, filters) => {
  dispatch(
    setIncidentsActiveFilters({
      incidentsActiveFilters: { days: [days], incidentFilters: filters.incidentFilters },
    }),
  );
};

export const onIncidentFiltersSelect = (event, selection, dispatch, incidentsActiveFilters) => {
  onSelect('incidentFilters', event, selection, dispatch, incidentsActiveFilters);
};

const onSelect = (type, event, selection, dispatch, incidentsActiveFilters) => {
  const checked = event.target.checked;

  dispatch((dispatch) => {
    const prevSelections = incidentsActiveFilters[type] || [];

    const updatedSelections = checked
      ? [...prevSelections, selection]
      : prevSelections.filter((value) => value !== selection);

    dispatch(
      setIncidentsActiveFilters({
        incidentsActiveFilters: {
          ...incidentsActiveFilters,
          [type]: updatedSelections,
        },
      }),
    );
  });
};

export const parseUrlParams = (search) => {
  const params = new URLSearchParams(search);
  const result = {};
  const arrayKeys = ['days', 'incidentFilters'];

  params.forEach((value, key) => {
    if (arrayKeys.includes(key)) {
      result[key] = value.includes(',') ? value.split(',') : [value];
    } else {
      result[key] = value;
    }
  });

  return result;
};
