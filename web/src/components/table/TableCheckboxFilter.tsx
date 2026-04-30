import { FC, useState, useRef, useEffect, MouseEvent as ReactMouseEvent } from 'react';
import {
  Badge,
  Menu,
  MenuContent,
  MenuItem,
  MenuList,
  MenuToggle,
  Popper,
  ToolbarLabel,
  ToolbarFilter,
} from '@patternfly/react-core';
import { DataViewCheckboxFilterProps } from '@patternfly/react-data-view/dist/dynamic/DataViewCheckboxFilter';
import { DataViewFilterOption } from '@patternfly/react-data-view/dist/dynamic/DataViewFilters';

const isToolbarLabel = (label: string | ToolbarLabel): label is ToolbarLabel =>
  typeof label === 'object' && 'key' in label;

// Don't allow options to be a string[]
export interface CustomDataViewCheckboxFilterProps extends Omit<
  DataViewCheckboxFilterProps,
  'options'
> {
  options?: DataViewFilterOption[];
}

export const TableCheckboxFilter: FC<CustomDataViewCheckboxFilterProps> = ({
  filterId,
  title,
  value = [],
  onChange,
  placeholder,
  options = [],
  showToolbarItem,
  ouiaId = 'DataViewCheckboxFilter',
  ...props
}: CustomDataViewCheckboxFilterProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleToggleClick = (event: ReactMouseEvent) => {
    event.stopPropagation();
    setTimeout(() => {
      const firstElement = menuRef.current?.querySelector(
        'li > button:not(:disabled)',
      ) as HTMLElement;
      firstElement?.focus();
    }, 0);
    setIsOpen((prev) => !prev);
  };

  const handleSelect = (event?: ReactMouseEvent, itemId?: string | number) => {
    const activeItem = String(itemId);
    const isSelected = value.includes(activeItem);

    onChange?.(
      event,
      isSelected ? value.filter((item) => item !== activeItem) : [activeItem, ...value],
    );
  };

  const handleClickOutside = (event: MouseEvent) =>
    isOpen &&
    menuRef.current &&
    toggleRef.current &&
    !menuRef.current.contains(event.target as Node) &&
    !toggleRef.current.contains(event.target as Node) &&
    setIsOpen(false);

  useEffect(() => {
    window.addEventListener('click', handleClickOutside);
    return () => {
      window.removeEventListener('click', handleClickOutside);
    };
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ToolbarFilter
      key={ouiaId}
      data-ouia-component-id={ouiaId}
      labels={value
        .map((item) => options.find((option) => option.value === item))
        .filter(Boolean)
        .map((activeOption) => ({ key: activeOption.value as string, node: activeOption.label }))}
      deleteLabel={(_, label) =>
        onChange?.(
          undefined,
          value.filter((item) => item !== (isToolbarLabel(label) ? label.key : label)),
        )
      }
      categoryName={title}
      showToolbarItem={showToolbarItem}
    >
      <Popper
        trigger={
          <MenuToggle
            ouiaId={`${ouiaId}-toggle`}
            ref={toggleRef}
            onClick={handleToggleClick}
            isExpanded={isOpen}
            badge={
              value.length > 0 ? (
                <Badge data-ouia-component-id={`${ouiaId}-badge`} isRead>
                  {value.length}
                </Badge>
              ) : undefined
            }
            style={{ width: '200px' }}
          >
            {placeholder ?? title}
          </MenuToggle>
        }
        triggerRef={toggleRef}
        popper={
          <Menu
            ref={menuRef}
            ouiaId={`${ouiaId}-menu`}
            onSelect={handleSelect}
            selected={value}
            {...props}
          >
            <MenuContent>
              <MenuList>
                {options.map((option) => (
                  <MenuItem
                    data-ouia-component-id={`${ouiaId}-filter-item-${option.value}`}
                    key={option.value}
                    itemId={option.value}
                    isSelected={value.includes(option.value)}
                    hasCheckbox
                  >
                    {option.label}
                  </MenuItem>
                ))}
              </MenuList>
            </MenuContent>
          </Menu>
        }
        popperRef={menuRef}
        appendTo={containerRef.current || undefined}
        aria-label={`${title ?? filterId} filter`}
        isVisible={isOpen}
      />
    </ToolbarFilter>
  );
};
