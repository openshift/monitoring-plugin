import type { FunctionComponent } from 'react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  formatPrometheusDuration,
  parsePrometheusDuration,
} from './console/console-shared/src/datetime/prometheus';
import { SimpleSelect, SimpleSelectOption } from '@patternfly/react-templates';
import { LegacyDashboardPageTestIDs } from './data-test';

type DropDownPollIntervalProps = {
  setInterval: (v: number) => void;
  selectedInterval: number;
  id?: string;
};

export const DEFAULT_REFRESH_INTERVAL = parsePrometheusDuration('30s');
const OFF_KEY = 'OFF_KEY';

export const DropDownPollInterval: FunctionComponent<DropDownPollIntervalProps> = ({
  id,
  setInterval,
  selectedInterval,
}) => {
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
      onSelect={(_ev, selection) => onSelect(_ev, selection)}
      toggleWidth="150px"
      data-test={LegacyDashboardPageTestIDs.PollIntervalDropdownOptions}
    />
  );
};
