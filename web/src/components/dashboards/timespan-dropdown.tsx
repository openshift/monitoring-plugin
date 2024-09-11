import * as _ from 'lodash';
// TODO: These will be available in future versions of the plugin SDK
import { formatPrometheusDuration, parsePrometheusDuration } from '../console/utils/datetime';
import {
  Select,
  SelectList,
  SelectOption,
  MenuToggle,
  MenuToggleElement,
} from '@patternfly/react-core';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

// TODO: These will be available in future versions of the plugin SDK
import { formatPrometheusDuration, parsePrometheusDuration } from '../console/utils/datetime';

import { getQueryArgument, removeQueryArgument, setQueryArgument } from '../console/utils/router';

import { dashboardsSetEndTime, dashboardsSetTimespan } from '../../actions/observe';
import { useBoolean } from '../hooks/useBoolean';
import { RootState } from '../types';
import CustomTimeRangeModal from './custom-time-range-modal';
import { usePerspective } from '../hooks/usePerspective';

const CUSTOM_TIME_RANGE_KEY = 'CUSTOM_TIME_RANGE_KEY';

const TimespanDropdown: React.FC = () => {
  const { t } = useTranslation('plugin__monitoring-plugin');

  const { perspective } = usePerspective();

  const [isOpen, toggleIsOpen, setOpen, setClosed] = useBoolean(false);
  const [isModalOpen, , setModalOpen, setModalClosed] = useBoolean(false);

  const timespan = useSelector(({ observe }: RootState) =>
    observe.getIn(['dashboards', perspective, 'timespan']),
  );
  const endTime = useSelector(({ observe }: RootState) =>
    observe.getIn(['dashboards', perspective, 'endTime']),
  );

  const timeSpanFromParams = getQueryArgument('timeRange');
  const endTimeFromParams = getQueryArgument('endTime');

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
      }
    },
    [perspective, dispatch, setModalOpen],
  );

  const items = {
    [CUSTOM_TIME_RANGE_KEY]: t('Custom time range'),
    '5m': t('Last {{count}} minute', { count: 5 }),
    '15m': t('Last {{count}} minute', { count: 15 }),
    '30m': t('Last {{count}} minute', { count: 30 }),
    '1h': t('Last {{count}} hour', { count: 1 }),
    '2h': t('Last {{count}} hour', { count: 2 }),
    '6h': t('Last {{count}} hour', { count: 6 }),
    '12h': t('Last {{count}} hour', { count: 12 }),
    '1d': t('Last {{count}} day', { count: 1 }),
    '2d': t('Last {{count}} day', { count: 2 }),
    '1w': t('Last {{count}} week', { count: 1 }),
    '2w': t('Last {{count}} week', { count: 2 }),
  };

  const selectedKey =
    endTime || endTimeFromParams
      ? CUSTOM_TIME_RANGE_KEY
      : formatPrometheusDuration(_.toNumber(timeSpanFromParams) || timespan);

  const toggle = (toggleRef: React.Ref<MenuToggleElement>) => (
    <MenuToggle
      id="monitoring-time-range-dropdown"
      onClick={toggleIsOpen}
      isExpanded={isOpen}
      ref={toggleRef}
      className="monitoring-dashboards__dropdown-button"
    >
      {items[selectedKey]}
    </MenuToggle>
  );

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
        <Select
          className="monitoring-dashboards__variable-dropdown"
          isOpen={isOpen}
          onSelect={(_event, value) => {
            if (value) {
              onChange(value);
            }
            setClosed();
          }}
          toggle={toggle}
          onOpenChange={(open) => (open ? setOpen() : setClosed())}
        >
          <SelectList>
            {_.map(items, (name, key) => (
              <SelectOption key={key} value={key} isSelected={selectedKey === key}>
                {name}
              </SelectOption>
            ))}
          </SelectList>
        </Select>
      </div>
    </>
  );
};

export default TimespanDropdown;
