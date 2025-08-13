import { Stack, StackItem } from '@patternfly/react-core';
import { SimpleSelect, SimpleSelectOption } from '@patternfly/react-templates';
import * as _ from 'lodash-es';
import type { FC } from 'react';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { NumberParam, useQueryParam } from 'use-query-params';
import {
  dashboardsSetEndTime,
  dashboardsSetPollInterval,
  dashboardsSetTimespan,
} from '../../../actions/observe';
import { MonitoringState } from '../../../reducers/observe';
import {
  formatPrometheusDuration,
  parsePrometheusDuration,
} from '../../console/console-shared/src/datetime/prometheus';
import { DEFAULT_REFRESH_INTERVAL, DropDownPollInterval } from '../../dropdown-poll-interval';
import { useBoolean } from '../../hooks/useBoolean';
import { getLegacyObserveState, usePerspective } from '../../hooks/usePerspective';
import { QueryParams } from '../../query-params';
import CustomTimeRangeModal from './custom-time-range-modal';

const CUSTOM_TIME_RANGE_KEY = 'CUSTOM_TIME_RANGE_KEY';
const DEFAULT_TIMERANGE = '30m';

export const TimespanDropdown: FC = () => {
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
  const [endTimeFromParams, setEndTime] = useQueryParam(QueryParams.EndTime, NumberParam);

  const selectedKey =
    endTime || endTimeFromParams
      ? CUSTOM_TIME_RANGE_KEY
      : formatPrometheusDuration(_.toNumber(timeRangeFromParams) || timespan);

  const dispatch = useDispatch();
  const onChange = useCallback(
    (v: string) => {
      if (v === CUSTOM_TIME_RANGE_KEY) {
        setModalOpen();
      } else {
        setTimeRange(parsePrometheusDuration(v));
        setEndTime(undefined);
        dispatch(dashboardsSetTimespan(parsePrometheusDuration(v), perspective));
        dispatch(dashboardsSetEndTime(null, perspective));
      }
    },
    [setModalOpen, dispatch, perspective, setTimeRange, setEndTime],
  );

  const initialOptions = useMemo<SimpleSelectOption[]>(() => {
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
    if (selectedKey === '' || (selectedKey === DEFAULT_TIMERANGE && !timeRangeFromParams)) {
      setTimeRange(parsePrometheusDuration(DEFAULT_TIMERANGE));
      setEndTime(undefined);
    }
    return intervalOptions.map((o) => ({ ...o, selected: o.value === selectedKey }));
  }, [selectedKey, t, timeRangeFromParams, setTimeRange, setEndTime]);

  const defaultTimerange = timespan ?? undefined;
  const defaultEndTime = endTime ?? undefined;

  return (
    <>
      <CustomTimeRangeModal
        perspective={perspective}
        isOpen={isModalOpen}
        setClosed={setModalClosed}
        timespan={defaultTimerange}
        endTime={defaultEndTime}
      />
      <Stack>
        <StackItem>
          <label htmlFor="monitoring-time-range-dropdown">{t('Time range')}</label>
        </StackItem>
        <StackItem>
          <SimpleSelect
            id="monitoring-time-range-dropdown"
            initialOptions={initialOptions}
            onSelect={(_event, selection) => {
              if (selection) {
                onChange(String(selection));
              }
            }}
            placeholder={t('Last {{count}} minute', { count: 30 })}
          />
        </StackItem>
      </Stack>
    </>
  );
};

export const PollIntervalDropdown: FC = () => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const { perspective } = usePerspective();
  const [selectedInterval, setSelectedInterval] = useState(DEFAULT_REFRESH_INTERVAL);

  const dispatch = useDispatch();
  const [, setRefreshInterval] = useQueryParam(QueryParams.RefreshInterval, NumberParam);

  const setInterval = useCallback(
    (v: number) => {
      setSelectedInterval(v);
      setRefreshInterval(v);
      dispatch(dashboardsSetPollInterval(v, perspective));
    },
    [dispatch, perspective, setRefreshInterval],
  );

  return (
    <Stack>
      <StackItem>
        <label htmlFor="refresh-interval-dropdown">{t('Refresh interval')}</label>
      </StackItem>
      <StackItem>
        <DropDownPollInterval
          id="refresh-interval-dropdown"
          setInterval={setInterval}
          selectedInterval={selectedInterval}
        />
      </StackItem>
    </Stack>
  );
};
