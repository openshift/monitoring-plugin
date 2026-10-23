import {
  DatePicker,
  InputGroup,
  InputGroupItem,
  isValidDate,
  TimePicker,
  yyyyMMddFormat,
} from '@patternfly/react-core';
import { copyTime, setTime } from '../time';
import { FC } from 'react';

/** Combine date and time pickers, return the result as a Date */
export const DateTimePicker: FC<{
  date: Date;
  onChange: (date: Date) => void;
}> = ({ date, onChange }) => {
  if (!isValidDate(date)) date = new Date();
  return (
    <InputGroup>
      <InputGroupItem>
        <DatePicker
          value={isValidDate(date) ? yyyyMMddFormat(date) : ''}
          onChange={(_event, _inputDate, newDate) => onChange(copyTime(newDate, date))}
          appendTo={() => document.body}
        />
      </InputGroupItem>
      <InputGroupItem>
        <TimePicker
          time={date}
          onChange={(_event, _time, hour, minute, second, isValid) => {
            if (isValid) onChange(setTime(date, hour, minute, second));
          }}
          is24Hour={true}
          menuAppendTo={() => document.body}
          style={{ width: '150px' }}
        />
      </InputGroupItem>
    </InputGroup>
  );
};
