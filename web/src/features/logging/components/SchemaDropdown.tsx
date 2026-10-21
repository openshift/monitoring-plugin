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

import { Schema } from '@/features/logging/utils/logs-types';
import { TestIds } from '@/features/logging/utils/test-ids';

type SchemaDropdownProps = {
  onSchemaSelected: ((schema: Schema) => void) | undefined;
  schema: Schema;
};

export const SchemaDropdown: FC<SchemaDropdownProps> = ({ onSchemaSelected, schema }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  const [isOpen, setIsOpen] = useState(false);

  const schemaSelectRef = useRef<HTMLDivElement>(null);

  const onToggle = () => setIsOpen((prevOpenState) => !prevOpenState);
  const onSelect = (
    _: ReactMouseEvent<Element, MouseEvent> | undefined,
    value: string | number | undefined,
  ) => {
    if (value != schema) {
      onSchemaSelected?.(value as Schema);
    }
    setIsOpen(false);
  };

  const handleClickOutside = useCallback(
    (event: MouseEvent) => {
      if (isOpen && !schemaSelectRef.current?.contains(event.target as Node)) {
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
      ref={toggleRef}
      onClick={onToggle}
      isExpanded={isOpen}
      data-test={TestIds.SchemaToggle}
    >
      {schema ? schema : t('Select a Schema')}
    </MenuToggle>
  );

  return (
    <div ref={schemaSelectRef}>
      <Select
        id="logging-view-schema-dropdown"
        selected={schema}
        onSelect={onSelect}
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        toggle={toggle}
      >
        <SelectList>
          <SelectOption key={'otel'} value={Schema.otel}>
            otel
          </SelectOption>
          <SelectOption key={'viaq'} value={Schema.viaq}>
            viaq
          </SelectOption>
        </SelectList>
      </Select>
    </div>
  );
};
