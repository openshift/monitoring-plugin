import { Stack, StackItem } from '@patternfly/react-core';
import type { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryParam } from 'use-query-params';

import { DropDownPollInterval } from '@/shared/components/DropdownPollInterval';
import { TimeRangeSelect } from '@/shared/components/TimeRangeSelect';
import { LegacyDashboardPageTestIDs } from '@/shared/constants/data-test';
import { QueryParams } from '@/shared/constants/query-params';
import { RefreshIntervalParam } from '@/shared/constants/timespan';

export const TimespanDropdown: FC = () => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  return (
    <Stack>
      <StackItem>
        <label htmlFor={LegacyDashboardPageTestIDs.TimeRangeDropdown}>{t('Time range')}</label>
      </StackItem>
      <StackItem data-test={LegacyDashboardPageTestIDs.TimeRangeDropdown}>
        <TimeRangeSelect
          id={LegacyDashboardPageTestIDs.TimeRangeDropdown}
          dataTest={LegacyDashboardPageTestIDs.TimeRangeDropdownOptions}
        />
      </StackItem>
    </Stack>
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
        <label htmlFor={LegacyDashboardPageTestIDs.PollIntervalDropdown}>
          {t('Refresh interval')}
        </label>
      </StackItem>
      <StackItem data-test={LegacyDashboardPageTestIDs.PollIntervalDropdown}>
        <DropDownPollInterval
          id={LegacyDashboardPageTestIDs.PollIntervalDropdown}
          setInterval={setRefreshInterval}
          selectedInterval={refreshInterval}
          data-test={LegacyDashboardPageTestIDs.PollIntervalDropdownOptions}
        />
      </StackItem>
    </Stack>
  );
};
