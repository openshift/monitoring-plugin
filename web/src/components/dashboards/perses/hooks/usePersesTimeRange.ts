import { useSelector } from 'react-redux';
import { getLegacyObserveState, usePerspective } from '../../../hooks/usePerspective';
import { MonitoringState } from '../../../../reducers/observe';
import { DurationString, TimeRangeValue } from '@perses-dev/core';

export const usePersesTimeRange = (): TimeRangeValue => {
  const { perspective } = usePerspective();
  const endTime = useSelector((state: MonitoringState) =>
    getLegacyObserveState(perspective, state)?.getIn(['dashboards', perspective, 'endTime']),
  );
  const timespan = useSelector((state: MonitoringState) =>
    getLegacyObserveState(perspective, state)?.getIn(['dashboards', perspective, 'timespan']),
  );

  if (!endTime) {
    return {
      pastDuration: `${String(timespan)}ms` as DurationString,
    };
  }

  return {
    start: new Date(endTime - timespan),
    end: new Date(endTime),
  };
};
