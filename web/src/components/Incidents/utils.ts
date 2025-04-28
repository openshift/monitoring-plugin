/* eslint-disable max-len */
import { setIncidentsActiveFilters } from '../../actions/observe';
import {
  t_global_color_status_danger_default,
  t_global_color_status_info_default,
  t_global_color_status_warning_default,
} from '@patternfly/react-tokens';

type Timestamps = [Date, string];

type SpanDates = [Date];

type Theme = 'dark' | 'light';

type AlertsIntervalsArray = [Date, Date, 'data' | 'nodata'];

type Incident = {
  component: string;
  componentList: Array<string>;
  critical: boolean;
  informative: boolean;
  warning: boolean;
  resolved: boolean;
  layer: string;
  firing: boolean;
  group_id: string;
  src_severity: string;
  src_alertname: string;
  src_namespace: string;
  x: number;
  values: Array<Timestamps>;
};

type Alert = {
  alertname: string;
  alertsStartFiring: Date;
  alertsEndFiring: Date;
  alertstate: string;
  component: string;
  layer: string;
  name: string;
  namespace: string;
  resolved: boolean;
  severity: 'critical' | 'warning' | 'info';
  x: number;
  values: Array<Timestamps>;
};

type DaysFilters = '1 day' | '3 days' | '7 days' | '15 days';

type IncidentFilters = 'Critical' | 'Warning' | 'Firing' | 'Informative' | 'Resolved';

type IncidentFiltersCombined = {
  days: Array<DaysFilters>;
  incidentFilters: Array<IncidentFilters>;
};

/**
 * Consolidates and merges intervals based on severity rankings.
 * @param {Object} data - The input data containing timestamps and severity levels.
 * @param {string[]} dateArray - The array of date strings defining the boundary.
 * @returns {Array} - The consolidated intervals.
 */

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
): Array<[Date, string]> {
  const highestSeverityValues: Record<string, string> = data.values.reduce(
    (acc: Record<string, string>, [timestamp, severity]) => {
      const timestampStr = timestamp.toISOString();

      if (!acc[timestampStr] || severityRank[severity] > severityRank[acc[timestampStr]]) {
        acc[timestampStr] = severity;
      }
      return acc;
    },
    {},
  );

  return Object.entries(highestSeverityValues)
    .map(([timestamp, severity]) => [new Date(timestamp), severity] as [Date, string])
    .sort((a, b) => a[0].getTime() - b[0].getTime());
}

/**
 * Generates intervals while handling gaps with "nodata".
 * @param {Array} filteredValues - The sorted array of timestamps with severities.
 * @param {string[]} dateArray - The array defining the start and end boundaries.
 * @returns {Array} - The list of consolidated intervals.
 */
