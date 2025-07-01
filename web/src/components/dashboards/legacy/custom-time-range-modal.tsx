import {
  Button,
  DatePicker,
  Flex,
  FlexItem,
  Modal,
  ModalVariant,
  TimePicker,
} from '@patternfly/react-core';
import * as _ from 'lodash-es';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';

import { dashboardsSetEndTime, dashboardsSetTimespan, Perspective } from '../../../actions/observe';

import { NumberParam, useQueryParam } from 'use-query-params';
import { QueryParams } from '../../query-params';

const zeroPad = (number: number) => (number < 10 ? `0${number}` : number);

// Get YYYY-MM-DD date string for a date object
const toISODateString = (date: Date): string =>
  `${date.getFullYear()}-${zeroPad(date.getMonth() + 1)}-${zeroPad(date.getDate())}`;

// Get HH:MM time string for a date object
const toISOTimeString = (date: Date): string =>
  new Intl.DateTimeFormat(
    'en',
    // TODO: TypeScript 3 doesn't allow the `hourCycle` attribute so use "as any" until we upgrade
    { hour: 'numeric', minute: 'numeric', hourCycle: 'h23' } as any,
  ).format(date);

type CustomTimeRangeModalProps = {
  perspective: Perspective;
  isOpen: boolean;
  setClosed: () => void;
  timespan?: number;
  endTime?: number;
};

const CustomTimeRangeModal: React.FC<CustomTimeRangeModalProps> = ({
  perspective,
  isOpen,
  setClosed,
  timespan,
  endTime,
}) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const [, setEndTime] = useQueryParam(QueryParams.EndTime, NumberParam);
  const [, setTimeRange] = useQueryParam(QueryParams.TimeRange, NumberParam);

  const dispatch = useDispatch();

  // If a time is already set in Redux, default to that, otherwise default to a time range that
  // covers all of today
  const now = new Date();
  const defaultFrom = endTime && timespan ? new Date(endTime - timespan) : undefined;
  const [fromDate, setFromDate] = React.useState(toISODateString(defaultFrom ?? now));
  const [fromTime, setFromTime] = React.useState(
    defaultFrom ? toISOTimeString(defaultFrom) : '00:00',
  );
  const [toDate, setToDate] = React.useState(toISODateString(endTime ? new Date(endTime) : now));
  const [toTime, setToTime] = React.useState(
    endTime ? toISOTimeString(new Date(endTime)) : '23:59',
  );

  const submit: React.MouseEventHandler<HTMLButtonElement> = () => {
    const from = Date.parse(`${fromDate} ${fromTime}`);
    const to = Date.parse(`${toDate} ${toTime}`);
    if (_.isInteger(from) && _.isInteger(to)) {
      dispatch(dashboardsSetEndTime(to, perspective));
      dispatch(dashboardsSetTimespan(to - from, perspective));
      setEndTime(Number(to.toString()));
      setTimeRange(Number((to - from).toString()));
      setClosed();
    }
  };

  return (
    <Modal
      hasNoBodyWrapper
      isOpen={isOpen}
      position="top"
      showClose={false}
      title={t('Custom time range')}
      variant={ModalVariant.small}
    >
      <Flex className="custom-time-range-modal" direction={{ default: 'column' }}>
        <FlexItem spacer={{ default: 'spacerNone' }}>
          <label>{t('From')}</label>
        </FlexItem>
        <Flex>
          <FlexItem>
            <DatePicker onChange={(event, str) => setFromDate(str)} value={fromDate} />
          </FlexItem>
          <FlexItem>
            <TimePicker is24Hour onChange={(event, text) => setFromTime(text)} time={fromTime} />
          </FlexItem>
        </Flex>
        <FlexItem spacer={{ default: 'spacerNone' }}>
          <label>{t('To')}</label>
        </FlexItem>
        <Flex>
          <FlexItem>
            <DatePicker onChange={(event, str) => setToDate(str)} value={toDate} />
          </FlexItem>
          <FlexItem>
            <TimePicker is24Hour onChange={(event, text) => setToTime(text)} time={toTime} />
          </FlexItem>
        </Flex>
        <Flex className="custom-time-range-modal-footer">
          <FlexItem align={{ default: 'alignRight' }}>
            <Button variant="secondary" onClick={setClosed}>
              {t('Cancel')}
            </Button>
          </FlexItem>
          <FlexItem>
            <Button variant="primary" onClick={submit}>
              {t('Save')}
            </Button>
          </FlexItem>
        </Flex>
      </Flex>
    </Modal>
  );
};

export default CustomTimeRangeModal;
