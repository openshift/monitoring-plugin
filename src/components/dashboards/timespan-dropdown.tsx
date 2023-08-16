import * as _ from 'lodash';
import { Dropdown, DropdownToggle, DropdownItem } from '@patternfly/react-core';
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
import { TimeDropdownsProps } from './types';
import { getActivePerspective } from './monitoring-dashboard-utils';

const CUSTOM_TIME_RANGE_KEY = 'CUSTOM_TIME_RANGE_KEY';

const TimespanDropdown: React.FC<TimeDropdownsProps> = ({ namespace }) => {
  const { t } = useTranslation('plugin__monitoring-plugin');

  const activePerspective = getActivePerspective(namespace);

  const [isOpen, toggleIsOpen, , setClosed] = useBoolean(false);
  const [isModalOpen, , setModalOpen, setModalClosed] = useBoolean(false);

  const timespan = useSelector(({ observe }: RootState) =>
    observe.getIn(['dashboards', activePerspective, 'timespan']),
  );
  const endTime = useSelector(({ observe }: RootState) =>
    observe.getIn(['dashboards', activePerspective, 'endTime']),
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
        dispatch(dashboardsSetTimespan(parsePrometheusDuration(v), activePerspective));
        dispatch(dashboardsSetEndTime(null, activePerspective));
      }
    },
    [activePerspective, dispatch, setModalOpen],
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

  return (
    <>
      <CustomTimeRangeModal
        activePerspective={activePerspective}
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
        <Dropdown
          className="monitoring-dashboards__variable-dropdown"
          dropdownItems={_.map(items, (name, key) => (
            <DropdownItem component="button" key={key} onClick={() => onChange(key)}>
              {name}
            </DropdownItem>
          ))}
          isOpen={isOpen}
          onSelect={setClosed}
          toggle={
            <DropdownToggle
              className="monitoring-dashboards__dropdown-button"
              id="monitoring-time-range-dropdown"
              onToggle={toggleIsOpen}
            >
              {
                items[
                  endTime || endTimeFromParams
                    ? CUSTOM_TIME_RANGE_KEY
                    : formatPrometheusDuration(_.toNumber(timeSpanFromParams) || timespan)
                ]
              }
            </DropdownToggle>
          }
        />
      </div>
    </>
  );
};

export default TimespanDropdown;
