import {
  CSSProperties,
  FormEvent,
  KeyboardEvent as ReactKeyboardEvent,
  ReactNode,
  Ref,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Select,
  SelectOption,
  SelectList,
  SelectOptionProps,
  MenuToggle,
  MenuToggleElement,
  TextInputGroup,
  TextInputGroupMain,
  TextInputGroupUtilities,
  Button,
} from '@patternfly/react-core';
import { TimesIcon } from '@patternfly/react-icons';
import { TypeaheadSelectOption } from './TypeaheadSelect';

export interface TypeaheadCheckboxSelectProps {
  placeholder: string;
  noResultsFoundText?: ReactNode;
  toggleWidth?: string;
  isCreatable?: boolean;
  style?: CSSProperties;
  options: TypeaheadSelectOption[];
  value: string[];
  setValue: (value: string[]) => void;
}

// based on https://www.patternfly.org/components/menus/select/#multiple-typeahead-with-checkboxes
export function TypeaheadCheckboxSelect(props: TypeaheadCheckboxSelectProps) {
  const initialSelectOptions = useMemo(() => {
    const needToSelect = new Set(props.value);
    const initialOptions: Omit<SelectOptionProps, 'content'>[] = [];
    for (const option of props.options) {
      let selected = false;
      if (needToSelect.has(String(option.value))) {
        selected = true;
        needToSelect.delete(String(option.value));
      }
      initialOptions.push({ ...option, children: option.content, selected });
    }

    // append all selected items which are not in the options list, if isCreatable is true
    if (props.isCreatable) {
      for (const value of needToSelect) {
        initialOptions.push({ children: value, value, selected: true });
      }
    }

    return initialOptions;
  }, [props.options, props.value, props.isCreatable]);

  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState<string>('');
  const [selected, setSelected] = [props.value, props.setValue];
  const [selectOptions, setSelectOptions] = useState<SelectOptionProps[]>(initialSelectOptions);
  const [focusedItemIndex, setFocusedItemIndex] = useState<number | null>(null);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const textInputRef = useRef<HTMLInputElement | undefined>(undefined);

  const NO_RESULTS = 'no results';

  useEffect(() => {
    let newSelectOptions: SelectOptionProps[] = initialSelectOptions;

    // Filter menu items based on the text input value when one exists
    if (inputValue) {
      newSelectOptions = initialSelectOptions.filter((menuItem) =>
        String(menuItem.children).toLowerCase().includes(inputValue.toLowerCase()),
      );

      if (
        props.isCreatable &&
        inputValue &&
        !initialSelectOptions.find(
          (o) => String(o.children).toLowerCase() === inputValue.toLowerCase(),
        )
      ) {
        const createOption = {
          children: inputValue,
          value: inputValue,
        };
        newSelectOptions = [...newSelectOptions, createOption];
      }

      // When no options are found after filtering, display 'No results found'
      if (!newSelectOptions.length) {
        newSelectOptions = [
          {
            isAriaDisabled: true,
            children: `No results found for "${inputValue}"`,
            value: NO_RESULTS,
            hasCheckbox: false,
          },
        ];
      }
    }

    // When no options are available, display 'No results found'
    if (!newSelectOptions.length) {
      newSelectOptions = [
        {
          isAriaDisabled: true,
          children: props.noResultsFoundText ?? `No results found`,
          value: NO_RESULTS,
          hasCheckbox: false,
        },
      ];
    }

    setSelectOptions(newSelectOptions); // eslint-disable-line react-hooks/set-state-in-effect
  }, [inputValue, initialSelectOptions, isOpen, props.isCreatable, props.noResultsFoundText]);

  const createItemId = (value: string) => `select-multi-typeahead-${value.replace(' ', '-')}`;

  const setActiveAndFocusedItem = (itemIndex: number) => {
    setFocusedItemIndex(itemIndex);
    const focusedItem = selectOptions[itemIndex];
    setActiveItemId(createItemId(focusedItem.value));
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

  const handleMenuArrowKeys = (key: string) => {
    let indexToFocus = 0;

    if (!isOpen) {
      setIsOpen(true);
    }

    if (selectOptions.every((option) => option.isDisabled)) {
      return;
    }

    if (key === 'ArrowUp') {
      // When no index is set or at the first index, focus to the last, otherwise decrement focus index
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
      // When no index is set or at the last index, focus to the first, otherwise increment focus index
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

  const onInputKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    const focusedItem = focusedItemIndex !== null ? selectOptions[focusedItemIndex] : null;

    switch (event.key) {
      case 'Enter':
        if (
          isOpen &&
          focusedItem &&
          focusedItem.value !== NO_RESULTS &&
          !focusedItem.isAriaDisabled
        ) {
          onSelect(focusedItem.value);
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

  const onTextInputChange = (_event: FormEvent<HTMLInputElement>, value: string) => {
    setInputValue(value);
    resetActiveAndFocusedItem();
  };

  const onSelect = (value: string) => {
    if (value && value !== NO_RESULTS) {
      setSelected(
        selected.includes(value)
          ? selected.filter((selection) => selection !== value)
          : [...selected, value],
      );
    }

    textInputRef.current?.focus();
  };

  const onClearButtonClick = () => {
    setSelected([]);
    setInputValue('');
    resetActiveAndFocusedItem();
    textInputRef?.current?.focus();
  };

  const toggle = (toggleRef: Ref<MenuToggleElement>) => (
    <MenuToggle
      variant="typeahead"
      aria-label="Multi typeahead checkbox menu toggle"
      onClick={onToggleClick}
      innerRef={toggleRef}
      isExpanded={isOpen}
      isFullWidth
      style={{ width: props.toggleWidth }}
    >
      <TextInputGroup isPlain>
        <TextInputGroupMain
          value={inputValue}
          onClick={onInputClick}
          onChange={onTextInputChange}
          onKeyDown={onInputKeyDown}
          id="multi-typeahead-select-checkbox-input"
          autoComplete="off"
          innerRef={textInputRef}
          placeholder={props.placeholder}
          {...(activeItemId && { 'aria-activedescendant': activeItemId })}
          role="combobox"
          isExpanded={isOpen}
          aria-controls="select-multi-typeahead-checkbox-listbox"
        />
        <TextInputGroupUtilities {...(selected.length === 0 ? { style: { display: 'none' } } : {})}>
          <Button
            variant="plain"
            onClick={onClearButtonClick}
            aria-label="Clear input value"
            icon={<TimesIcon />}
          />
        </TextInputGroupUtilities>
      </TextInputGroup>
    </MenuToggle>
  );

  return (
    <Select
      role="menu"
      id="multi-typeahead-checkbox-select"
      isOpen={isOpen}
      selected={selected}
      onSelect={(_event, selection) => onSelect(selection as string)}
      onOpenChange={(isOpen) => {
        if (!isOpen) closeMenu();
      }}
      toggle={toggle}
      variant="typeahead"
      style={props.style}
    >
      <SelectList isAriaMultiselectable id="select-multi-typeahead-checkbox-listbox">
        {selectOptions.map((option, index) => (
          <SelectOption
            {...(!option.isDisabled && !option.isAriaDisabled && { hasCheckbox: true })}
            isSelected={selected.includes(option.value)}
            key={option.value || option.children}
            isFocused={focusedItemIndex === index}
            className={option.className}
            id={createItemId(option.value)}
            {...option}
            ref={null}
          />
        ))}
      </SelectList>
    </Select>
  );
}
