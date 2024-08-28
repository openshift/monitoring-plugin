import * as React from 'react';
import moment from 'moment';
import { ChartBar } from '@patternfly/react-charts';
import global_danger_color_100 from '@patternfly/react-tokens/dist/esm/global_danger_color_100';
import global_info_color_100 from '@patternfly/react-tokens/dist/esm/global_info_color_100';
import global_warning_color_100 from '@patternfly/react-tokens/dist/esm/global_warning_color_100';

export function groupAndDeduplicate(objects) {
  const groupedObjects = new Map();
  for (const obj of objects) {
    // Create a unique key based on metric.alertname + metric.namespace
    const key = obj.metric.alertname + obj.metric.namespace;
    // If the key already exists in the map, merge the values
    if (groupedObjects.has(key)) {
      const existingObj = groupedObjects.get(key);
      existingObj.values = existingObj.values.concat(obj.values);
    } else {
      groupedObjects.set(key, {
        metric: obj.metric,
        values: obj.values.slice(),
      });
    }
  }

  // remove duplicates in each grouped object
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

export function processIncidentsTimestamps(data) {
  const firing = groupAndDeduplicate(data).filter((value) => value.metric.alertstate === 'firing');

  return firing.map((alert, index) => {
    // Process each value
    const processedValues = alert.values.map((value) => {
      const timestamp = value[0];

      // Convert timestamp to date
      const date = new Date(timestamp * 1000);
      return [date];
    });

    return {
      alertname: alert.metric.alertname,
      namespace: alert.metric.namespace,
      severity: alert.metric.severity,
      values: processedValues,
      alertsStartFiring: processedValues.at(0)[0],
      alertsEndFiring: processedValues.at(-1)[0],
      x: firing.length - index,
    };
  });
}

const today = moment().startOf('day');
const threeDaysAgo = moment().subtract(3, 'days');
const sevenDaysAgo = moment().subtract(7, 'days');
const fifteenDaysAgo = moment().subtract(15, 'days');

export const createChartBars = (alert) => {
  const data = [];

  for (let i = 0; i < alert.values.length - 1; i++) {
    data.push({
      y0: new Date(alert.values[i].at(0)),
      y: new Date(alert.values[i + 1].at(0)),
      x: alert.x,
      name: alert.severity[0].toUpperCase() + alert.severity.slice(1),
      fill:
        alert.severity === 'danger'
          ? global_danger_color_100.var
          : alert.severity === 'warning'
          ? global_warning_color_100.var
          : global_info_color_100.var,
    });
  }

  return data;
};
