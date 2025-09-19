/* eslint-disable max-len */
import {
  t_global_color_status_danger_default,
  t_global_color_status_info_default,
  t_global_color_status_warning_default,
} from '@patternfly/react-tokens';
import { Dispatch } from 'redux';
import { setIncidentsActiveFilters } from '../../store/actions';
import {
  Alert,
  AlertsChartBar,
  AlertsIntervalsArray,
  DaysFilters,
  Incident,
  IncidentFiltersCombined,
  IncidentsDetailsAlert,
  SpanDates,
  Timestamps,
} from './model';

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
  const intervals: [number, number, string][] = [];
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
function createNodataInterval(
  filteredValues: Array<Timestamps>,
  index: number,
): [number, number, string] {
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
  const data: {
    y0: Date;
    y: Date;
    x: number;
    name: string;
    firing: boolean;
    componentList: string[];
    group_id: string;
    nodata: boolean;
    fill: string;
  }[] = [];
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

function consolidateAndMergeAlertIntervals(data: Alert) {
  if (!data.values || data.values.length === 0) {
    return [];
  }

  // Spread the array items to prevent sorting the original array
  const sortedValues = [...data.values].sort((a, b) => a[0] - b[0]);

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

  // For dynamic alerts timeline, we don't add padding gaps since the dateArray
  // is already calculated to fit the alert data with appropriate padding
  // This allows the timeline to focus on the actual alert activity period

  return intervals;
}

export const createAlertsChartBars = (alert: IncidentsDetailsAlert): AlertsChartBar[] => {
  const groupedData = consolidateAndMergeAlertIntervals(alert);
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
      silenced: alert.silenced,
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
 * Generates a dynamic date array based on the actual min/max timestamps from alerts data.
 * This creates a focused timeline that spans only the relevant alert activity period.
 *
 * @param {Array<Alert>} alertsData - Array of alert objects containing timestamp values
 * @returns {Array<number>} - Array of timestamp values representing the date range with some padding
 *
 * @example
 * const alertsDateRange = generateAlertsDateArray(alertsData);
 * // Returns timestamps spanning from earliest alert minus padding to latest alert plus padding
 */
export function generateAlertsDateArray(alertsData: Array<Alert>): Array<number> {
  if (!Array.isArray(alertsData) || alertsData.length === 0) {
    // Fallback to current day if no alerts data
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return [now.getTime() / 1000];
  }

  let minTimestamp = Infinity;
  let maxTimestamp = -Infinity;

  // Find min and max timestamps across all alerts
  alertsData.forEach((alert) => {
    if (alert.values && Array.isArray(alert.values)) {
      alert.values.forEach(([timestamp]) => {
        minTimestamp = Math.min(minTimestamp, timestamp);
        maxTimestamp = Math.max(maxTimestamp, timestamp);
      });
    }
  });

  // Handle edge case where no valid timestamps found
  if (minTimestamp === Infinity || maxTimestamp === -Infinity) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return [now.getTime() / 1000];
  }

  // Add some padding to make the timeline more readable
  // Padding: 10% of the time span, minimum 1 hour, maximum 24 hours
  const timeSpan = maxTimestamp - minTimestamp;
  const paddingSeconds = Math.max(3600, Math.min(86400, timeSpan * 0.1));

  const paddedMin = minTimestamp - paddingSeconds;
  const paddedMax = maxTimestamp + paddingSeconds;

  // Generate array with exactly 2 timestamps: min (start) and max (end)
  const dateArray: Array<number> = [];

  // Always show exactly 2 ticks for clean X-axis: start and end only
  dateArray.push(paddedMin); // Min date (start)
  dateArray.push(paddedMax); // Max date (end)

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
 * const filters = { severity: ["Critical"], state: ["Firing"] };
 * const filteredIncidents = filterIncident(filters, incidents);
 * ```
 */
/**
 * Determines all maximum severities that an incident has had over time.
 * This looks at each time period and finds what was the maximum severity at that time,
 * then returns all unique maximum severities that occurred.
 *
 * @param incident - The incident to evaluate
 * @returns Array of severity strings that were maximum severities at some point in time
 */
function getIncidentMaximumSeveritiesOverTime(incident: Incident): string[] {
  const severityRank = { '2': 2, '1': 1, '0': 0 };
  const getSeverityName = (value: string) => {
    return value === '2' ? 'Critical' : value === '1' ? 'Warning' : 'Informative';
  };

  // Group values by timestamp to find maximum severity at each point in time
  const timestampSeverities: Record<string, string> = {};

  incident.values.forEach(([timestamp, severity]) => {
    const timestampStr = timestamp.toString();
    if (
      !timestampSeverities[timestampStr] ||
      severityRank[severity] > severityRank[timestampSeverities[timestampStr]]
    ) {
      timestampSeverities[timestampStr] = severity;
    }
  });

  // Get unique maximum severities that occurred over time
  const maxSeverities = new Set<string>();
  Object.values(timestampSeverities).forEach((severity) => {
    maxSeverities.add(getSeverityName(severity));
  });

  return Array.from(maxSeverities);
}

export function filterIncident(filters: IncidentFiltersCombined, incidents: Array<Incident>) {
  const stateConditions = {
    Firing: 'firing',
    Resolved: 'resolved',
  };

  return incidents.filter((incident) => {
    if (!filters?.severity?.length && !filters?.state?.length && !filters?.groupId?.length) {
      return true;
    }

    // Filter by maximum severities that occurred at any point in time
    const isSeverityMatch =
      filters.severity && filters.severity.length > 0
        ? filters.severity.some((selectedSeverity) =>
            getIncidentMaximumSeveritiesOverTime(incident).includes(selectedSeverity),
          )
        : true; // True if no severity filters

    const isStateMatch =
      filters.state && filters.state.length > 0
        ? filters.state.some((filter) => incident[stateConditions[filter]] === true)
        : true; // True if no state filters

    const isIncidentIdMatch =
      filters.groupId && filters.groupId?.length > 0
        ? filters.groupId.includes(incident.group_id)
        : true;

    // Combine conditions with AND behavior between categories
    return isSeverityMatch && isStateMatch && isIncidentIdMatch;
  });
}

export const onDeleteIncidentFilterChip = (
  type: string,
  id: string,
  filters: IncidentFiltersCombined,
  setFilters,
) => {
  if (type === 'State') {
    setFilters(
      setIncidentsActiveFilters({
        incidentsActiveFilters: {
          severity: filters.severity,
          days: filters.days,
          state: filters.state?.filter((fil) => fil !== id) ?? [],
          groupId: filters.groupId,
        },
      }),
    );
  }
  if (type === 'Severity') {
    setFilters(
      setIncidentsActiveFilters({
        incidentsActiveFilters: {
          severity: filters.severity?.filter((fil) => fil !== id) ?? [],
          days: filters.days,
          state: filters.state,
          groupId: filters.groupId,
        },
      }),
    );
  }
  if (type === 'Incident ID') {
    setFilters(
      setIncidentsActiveFilters({
        incidentsActiveFilters: {
          severity: filters.severity,
          days: filters.days,
          state: filters.state,
          groupId: filters.groupId?.filter((fil) => fil !== id) ?? [],
        },
      }),
    );
  }
};

export const onDeleteGroupIncidentFilterChip = (
  filters: IncidentFiltersCombined,
  setFilters,
  category,
) => {
  if (category === 'State') {
    setFilters(
      setIncidentsActiveFilters({
        incidentsActiveFilters: {
          severity: filters.severity,
          days: filters.days,
          state: [],
          groupId: filters.groupId,
        },
      }),
    );
  } else if (category === 'Severity') {
    setFilters(
      setIncidentsActiveFilters({
        incidentsActiveFilters: {
          severity: [],
          days: filters.days,
          state: filters.state,
          groupId: filters.groupId,
        },
      }),
    );
  } else if (category === 'Incident ID') {
    setFilters(
      setIncidentsActiveFilters({
        incidentsActiveFilters: {
          severity: filters.severity,
          days: filters.days,
          state: filters.state,
          groupId: [],
        },
      }),
    );
  } else {
    setFilters(
      setIncidentsActiveFilters({
        incidentsActiveFilters: {
          severity: [],
          days: filters.days,
          state: [],
          groupId: [],
        },
      }),
    );
  }
};

export const makeIncidentUrlParams = (
  params?: IncidentFiltersCombined,
  incidentGroupId?: string,
) => {
  const processedParams = Object.entries(params ?? {}).reduce((acc, [key, value]) => {
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

export const updateBrowserUrl = (params?: IncidentFiltersCombined, incidentGroupId?: string) => {
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
      incidentsActiveFilters: {
        days: [days],
        severity: filters.severity,
        state: filters.state,
        groupId: filters.groupId,
      },
    }),
  );
};

/**
 * A wrapper function that handles a user's selection on an incident filter.
 *
 * This function acts as the public entry point for filter selection,
 * passing the event details and filter state to the internal `onSelect`
 * helper function to perform the state update.
 *
 * @param {Event} event - The DOM event from the checkbox or filter selection.
 * @param {string | undefined} selection - The value of the filter being selected or deselected.
 * @param {Function} dispatch - The Redux dispatch function to trigger state changes.
 * @param {object} incidentsActiveFilters - The current state of active filters.
 * @param {string} filterCategoryType - The category of the filter (e.g., 'Incident ID', 'severity').
 * @returns {void}
 */
export const onIncidentFiltersSelect = (
  event,
  selection: string,
  dispatch,
  incidentsActiveFilters: IncidentFiltersCombined,
  filterCategoryType: string,
) => {
  onSelect(event, selection, dispatch, incidentsActiveFilters, filterCategoryType);
};

/**
 * An internal helper function that manages the logic for selecting or deselecting a filter.
 *
 * It updates the Redux state based on the filter type. For 'groupId', it replaces the
 * existing selection (single-select behavior). For all other filters, it adds or
 * removes the selection from the array (multi-select behavior).
 *
 * @param {Event} event - The DOM event from the checkbox or filter selection.
 * @param {string} selection - The value of the filter being selected or deselected.
 * @param {Function} dispatch - The Redux dispatch function to trigger state changes.
 * @param {object} incidentsActiveFilters - The current state of active filters.
 * @param {string} filterCategoryType - The category of the filter.
 * @returns {void}
 */
const onSelect = (event, selection, dispatch, incidentsActiveFilters, filterCategoryType) => {
  let effectiveFilterType = filterCategoryType;

  if (effectiveFilterType === 'incident id') {
    effectiveFilterType = 'groupId';
  }

  dispatch(() => {
    const targetArray = incidentsActiveFilters[effectiveFilterType] || [];
    const newFilters = { ...incidentsActiveFilters };

    // Determine if the item is already selected by checking the current state.
    // This replaces the need for event.target.checked.
    const isSelected = targetArray.includes(selection);

    if (effectiveFilterType === 'groupId') {
      // Single-select logic: If already selected, unselect it. Otherwise, select it.
      newFilters[effectiveFilterType] = isSelected ? [] : [selection];
    } else {
      // Multi-select logic: If already selected, remove it. Otherwise, add it.
      if (isSelected) {
        newFilters[effectiveFilterType] = targetArray.filter((value) => value !== selection);
      } else {
        newFilters[effectiveFilterType] = [...targetArray, selection];
      }
    }

    dispatch(
      setIncidentsActiveFilters({
        incidentsActiveFilters: newFilters,
      }),
    );
  });
};

export const parseUrlParams = (search) => {
  const params = new URLSearchParams(search);
  const result: { [key: string]: any } = {};
  const arrayKeys = ['days', 'groupId', 'severity', 'state'];

  params.forEach((value, key) => {
    if (arrayKeys.includes(key)) {
      result[key] = value.includes(',') ? value.split(',') : [value];
    } else {
      result[key] = value;
    }
  });

  return result;
};

/**
 * Generates an array of unique incident ID options for a filter.
 *
 * This function iterates through a list of incident objects,
 * extracts their unique `group_id`s, and returns them in a format
 * suitable for a dropdown or filter component.
 *
 * @param {Array<Incident>} incidents - An array of incident objects.
 * @returns {{value: string}[]} An array of objects, where each object has a `value` key with a unique incident ID.
 */
export const getIncidentIdOptions = (incidents: Array<Incident>) => {
  const incidentMap = new Map<string, Incident>();
  incidents.forEach((incident) => {
    if (incident.group_id) {
      incidentMap.set(incident.group_id, incident);
    }
  });
  return Array.from(incidentMap.entries()).map(([id, incident]) => {
    const componentCount = incident.componentList ? incident.componentList.length : 1;
    const componentText = componentCount === 1 ? 'component' : 'components';
    return {
      value: id,
      description: `${componentCount} ${componentText}`,
    };
  });
};

/**
 * Maps a human-readable filter category name to its corresponding data key.
 *
 * This function is used to convert a display name (e.g., "Incident ID")
 * into the internal key used to access filter data (e.g., "groupId").
 * It handles a specific case for "Incident ID" and converts all other
 * category names to lowercase.
 *
 * @param {string} categoryName - The human-readable name of the filter category.
 * @returns {string} The corresponding data key for the filter.
 */
export const getFilterKey = (categoryName: string): string => {
  if (categoryName === 'Incident ID') {
    return 'groupId';
  }
  return categoryName.toLowerCase();
};
