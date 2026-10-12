import { Alert, Button, DatePicker, ModalFooter, ModalHeader } from '@patternfly/react-core';
import { Modal, ModalBody, ModalVariant } from '@patternfly/react-core';
import { FC, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PrecisionTimePicker } from '@/features/logging/components/PrecisionTimePicker';
import '@/features/logging/components/time-range-select-modal.css';
import {
  DateFormat,
  dateToFormat,
  getBrowserTimezone,
  normalizeTimezone,
  parseInTimezone,
} from '@/features/logging/date-utils';
import { TimeRange } from '@/features/logging/logs-types';
import { TestIds } from '@/features/logging/test-ids';
import { defaultTimeRange, numericTimeRange } from '@/features/logging/time-range';
import { padLeadingZero } from '@/features/logging/value-utils';

interface TimeRangeSelectModalProps {
  onClose: () => void;
  onSelectRange?: (timeRange: TimeRange) => void;
  initialRange?: TimeRange;
  timezone?: string;
}

export const INTERVAL_AUTO_KEY = 'AUTO';

export const TimeRangeSelectModal: FC<TimeRangeSelectModalProps> = ({
  onClose,
  onSelectRange,
  initialRange,
  timezone,
}) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  const effectiveTimezone = normalizeTimezone(timezone) ?? getBrowserTimezone();
  const initialRangeNumber = numericTimeRange(initialRange ?? defaultTimeRange());
  const [startDate, setStartDate] = useState<string>(
    dateToFormat(initialRangeNumber.start, DateFormat.DateMed, effectiveTimezone),
  );
  const [startTime, setStartTime] = useState<string>(
    dateToFormat(initialRangeNumber.start, DateFormat.TimeFull, effectiveTimezone),
  );
  const [endDate, setEndDate] = useState<string>(
    dateToFormat(initialRangeNumber.end, DateFormat.DateMed, effectiveTimezone),
  );
  const [endTime, setEndTime] = useState<string>(
    dateToFormat(initialRangeNumber.end, DateFormat.TimeFull, effectiveTimezone),
  );
  const [isRangeValid, setIsRangeValid] = useState(false);

  const isRangeSelected = startDate && startTime && endDate && endTime;

  useEffect(() => {
    if (isRangeSelected) {
      const start = parseInTimezone(startDate, startTime, effectiveTimezone);
      const end = parseInTimezone(endDate, endTime, effectiveTimezone);

      // eslint-disable-next-line react-hooks/set-state-in-effect -- Imported control sync.
      setIsRangeValid(start < end);
    } else {
      setIsRangeValid(false);
    }
  }, [startDate, endDate, startTime, endTime, isRangeSelected, effectiveTimezone]);

  const handleSelectRange = () => {
    if (isRangeSelected) {
      const start = parseInTimezone(startDate, startTime, effectiveTimezone);
      const end = parseInTimezone(endDate, endTime, effectiveTimezone);

      onSelectRange?.({ start, end });
    }
  };

  const handleStartTimeChange = (
    _time: string,
    hours?: number,
    minutes?: number,
    seconds?: number,
  ) => {
    if (
      hours !== undefined &&
      hours !== null &&
      minutes !== undefined &&
      minutes !== null &&
      seconds !== undefined &&
      seconds !== null
    ) {
      setStartTime(
        `${padLeadingZero(hours)}:${padLeadingZero(minutes)}:${padLeadingZero(seconds)}`,
      );
    } else {
      setIsRangeValid(false);
    }
  };

  const handleEndTimeChange = (
    _time: string,
    hour?: number,
    minutes?: number,
    seconds?: number,
  ) => {
    if (
      hour !== undefined &&
      hour !== null &&
      minutes !== undefined &&
      minutes !== null &&
      seconds !== undefined &&
      seconds !== null
    ) {
      setEndTime(`${padLeadingZero(hour)}:${padLeadingZero(minutes)}:${padLeadingZero(seconds)}`);
    } else {
      setIsRangeValid(false);
    }
  };

  /* As the patternfly version used in OCP 4.12-4.14 varies,
   * we need to handle both cases until we can build different images per OCP version
   */

  const handleStartDateChange = (event: unknown, value: unknown) => {
    if (typeof event === 'string') {
      setStartDate(event);
    } else if (typeof value === 'string') {
      setStartDate(value);
    }
  };

  /* As the patternfly version used in OCP 4.12-4.14 varies,
   * we need to handle both cases until we can build different images per OCP version
   */

  const handleEndDateChange = (event: unknown, value: unknown) => {
    if (typeof event === 'string') {
      setEndDate(event);
    } else if (typeof value === 'string') {
      setEndDate(value);
    }
  };

  return (
    <Modal
      id="date-time-picker-modal"
      className="modal-dialog lv-plugin__time-range-modal"
      variant={ModalVariant.small}
      width="auto"
      title="Custom time range"
      position="top"
      isOpen
      onEscapePress={onClose}
      onClose={onClose}
      aria-label="date-time-picker-modal"
      data-test={TestIds.TimeRangeSelectModal}
    >
      <ModalHeader title="Custom time range" labelId="scrollable-modal-title" />
      <ModalBody
        className="lv-plugin__time-range-modal__body"
        data-test={TestIds.TimeRangeSelectModal}
        tabIndex={0}
      >
        <div>
          <label>{t('From')}</label>
          <div className="lv-plugin__time-range-modal__field">
            <DatePicker
              onChange={handleStartDateChange}
              value={startDate}
              appendTo={document.body}
            />
            <PrecisionTimePicker time={startTime} onChange={handleStartTimeChange} />
          </div>
        </div>
        <div>
          <label>{t('To')}</label>
          <div className="lv-plugin__time-range-modal__field">
            <DatePicker onChange={handleEndDateChange} value={endDate} appendTo={document.body} />
            <PrecisionTimePicker time={endTime} onChange={handleEndTimeChange} />
          </div>
          {!isRangeValid && (
            <Alert
              className="lv-plugin__time-range-modal__error"
              variant="danger"
              isInline
              isPlain
              title={t('Invalid date range')}
            />
          )}
        </div>
      </ModalBody>
      <ModalFooter>
        <Button
          key="confirm"
          variant="primary"
          onClick={handleSelectRange}
          isDisabled={!isRangeSelected || !isRangeValid}
          data-test={TestIds.TimeRangeDropdownSaveButton}
        >
          {t('Save')}
        </Button>
        <Button key="cancel" variant="secondary" onClick={onClose}>
          {t('Cancel')}
        </Button>
      </ModalFooter>
    </Modal>
  );
};
