/* eslint-disable max-len */
import {
  t_global_color_status_danger_default,
  t_global_color_status_info_default,
  t_global_color_status_warning_default,
} from '@patternfly/react-tokens';
import { Dispatch } from 'redux';
import { setIncidentsActiveFilters } from '../../actions/observe';
import {
  Alert,
  AlertsIntervalsArray,
  DaysFilters,
  Incident,
  IncidentFilters,
  IncidentFiltersCombined,
  SpanDates,
  Timestamps,
} from './model';

export const isIncidentFilter = (filter: unknown): filter is IncidentFilters => {
  return (
    typeof filter === 'string' &&
    ['Critical', 'Warning', 'Firing', 'Informative', 'Resolved'].includes(filter)
  );
};

function consolidateAndMergeIntervals(data: Incident, dateArray: SpanDates) {
  const severityRank = { 2: 2, 1: 1, 0: 0 };
  const filteredValues = filterAndSortValues(data, severityRank);
  return generateIntervalsWithGaps(filteredValues, dateArray);
}

/**
 * Filters and sorts values by severity, keeping only the highest severity for each timestamp.
 * @param {Object} data - The input data containing timestamps and severities.
 * @param {Object} severityRank - An object mapping severity levels to their ranking values.
 * @returns {Array} - An array of sorted timestamps with their severities.
 */
function filterAndSortValues(
  data: Incident,
  severityRank: Record<string, number>,
): Array<[number, string]> {
  const highestSeverityValues: Record<string, string> = data.values.reduce(
    (acc: Record<string, string>, [timestamp, severity]) => {
      const timestampStr = new Date(timestamp * 1000).toISOString();

      if (!acc[timestampStr] || severityRank[severity] > severityRank[acc[timestampStr]]) {
        acc[timestampStr] = severity;
      }
      return acc;
    },
    {},
  );

  return Object.entries(highestSeverityValues)
    .map(
      ([timestamp, severity]) =>
        [new Date(timestamp).getTime() / 1000, severity] as [number, string],
    )
    .sort((a, b) => a[0] - b[0]);
}

/**
 * Generates intervals while handling gaps with "nodata".
 * @param {Array} filteredValues - The sorted array of timestamps with severities.
 * @param {string[]} dateArray - The array defining the start and end boundaries.
 * @returns {Array} - The list of consolidated intervals.
 */
function generateIntervalsWithGaps(filteredValues: Array<Timestamps>, dateArray: SpanDates) {
  const intervals = [];
  const startBoundary = dateArray[0];
  const endBoundary = dateArray[dateArray.length - 1];

  let currentStart = filteredValues[0] ? filteredValues[0][0] : startBoundary;
  let currentSeverity = filteredValues[0] ? filteredValues[0][1] : 'nodata';

  if (filteredValues.length === 0) {
    intervals.push([startBoundary, endBoundary, 'nodata']);
    return intervals;
  }

  const firstTimestamp = filteredValues[0][0];
  if (firstTimestamp > startBoundary) {
    intervals.push([startBoundary, firstTimestamp - 1, 'nodata']);
  }

  for (let i = 0; i < filteredValues.length; i++) {
    const [timestamp, severity] = filteredValues[i];

    if (i > 0 && hasGap(filteredValues, i)) {
      intervals.push(createNodataInterval(filteredValues, i));
    }

    if (currentSeverity !== severity || i === 0) {
      if (i > 0) {
        const endDate = timestamp - 1;
        intervals.push([currentStart, endDate, currentSeverity]);
      }
      currentStart = timestamp;
      currentSeverity = severity;
    }
  }

  const lastEndDate = filteredValues[filteredValues.length - 1][0];
  intervals.push([currentStart, lastEndDate, currentSeverity]);

  if (lastEndDate < endBoundary) {
    intervals.push([lastEndDate + 1, endBoundary, 'nodata']);
  }

  return intervals;
}

/**
 * Checks if there is a gap larger than 5 minutes between consecutive timestamps.
 * @param {Array} filteredValues - The array of filtered timestamps and severities.
 * @param {number} index - The current index in the array.
 * @returns {boolean} - Whether a gap exists.
 */
function hasGap(filteredValues: Array<Timestamps>, index: number) {
  const previousTimestamp = filteredValues[index - 1][0];
  const currentTimestamp = filteredValues[index][0];
  return (currentTimestamp - previousTimestamp) / 60 > 5;
}

/**
 * Creates a "nodata" interval to fill gaps between timestamps.
 * @param {Array} filteredValues - The array of filtered timestamps and severities.
 * @param {number} index - The current index in the array.
 * @returns {Array} - The "nodata" interval.
 */
function createNodataInterval(filteredValues: Array<Timestamps>, index: number) {
  const previousTimestamp = filteredValues[index - 1][0];
  const currentTimestamp = filteredValues[index][0];

  return [previousTimestamp + 1, currentTimestamp - 1, 'nodata'];
}

