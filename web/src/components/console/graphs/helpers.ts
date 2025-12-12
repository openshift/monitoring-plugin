import * as _ from 'lodash-es';
import {
  Humanize,
  PrometheusResponse,
} from '@openshift-console/dynamic-plugin-sdk/lib/extensions/console-types';

export const getInstantVectorStats: GetInstantStats = (response, metric, humanize) => {
  const results = _.get(response, 'data.result', []);
  return results.map((r) => {
    const y = parseFloat(_.get(r, 'value[1]'));
    return {
      label: humanize ? humanize(y).string : null,
      x: _.get(r, ['metric', metric], ''),
      y,
      metric: r.metric,
    };
  });
};

type GetInstantStats = (
  response: PrometheusResponse,
  metric?: string,
  humanize?: Humanize,
) => DataPoint<number>[];

export type DataPoint<X = Date | number | string> = {
  x?: X;
  y?: number;
  label?: string;
  metric?: { [key: string]: string };
  description?: string;
  symbol?: {
    type?: string;
    fill?: string;
  };
};
