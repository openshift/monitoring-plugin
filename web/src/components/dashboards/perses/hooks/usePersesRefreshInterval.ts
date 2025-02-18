import { useSelector } from 'react-redux';
import { getLegacyObserveState, usePerspective } from '../../../hooks/usePerspective';
import { MonitoringState } from '../../../../reducers/observe';
import { DurationString } from '@perses-dev/core';

export const usePersesRefreshInterval = (): DurationString | undefined => {
  const { perspective } = usePerspective();
  const pollInterval = useSelector((state: MonitoringState) =>
    getLegacyObserveState(perspective, state)?.getIn(['dashboards', perspective, 'pollInterval']),
  );

  return pollInterval ? (`${String(pollInterval)}ms` as DurationString) : undefined;
};
