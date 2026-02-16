/* eslint-disable max-len */

import { PrometheusLabels, PrometheusResult } from '@openshift-console/dynamic-plugin-sdk';
import { Metric, ProcessedIncident } from './model';
import {
  insertPaddingPointsForChart,
  isResolved,
  sortByEarliestTimestamp,
  DAY_MS,
  PROMETHEUS_QUERY_INTERVAL_SECONDS,
} from './utils';

/**
 * Converts Prometheus results into processed incidents, filtering out Watchdog incidents.
 * Adds padding points for chart rendering and determines firing/resolved status based on
 * the time elapsed since the last data point.
 *
 * Severity-based splitting is handled upstream in getIncidents, which produces separate
 * entries for each consecutive run of the same severity within a group_id.
 *
 * @param prometheusResults - Array of Prometheus query results containing incident data.
 * @param currentTime - The current time in milliseconds to use for resolved/firing calculations.
 * @returns Array of processed incidents with firing/resolved status, padding points, and x positioning.
 */
export function convertToIncidents(
  prometheusResults: PrometheusResult[],
  currentTime: number,
  daysSpanMs: number,
): ProcessedIncident[] {
  const incidents = getIncidents(prometheusResults).filter(
    (incident) => incident.metric.src_alertname !== 'Watchdog',
  );
  const sortedIncidents = sortByEarliestTimestamp(incidents);

  // Assign x values by unique group_id so that split severity segments share the same x
  const uniqueGroupIds = [...new Set(sortedIncidents.map((i) => i.metric.group_id))];
  const groupIdToX = new Map(uniqueGroupIds.map((id, idx) => [id, uniqueGroupIds.length - idx]));

  // N-day window boundary (in seconds) for filtering values
  const nDaysStartSeconds = (currentTime - daysSpanMs) / 1000;

  const processedIncidents = sortedIncidents
    .map((incident) => {
      const sortedValues = incident.values.sort((a, b) => a[0] - b[0]);

      // Filter values to the N-day window
      const windowValues = sortedValues.filter(([ts]) => ts >= nDaysStartSeconds);

      // Exclude incidents with no values in the selected window
      if (windowValues.length === 0) {
        return null;
      }

      // Determine resolved status based on filtered values before padding
      const lastTimestamp = windowValues[windowValues.length - 1][0];
      const resolved = isResolved(lastTimestamp, currentTime);

      // Add padding points for chart rendering
      const paddedValues = insertPaddingPointsForChart(windowValues, currentTime);

      // firstTimestamp is absolute over the full 15-day data (before N-day filtering),
      // with the padding offset applied to match chart rendering
      const firstTimestamp = sortedValues[0][0] - PROMETHEUS_QUERY_INTERVAL_SECONDS;

      const srcProperties = getSrcProperties(incident.metric);

      return {
        component: incident.metric.component,
        componentList: incident.metric.componentList,
        group_id: incident.metric.group_id,
        layer: incident.metric.layer,
        values: paddedValues,
        x: groupIdToX.get(incident.metric.group_id),
        resolved,
        firing: !resolved,
        firstTimestamp,
        ...srcProperties,
        metric: incident.metric,
      } as ProcessedIncident;
    })
    .filter((incident): incident is ProcessedIncident => incident !== null);

  return processedIncidents;
}

/**
 * Splits a sorted array of [timestamp, severity] tuples into consecutive segments
 * where the severity value remains the same. A new segment starts whenever the
 * severity changes between consecutive data points.
 *
 * @param sortedValues - Array of [timestamp, severity] tuples, sorted by timestamp
 * @returns Array of segments, each containing consecutive values with the same severity
 */
