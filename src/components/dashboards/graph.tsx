import * as React from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { CustomDataSource } from '../console/extensions/dashboard-data-source';

import { dashboardsSetEndTime, dashboardsSetTimespan, Perspective } from '../../actions/observe';
import { FormatSeriesTitle, QueryBrowser } from '../query-browser';
import { RootState } from '../types';
import { DEFAULT_GRAPH_SAMPLES } from './monitoring-dashboard-utils';

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
}) => {
  const dispatch = useDispatch();
  const endTime = useSelector(({ observe }: RootState) =>
    observe.getIn(['dashboards', perspective, 'endTime']),
  );
  const timespan = useSelector(({ observe }: RootState) =>
    observe.getIn(['dashboards', perspective, 'timespan']),
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
      namespace={namespace}
    />
  );
};

export default Graph;
