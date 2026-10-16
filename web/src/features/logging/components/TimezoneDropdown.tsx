import {
  Button,
  MenuToggle,
  MenuToggleElement,
  Select,
  SelectGroup,
  SelectList,
  SelectOption,
  SelectOptionProps,
  TextInputGroup,
  TextInputGroupMain,
  TextInputGroupUtilities,
} from '@patternfly/react-core';
import { TimesIcon } from '@patternfly/react-icons';
import {
  FC,
  FormEvent,
  KeyboardEvent,
  MouseEvent as ReactMouseEvent,
  Ref,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';

import { getBrowserTimezone, getTimezoneOffset } from '@/features/logging/date-utils';
import { TestIds } from '@/features/logging/test-ids';

// Extend Intl type to include supportedValuesOf (available in modern browsers)
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Intl {
    function supportedValuesOf(key: string): string[];
  }
}

// Format timezone for display: "America/New_York (UTC-05:00)"
const formatTimezoneLabel = (timezone: string): string => {
  const { label } = getTimezoneOffset(timezone);
  return label ? `${timezone} (${label})` : timezone;
};

// Curated list of common timezones
const DEFAULT_TIMEZONES = [
  'UTC',
  getBrowserTimezone(), // Browser's local timezone
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Kolkata',
  'Australia/Sydney',
  // Remove duplicates if browser TZ is in the list
].filter((tz, index, arr) => arr.indexOf(tz) === index);

const getAllTimezones = (): string[] => {
  try {
    return Intl.supportedValuesOf('timeZone');
  } catch {
    // Fallback for older browsers
    return DEFAULT_TIMEZONES;
  }
};

interface TimezoneDropdownProps {
  value?: string;
  onChange?: (timezone: string) => void;
  isDisabled?: boolean;
}

