import { SimpleSelect, SimpleSelectOption } from '@patternfly/react-templates';
import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import {
  formatPrometheusDuration,
  parsePrometheusDuration,
} from '@/shared/console/console-shared/src/datetime/prometheus';
import { LegacyDashboardPageTestIDs } from '@/shared/constants/data-test';

type DropDownPollIntervalProps = {
  setInterval: (v: number) => void;
  selectedInterval: number;
  id?: string;
  formatToggleContent?: (label: ReactNode, interval: number) => ReactNode;
  toggleWidth?: string;
};

export const DEFAULT_REFRESH_INTERVAL = parsePrometheusDuration('30s');
const OFF_KEY = 'OFF_KEY';

export function DropDownPollInterval({
  id,
  setInterval,
  selectedInterval,
  formatToggleContent,
  toggleWidth = '150px',
}: DropDownPollIntervalProps) {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  const selectedKey = selectedInterval ? formatPrometheusDuration(selectedInterval) : OFF_KEY;

  const initialOptions = useMemo<SimpleSelectOption[]>(() => {
    const intervalOptions: SimpleSelectOption[] = [
      { content: t('Refresh off'), value: OFF_KEY },
      { content: t('{{count}} second', { count: 15 }), value: '15s' },
      { content: t('{{count}} second', { count: 30 }), value: '30s' },
      { content: t('{{count}} minute', { count: 1 }), value: '1m' },
      { content: t('{{count}} minute', { count: 15 }), value: '15m' },
      { content: t('{{count}} hour', { count: 1 }), value: '1h' },
      { content: t('{{count}} hour', { count: 2 }), value: '2h' },
      { content: t('{{count}} day', { count: 1 }), value: '1d' },
    ];
    return intervalOptions.map((o) => ({ ...o, selected: o.value === selectedKey }));
  }, [selectedKey, t]);

  const onSelect = (_ev, selection) => {
    setInterval(parsePrometheusDuration(String(selection)));
  };

  return (
    <SimpleSelect
      id={id}
      initialOptions={initialOptions}
      toggleContent={formatToggleContent?.(
        initialOptions.find((option) => option.value === selectedKey)?.content,
        selectedInterval,
      )}
      onSelect={(_ev, selection) => onSelect(_ev, selection)}
      toggleWidth={toggleWidth}
      data-test={LegacyDashboardPageTestIDs.PollIntervalDropdownOptions}
    />
  );
}
