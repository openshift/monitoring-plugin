import { FC } from 'react';
import {
  SearchInput,
  SearchInputProps,
  ToolbarFilter,
  ToolbarFilterProps,
} from '@patternfly/react-core';

/** extends SearchInputProps */
export interface DataViewTextFilterProps extends SearchInputProps {
  /** Unique key for the filter attribute */
  filterId: string;
  /** Current filter value */
  value?: string;
  /** Filter title displayed in the toolbar */
  title: string;
  /** Callback for when the input value changes */
  onChange?: (event: React.FormEvent<HTMLInputElement> | undefined, value: string) => void;
  /** Controls visibility of the filter in the toolbar */
  showToolbarItem?: ToolbarFilterProps['showToolbarItem'];
  /** Trims input value on change */
  trimValue?: boolean;
  /** Custom OUIA ID */
  ouiaId?: string;
  /** Enable keyboard shortcut (/) to focus the filter. Defaults to true. */
  enableShortcut?: boolean;
}

export const DataViewTextFilter: FC<DataViewTextFilterProps> = ({
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
  return (
    <ToolbarFilter
      categoryName={title}
      labels={value.length > 0 ? [{ key: title, node: value }] : []}
      showToolbarItem={showToolbarItem}
      deleteLabel={() => onChange?.(undefined, '')}
      key={ouiaId}
      data-ouia-component-id={ouiaId}
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

export default DataViewTextFilter;
