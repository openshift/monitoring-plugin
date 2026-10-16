import {
  MenuToggle,
  MenuToggleElement,
  Select,
  SelectList,
  SelectOption,
} from '@patternfly/react-core';
import {
  FC,
  MouseEvent as ReactMouseEvent,
  Ref,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';

import { isOption } from '@/features/logging/components/filters/FiltersFromParams';
import { TENANTS } from '@/features/logging/tenants';
import { TestIds } from '@/features/logging/test-ids';

interface TenantDropdownProps {
  selectedTenant?: string;
  onTenantSelected?: (tenant: string) => void;
  isDisabled?: boolean;
}

export const TenantDropdown: FC<TenantDropdownProps> = ({
  selectedTenant,
  onTenantSelected,
  isDisabled = false,
}) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  const [isOpen, setIsOpen] = useState(false);

  const selectRef = useRef<HTMLDivElement>(null);

  const onToggle = () => setIsOpen(!isOpen);
  const onSelect = (
    _: ReactMouseEvent<Element, MouseEvent> | undefined,
    value: string | number | undefined,
  ) => {
    const selectedValue = isOption(value) ? value.value : String(value);
    setIsOpen(false);
    if (selectedValue && selectedValue !== selectedTenant) {
      onTenantSelected?.(selectedValue);
    }
  };

  const handleClickOutside = useCallback(
    (event: MouseEvent) => {
      if (isOpen && !selectRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    },
    [isOpen, setIsOpen],
  );

  useEffect(() => {
    if (isOpen) {
      window.addEventListener('click', handleClickOutside);
    }
    return () => {
      window.removeEventListener('click', handleClickOutside);
    };
  }, [isOpen, handleClickOutside]);

  const toggle = (toggleRef: Ref<MenuToggleElement>) => (
    <MenuToggle
      isDisabled={isDisabled}
      ref={toggleRef}
      onClick={onToggle}
      isExpanded={isOpen}
      data-test={TestIds.TenantToggle}
    >
      {selectedTenant ? selectedTenant : t('Select a tenant')}
    </MenuToggle>
  );

  return (
    <div ref={selectRef}>
      <Select
        id="logging-view-tenant-dropdown"
        selected={selectedTenant}
        onSelect={onSelect}
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        toggle={toggle}
      >
        <SelectList>
          {TENANTS.map((tenant) => (
            <SelectOption key={tenant} value={tenant}>
              {tenant}
            </SelectOption>
          ))}
        </SelectList>
      </Select>
    </div>
  );
};
