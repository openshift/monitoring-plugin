import * as _ from 'lodash-es';
import type { FC } from 'react';

import { Bar, LabelComponentProps } from '../../console/graphs/bar';
import { CustomDataSource } from '@openshift-console/dynamic-plugin-sdk/lib/extensions/dashboard-data-source';

const Label: FC<LabelComponentProps> = ({ metric }) => <>{_.values(metric).join()}</>;

const BarChart: FC<BarChartProps> = ({ customDataSource, pollInterval, query }) => (
  <Bar
    barSpacing={5}
    barWidth={8}
    customDataSource={customDataSource}
    delay={pollInterval}
    LabelComponent={Label}
    query={query}
  />
);

type BarChartProps = {
  pollInterval: number;
  query: string;
  customDataSource?: CustomDataSource;
};

export default BarChart;
