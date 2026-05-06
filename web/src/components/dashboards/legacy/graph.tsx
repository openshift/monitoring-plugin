import type { FC } from 'react';
import { useCallback } from 'react';
import { NumberParam, useQueryParam } from 'use-query-params';

import { FormatSeriesTitle, QueryBrowser } from '../../query-browser';
import { DEFAULT_GRAPH_SAMPLES, TimeRangeParam } from './utils';
import { CustomDataSource } from '@openshift-console/dynamic-plugin-sdk/lib/extensions/dashboard-data-source';
import { GraphUnits } from '../../../components/metrics/units';
import { QueryParams } from '../../query-params';

type Props = {
  customDataSource?: CustomDataSource;
  formatSeriesTitle?: FormatSeriesTitle;
  isStack: boolean;
  onLoadingChange?: (isLoading: boolean) => void;
  pollInterval: number;
  queries: string[];
  showLegend?: boolean;
  units: string;
  onDataChange?: (data: any) => void;
};

const Graph: FC<Props> = ({
  customDataSource,
  formatSeriesTitle,
  isStack,
  onLoadingChange,
  pollInterval,
  queries,
  showLegend,
  units,
  onDataChange,
}) => {
  const [timeRange, setTimeRange] = useQueryParam(QueryParams.TimeRange, TimeRangeParam);
  const [endTime, setEndTime] = useQueryParam(QueryParams.EndTime, NumberParam);

  const onZoom = useCallback(
    (from: number, to: number) => {
      setEndTime(to);
      setTimeRange(to - from);
    },
    [setEndTime, setTimeRange],
  );

  return (
    <QueryBrowser
      customDataSource={customDataSource}
      defaultSamples={DEFAULT_GRAPH_SAMPLES}
      fixedEndTime={endTime}
      formatSeriesTitle={formatSeriesTitle}
      hideControls
      isStack={isStack}
      onLoadingChange={onLoadingChange}
      onZoom={onZoom}
      pollInterval={pollInterval}
      queries={queries}
      showLegend={showLegend}
      timespan={timeRange}
      units={units as GraphUnits}
      onDataChange={onDataChange}
      isPlain
    />
  );
};

export default Graph;
