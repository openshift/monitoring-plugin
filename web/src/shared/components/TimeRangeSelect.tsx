import {
  Button,
  DatePicker,
  Form,
  FormGroup,
  InputGroup,
  InputGroupItem,
  MenuToggleProps,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalVariant,
  TimePicker,
} from '@patternfly/react-core';
import { SimpleSelect, SimpleSelectOption } from '@patternfly/react-templates';
import { FC, MouseEventHandler, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NumberParam, useQueryParams } from 'use-query-params';

import {
  formatPrometheusDuration,
  parsePrometheusDuration,
} from '@/shared/console/console-shared/src/datetime/prometheus';
import { DataTestIDs } from '@/shared/constants/data-test';
import { QueryParams } from '@/shared/constants/query-params';
import { TimeRangeParam } from '@/shared/constants/timespan';
import { useBoolean } from '@/shared/hooks/useBoolean';
import { padNumber } from '@/shared/utils/date';

const CUSTOM_TIME_RANGE_KEY = 'CUSTOM_TIME_RANGE_KEY';
const DEFAULT_TIMERANGE = '30m';

type Props = {
  id?: string;
  toggleWidth?: string;
  toggleProps?: MenuToggleProps;
  dataTest?: string;
};

export const TimeRangeSelect = ({ id, toggleWidth, toggleProps, dataTest }: Props) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  const [isModalOpen, , setModalOpen, setModalClosed] = useBoolean(false);

  const [queryParams, setQueryParams] = useQueryParams({
    [QueryParams.TimeRange]: TimeRangeParam,
    [QueryParams.EndTime]: NumberParam,
  });
  const timeRange = queryParams[QueryParams.TimeRange];
  const endTime = queryParams[QueryParams.EndTime];
  const selectedKey = endTime ? CUSTOM_TIME_RANGE_KEY : formatPrometheusDuration(timeRange);

  const options = useMemo<SimpleSelectOption[]>(() => {
    const choices = [
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

    if (selectedKey === '' || (selectedKey === DEFAULT_TIMERANGE && !timeRange)) {
      setQueryParams({
        [QueryParams.TimeRange]: parsePrometheusDuration(DEFAULT_TIMERANGE),
        [QueryParams.EndTime]: undefined,
      });
    }

    return choices.map((choice) => ({ ...choice, selected: choice.value === selectedKey }));
  }, [selectedKey, t, setQueryParams, timeRange]);

  const onChange = useCallback(
    (v: string) => {
      if (v === CUSTOM_TIME_RANGE_KEY) {
        setModalOpen();
      } else {
        setQueryParams({
          [QueryParams.TimeRange]: parsePrometheusDuration(v),
          [QueryParams.EndTime]: undefined,
        });
      }
    },
    [setModalOpen, setQueryParams],
  );

  const defaultTimerange = timeRange ?? undefined;
  let defaultEndTime = Number(endTime);
  if (Number.isNaN(defaultEndTime)) {
    defaultEndTime = undefined;
  }

  return (
    <>
      <SimpleSelect
        id={id}
        initialOptions={options}
        onSelect={(_event, selection) => {
          if (selection) {
            onChange(String(selection));
          }
        }}
        placeholder={t('Last {{count}} minute', { count: 30 })}
        toggleWidth={toggleWidth}
        toggleProps={toggleProps}
        data-test={dataTest}
      />
      {isModalOpen && (
        <CustomTimeRangeModal
          isOpen={isModalOpen}
          setClosed={setModalClosed}
          timespan={defaultTimerange}
          endTime={defaultEndTime}
        />
      )}
    </>
  );
};

const toISODateString = (date: Date): string =>
  `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-${padNumber(date.getDate())}`;

const toISOTimeString = (date: Date): string =>
  new Intl.DateTimeFormat('en', { hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).format(
    date,
  );

type CustomTimeRangeModalProps = {
  isOpen: boolean;
  setClosed: () => void;
  timespan?: number;
  endTime?: number;
};

const CustomTimeRangeModal: FC<CustomTimeRangeModalProps> = ({
  isOpen,
  setClosed,
  timespan,
  endTime,
}) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const [, setQueryParams] = useQueryParams({
    [QueryParams.TimeRange]: TimeRangeParam,
    [QueryParams.EndTime]: NumberParam,
  });

  // If a time is already set in Redux, default to that, otherwise default to a time range that
  // covers all of today
  const now = new Date();
  const defaultFrom = endTime && timespan ? new Date(endTime - timespan) : undefined;
  const [fromDate, setFromDate] = useState(toISODateString(defaultFrom ?? now));
  const [fromTime, setFromTime] = useState(defaultFrom ? toISOTimeString(defaultFrom) : '00:00');
  const [toDate, setToDate] = useState(toISODateString(endTime ? new Date(endTime) : now));
  const [toTime, setToTime] = useState(endTime ? toISOTimeString(new Date(endTime)) : '23:59');
  const from = Date.parse(`${fromDate} ${fromTime}`);
  const to = Date.parse(`${toDate} ${toTime}`);

  const submit: MouseEventHandler<HTMLButtonElement> = () => {
    if (Number.isInteger(from) && Number.isInteger(to)) {
      setQueryParams({
        [QueryParams.EndTime]: to,
        [QueryParams.TimeRange]: to - from,
      });
      setClosed();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      position="top"
      title={t('Custom time range')}
      onClose={setClosed}
      variant={ModalVariant.small}
    >
      <ModalHeader title={t('Custom time range')} />
      <ModalBody>
        <Form>
          <FormGroup
            label={t('From')}
            isRequired
            fieldId={DataTestIDs.TimeRangeSelect.CustomRangeFromInput}
          >
            <InputGroup>
              <InputGroupItem>
                <DatePicker
                  onChange={(event, str) => setFromDate(str)}
                  value={fromDate}
                  appendTo={() => document.body}
                />
              </InputGroupItem>
              <InputGroupItem>
                <TimePicker
                  is24Hour
                  onChange={(event, text) => setFromTime(text)}
                  time={fromTime}
                  menuAppendTo={() => document.body}
                />
              </InputGroupItem>
            </InputGroup>
          </FormGroup>

          <FormGroup
            label={t('To')}
            isRequired
            fieldId={DataTestIDs.TimeRangeSelect.CustomRangeToInput}
          >
            <InputGroup>
              <InputGroupItem>
                <DatePicker
                  onChange={(event, str) => setToDate(str)}
                  value={toDate}
                  appendTo={() => document.body}
                />
              </InputGroupItem>
              <InputGroupItem>
                <TimePicker
                  is24Hour
                  onChange={(event, text) => setToTime(text)}
                  time={toTime}
                  menuAppendTo={() => document.body}
                />
              </InputGroupItem>
            </InputGroup>
          </FormGroup>
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button
          variant="primary"
          onClick={submit}
          isAriaDisabled={!(Number.isInteger(from) && Number.isInteger(to) && to > from)}
        >
          {t('Save')}
        </Button>
        <Button variant="secondary" onClick={setClosed}>
          {t('Cancel')}
        </Button>
      </ModalFooter>
    </Modal>
  );
};
