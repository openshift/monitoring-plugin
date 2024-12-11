import * as React from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { CustomDataSource } from '../console/extensions/dashboard-data-source';

import { dashboardsSetEndTime, dashboardsSetTimespan, Perspective } from '../../actions/observe';
import { FormatSeriesTitle, QueryBrowser } from '../query-browser';
import { DEFAULT_GRAPH_SAMPLES } from './monitoring-dashboard-utils';
import { MonitoringState } from '../../reducers/observe';
import { getObserveState } from '../hooks/usePerspective';

type Props = {
  customDataSource?: CustomDataSource;
  formatSeriesTitle?: FormatSeriesTitle;
  isStack: boolean;
  pollInterval: number;
  queries: string[];
  showLegend?: boolean;
  units: string;
  onZoomHandle?: (timeRange: number, endTime: number) => void;
  namespace?: string;
  perspective: Perspective;
  onDataChange?: (data: any) => void;
};

const Graph: React.FC<Props> = ({
  customDataSource,
  formatSeriesTitle,
  isStack,
  pollInterval,
  queries,
  showLegend,
  units,
  onZoomHandle,
  namespace,
  perspective,
  onDataChange,
}) => {
  const dispatch = useDispatch();
  const endTime = useSelector((state: MonitoringState) =>
    getObserveState(perspective, state)?.getIn(['dashboards', perspective, 'endTime']),
  );
  const timespan = useSelector((state: MonitoringState) =>
    getObserveState(perspective, state)?.getIn(['dashboards', perspective, 'timespan']),
  );

  const onZoom = React.useCallback(
    (from, to) => {
      dispatch(dashboardsSetEndTime(to, perspective));
      dispatch(dashboardsSetTimespan(to - from, perspective));
      onZoomHandle?.(to - from, to);
    },
    [perspective, dispatch, onZoomHandle],
  );

  return (
    <QueryBrowser
      customDataSource={customDataSource}
      defaultSamples={DEFAULT_GRAPH_SAMPLES}
      fixedEndTime={endTime}
      formatSeriesTitle={formatSeriesTitle}
      hideControls
      isStack={isStack}
      onZoom={onZoom}
      pollInterval={pollInterval}
      queries={queries}
      showLegend={showLegend}
      timespan={timespan}
      units={units}
      onDataChange={onDataChange}
    />
  );
};

export default Graph;
