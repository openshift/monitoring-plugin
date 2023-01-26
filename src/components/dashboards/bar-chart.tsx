import * as _ from 'lodash-es';
import * as React from 'react';

import { Bar, LabelComponentProps } from '../console/graphs/bar';

const Label: React.FC<LabelComponentProps> = ({ metric }) => <>{_.values(metric).join()}</>;

const BarChart: React.FC<BarChartProps> = ({ pollInterval, query }) => (
  <Bar barSpacing={5} barWidth={8} delay={pollInterval} LabelComponent={Label} query={query} />
);

type BarChartProps = {
  pollInterval: number;
  query: string;
};

export default BarChart;