function generateIntervalsWithGaps(filteredValues: Array<Timestamps>, dateArray: SpanDates) {
  const intervals = [];
  const startBoundary = new Date(dateArray[0]);
  const endBoundary = new Date(dateArray[dateArray.length - 1]);

  let currentStart = filteredValues[0] ? filteredValues[0][0] : startBoundary.toISOString();
  let currentSeverity = filteredValues[0] ? filteredValues[0][1] : 'nodata';

  if (!filteredValues.length) {
    intervals.push([startBoundary.toISOString(), endBoundary.toISOString(), 'nodata']);
    return intervals;
  }

  const firstTimestamp = new Date(filteredValues[0][0]);
  if (firstTimestamp > startBoundary) {
    intervals.push([
      startBoundary.toISOString(),
      new Date(firstTimestamp.getTime() - 1).toISOString(),
      'nodata',
    ]);
  }

  for (let i = 0; i < filteredValues.length; i++) {
    const [timestamp, severity] = filteredValues[i];

    if (i > 0 && hasGap(filteredValues, i)) {
      intervals.push(createNodataInterval(filteredValues, i));
    }

    if (currentSeverity !== severity || i === 0) {
      if (i > 0) {
        const endDate = new Date(timestamp);
        endDate.setMilliseconds(endDate.getMilliseconds() - 1);
        intervals.push([currentStart, endDate.toISOString(), currentSeverity]);
      }
      currentStart = timestamp;
      currentSeverity = severity;
    }
  }

  const lastEndDate = new Date(filteredValues[filteredValues.length - 1][0]);
  intervals.push([currentStart, lastEndDate.toISOString(), currentSeverity]);

  if (lastEndDate < endBoundary) {
    intervals.push([
      new Date(lastEndDate.getTime() + 1).toISOString(),
      endBoundary.toISOString(),
      'nodata',
    ]);
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
  const previousTimestamp = new Date(filteredValues[index - 1][0]);
  const currentTimestamp = new Date(filteredValues[index][0]);
  return (currentTimestamp.getTime() - previousTimestamp.getTime()) / 1000 / 60 > 5;
}

/**
 * Creates a "nodata" interval to fill gaps between timestamps.
 * @param {Array} filteredValues - The array of filtered timestamps and severities.
 * @param {number} index - The current index in the array.
 * @returns {Array} - The "nodata" interval.
 */
function createNodataInterval(filteredValues: Array<Timestamps>, index: number) {
  const previousTimestamp = new Date(filteredValues[index - 1][0]);
  const currentTimestamp = new Date(filteredValues[index][0]);

  const gapStart = new Date(previousTimestamp);
  gapStart.setMilliseconds(gapStart.getMilliseconds() + 1);

  const gapEnd = new Date(currentTimestamp);
  gapEnd.setMilliseconds(gapEnd.getMilliseconds() - 1);

  return [gapStart.toISOString(), gapEnd.toISOString(), 'nodata'];
}

/**
 * Creates an array of incident data for chart bars, ensuring that when two severities have the same time range, the lower severity is removed.
 *
 * @param {Object} incident - The incident data containing values with timestamps and severity levels.
 * @returns {Array} - An array of incident objects with `y0`, `y`, `x`, and `name` fields representing the bars for the chart.
 */
export const createIncidentsChartBars = (
  incident: Incident,
  theme: Theme,
  dateArray: SpanDates,
) => {
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
      y0: new Date(groupedData[i][0]),
      y: new Date(groupedData[i][1]),
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
  const sortedValues = data.values.sort(
    (a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime(),
  );

  const intervals: Array<AlertsIntervalsArray> = [];
  let currentStart = sortedValues[0][0],
    previousTimestamp = new Date(currentStart);

  for (let i = 1; i < sortedValues.length; i++) {
    const currentTimestamp = new Date(sortedValues[i][0]);
    const timeDifference = (currentTimestamp.getTime() - previousTimestamp.getTime()) / 60000; // Convert to minutes

    if (timeDifference > 5) {
      intervals.push([currentStart, sortedValues[i - 1][0], 'data']);
      intervals.push([
        new Date(previousTimestamp.getTime() + 1),
        new Date(currentTimestamp.getTime() - 1),
        'nodata',
      ]);
      currentStart = sortedValues[i][0];
    }
    previousTimestamp = currentTimestamp;
  }

  intervals.push([currentStart, sortedValues[sortedValues.length - 1][0], 'data']);

  // Handle gaps before and after the detected intervals
  const startBoundary = new Date(dateArray[0]),
    endBoundary = new Date(dateArray[dateArray.length - 1]);
  const firstIntervalStart = new Date(intervals[0][0]),
    lastIntervalEnd = new Date(intervals[intervals.length - 1][1]);

  if (firstIntervalStart > startBoundary) {
    intervals.unshift([startBoundary, new Date(firstIntervalStart.getTime() - 1), 'nodata']);
  }
  if (lastIntervalEnd < endBoundary) {
    intervals.push([new Date(lastIntervalEnd.getTime() + 1), endBoundary, 'nodata']);
  }

  return intervals;
}

export const createAlertsChartBars = (alert: Alert, theme: Theme, dateValues: SpanDates) => {
  const groupedData = consolidateAndMergeAlertIntervals(alert, dateValues);
  const barChartColorScheme = {
    critical: t_global_color_status_danger_default.var,
    info: t_global_color_status_info_default.var,
    warning: t_global_color_status_warning_default.var,
  };

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
export function generateDateArray(days: number) {
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
 * @param {string[]} filters.incidentFilters - An array of strings representing filter conditions such as "Critical", etc.
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
  type: 'Filters' | '',
  id: IncidentFilters,
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

export const updateBrowserUrl = (params: IncidentFiltersCombined, incidentGroupId: string) => {
  const queryString = makeIncidentUrlParams(params, incidentGroupId);

  const newUrl = `${window.location.origin}${window.location.pathname}?${queryString}`;

  window.history.replaceState(null, '', newUrl);
};

export const changeDaysFilter = (days: DaysFilters, dispatch, filters: IncidentFiltersCombined) => {
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
  const result = {};
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
