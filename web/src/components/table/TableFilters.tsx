import { useState, useRef, useEffect } from 'react';
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuList,
  MenuToggle,
  Popper,
  ToolbarGroup,
  ToolbarToggleGroup,
  ToolbarToggleGroupProps,
} from '@patternfly/react-core';
import { FilterIcon } from '@patternfly/react-icons';
import { DataViewTextFilterProps } from '@patternfly/react-data-view/dist/dynamic/DataViewTextFilter';
import { TableLabelFilter, DataViewLabelFilterProps } from './TableLabelFilter';
import { TableTextFilter } from './TableTextFilter';
import { CustomDataViewCheckboxFilterProps, TableCheckboxFilter } from './TableCheckboxFilter';

interface TableFiltersProps extends Omit<
  ToolbarToggleGroupProps,
  'toggleIcon' | 'breakpoint' | 'onChange'
> {
  children: React.ReactNode;
  ouiaId?: string;
  activeAttributeMenu: string;
  setActiveAttributeMenu: (name: string) => void;
  filterItems: {
    filterId: string;
    title: string;
  }[];
}

export const TableFilters = ({
  children,
  ouiaId = 'DataViewFilters',
  activeAttributeMenu,
  setActiveAttributeMenu,
  filterItems,
  ...props
}: TableFiltersProps) => {
  const [isAttributeMenuOpen, setIsAttributeMenuOpen] = useState(false);
  const attributeToggleRef = useRef<HTMLButtonElement>(null);
  const attributeMenuRef = useRef<HTMLDivElement>(null);
  const attributeContainerRef = useRef<HTMLDivElement>(null);

  const handleClickOutside = (event: MouseEvent) =>
    isAttributeMenuOpen &&
    !attributeMenuRef.current?.contains(event.target as Node) &&
    !attributeToggleRef.current?.contains(event.target as Node) &&
    setIsAttributeMenuOpen(false);

  useEffect(() => {
    window.addEventListener('click', handleClickOutside);
    return () => {
      window.removeEventListener('click', handleClickOutside);
    };
  }, [isAttributeMenuOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const attributeToggle = (
    <MenuToggle
      ref={attributeToggleRef}
      onClick={() => setIsAttributeMenuOpen(!isAttributeMenuOpen)}
      isExpanded={isAttributeMenuOpen}
      icon={<FilterIcon />}
    >
      {activeAttributeMenu}
    </MenuToggle>
  );

  const attributeMenu = (
    <Menu
      ref={attributeMenuRef}
      onSelect={(_ev, itemId) => {
        const selectedItem = filterItems.find((item) => item.filterId === itemId);
        if (selectedItem) {
          setActiveAttributeMenu(selectedItem.title);
        }
        setIsAttributeMenuOpen(false);
      }}
    >
      <MenuContent>
        <MenuList>
          {filterItems.map((item) => (
            <MenuItem key={item.filterId} itemId={item.filterId}>
              {item.title}
            </MenuItem>
          ))}
        </MenuList>
      </MenuContent>
    </Menu>
  );

  return (
    <ToolbarToggleGroup
      data-ouia-component-id={ouiaId}
      toggleIcon={<FilterIcon />}
      breakpoint={'xl'}
      {...props}
    >
      <ToolbarGroup variant="filter-group">
        <div ref={attributeContainerRef}>
          <Popper
            trigger={attributeToggle}
            triggerRef={attributeToggleRef}
            popper={attributeMenu}
            popperRef={attributeMenuRef}
            appendTo={attributeContainerRef.current || undefined}
            isVisible={isAttributeMenuOpen}
          />
        </div>
        {children}
      </ToolbarGroup>
    </ToolbarToggleGroup>
  );
};

export const enum TableFilterOption {
  CHECKBOX = 'checkbox',
  TEXT = 'text',
  LABEL = 'label',
}

export type TableFilterProps<TData> =
  | (DataViewTextFilterProps & { type: TableFilterOption.TEXT })
  | (CustomDataViewCheckboxFilterProps & { type: TableFilterOption.CHECKBOX })
  | (DataViewLabelFilterProps<TData> & { type: TableFilterOption.LABEL });

export const TableFilter = <TData,>({ ...props }: TableFilterProps<TData>) => {
  switch (props.type) {
    case TableFilterOption.TEXT:
      return <TableTextFilter {...props} />;
    case TableFilterOption.CHECKBOX:
      return <TableCheckboxFilter {...props} />;
    case TableFilterOption.LABEL:
      return <TableLabelFilter {...props} />;
  }
};
