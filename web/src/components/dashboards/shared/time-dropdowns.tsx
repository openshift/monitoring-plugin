import * as _ from 'lodash';
// TODO: These will be available in future versions of the plugin SDK
import { formatPrometheusDuration, parsePrometheusDuration } from '../../console/utils/datetime';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { removeQueryArgument, setQueryArgument } from '../../console/utils/router';
import {
  dashboardsSetEndTime,
  dashboardsSetPollInterval,
  dashboardsSetTimespan,
} from '../../../actions/observe';
import { useBoolean } from '../../hooks/useBoolean';
import CustomTimeRangeModal from '../shared/custom-time-range-modal';
import { getLegacyObserveState, usePerspective } from '../../hooks/usePerspective';
import { SimpleSelect, SimpleSelectOption } from '../../SimpleSelect';
import { MonitoringState } from '../../../reducers/observe';
import {
  DEFAULT_REFRESH_INTERVAL,
  DropDownPollInterval,
} from '../../../components/dropdown-poll-interval';
import { QueryParams } from '../../query-params';
import { NumberParam, useQueryParam } from 'use-query-params';

const CUSTOM_TIME_RANGE_KEY = 'CUSTOM_TIME_RANGE_KEY';
const DEFAULT_TIMERANGE = '30m';

const TimespanDropdown: React.FC = () => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  const { perspective } = usePerspective();

  const [isModalOpen, , setModalOpen, setModalClosed] = useBoolean(false);

  const timespan = useSelector((state: MonitoringState) =>
    getLegacyObserveState(perspective, state)?.getIn(['dashboards', perspective, 'timespan']),
  );
  const endTime = useSelector((state: MonitoringState) =>
    getLegacyObserveState(perspective, state)?.getIn(['dashboards', perspective, 'endTime']),
  );

  const [timeRangeFromParams, setTimeRange] = useQueryParam(QueryParams.TimeRange, NumberParam);
  const [endTimeFromParams] = useQueryParam(QueryParams.EndTime, NumberParam);

  const selectedKey =
    endTime || endTimeFromParams
      ? CUSTOM_TIME_RANGE_KEY
      : formatPrometheusDuration(_.toNumber(timeRangeFromParams) || timespan);

  const dispatch = useDispatch();
  const onChange = React.useCallback(
    (v: string) => {
      if (v === CUSTOM_TIME_RANGE_KEY) {
        setModalOpen();
      } else {
        setTimeRange(parsePrometheusDuration(v));
        removeQueryArgument(QueryParams.EndTime);
        dispatch(dashboardsSetTimespan(parsePrometheusDuration(v), perspective));
        dispatch(dashboardsSetEndTime(null, perspective));
      }
    },
    [setModalOpen, dispatch, perspective, setTimeRange],
  );

  const initialOptions = React.useMemo<SimpleSelectOption[]>(() => {
    const intervalOptions: SimpleSelectOption[] = [
      { content: t('Custom time range'), value: CUSTOM_TIME_RANGE_KEY },
      { content: t('Last {{count}} minute', { count: 5 }), value: '5m' },
      { content: t('Last {{count}} minute', { count: 15 }), value: '15m' },
      { content: t('Last {{count}} minute', { count: 30 }), value: '30m' },
      { content: t('Last {{count}} hour', { count: 1 }), value: '1h' },
      { content: t('Last {{count}} hour', { count: 2 }), value: '2h' },
      { content: t('Last {{count}} hour', { count: 6 }), value: '6h' },
      { content: t('Last {{count}} hour', { count: 12 }), value: '12h' },
      { content: t('Last {{count}} day', { count: 1 }), value: '1d' },
      { content: t('Last {{count}} day', { count: 2 }), value: '2d' },
      { content: t('Last {{count}} week', { count: 1 }), value: '1w' },
      { content: t('Last {{count}} week', { count: 2 }), value: '2w' },
    ];

    // If selectedKey is empty, the dashboard has changed. Reset selected to default value.
    if (selectedKey === '') {
      setQueryArgument(QueryParams.TimeRange, DEFAULT_TIMERANGE);
      removeQueryArgument(QueryParams.EndTime);
    }
    return intervalOptions.map((o) => ({ ...o, selected: o.value === selectedKey }));
  }, [selectedKey, t]);

  return (
    <>
      <CustomTimeRangeModal
        perspective={perspective}
        isOpen={isModalOpen}
        setClosed={setModalClosed}
      />
      <div className="form-group monitoring-dashboards__dropdown-wrap">
        <label
          className="monitoring-dashboards__dropdown-title"
          htmlFor="monitoring-time-range-dropdown"
        >
          {t('Time range')}
        </label>
        <SimpleSelect
          id="monitoring-time-range-dropdown"
          initialOptions={initialOptions}
          className="monitoring-dashboards__variable-dropdown"
          onSelect={(_event, selection) => {
            if (selection) {
              onChange(String(selection));
            }
          }}
          toggleWidth="150px"
          placeholder={t('Last {{count}} minute', { count: 30 })}
        />
      </div>
    </>
  );
};

const PollIntervalDropdown: React.FC = () => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const { perspective } = usePerspective();
  const [selectedInterval, setSelectedInterval] = React.useState(null);

  const dispatch = useDispatch();
  const [refreshInterval, setRefreshInterval] = useQueryParam(
    QueryParams.RefreshInterval,
    NumberParam,
  );
  const setInterval = React.useCallback(
    (v: number) => {
      if (v) {
        setSelectedInterval(v);
      } else {
        removeQueryArgument(QueryParams.RefreshInterval);
      }
      dispatch(dashboardsSetPollInterval(v, perspective));
    },
    [dispatch, perspective],
  );

  React.useEffect(() => {
    if (!refreshInterval) {
      setRefreshInterval(DEFAULT_REFRESH_INTERVAL);
    }
  }, [refreshInterval, setRefreshInterval]);

  return (
    <div className="form-group monitoring-dashboards__dropdown-wrap">
      <label htmlFor="refresh-interval-dropdown" className="monitoring-dashboards__dropdown-title">
        {t('Refresh interval')}
      </label>
      <DropDownPollInterval
        id="refresh-interval-dropdown"
        setInterval={setInterval}
        selectedInterval={selectedInterval}
      />
    </div>
  );
};

export const TimeDropdowns: React.FC = React.memo(() => {
  return (
    <div className="monitoring-dashboards__options">
      <TimespanDropdown />
      <PollIntervalDropdown />
    </div>
  );
});
