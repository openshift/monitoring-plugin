/* eslint-disable max-len */

// Define the interface for Metric
interface Metric {
  group_id: string; // The unique ID for grouping
  component: string; // Component name
  componentList?: string[]; // List of all unique components
  [key: string]: any; // Allow other dynamic fields in Metric
}

interface Incident {
  metric: Metric;
  values: Array<[number, string]>;
}

interface ProcessedIncident {
  component: string;
  componentList?: string[];
  group_id: string;
  severity: string;
  alertname: string;
  namespace: string;
  name: string;
  layer: string;
  values: Array<[Date, string]>;
  x: number;
  long_standing: boolean;
  informative: boolean;
  critical: string;
  warning: string;
  resolved: boolean;
  firing: boolean;
}

//this will be moved to the utils.js file when I convert them to the Typescript
export function sortObjectsByEarliestTimestamp(incidents: Incident[]): Incident[] {
  return incidents.sort((a, b) => {
    const earliestA = Math.min(...a.values.map((value) => value[0]));
    const earliestB = Math.min(...b.values.map((value) => value[0]));
    return earliestA - earliestB;
  });
}

export function processIncidents(data: Incident[]): ProcessedIncident[] {
  const incidents = groupById(data).filter(
    (incident) => incident.metric.src_alertname !== 'Watchdog',
  );
  const sortedIncidents = sortObjectsByEarliestTimestamp(incidents);

  return sortedIncidents.map((incident, index) => {
    const processedValues = incident.values.map((value) => {
      const timestamp = value[0];
      const date = new Date(timestamp * 1000);
      return [date, value[1]] as [Date, string];
    });

    const timestamps = incident.values.map((value) => value[0]); // Extract timestamps
    const lastTimestamp = Math.max(...timestamps); // Last timestamp in seconds
    const firstTimestamp = Math.min(...timestamps); // First timestamp in seconds
    const currentDate = new Date();
    const currentTimestamp = Math.floor(currentDate.valueOf() / 1000); // Current time in seconds

    // Firing and resolved logic
    const firing = currentTimestamp - lastTimestamp <= 10 * 60;
    const resolved = !firing;

    // Persistent logic based on the first occurrence
    const daysSinceFirstOccurrence = (currentTimestamp - firstTimestamp) / (60 * 60 * 24);
    const longStanding = daysSinceFirstOccurrence >= 7;

    const srcProperties = getSrcProperties(incident.metric);

    return {
      component: incident.metric.component,
      componentList: incident.metric.componentList,
      group_id: incident.metric.group_id,
      layer: incident.metric.layer,
      values: processedValues,
      x: incidents.length - index,
      critical: incident.metric.src_severity === 'critical',
      warning: incident.metric.src_severity === 'warning',
      informative: incident.metric.src_severity === 'info',
      longStanding,
      resolved: resolved,
      firing: firing,
      ...srcProperties,
    } as unknown as ProcessedIncident;
  });
}

/**
 * Extracts properties from the metric that start with 'src_' and returns them in an object.
 *
 * @param metric - The metric object from which source properties are extracted.
 * @returns An object containing only the properties from metric that start with 'src_'.
 */

function getSrcProperties(metric: Metric): Partial<Metric> {
  return Object.keys(metric)
    .filter((key) => key.startsWith('src_'))
    .reduce((acc, key) => {
      acc[key] = metric[key as keyof Metric];
      return acc;
    }, {} as Partial<Metric>);
}

/**
 * Groups a list of alert objects by their `group_id` field, merges their values, and deduplicates.
 * Creates a combined object with deduplicated values and lists of components and layers for each unique `group_id`.
 *
 * @param objects - Array of alert objects to group by `group_id`.
 * @returns Array of grouped alert objects with deduplicated values and combined properties.
 */

export function groupById(objects: Incident[]): Incident[] {
  const groupedObjects = new Map<string, Incident>();

  for (const obj of objects) {
    const key = obj.metric.group_id;

    const existingObj = groupedObjects.get(key);

    if (existingObj) {
      const existingValuesSet = new Set(existingObj.values.map((v) => JSON.stringify(v)));
      const newValues = obj.values.filter((v) => !existingValuesSet.has(JSON.stringify(v)));

      existingObj.values = existingObj.values.concat(newValues);

      // Add or update the componentList
      if (!existingObj.metric.componentList) {
        existingObj.metric.componentList = [existingObj.metric.component];
      }

      if (
        existingObj.metric.component !== obj.metric.component &&
        !existingObj.metric.componentList.includes(obj.metric.component)
      ) {
        existingObj.metric.componentList.push(obj.metric.component);
      }

      groupedObjects.set(key, {
        ...existingObj,
        values: existingObj.values,
      });
    } else {
      groupedObjects.set(key, {
        metric: {
          ...obj.metric,
          componentList: [obj.metric.component], // Initialize componentList with the current component
        },
        values: [...new Set(obj.values.map((v) => JSON.stringify(v)))].map((v) => JSON.parse(v)),
      });
    }
  }

  return Array.from(groupedObjects.values());
}

const QUERY_CHUNK_SIZE = 24 * 60 * 60 * 1000;

/**
 * Calculates time ranges for incidents based on a given timespan, split into daily intervals.
 *
 * @param timespan - The total timespan for which to calculate ranges.
 * @param maxEndTime - The maximum end time for the ranges, defaulting to the current time.
 * @returns Array of time range objects, each with `endTime` and `duration` for a daily interval.
 */

export const getIncidentsTimeRanges = (
  timespan: number,
  maxEndTime: number = Date.now(),
): Array<{ endTime: number; duration: number }> => {
  const startTime = maxEndTime - timespan;
  const timeRanges = [{ endTime: startTime + QUERY_CHUNK_SIZE, duration: QUERY_CHUNK_SIZE }];

  while (timeRanges.length > 0 && timeRanges[timeRanges.length - 1].endTime < maxEndTime) {
    const lastRange = timeRanges[timeRanges.length - 1];
    const nextEndTime = lastRange.endTime + QUERY_CHUNK_SIZE;
    timeRanges.push({ endTime: nextEndTime, duration: QUERY_CHUNK_SIZE });
  }

  return timeRanges;
};

export const processIncidentsForAlerts = (incidents) => {
  return incidents.map((incident, index) => {
    // Process the values
    const processedValues = incident.values.map((value): [Date, string] => {
      const timestamp = value[0];
      const date = new Date(timestamp * 1000);
      return [date, value[1]];
    });

    // Return the processed incident
    return {
      ...incident.metric,
      values: processedValues,
      x: incidents.length - index,
    };
  });
};