export const TimezoneDropdown: FC<TimezoneDropdownProps> = ({
  onChange,
  value = '',
  isDisabled,
}) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const [isOpen, setIsOpen] = useState(false);
  const localTimezone = useMemo(() => getBrowserTimezone(), []);
  const [selected, setSelected] = useState<string>(value || localTimezone);
  const [inputValue, setInputValue] = useState<string>(value || localTimezone);
  const [filterValue, setFilterValue] = useState<string>('');
  const [focusedItemIndex, setFocusedItemIndex] = useState<number | null>(null);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const textInputRef = useRef<HTMLInputElement>();

  const initialSelectOptions: SelectOptionProps[] = useMemo(() => {
    return getAllTimezones().map((tz) => ({
      value: tz,
      children: formatTimezoneLabel(tz),
    }));
  }, []);

  const commonTimezoneOptions: SelectOptionProps[] = useMemo(() => {
    return DEFAULT_TIMEZONES.map((tz) => ({
      value: tz,
      children: formatTimezoneLabel(tz),
    }));
  }, []);

  const [selectOptions, setSelectOptions] = useState<SelectOptionProps[]>(initialSelectOptions);

  const NO_RESULTS = 'no results';

  useEffect(() => {
    const timezone = value || localTimezone;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Imported control sync.
    setSelected(timezone);
    setInputValue(formatTimezoneLabel(timezone));
  }, [value, localTimezone]);

  useEffect(() => {
    let newSelectOptions: SelectOptionProps[] = initialSelectOptions;

    // Filter menu items based on the text input value when one exists
    if (filterValue) {
      newSelectOptions = initialSelectOptions.filter((menuItem) =>
        String(menuItem.children).toLowerCase().includes(filterValue.toLowerCase()),
      );

      // When no options are found after filtering, display 'No results found'
      if (!newSelectOptions.length) {
        newSelectOptions = [
          {
            isAriaDisabled: true,
            children: `${t('No results found for')} "${filterValue}"`,
            value: NO_RESULTS,
          },
        ];
      }

      // Open the menu when the input value changes and the new value is not empty
      if (!isOpen) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- Imported control sync.
        setIsOpen(true);
      }
    }

    setSelectOptions(newSelectOptions);
  }, [filterValue, initialSelectOptions, isOpen, t]);

  const setActiveAndFocusedItem = (itemIndex: number) => {
    setFocusedItemIndex(itemIndex);
    const focusedItem = selectOptions[itemIndex];
    setActiveItemId(focusedItem.value);
  };

  const resetActiveAndFocusedItem = () => {
    setFocusedItemIndex(null);
    setActiveItemId(null);
  };

  const closeMenu = () => {
    setIsOpen(false);
    resetActiveAndFocusedItem();
  };

  const onInputClick = () => {
    if (!isOpen) {
      setIsOpen(true);
    } else if (!inputValue) {
      closeMenu();
    }
  };

  const selectOption = (selectedOption: string, content: string) => {
    setInputValue(String(content));
    setFilterValue('');
    setSelected(String(selectedOption));
    onChange?.(String(selectedOption));
    closeMenu();
  };

  const onSelect = (
    _event: ReactMouseEvent<Element, MouseEvent> | undefined,
    selectedValue: string | number | undefined,
  ) => {
    if (
      selectedValue &&
      selectedValue !== NO_RESULTS &&
      typeof selectedValue === 'string' &&
      selectedValue !== selected
    ) {
      const optionText = selectOptions.find((option) => option.value === selectedValue)?.children;
      selectOption(selectedValue, optionText as string);
    }
  };

  const onTextInputChange = (_event: FormEvent<HTMLInputElement>, typedValue: string) => {
    setInputValue(typedValue);
    setFilterValue(typedValue);

    resetActiveAndFocusedItem();

    if (typedValue !== selected) {
      setSelected('');
    }
  };

  const handleMenuArrowKeys = (key: string) => {
    let indexToFocus = 0;

    if (!isOpen) {
      setIsOpen(true);
    }

    if (key === 'ArrowUp') {
      if (focusedItemIndex === null || focusedItemIndex === 0) {
        indexToFocus = selectOptions.length - 1;
      } else {
        indexToFocus = focusedItemIndex - 1;
      }
    }

    if (key === 'ArrowDown') {
      // When no index is set or at the last index,
      // focus to the first, otherwise increment focus index
      if (focusedItemIndex === null || focusedItemIndex === selectOptions.length - 1) {
        indexToFocus = 0;
      } else {
        indexToFocus = focusedItemIndex + 1;
      }
    }

    setActiveAndFocusedItem(indexToFocus);
  };

  const onInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const focusedItem = focusedItemIndex !== null ? selectOptions[focusedItemIndex] : null;

    switch (event.key) {
      case 'Enter':
        if (
          isOpen &&
          focusedItem &&
          focusedItem.value !== NO_RESULTS &&
          !focusedItem.isAriaDisabled
        ) {
          selectOption(focusedItem.value, focusedItem.children as string);
        }

        if (!isOpen) {
          setIsOpen(true);
        }

        break;
      case 'ArrowUp':
      case 'ArrowDown':
        event.preventDefault();
        handleMenuArrowKeys(event.key);
        break;
    }
  };

  const onToggleClick = () => {
    setIsOpen(!isOpen);
    textInputRef?.current?.focus();
  };

  const onClearButtonClick = () => {
    setSelected('');
    setInputValue('');
    setFilterValue('');
    resetActiveAndFocusedItem();
    textInputRef?.current?.focus();
    onChange?.('');
  };

  const toggle = (toggleRef: Ref<MenuToggleElement>) => (
    <MenuToggle
      ref={toggleRef}
      variant="typeahead"
      aria-label="Select timezone"
      onClick={onToggleClick}
      isExpanded={isOpen}
      isDisabled={isDisabled}
    >
      <TextInputGroup isPlain>
        <TextInputGroupMain
          value={inputValue}
          onClick={onInputClick}
          onChange={onTextInputChange}
          onKeyDown={onInputKeyDown}
          id="timezone-typeahead-select-input"
          autoComplete="off"
          innerRef={textInputRef}
          placeholder={t('Select timezone')}
          {...(activeItemId && { 'aria-activedescendant': activeItemId })}
          role="combobox"
          isExpanded={isOpen}
          aria-controls="timezone-select-typeahead-listbox"
        />

        <TextInputGroupUtilities {...(!inputValue ? { style: { display: 'none' } } : {})}>
          <Button
            icon={<TimesIcon aria-hidden />}
            variant="plain"
            onClick={onClearButtonClick}
            aria-label={t('Clear input value')}
          />
        </TextInputGroupUtilities>
      </TextInputGroup>
    </MenuToggle>
  );

  return (
    <Select
      id="timezone-typeahead-select"
      isOpen={isOpen}
      selected={selected}
      onSelect={onSelect}
      onOpenChange={(isOpenValue) => {
        if (!isOpenValue) {
          closeMenu();
        }
      }}
      toggle={toggle}
      shouldFocusFirstItemOnOpen={false}
      data-test={TestIds.TimezoneDropdown}
      isScrollable
    >
      {filterValue ? (
        <SelectGroup label={t('All Timezones')}>
          <SelectList>
            {selectOptions.map((option, index) => (
              <SelectOption
                key={option.value || option.children}
                isFocused={focusedItemIndex === index}
                className={option.className}
                id={option.value as string}
                {...option}
                ref={null}
              />
            ))}
          </SelectList>
        </SelectGroup>
      ) : (
        <>
          <SelectGroup label={t('Common Timezones')}>
            <SelectList>
              {commonTimezoneOptions.map((option, index) => (
                <SelectOption
                  key={option.value || option.children}
                  isFocused={focusedItemIndex === index}
                  id={option.value as string}
                  {...option}
                  ref={null}
                />
              ))}
            </SelectList>
          </SelectGroup>
          <SelectGroup label={t('All Timezones')}>
            <SelectList id="timezone-select-typeahead-listbox">
              {selectOptions.map((option, index) => (
                <SelectOption
                  key={option.value || option.children}
                  isFocused={focusedItemIndex === index}
                  id={option.value as string}
                  {...option}
                  ref={null}
                />
              ))}
            </SelectList>
          </SelectGroup>
        </>
      )}
    </Select>
  );
};
