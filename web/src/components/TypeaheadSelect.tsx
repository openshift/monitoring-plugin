import {
  Button,
  MenuToggle,
  MenuToggleElement,
  Select,
  SelectList,
  SelectOption,
  SelectOptionProps,
  TextInputGroup,
  TextInputGroupMain,
  TextInputGroupUtilities,
} from '@patternfly/react-core';
import { TimesIcon } from '@patternfly/react-icons';
import React from 'react';
import { DataTestIDs } from './data-test';

const NO_RESULTS = 'no results';

interface TypeaheadSelectProps {
  options: SelectOptionProps[];
  onSelect: (value: string | undefined) => void;
  placeholder?: string;
}

export const TypeaheadSelect: React.FC<TypeaheadSelectProps> = ({
  options,
  onSelect,
  placeholder,
}) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [selected, setSelected] = React.useState('');
  const [inputValue, setInputValue] = React.useState<string>('');
  const [selectOptions, setSelectOptions] = React.useState<SelectOptionProps[]>(options);
  const [focusedItemIndex, setFocusedItemIndex] = React.useState<number | null>(null);
  const [activeItemId, setActiveItemId] = React.useState<string | null>(null);
  const [filterValue, setFilterValue] = React.useState<string>('');
  const textInputRef = React.useRef<HTMLInputElement>();

  React.useEffect(() => {
    let newSelectOptions: SelectOptionProps[] = options;

    if (filterValue) {
      newSelectOptions = options.filter((menuItem) =>
        String(menuItem.name).toLowerCase().includes(filterValue.toLowerCase()),
      );

      if (!newSelectOptions.length) {
        newSelectOptions = [
          {
            isAriaDisabled: true,
            name: `No results found for "${filterValue}"`,
            value: NO_RESULTS,
          },
        ];
      }

      if (!isOpen) {
        setIsOpen(true);
      }
    }

    setSelectOptions(newSelectOptions);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterValue, options]);

  const handleSelect = (
    _event: React.MouseEvent<Element, MouseEvent> | undefined,
    value: string | undefined,
  ) => {
    if (!value) {
      setSelected(undefined);
      setIsOpen(false);
      return;
    }
    setSelected(value);
    setInputValue('');
    setIsOpen(false);
    setSelectOptions(options);
    onSelect(value);
  };

  const resetActiveAndFocusedItem = () => {
    setFocusedItemIndex(null);
    setActiveItemId(null);
  };

  const closeMenu = () => {
    setIsOpen(false);
    resetActiveAndFocusedItem();
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
  };

  const onInputClick = () => {
    if (!isOpen) {
      setIsOpen(true);
    } else if (!inputValue) {
      closeMenu();
    }
  };

  const onTextInputChange = (_event: React.FormEvent<HTMLInputElement>, value: string) => {
    setInputValue(value);
    setFilterValue(value);

    resetActiveAndFocusedItem();

    if (value !== selected) {
      setSelected('');
    }
  };

  const selectOption = (value: string, content: string | number) => {
    onSelect(value);
    setInputValue(String(content));
    setFilterValue('');
    setSelected(String(value));

    closeMenu();
  };

  const onInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    const focusedItem = focusedItemIndex !== null ? selectOptions[focusedItemIndex] : null;

    switch (event.key) {
      case 'Enter':
        if (
          isOpen &&
          focusedItem &&
          focusedItem.value !== NO_RESULTS &&
          !focusedItem.isAriaDisabled
        ) {
          selectOption(focusedItem.value, focusedItem.name);
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

  const setActiveAndFocusedItem = (itemIndex: number) => {
    setFocusedItemIndex(itemIndex);
    const focusedItem = selectOptions[itemIndex];
    setActiveItemId(focusedItem.name);
  };

  const handleMenuArrowKeys = (key: string) => {
    let indexToFocus = 0;

    if (!isOpen) {
      setIsOpen(true);
    }

    if (selectOptions.every((option) => option.isDisabled)) {
      return;
    }

    if (key === 'ArrowUp') {
      if (focusedItemIndex === null || focusedItemIndex === 0) {
        indexToFocus = selectOptions.length - 1;
      } else {
        indexToFocus = focusedItemIndex - 1;
      }

      // Skip disabled options
      while (selectOptions[indexToFocus].isDisabled) {
        indexToFocus--;
        if (indexToFocus === -1) {
          indexToFocus = selectOptions.length - 1;
        }
      }
    }

    if (key === 'ArrowDown') {
      if (focusedItemIndex === null || focusedItemIndex === selectOptions.length - 1) {
        indexToFocus = 0;
      } else {
        indexToFocus = focusedItemIndex + 1;
      }

      // Skip disabled options
      while (selectOptions[indexToFocus].isDisabled) {
        indexToFocus++;
        if (indexToFocus === selectOptions.length) {
          indexToFocus = 0;
        }
      }
    }

    setActiveAndFocusedItem(indexToFocus);
  };

  const toggle = (toggleRef: React.Ref<MenuToggleElement>) => (
    <MenuToggle
      ref={toggleRef}
      variant="typeahead"
      aria-label="Typeahead menu toggle"
      onClick={onToggleClick}
      isExpanded={isOpen}
      isFullWidth
    >
      <TextInputGroup isPlain>
        <TextInputGroupMain
          value={inputValue}
          onClick={onInputClick}
          onChange={onTextInputChange}
          onKeyDown={onInputKeyDown}
          id="query-select-typeahead-input"
          autoComplete="off"
          innerRef={textInputRef}
          placeholder={placeholder}
          {...(activeItemId && { 'aria-activedescendant': activeItemId })}
          role="combobox"
          isExpanded={isOpen}
          aria-controls="select-typeahead-listbox"
          data-test={DataTestIDs.TypeaheadSelectInput}
        />

        <TextInputGroupUtilities {...(!inputValue ? { style: { display: 'none' } } : {})}>
          <Button
            icon={<TimesIcon aria-hidden />}
            variant="plain"
            onClick={onClearButtonClick}
            aria-label="Clear input value"
          />
        </TextInputGroupUtilities>
      </TextInputGroup>
    </MenuToggle>
  );

  return (
    <Select
      id="typeahead-select"
      isOpen={isOpen}
      onSelect={handleSelect}
      onOpenChange={(isOpen) => {
        !isOpen && closeMenu();
      }}
      toggle={toggle}
      shouldFocusFirstItemOnOpen={false}
    >
      <SelectList>
        {selectOptions.map((option, index) => (
          <SelectOption
            key={`${option.name} ${index}`}
            isFocused={focusedItemIndex === index}
            id={option.name}
            value={option.value}
            isDisabled={option.isAriaDisabled}
          >
            {option.name}
          </SelectOption>
        ))}
      </SelectList>
    </Select>
  );
};
