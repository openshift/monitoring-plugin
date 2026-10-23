import {
  MenuToggle,
  MenuToggleElement,
  Select,
  SelectList,
  SelectOption,
} from '@patternfly/react-core';

import { useTimeUnitLabel } from '../hooks/useTimeUnitLabel';
import * as time from '../time';
import { FC, Ref, useState, MouseEvent as ReactMouseEvent } from 'react';

interface TimeUnitPickerProps {
  unit: time.Unit;
  onChange: (unit: time.Unit) => void;
}

/** Pick a time unit (hours, days etc) */
export const TimeUnitPicker: FC<TimeUnitPickerProps> = ({ unit, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const timeUnitLabel = useTimeUnitLabel();

  const toggle = (toggleRef: Ref<MenuToggleElement>) => (
    <MenuToggle ref={toggleRef} onClick={() => setIsOpen(!isOpen)} isExpanded={isOpen}>
      {timeUnitLabel(unit)}
    </MenuToggle>
  );

  return (
    <Select
      id={'unit-select'}
      selected={unit}
      isOpen={isOpen}
      onSelect={(_: ReactMouseEvent<Element, MouseEvent>, value: string | number) => {
        onChange(value as time.Unit);
        setIsOpen(false);
      }}
      onOpenChange={setIsOpen}
      toggle={toggle}
    >
      <SelectList>
        {time.units.map((u) => (
          <SelectOption key={u} value={u}>
            {timeUnitLabel(u)}
          </SelectOption>
        ))}
      </SelectList>
    </Select>
  );
};
