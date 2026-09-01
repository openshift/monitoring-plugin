import { CustomDataSource } from '@openshift-console/dynamic-plugin-sdk/lib/extensions/dashboard-data-source';
import type { FC } from 'react';
import { useCallback } from 'react';
import { NumberParam, useQueryParam } from 'use-query-params';

import { DEFAULT_GRAPH_SAMPLES, TimeRangeParam } from '@/features/legacy-dashboards/utils/utils';
import { FormatSeriesTitle, QueryBrowser } from '@/shared/components/query-browser/QueryBrowser';
import { QueryParams } from '@/shared/constants/query-params';
import { GraphUnits } from '@/shared/utils/units';

type Props = {
  customDataSource?: CustomDataSource;
  formatSeriesTitle?: FormatSeriesTitle;
  isStack: boolean;
  onLoadingChange?: (isLoading: boolean) => void;
  pollInterval: number;
  queries: string[];
  showLegend?: boolean;
  units: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