/**
 * Creates an array of incident data for chart bars, ensuring that when two severities have the same time range, the lower severity is removed.
 *
 * @param {Object} incident - The incident data containing values with timestamps and severity levels.
 * @returns {Array} - An array of incident objects with `y0`, `y`, `x`, and `name` fields representing the bars for the chart.
 */
export const createIncidentsChartBars = (incident: Incident, dateArray: SpanDates) => {
  const groupedData = consolidateAndMergeIntervals(incident, dateArray);
  const data = [];
  const getSeverityName = (value) => {
    return value === '2' ? 'Critical' : value === '1' ? 'Warning' : 'Info';
  };
  const barChartColorScheme = {
    critical: t_global_color_status_danger_default.var,
    info: t_global_color_status_info_default.var,
    warning: t_global_color_status_warning_default.var,
  };

  for (let i = 0; i < groupedData.length; i++) {
    const severity = getSeverityName(groupedData[i][2]);

    data.push({
      y0: new Date(groupedData[i][0] * 1000),
      y: new Date(groupedData[i][1] * 1000),
      x: incident.x,
      name: severity,
      firing: incident.firing,
      componentList: incident.componentList || [],
      group_id: incident.group_id,
      nodata: groupedData[i][2] === 'nodata' ? true : false,
      fill:
        severity === 'Critical'
          ? barChartColorScheme.critical
          : severity === 'Warning'
          ? barChartColorScheme.warning
          : barChartColorScheme.info,
    });
  }

  return data;
};

function consolidateAndMergeAlertIntervals(data: Alert, dateArray: SpanDates) {
  if (!data.values || data.values.length === 0) {
    return [];
  }
  const sortedValues = data.values.sort((a, b) => a[0] - b[0]);

  const intervals: Array<AlertsIntervalsArray> = [];
  let currentStart = sortedValues[0][0];
  let previousTimestamp = currentStart;

  for (let i = 1; i < sortedValues.length; i++) {
    const currentTimestamp = sortedValues[i][0];
    const timeDifference = (currentTimestamp - previousTimestamp) / 60; // Convert to minutes

    if (timeDifference > 5) {
      intervals.push([currentStart, sortedValues[i - 1][0], 'data']);
      intervals.push([previousTimestamp + 1, currentTimestamp - 1, 'nodata']);
      currentStart = sortedValues[i][0];
    }
    previousTimestamp = currentTimestamp;
  }

  intervals.push([currentStart, sortedValues[sortedValues.length - 1][0], 'data']);

  // Handle gaps before and after the detected intervals
  const startBoundary = dateArray[0],
    endBoundary = dateArray[dateArray.length - 1];
  const firstIntervalStart = intervals[0][0],
    lastIntervalEnd = intervals[intervals.length - 1][1];

  if (firstIntervalStart > startBoundary) {
    intervals.unshift([startBoundary, firstIntervalStart - 1, 'nodata']);
  }
  if (lastIntervalEnd < endBoundary) {
    intervals.push([lastIntervalEnd + 1, endBoundary, 'nodata']);
  }

  return intervals;
}

export const createAlertsChartBars = (alert: Alert, dateValues: SpanDates) => {
  const groupedData = consolidateAndMergeAlertIntervals(alert, dateValues);
  const barChartColorScheme = {
    critical: t_global_color_status_danger_default.var,
    info: t_global_color_status_info_default.var,
    warning: t_global_color_status_warning_default.var,
  };

  const data = [];

  for (let i = 0; i < groupedData.length; i++) {
    data.push({
      y0: new Date(groupedData[i][0] * 1000),
      y: new Date(groupedData[i][1] * 1000),
      x: alert.x,
      severity: alert.severity[0].toUpperCase() + alert.severity.slice(1),
      name: alert.alertname,
      namespace: alert.namespace,
      layer: alert.layer,
      component: alert.component,
      nodata: groupedData[i][2] === 'nodata' ? true : false,
      alertstate: alert.alertstate,
      fill:
        alert.severity === 'critical'
          ? barChartColorScheme.critical
          : alert.severity === 'warning'
          ? barChartColorScheme.warning
          : barChartColorScheme.info,
    });
  }

  return data;
};

export const formatDate = (date: Date, isTime: boolean) => {
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
 * @returns {Array<number>} An array of timestamps (in seconds) representing midnight (00:00:00) in UTC, for the past `days` number of days.
 *
 * @description
 * This function creates an array of timestamps, starting from `days` ago up to the current day. Each timestamp in the array is set to midnight (00:00:00) to represent the start of the day.
 *
 * The function works by subtracting days from the current date and setting the time to 00:00:00 for each day.
 *
 * @example
 * // Generate an array of 7 days (last 7 days including today)
 * const dateArray = generateDateArray(7);
 * // Output example:
 * // [
 * //   1754381643,
 * //   1754468043,
 * //   1754554443,
 * //   1754640843,
 * //   1754727243,
 * //   1754813643,
 * //   1754900043
 * // ]
 */
export function generateDateArray(days: number): Array<number> {
  const currentDate = new Date();

  const dateArray: Array<number> = [];
  for (let i = 0; i < days; i++) {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() - (days - 1 - i));
    newDate.setHours(0, 0, 0, 0);
    dateArray.push(newDate.getTime() / 1000);
  }

  return dateArray;
}

