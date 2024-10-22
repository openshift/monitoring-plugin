import React from 'react';
import { SimpleSelect, SimpleSelectOption } from './SimpleSelect';
import { useDispatch } from 'react-redux';
import { queryBrowserSetPollInterval } from '../actions/observe';
import { parsePrometheusDuration } from './console/utils/datetime';
import { useTranslation } from 'react-i18next';

export const DropDownPollInterval: React.FunctionComponent = () => {
  const OFF_KEY = 'OFF_KEY';
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const [selected, setSelected] = React.useState<string | undefined>(OFF_KEY);

  const dispatch = useDispatch();

  const setInterval = React.useCallback(
    (v: number) => dispatch(queryBrowserSetPollInterval(v)),
    [dispatch],
  );

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
    return intervalOptions.map((o) => ({ ...o, selected: o.value === selected }));
  }, [selected, t]);

  const onSelect = (_ev, selection) => {
    setSelected(String(selection));
    setInterval(parsePrometheusDuration(String(selection)));
  };

  return (
    <SimpleSelect
      initialOptions={initialOptions}
      onSelect={(_ev, selection) => onSelect(_ev, selection)}
      placeholder={t('Refresh off')}
      className="monitoring-dashboards__variable-dropdown"
      toggleWidth="150px"
    />
  );
};
