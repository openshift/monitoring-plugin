import type { FC } from 'react';

import { Bar } from '../../console/graphs/bar';
import { CustomDataSource } from '@openshift-console/dynamic-plugin-sdk/lib/extensions/dashboard-data-source';

const BarChart: FC<BarChartProps> = ({ customDataSource, pollInterval, query }) => (
  <Bar
    barSpacing={5}
    barWidth={8}
    customDataSource={customDataSource}
    delay={pollInterval}
    query={query}
  />
);

type BarChartProps = {
  pollInterval: number;
  query: string;
  customDataSource?: CustomDataSource;
};

export default BarChart;