/**
 * Filters incidents based on the specified filters.
 *
 * @param {IncidentFiltersCombined} filters - An object containing filter criteria.
 * @param {Array<Incident>} incidents - An array of incidents to be filtered.
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
export function filterIncident(filters: IncidentFiltersCombined, incidents: Array<Incident>) {
  const conditions = {
    Critical: 'critical',
    Warning: 'warning',
    Informative: 'informative',
    Firing: 'firing',
    Resolved: 'resolved',
  };

  return incidents.filter((incident) => {
    // If no filters are applied, return all incidents
    if (!filters.incidentFilters.length) {
      return incident;
    }

    // Normalize user-provided filters to match keys in conditions
    const normalizedFilters = filters.incidentFilters.map((filter) => filter.trim());

    // Separate filters into categories
    const severityFilters = ['Critical', 'Warning', 'Informative'].filter((key) =>
      normalizedFilters.includes(key),
    );
    const statusFilters = ['Firing', 'Resolved'].filter((key) => normalizedFilters.includes(key));

    // Match severity filters (OR behavior within the category)
    const isSeverityMatch =
      severityFilters.length > 0
        ? severityFilters.some((filter) => incident[conditions[filter]] === true)
        : true; // True if no severity filters

    // Match status filters (OR behavior within the category)
    const isStatusMatch =
      statusFilters.length > 0
        ? statusFilters.some((filter) => incident[conditions[filter]] === true)
        : true; // True if no status filters

    // Combine conditions with AND behavior between categories
    return isSeverityMatch && isStatusMatch;
  });
}

export const onDeleteIncidentFilterChip = (
  type: string,
  id: IncidentFilters | undefined,
  filters: IncidentFiltersCombined,
  setFilters,
) => {
  if (type === 'Filters') {
    setFilters(
      setIncidentsActiveFilters({
        incidentsActiveFilters: {
          incidentFilters: filters.incidentFilters.filter((fil) => fil !== id),
          days: filters.days,
        },
      }),
    );
  } else {
    setFilters(
      setIncidentsActiveFilters({
        incidentsActiveFilters: {
          incidentFilters: [],
          days: ['7 days'],
        },
      }),
    );
  }
};

export const onDeleteGroupIncidentFilterChip = (filters: IncidentFiltersCombined, setFilters) => {
  setFilters(
    setIncidentsActiveFilters({
      incidentsActiveFilters: {
        incidentFilters: [],
        days: filters.days,
      },
    }),
  );
};

export const makeIncidentUrlParams = (
  params: IncidentFiltersCombined,
  incidentGroupId?: string,
) => {
  const processedParams = Object.entries(params).reduce((acc, [key, value]) => {
    if (Array.isArray(value)) {
      if (value.length > 0) {
        acc[key] = value.join(',');
      }
    } else {
      acc[key] = value;
    }
    return acc;
  }, {} as Record<string, string>);

  if (incidentGroupId) {
    processedParams['groupId'] = incidentGroupId;
  }

  return new URLSearchParams(processedParams).toString();
};

export const updateBrowserUrl = (params: IncidentFiltersCombined, incidentGroupId?: string) => {
  const queryString = makeIncidentUrlParams(params, incidentGroupId);

  const newUrl = `${window.location.origin}${window.location.pathname}?${queryString}`;

  window.history.replaceState(null, '', newUrl);
};

export const changeDaysFilter = (
  days: DaysFilters,
  dispatch: Dispatch<any>,
  filters: IncidentFiltersCombined,
) => {
  dispatch(
    setIncidentsActiveFilters({
      incidentsActiveFilters: { days: [days], incidentFilters: filters.incidentFilters },
    }),
  );
};

export const onIncidentFiltersSelect = (
  event,
  selection: IncidentFilters,
  dispatch,
  incidentsActiveFilters: IncidentFiltersCombined,
) => {
  onSelect(event, selection, dispatch, incidentsActiveFilters);
};

const onSelect = (
  event,
  selection: IncidentFilters,
  dispatch,
  incidentsActiveFilters: IncidentFiltersCombined,
) => {
  const checked = event.target.checked;

  dispatch((dispatch) => {
    const prevSelections = incidentsActiveFilters.incidentFilters || [];

    const updatedSelections = checked
      ? [...prevSelections, selection]
      : prevSelections.filter((value) => value !== selection);

    dispatch(
      setIncidentsActiveFilters({
        incidentsActiveFilters: {
          ...incidentsActiveFilters,
          incidentFilters: updatedSelections,
        },
      }),
    );
  });
};

export const parseUrlParams = (search) => {
  const params = new URLSearchParams(search);
  const result: { [key: string]: any } = {};
  const arrayKeys = ['days', 'incidentFilters', 'groupId'];

  params.forEach((value, key) => {
    if (arrayKeys.includes(key)) {
      result[key] = value.includes(',') ? value.split(',') : [value];
    } else {
      result[key] = value;
    }
  });

  return result;
};
