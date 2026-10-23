import {
  Flex,
  FlexItem,
  InputGroup,
  InputGroupItem,
  DatePicker,
  isValidDate,
  TimePicker,
  yyyyMMddFormat,
} from '@patternfly/react-core';
import { FC } from 'react';

interface DateTimeRangePickerProps {
  from: Date | null;
  to: Date | null;
  onDateChange: (type: 'start' | 'end', newDate: Date, hour?: number, minute?: number) => void;
}

const DateTimeRangePicker: FC<DateTimeRangePickerProps> = ({ from, to, onDateChange }) => {
  const toValidator = (date: Date): string => {
    // Date comparison validation
    return isValidDate(from) && yyyyMMddFormat(date) >= yyyyMMddFormat(from)
      ? ''
      : 'The "to" date must be after the "from" date';
  };

  return (
    <Flex direction={{ default: 'column', lg: 'column' }}>
      <FlexItem>
        <InputGroup>
          <InputGroupItem>
            <DatePicker
              value={isValidDate(from) ? yyyyMMddFormat(from) : ''}
              onChange={(_event, inputDate, newFromDate) => {
                if (isValidDate(newFromDate)) {
                  onDateChange('start', newFromDate); // Pass 'start' type to handler
                }
              }}
              aria-label="Start date"
              placeholder="YYYY-MM-DD"
            />
          </InputGroupItem>
          <InputGroupItem>
            <TimePicker
              aria-label="Start time"
              style={{ width: '150px' }}
              onChange={(_event, time, hour, minute) => {
                if (isValidDate(from)) {
                  onDateChange('start', from as Date, hour, minute); // Update start time
                }
              }}
            />
          </InputGroupItem>
        </InputGroup>
      </FlexItem>
      <FlexItem>
        <div>to</div>
      </FlexItem>
      <FlexItem>
        <InputGroup>
          <InputGroupItem>
            <DatePicker
              value={isValidDate(to) ? yyyyMMddFormat(to as Date) : ''}
              onChange={(_event, inputDate, newToDate) => {
                if (isValidDate(newToDate)) {
                  onDateChange('end', newToDate); // Pass 'end' type to handler
                }
              }}
              isDisabled={!isValidDate(from)}
              rangeStart={from}
              validators={[toValidator]}
              aria-label="End date"
              placeholder="YYYY-MM-DD"
            />
          </InputGroupItem>
          <InputGroupItem>
            <TimePicker
              style={{ width: '150px' }}
              onChange={(_event, time, hour, minute) => {
                if (isValidDate(to)) {
                  onDateChange('end', to as Date, hour, minute); // Update end time
                }
              }}
              isDisabled={!isValidDate(from)}
            />
          </InputGroupItem>
        </InputGroup>
      </FlexItem>
    </Flex>
  );
};

export default DateTimeRangePicker;
