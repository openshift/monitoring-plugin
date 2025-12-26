/* eslint-disable max-len */

import { PrometheusLabels, PrometheusResult } from '@openshift-console/dynamic-plugin-sdk';
import { Incident, Metric, ProcessedIncident } from './model';
import { insertPaddingPointsForChart, isResolved, sortByEarliestTimestamp } from './utils';

/**
 * Converts Prometheus results into processed incidents, filtering out Watchdog incidents.
 * Adds padding points for chart rendering and determines firing/resolved status based on
 * the time elapsed since the last data point.
 *
 * @param prometheusResults - Array of Prometheus query results containing incident data.
 * @param currentTime - The current time in milliseconds to use for resolved/firing calculations.
 * @returns Array of processed incidents with firing/resolved status, padding points, and x positioning.
 */
export function convertToIncidents(
  prometheusResults: PrometheusResult[],
  currentTime: number,
): ProcessedIncident[] {
  const incidents = getIncidents(prometheusResults).filter(
    (incident) => incident.metric.src_alertname !== 'Watchdog',
  );
  const sortedIncidents = sortByEarliestTimestamp(incidents);

  return sortedIncidents.map((incident, index) => {
    // Determine resolved status based on original values before padding
    const sortedValues = incident.values.sort((a, b) => a[0] - b[0]);
    const lastTimestamp = sortedValues[sortedValues.length - 1][0];
    const resolved = isResolved(lastTimestamp, currentTime);

    // Add padding points for chart rendering
    const paddedValues = insertPaddingPointsForChart(sortedValues, currentTime);

    const srcProperties = getSrcProperties(incident.metric);

    return {
      component: incident.metric.component,
      componentList: incident.metric.componentList,
      group_id: incident.metric.group_id,
      layer: incident.metric.layer,
      values: paddedValues,
      x: incidents.length - index,
      resolved,
      firing: !resolved,
      ...srcProperties,
      metric: incident.metric,
    } as ProcessedIncident;
  });
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
 * @param prometheusResults - Array of Prometheus query results to convert.
 * @returns Array of incident objects with deduplicated values and combined properties.
 */

export function getIncidents(
  prometheusResults: PrometheusResult[],
): Array<PrometheusResult & { metric: Metric }> {
  const incidents = new Map<string, PrometheusResult & { metric: Metric }>();

  for (const result of prometheusResults) {
    const groupId = result.metric.group_id;

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

  return Array.from(incidents.values());
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
  const ONE_DAY = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  const FIFTEEN_DAYS = 15 * ONE_DAY;
  return [{ endTime: currentTime, duration: FIFTEEN_DAYS }];
};

/**
 * Processes Prometheus incident results for use in alert processing.
 * Converts the silenced metric label from string to boolean and adds x positioning.
 *
 * @param incidents - Array of Prometheus results containing incident data.
 * @returns Array of partial incident objects with silenced status as boolean and x position.
 */
export const processIncidentsForAlerts = (
  incidents: Array<PrometheusResult>,
): Array<Partial<Incident>> => {
  return incidents.map((incident, index) => {
    // Read silenced value from cluster_health_components_map metric label
    // If missing, default to false
    const silenced = incident.metric.silenced === 'true';

    // Return the processed incident
    return {
      ...incident.metric,
      values: incident.values,
      x: incidents.length - index,
      silenced,
    };
  });
};
