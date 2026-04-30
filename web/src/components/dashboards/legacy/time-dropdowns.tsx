import { Stack, StackItem } from '@patternfly/react-core';
import { SimpleSelect, SimpleSelectOption } from '@patternfly/react-templates';
import type { FC } from 'react';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { NumberParam, useQueryParam } from 'use-query-params';
import {
  formatPrometheusDuration,
  parsePrometheusDuration,
} from '../../console/console-shared/src/datetime/prometheus';
import { DropDownPollInterval } from '../../dropdown-poll-interval';
import { useBoolean } from '../../hooks/useBoolean';
import { QueryParams } from '../../query-params';
import CustomTimeRangeModal from './custom-time-range-modal';
import { LegacyDashboardPageTestIDs } from '../../data-test';
import { RefreshIntervalParam, TimeRangeParam } from './utils';

const CUSTOM_TIME_RANGE_KEY = 'CUSTOM_TIME_RANGE_KEY';
const DEFAULT_TIMERANGE = '30m';

export const TimespanDropdown: FC = () => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  const [isModalOpen, , setModalOpen, setModalClosed] = useBoolean(false);

  const [timeRange, setTimeRange] = useQueryParam(QueryParams.TimeRange, TimeRangeParam);
  const [endTime, setEndTime] = useQueryParam(QueryParams.EndTime, NumberParam);

  const selectedKey = endTime ? CUSTOM_TIME_RANGE_KEY : formatPrometheusDuration(timeRange);

  const onChange = useCallback(
    (v: string) => {
      if (v === CUSTOM_TIME_RANGE_KEY) {
        setModalOpen();
      } else {
        setTimeRange(parsePrometheusDuration(v));
        setEndTime(undefined);
      }
    },
    [setModalOpen, setTimeRange, setEndTime],
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
    if (selectedKey === '' || (selectedKey === DEFAULT_TIMERANGE && !timeRange)) {
      setTimeRange(parsePrometheusDuration(DEFAULT_TIMERANGE));
      setEndTime(undefined);
    }
    return intervalOptions.map((o) => ({ ...o, selected: o.value === selectedKey }));
  }, [selectedKey, t, timeRange, setTimeRange, setEndTime]);

  const defaultTimerange = timeRange ?? undefined;
  let defaultEndTime = Number(endTime);
  if (Number.isNaN(defaultEndTime)) {
    defaultEndTime = undefined;
  }

  return (
    <>
      <CustomTimeRangeModal
        isOpen={isModalOpen}
        setClosed={setModalClosed}
        timespan={defaultTimerange}
        endTime={defaultEndTime}
      />
      <Stack>
        <StackItem>
          <label htmlFor="monitoring-time-range-dropdown">{t('Time range')}</label>
        </StackItem>
        <StackItem data-test={LegacyDashboardPageTestIDs.TimeRangeDropdown}>
          <SimpleSelect
            id="monitoring-time-range-dropdown"
            initialOptions={initialOptions}
            onSelect={(_event, selection) => {
              if (selection) {
                onChange(String(selection));
              }
            }}
            placeholder={t('Last {{count}} minute', { count: 30 })}
            data-test={LegacyDashboardPageTestIDs.TimeRangeDropdownOptions}
          />
        </StackItem>
      </Stack>
    </>
  );
};

export const PollIntervalDropdown: FC = () => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const [refreshInterval, setRefreshInterval] = useQueryParam(
    QueryParams.RefreshInterval,
    RefreshIntervalParam,
  );

  return (
    <Stack>
      <StackItem>
        <label htmlFor="refresh-interval-dropdown">{t('Refresh interval')}</label>
      </StackItem>
      <StackItem data-test={LegacyDashboardPageTestIDs.PollIntervalDropdown}>
        <DropDownPollInterval
          id="refresh-interval-dropdown"
          setInterval={setRefreshInterval}
          selectedInterval={refreshInterval}
          data-test={LegacyDashboardPageTestIDs.PollIntervalDropdownOptions}
        />
      </StackItem>
    </Stack>
  );
};
