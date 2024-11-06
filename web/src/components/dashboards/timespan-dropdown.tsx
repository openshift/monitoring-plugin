import * as _ from 'lodash';
// TODO: These will be available in future versions of the plugin SDK
import { formatPrometheusDuration, parsePrometheusDuration } from '../console/utils/datetime';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { getQueryArgument, removeQueryArgument, setQueryArgument } from '../console/utils/router';
import { dashboardsSetEndTime, dashboardsSetTimespan } from '../../actions/observe';
import { useBoolean } from '../hooks/useBoolean';
import CustomTimeRangeModal from './custom-time-range-modal';
import { getObserveState, usePerspective } from '../hooks/usePerspective';
import { SimpleSelect, SimpleSelectOption } from '../SimpleSelect';
import { MonitoringState } from '../../reducers/observe';

const CUSTOM_TIME_RANGE_KEY = 'CUSTOM_TIME_RANGE_KEY';
const DEFAULT_TIMERANGE = '30m';

const TimespanDropdown: React.FC = () => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  const { perspective } = usePerspective();

  const [isModalOpen, , setModalOpen, setModalClosed] = useBoolean(false);
  const [selected, setSelected] = React.useState<string | undefined>(DEFAULT_TIMERANGE);

  const timespan = useSelector((state: MonitoringState) =>
    getObserveState(perspective, state)?.getIn(['dashboards', perspective, 'timespen']),
  );
  const endTime = useSelector((state: MonitoringState) =>
    getObserveState(perspective, state)?.getIn(['dashboards', perspective, 'endTime']),
  );

  const timeSpanFromParams = getQueryArgument('timeRange');
  const endTimeFromParams = getQueryArgument('endTime');

  const selectedKey =
    endTime || endTimeFromParams
      ? CUSTOM_TIME_RANGE_KEY
      : formatPrometheusDuration(_.toNumber(timeSpanFromParams) || timespan);

  const dispatch = useDispatch();
  const onChange = React.useCallback(
    (v: string) => {
      if (v === CUSTOM_TIME_RANGE_KEY) {
        setModalOpen();
      } else {
        setQueryArgument('timeRange', parsePrometheusDuration(v).toString());
        removeQueryArgument('endTime');
        dispatch(dashboardsSetTimespan(parsePrometheusDuration(v), perspective));
        dispatch(dashboardsSetEndTime(null, perspective));
        setSelected(v);
      }
    },
    [setModalOpen, dispatch, perspective],
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
      setSelected(DEFAULT_TIMERANGE);
    }
    return intervalOptions.map((o) => ({ ...o, selected: o.value === selected }));
  }, [selected, selectedKey, t]);

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

export default TimespanDropdown;
