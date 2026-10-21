import {
  HelperText,
  HelperTextItem,
  Menu,
  MenuContent,
  MenuItem,
  MenuList,
  Popper,
  TextInput,
  ValidatedOptions,
} from '@patternfly/react-core';
import { FC, MouseEvent as ReactMouseEvent, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import '@/features/logging/components/precision-time-picker.css';
import { useBoolean } from '@/features/logging/hooks/useBoolean';
import { padLeadingZero } from '@/features/logging/utils/value-utils';

interface PrecisionTimePickerProps {
  time: string;
  onChange?: (time: string, hours?: number, minutes?: number, seconds?: number) => void;
}

const validTimeStringRegex = /^\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/;

const parseTimeString = (
  time: string,
): { hours: number; minutes: number; seconds: number } | null => {
  if (!validTimeStringRegex.test(time)) {
    return null;
  }

  const parts = time.split(':');

  if (parts.length >= 2) {
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    const seconds = parts.length >= 3 ? parseFloat(parts[2]) : 0;

    if (!isNaN(hours) && !isNaN(minutes) && !isNaN(seconds)) {
      if (hours >= 24 || minutes >= 60 || seconds >= 60) {
        return null;
      } else {
        return { hours, minutes, seconds };
      }
    }
  }

  return null;
};

const timeMenuItemsBuilder: () => Array<string> = () => {
  const items = [];

  for (let hours = 0; hours < 24; hours++) {
    for (let minutes = 0; minutes < 60; minutes += 30) {
      items.push(`${padLeadingZero(hours)}:${padLeadingZero(minutes)}`);
    }
  }

  return items;
};

const timeMenuItems = timeMenuItemsBuilder();

export const PrecisionTimePicker: FC<PrecisionTimePickerProps> = ({ onChange, time }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  const [value, setValue] = useState(time);
  const [isValid, setIsvalid] = useState(true);
  const { value: isMenuOpen, setTrue: openMenu, setFalse: closeMenu } = useBoolean(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const handleValueChange = (changedValue: string) => {
    setValue(changedValue);
    const parsedTime = parseTimeString(changedValue);

    if (parsedTime) {
      setIsvalid(true);
      onChange?.(changedValue, parsedTime.hours, parsedTime.minutes, parsedTime.seconds);
    } else {
      setIsvalid(false);
      onChange?.(changedValue, undefined, undefined, undefined);
    }

    closeMenu();
  };

  const onDocumentClick = (event: MouseEvent | undefined) => {
    if (
      inputRef.current !== event?.target &&
      !menuRef.current?.contains(event?.target as HTMLElement)
    ) {
      closeMenu();
    }
  };

  const handleMenuSelect = (_?: ReactMouseEvent, itemId?: string | number) => {
    if (itemId && typeof itemId === 'string') {
      handleValueChange(itemId);
    }
  };

  const popper = (
    <Menu
      id="time-select-menu"
      onSelect={handleMenuSelect}
      className="lv-plugin__time-picker__time-options"
      ref={menuRef}
    >
      <MenuContent>
        <MenuList>
          {timeMenuItems.map((item, index) => (
            <MenuItem key={index} onClick={() => handleValueChange(item)} ref={null} itemID={item}>
              {item}
            </MenuItem>
          ))}
        </MenuList>
      </MenuContent>
    </Menu>
  );

  const trigger = (
    <div>
      <TextInput
        value={value}
        onFocus={openMenu}
        type="text"
        onChange={(_event, changedValue: string) => handleValueChange(changedValue)}
        aria-label="Precision time picker"
        isRequired
        validated={isValid ? undefined : ValidatedOptions.error}
        className="lv-plugin__time-picker__input"
        ref={inputRef}
      />
      {!isValid && (
        <HelperText className="lv-plugin__time-picker__error">
          <HelperTextItem variant="error">{t('Invalid time format')}</HelperTextItem>
        </HelperText>
      )}
    </div>
  );

  return (
    <Popper
      trigger={trigger}
      popper={popper}
      isVisible={isMenuOpen}
      onDocumentClick={onDocumentClick}
    />
  );
};
