import React from 'react';
import { SimpleSelect, SimpleSelectOption } from './SimpleSelect';
import { formatPrometheusDuration, parsePrometheusDuration } from './console/utils/datetime';
import { useTranslation } from 'react-i18next';

type DropDownPollIntervalProps = {
  setInterval: (v: number) => void;
  selectedInterval: string | undefined;
  id?: string;
};

export const DEFAULT_REFRESH_INTERVAL = parsePrometheusDuration('30s');

export const DropDownPollInterval: React.FunctionComponent<DropDownPollIntervalProps> = ({
  id,
  setInterval,
  selectedInterval,
}) => {
  const OFF_KEY = 'OFF_KEY';
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  const selectedKey = formatPrometheusDuration(Number(selectedInterval));

  const initialOptions = React.useMemo<SimpleSelectOption[]>(() => {
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

  React.useEffect(() => {
    if (!selectedInterval) {
      setInterval(DEFAULT_REFRESH_INTERVAL);
    }
  }, [selectedInterval, setInterval]);

  return (
    <SimpleSelect
      id={id}
      initialOptions={initialOptions}
      onSelect={(_ev, selection) => onSelect(_ev, selection)}
      className="monitoring-dashboards__variable-dropdown"
      toggleWidth="150px"
    />
  );
};
