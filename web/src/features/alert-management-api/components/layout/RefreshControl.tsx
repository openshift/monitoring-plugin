import { Flex, FlexItem } from '@patternfly/react-core';
import { ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { DropDownPollInterval } from '@/shared/components/DropdownPollInterval';
import { DataTestIDs } from '@/shared/constants/data-test';

export type RefreshControlProps = {
  intervalMs: number | false;
  onIntervalChange: (interval: number) => void;
  lastRefreshedAt: number;
};

function LastRefreshTimestamp({
  lastRefreshedAt,
  format,
}: {
  lastRefreshedAt: number;
  format: (timestamp: number) => ReactNode;
}) {
  const [pageLoadedAt] = useState(() => Date.now());
  return <span>{format(lastRefreshedAt || pageLoadedAt)}</span>;
}

export function RefreshControl({
  intervalMs,
  onIntervalChange,
  lastRefreshedAt,
  pageKey,
}: RefreshControlProps & { pageKey: string }) {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  return (
    <Flex
      direction={{ default: 'column' }}
      alignItems={{ default: 'alignItemsCenter' }}
      spaceItems={{ default: 'spaceItemsNone' }}
    >
      <FlexItem>
        <DropDownPollInterval
          id={DataTestIDs.AlertManagementAPI.RefreshIntervalSelect}
          selectedInterval={intervalMs || 0}
          setInterval={onIntervalChange}
          toggleWidth="200px"
          formatToggleContent={(label, selectedInterval) =>
            selectedInterval
              ? t('Every {{interval}}', { interval: String(label) })
              : t('Refresh off')
          }
        />
      </FlexItem>
      <FlexItem>
        <LastRefreshTimestamp
          key={pageKey}
          lastRefreshedAt={lastRefreshedAt}
          format={(timestamp) =>
            t('Last refresh: {{time}}', { time: new Date(timestamp).toLocaleTimeString() })
          }
        />
      </FlexItem>
    </Flex>
  );
}
