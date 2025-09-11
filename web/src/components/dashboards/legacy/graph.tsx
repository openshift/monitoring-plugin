import type { FC } from 'react';
import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { dashboardsSetEndTime, dashboardsSetTimespan } from '../../../store/actions';
import { FormatSeriesTitle, QueryBrowser } from '../../query-browser';
import { MonitoringState } from '../../../store/store';
import { getObserveState } from '../../hooks/usePerspective';
import { DEFAULT_GRAPH_SAMPLES } from './utils';
import { CustomDataSource } from '@openshift-console/dynamic-plugin-sdk/lib/extensions/dashboard-data-source';
import { GraphUnits } from 'src/components/metrics/units';
import { useMonitoring } from '../../../hooks/useMonitoring';

type Props = {
  customDataSource?: CustomDataSource;
  formatSeriesTitle?: FormatSeriesTitle;
  isStack: boolean;
  pollInterval: number;
  queries: string[];
  showLegend?: boolean;
  units: string;
  onZoomHandle?: (timeRange: number, endTime: number) => void;
  onDataChange?: (data: any) => void;
};

const Graph: FC<Props> = ({
  customDataSource,
  formatSeriesTitle,
  isStack,
  pollInterval,
  queries,
  showLegend,
  units,
  onZoomHandle,
  onDataChange,
}) => {
  const dispatch = useDispatch();
  const { plugin } = useMonitoring();
  const endTime = useSelector(
    (state: MonitoringState) => getObserveState(plugin, state).dashboards.endTime,
  );
  const timespan = useSelector(
    (state: MonitoringState) => getObserveState(plugin, state).dashboards.timespan,
  );

  const onZoom = useCallback(
    (from, to) => {
      dispatch(dashboardsSetEndTime(to));
      dispatch(dashboardsSetTimespan(to - from));
      onZoomHandle?.(to - from, to);
    },
    [dispatch, onZoomHandle],
  );

  return (
    <QueryBrowser
      customDataSource={customDataSource}
      defaultSamples={DEFAULT_GRAPH_SAMPLES}
      fixedEndTime={Number(endTime)}
      formatSeriesTitle={formatSeriesTitle}
      hideControls
      isStack={isStack}
      onZoom={onZoom}
      pollInterval={pollInterval}
      queries={queries}
      showLegend={showLegend}
      timespan={timespan}
      units={units as GraphUnits}
      onDataChange={onDataChange}
      isPlain
    />
  );
};

export default Graph;
