import { FC, useEffect } from 'react';
import { SearchInput, ToolbarFilter } from '@patternfly/react-core';
import { DataViewTextFilterProps } from '@patternfly/react-data-view/dist/dynamic/DataViewTextFilter';

export const TableTextFilter: FC<DataViewTextFilterProps> = ({
  filterId,
  title,
  value = '',
  onChange,
  onClear = () => onChange?.(undefined, ''),
  showToolbarItem,
  trimValue = true,
  ouiaId = 'DataViewTextFilter',
  ...props
}: DataViewTextFilterProps) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle "/" key when not typing in an input, textarea, or contenteditable element
      if (event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey) {
        const target = event.target as HTMLElement;
        const isInputElement =
          target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

        // Only focus if the filter is visible and we're not already in an input field
        if (showToolbarItem && !isInputElement) {
          // Find the input element by its ID (searchInputId prop)
          const inputElement = document.getElementById(filterId) as HTMLInputElement;
          if (inputElement) {
            event.preventDefault();
            inputElement.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showToolbarItem, filterId]);

  return (
    <ToolbarFilter
      key={ouiaId}
      data-ouia-component-id={ouiaId}
      labels={value.length > 0 ? [{ key: title, node: value }] : []}
      deleteLabel={() => onChange?.(undefined, '')}
      categoryName={title}
      showToolbarItem={showToolbarItem}
    >
      <SearchInput
        searchInputId={filterId}
        value={value}
        onChange={(e, inputValue) => onChange?.(e, trimValue ? inputValue.trim() : inputValue)}
        onClear={onClear}
        placeholder={`Filter by ${title}`}
        aria-label={`${title ?? filterId} filter`}
        data-ouia-component-id={`${ouiaId}-input`}
        {...props}
      />
    </ToolbarFilter>
  );
};
