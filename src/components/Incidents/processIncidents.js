const currentDate = new Date(); // Get the current date and time in UTC
const currentDay = currentDate.getUTCDate();
const currentMonth = currentDate.getUTCMonth();
const currentYear = currentDate.getUTCFullYear();
const currentHour = currentDate.getUTCHours();

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

    return {
      component: incident.metric.component,
      group_id: incident.metric.group_id,
      severity: incident.metric.src_severity,
      alertname: incident.metric.src_alertname,
      namespace: incident.metric.src_namespace,
      name: incident.metric.src_name,
      layer: incident.metric.layer,
      componentsList: incident.componentsList,
      layerList: incident.layerList,
      values: processedValues,
      x: incidents.length - index,
      informative: incident.metric.src_severity === 'info' ? true : false,
      longStanding: dayDifference < 7 ? true : false,
      inactive: !hasMatchingDayAndHour ? true : false,
    };
  });
}

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

      // Add the component to componentsList and layer to the layerList
      //it is used to create an alerts query that combines all of them
      if (!existingObj.componentsList.includes(component)) {
        existingObj.componentsList.push(component);
      }
      if (!existingObj.layerList.includes(layer)) {
        existingObj.layerList.push(layer);
      }

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
        componentsList: [component],
        layerList: [layer],
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
