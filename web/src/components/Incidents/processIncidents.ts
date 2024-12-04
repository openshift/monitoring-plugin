/* eslint-disable max-len */

interface Metric {
  src_alertname: string;
  src_severity: string;
  src_namespace: string;
  src_name: string;
  component: string;
  layer: string;
  group_id: string;
}

interface Incident {
  metric: Metric;
  values: Array<[number, string]>;
  componentsList?: string[];
  layerList?: string[];
}

interface ProcessedIncident {
  component: string;
  group_id: string;
  severity: string;
  alertname: string;
  namespace: string;
  name: string;
  layer: string;
  componentsList?: string[];
  layerList?: string[];
  values: Array<[Date, string]>;
  x: number;
  informative: boolean;
  longStanding: boolean;
  inactive: boolean;
}

/**
 * Processes an array of incident data by filtering and transforming it into a structured format.
 * Removes "Watchdog" alerts, deduplicates entries by `group_id`, and calculates properties
 * such as `longStanding`, `informative`, and `inactive` based on the data.
 *
 * @param data - Array of incident objects to process, each containing metric details and values.
 * @returns Array of processed incident objects, each containing details and properties calculated from the data.
 */

export function processIncidents(data: Incident[]): ProcessedIncident[] {
  const incidents = groupById(data).filter(
    (incident) => incident.metric.src_alertname !== 'Watchdog',
  );

  return incidents.map((incident, index) => {
    const processedValues = incident.values.map((value) => {
      const timestamp = value[0];
      const date = new Date(timestamp * 1000);
      return [date, value[1]] as [Date, string];
    });

    const firstDate = incident.values[0][0];
    const lastDate = incident.values[incident.values.length - 1][0];
    const currentDate = new Date(); // Current timestamp in milliseconds

    // Calculate the time difference in milliseconds
    const timeDifference = currentDate.valueOf() - lastDate * 1000;
    const inactive = timeDifference < 10 * 60 * 1000;
    const dayDifference = (lastDate - firstDate) / (60 * 60 * 24);

    // Set longStanding to true if the difference is 7 or more days
    const longStanding = dayDifference >= 7;

    const srcProperties = getSrcProperties(incident.metric);
    return {
      component: incident.metric.component,
      group_id: incident.metric.group_id,
      layer: incident.metric.layer,
      values: processedValues,
      x: incidents.length - index,
      informative: incident.metric.src_severity === 'info',
      longStanding: longStanding,
      inactive: inactive,
      ...srcProperties,
    } as ProcessedIncident;
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

      const existingMetricsSet = new Set([JSON.stringify(existingObj.metric)]);
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