function splitBySeverityChange(
  sortedValues: Array<[number, string]>,
): Array<Array<[number, string]>> {
  if (sortedValues.length === 0) return [];

  const segments: Array<Array<[number, string]>> = [];
  let currentSegment: Array<[number, string]> = [sortedValues[0]];

  for (let i = 1; i < sortedValues.length; i++) {
    if (sortedValues[i][1] !== sortedValues[i - 1][1]) {
      segments.push(currentSegment);
      currentSegment = [sortedValues[i]];
    } else {
      currentSegment.push(sortedValues[i]);
    }
  }

  segments.push(currentSegment);
  return segments;
}

/**
 * Deduplicates values by timestamp, keeping only the highest severity for each timestamp.
 * Severity ranking: '2' (Critical) > '1' (Warning) > '0' (Info)
 *
 * @param values - Array of [timestamp, severity] tuples
 * @returns Deduplicated array with only the highest severity per timestamp
 */
function deduplicateByTimestampWithHighestSeverity(
  values: Array<[number, string]>,
): Array<[number, string]> {
  const severityRank = { '2': 2, '1': 1, '0': 0 };
  const timestampMap = new Map<number, string>();

  // Keep only the highest severity for each timestamp
  values.forEach(([timestamp, severity]) => {
    const existing = timestampMap.get(timestamp);
    if (!existing || severityRank[severity] > severityRank[existing]) {
      timestampMap.set(timestamp, severity);
    }
  });

  // Convert back to array format
  return Array.from(timestampMap.entries());
}

/**
 * Extracts properties from the metric that start with 'src_' and returns them in an object.
 * These are the keys we use to identify the associated alerts.
 *
 * @param metric - The metric object from which source properties are extracted.
 * @returns An object containing only the properties from metric that start with 'src_'.
 */

function getSrcProperties(metric: PrometheusLabels): Partial<Metric> {
  return Object.keys(metric)
    .filter((key) => key.startsWith('src_'))
    .reduce((acc: Record<string, any>, key) => {
      acc[key] = metric[key as keyof Metric];
      return acc;
    }, {} as Partial<Metric>);
}

/**
 * Converts Prometheus results into incident records by their `group_id` field.
 * Merges values arrays from multiple Prometheus results with the same group_id,
 * deduplicates timestamps (keeping only the highest severity per timestamp),
 * and combines components into componentList.
 *
 * After merging and deduplication, each incident is split into separate entries
 * when the severity (values[1]) changes between consecutive data points.
 * This means a single group_id may produce multiple entries if its severity
 * transitions over time (e.g., from warning '1' to critical '2').
 *
 * @param prometheusResults - Array of Prometheus query results to convert.
 * @returns Array of incident objects with deduplicated values and combined properties,
 *          split by severity changes.
 */

