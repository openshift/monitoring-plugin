import {
  Humanize,
  PrometheusEndpoint,
  PrometheusResponse,
  usePrometheusPoll,
} from '@openshift-console/dynamic-plugin-sdk';
import {
  ChartBar,
  ChartLabel,
  ChartThemeColor,
  ChartThemeDefinition,
  getCustomTheme,
} from '@patternfly/react-charts';
import * as _ from 'lodash-es';
import * as React from 'react';

import { useRefWidth } from '../utils/ref-width-hook';
import { humanizeNumber } from '../utils/units';
import { GraphEmpty } from './graph-empty';
import { CustomDataSource } from '@openshift-console/dynamic-plugin-sdk/lib/extensions/dashboard-data-source';

const DEFAULT_BAR_WIDTH = 10;
const PADDING_RATIO = 1 / 3;

const barTextAnchor = 'end';

const barTheme: ChartThemeDefinition = {
  bar: {
    style: {
      labels: {
        textAnchor: barTextAnchor,
      },
    },
  },
  dependentAxis: {
    style: {
      axis: {
        stroke: 'none',
      },
      tickLabels: {
        fill: 'none',
      },
    },
  },
  independentAxis: {
    style: {
      axis: {
        stroke: 'none',
      },
      tickLabels: {
        textAnchor: 'start',
      },
    },
  },
};

const theme = getCustomTheme(ChartThemeColor.blue, barTheme);

const BarChart: React.FC<BarChartProps> = ({
  barSpacing = 15,
  barWidth = DEFAULT_BAR_WIDTH,
  data = [],
  LabelComponent,
  loading = false,
}) => {
  const [containerRef, width] = useRefWidth();

  // Max space that horizontal padding should take up. By default, 2/3 of the horizontal space is
  // always available for the actual bar graph.
  const maxHorizontalPadding = PADDING_RATIO * width;

  const padding = {
    bottom: barSpacing,
    left: 0,
    right: Math.min(100, maxHorizontalPadding),
    top: 0,
  };

  return (
    <div ref={containerRef} className="graph-wrapper graph-wrapper__horizontal-bar">
      {data.length ? (
        data.map((datum, index) => (
          <React.Fragment key={index}>
            <div className="graph-bar__label">
              {LabelComponent ? (
                <LabelComponent title={datum.x} metric={datum.metric} />
              ) : (
                String(datum.x)
              )}
            </div>
            <div className="graph-bar__chart">
              <ChartBar
                barWidth={barWidth}
                data={[datum]}
                horizontal
                labelComponent={<ChartLabel x={width} textAnchor={barTextAnchor} />}
                theme={theme}
                height={barWidth + padding.bottom}
                width={width}
                domain={{ y: [0, data.reduce((max, datum) => Math.max(max, datum.y), 0)] }}
                padding={padding}
              />
            </div>
          </React.Fragment>
        ))
      ) : (
        <GraphEmpty loading={loading} />
      )}
    </div>
  );
};

const getInstantVectorStats: GetInstantStats = (response, metric, humanize) => {
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

type DataPoint = {
  x?: number;
  y?: number;
  label?: string;
  metric?: { [key: string]: string };
};

type GetInstantStats = (
  response: PrometheusResponse,
  metric?: string,
  humanize?: Humanize,
) => DataPoint[];

export const Bar: React.FC<BarProps> = ({
  barSpacing,
  barWidth,
  customDataSource,
  delay = undefined,
  humanize = humanizeNumber,
  LabelComponent,
  metric,
  query,
}) => {
  const [response, , loading] = usePrometheusPoll({
    customDataSource,
    delay,
    endpoint: PrometheusEndpoint.QUERY,
    query,
  });
  const data = getInstantVectorStats(response, metric, humanize);

  return (
    <BarChart
      barSpacing={barSpacing}
      barWidth={barWidth}
      data={data}
      LabelComponent={LabelComponent}
      loading={loading as boolean}
      query={query}
    />
  );
};

export type LabelComponentProps = {
  title: Date | string | number;
  metric?: { [key: string]: string };
};

type BarChartProps = {
  barSpacing?: number;
  barWidth?: number;
  data: DataPoint[];
  LabelComponent: React.ComponentType<LabelComponentProps>;
  loading: boolean;
  query: string;
};

type BarProps = {
  barSpacing?: number;
  barWidth?: number;
  customDataSource?: CustomDataSource;
  delay?: number;
  humanize?: Humanize;
  LabelComponent?: React.ComponentType<LabelComponentProps>;
  metric?: string;
  query: string;
};