export function getIncidents(
  prometheusResults: PrometheusResult[],
): Array<PrometheusResult & { metric: Metric }> {
  const incidents = new Map<string, PrometheusResult & { metric: Metric }>();
  // Track which metric labels correspond to each severity value per group_id
  // severity value ("0","1","2") -> metric from the Prometheus result that contributed it
  const severityMetrics = new Map<string, Map<string, PrometheusLabels>>();

  for (const result of prometheusResults) {
    const groupId = result.metric.group_id;

    // Track the metric for this result's severity value (skip Watchdog)
    if (result.values.length > 0 && result.metric.src_alertname !== 'Watchdog') {
      const severityValue = result.values[0][1]; // constant within a single result
      if (!severityMetrics.has(groupId)) {
        severityMetrics.set(groupId, new Map());
      }
      severityMetrics.get(groupId).set(severityValue, result.metric);
    }

    const existingIncident = incidents.get(groupId);

    if (existingIncident) {
      // Merge values from the new result with existing incident
      // Concatenate and let deduplicateByTimestampWithHighestSeverity handle deduplication
      const mergedValues = existingIncident.values.concat(result.values);
      existingIncident.values = deduplicateByTimestampWithHighestSeverity(mergedValues);

      // Add or update the componentList
      if (!existingIncident.metric.componentList) {
        existingIncident.metric.componentList = [existingIncident.metric.component];
      }

      if (
        existingIncident.metric.component !== result.metric.component &&
        !existingIncident.metric.componentList.includes(result.metric.component)
      ) {
        existingIncident.metric.componentList.push(result.metric.component);
      }

      // Update silenced from the result if it has a more recent or equal timestamp
      if (result.values.length > 0 && existingIncident.values.length > 0) {
        const resultLatestTimestamp = Math.max(...result.values.map((v) => v[0]));
        const existingLatestTimestamp = Math.max(...existingIncident.values.map((v) => v[0]));

        if (resultLatestTimestamp >= existingLatestTimestamp) {
          existingIncident.metric.silenced = result.metric.silenced;
        }
      }

      incidents.set(groupId, existingIncident);
    } else {
      // Create new incident from Prometheus result
      incidents.set(groupId, {
        metric: {
          ...result.metric,
          componentList: [result.metric.component], // Initialize componentList with the current component
        } as Metric,
        values: deduplicateByTimestampWithHighestSeverity(result.values),
      });
    }
  }

  // Split each incident into separate entries when severity (values[1]) changes over time
  const result: Array<PrometheusResult & { metric: Metric }> = [];

  for (const incident of incidents.values()) {
    const groupId = incident.metric.group_id;
    const sortedValues = [...incident.values].sort((a, b) => a[0] - b[0]);
    const segments = splitBySeverityChange(sortedValues);
    const groupSeverityMetrics = severityMetrics.get(groupId);

    for (const segmentValues of segments) {
      const segmentSeverity = segmentValues[0][1]; // uniform within a segment
      // Use the metric from the Prometheus result that contributed this severity,
      // preserving shared properties (componentList, silenced) from the merged incident
      const severitySpecificMetric = groupSeverityMetrics?.get(segmentSeverity);

      result.push({
        metric: {
          ...incident.metric,
          ...(severitySpecificMetric && {
            src_alertname: severitySpecificMetric.src_alertname,
            src_namespace: severitySpecificMetric.src_namespace,
            src_severity: severitySpecificMetric.src_severity,
            component: severitySpecificMetric.component,
          }),
        } as Metric,
        values: segmentValues,
      });
    }
  }

  return result;
}

/**
 * Calculates time ranges for incidents based on a given timespan, split into daily intervals.
 *
 * @param timespan - The total timespan for which to calculate ranges.
 * @param currentTime - The current time to use as the end boundary.
 * @returns Array of time range objects, each with `endTime` and `duration` for a daily interval.
 */

export const getIncidentsTimeRanges = (
  timespan: number,
  currentTime: number,
): Array<{ endTime: number; duration: number }> => {
  const startTime = currentTime - timespan;
  const timeRanges = [{ endTime: startTime + DAY_MS, duration: DAY_MS }];

  while (timeRanges[timeRanges.length - 1].endTime < currentTime) {
    const lastRange = timeRanges[timeRanges.length - 1];
    const nextEndTime = lastRange.endTime + DAY_MS;
    timeRanges.push({ endTime: nextEndTime, duration: DAY_MS });
  }

  return timeRanges;
};

/**
 * Processes Prometheus incident results for use in alert processing.
 * Converts the silenced metric label from string to boolean and adds x positioning.
 *
 * @param incidents - Array of Prometheus results containing incident data.
 * @returns Array of partial incident objects with silenced status as boolean and x position.
 */
export const processIncidentsForAlerts = (incidents: Array<PrometheusResult>) => {
  return incidents.map((incident, index) => {
    // Read silenced value from cluster_health_components_map metric label
    // If missing, default to false
    const silenced = incident.metric.silenced === 'true';

    // Return the processed incident
    const retval = {
      ...incident.metric,
      values: incident.values,
      x: incidents.length - index,
      silenced,
      // TODO SET ME
      firstTimestamp: 0,
    };
    return retval;
  });
};
