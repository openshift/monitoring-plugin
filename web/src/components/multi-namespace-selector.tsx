import {
  Label,
  LabelGroup,
  MenuToggle,
  MenuToggleElement,
  Select,
  SelectList,
  SelectOption,
  TextInputGroup,
  TextInputGroupMain,
  TextInputGroupUtilities,
  Button,
  Badge,
  Divider,
} from '@patternfly/react-core';
import { TimesIcon } from '@patternfly/react-icons';
import type { FC, Ref } from 'react';
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

const MAX_NAMESPACES = 25;

type MultiNamespaceSelectorProps = {
  accessibleNamespaces: string[];
  selectedNamespaces: string[];
  allSelected: boolean;
  toggleNamespace: (ns: string) => void;
  toggleAll: () => void;
  deselectAll: () => void;
};

export const MultiNamespaceSelector: FC<MultiNamespaceSelectorProps> = ({
  accessibleNamespaces,
  selectedNamespaces,
  allSelected,
  toggleNamespace,
  toggleAll,
  deselectAll,
}) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const [isOpen, setIsOpen] = useState(false);
  const [filterValue, setFilterValue] = useState('');
  const textInputRef = useRef<HTMLInputElement>();

  const filteredNamespaces = useMemo(
    () =>
      filterValue
        ? accessibleNamespaces.filter((ns) => ns.toLowerCase().includes(filterValue.toLowerCase()))
        : accessibleNamespaces,
    [accessibleNamespaces, filterValue],
  );

  const onToggle = () => {
    setIsOpen((prev) => !prev);
  };

  const onSelect = (_event: React.MouseEvent, value: string) => {
    if (value === '__all__') {
      toggleAll();
    } else {
      if (
        !allSelected &&
        selectedNamespaces.length >= MAX_NAMESPACES &&
        !selectedNamespaces.includes(value)
      ) {
        return;
      }
      toggleNamespace(value);
    }
  };

  const onTextInputChange = (_event: React.FormEvent, value: string) => {
    setFilterValue(value);
  };

  const toggle = (toggleRef: Ref<MenuToggleElement>) => (
    <MenuToggle
      variant="typeahead"
      onClick={onToggle}
      innerRef={toggleRef}
      isExpanded={isOpen}
      style={{ width: '400px' }}
      data-test="multi-namespace-toggle"
    >
      <TextInputGroup isPlain>
        <TextInputGroupMain
          value={filterValue}
          onClick={onToggle}
          onChange={onTextInputChange}
          innerRef={textInputRef}
          placeholder={
            selectedNamespaces.length > 0
              ? t('{{count}} namespace(s) selected', { count: selectedNamespaces.length })
              : t('Select namespaces...')
          }
          role="combobox"
          isExpanded={isOpen}
          aria-controls="multi-namespace-select-listbox"
        />
        <TextInputGroupUtilities>
          {selectedNamespaces.length > 0 && (
            <Button
              variant="plain"
              onClick={() => {
                deselectAll();
                setFilterValue('');
              }}
              aria-label={t('Clear selections')}
            >
              <TimesIcon aria-hidden />
            </Button>
          )}
          {selectedNamespaces.length > 0 && <Badge isRead>{selectedNamespaces.length}</Badge>}
        </TextInputGroupUtilities>
      </TextInputGroup>
    </MenuToggle>
  );

  return (
    <div>
      <Select
        id="multi-namespace-select"
        isOpen={isOpen}
        selected={selectedNamespaces}
        onSelect={onSelect}
        onOpenChange={(open) => setIsOpen(open)}
        toggle={toggle}
        data-test="multi-namespace-selector"
      >
        <SelectList id="multi-namespace-select-listbox">
          <SelectOption
            hasCheckbox
            value="__all__"
            isSelected={allSelected}
            data-test="multi-namespace-all-option"
          >
            {t('All Namespaces')}
            <Badge isRead style={{ marginLeft: '8px' }}>
              {accessibleNamespaces.length}
            </Badge>
          </SelectOption>
          <Divider />
          {filteredNamespaces.map((ns) => (
            <SelectOption
              hasCheckbox
              key={ns}
              value={ns}
              isSelected={selectedNamespaces.includes(ns)}
              isDisabled={
                !allSelected &&
                selectedNamespaces.length >= MAX_NAMESPACES &&
                !selectedNamespaces.includes(ns)
              }
              data-test={`multi-namespace-option-${ns}`}
            >
              {ns}
            </SelectOption>
          ))}
        </SelectList>
      </Select>
      {selectedNamespaces.length > 0 && selectedNamespaces.length <= 10 && (
        <LabelGroup categoryName={t('Namespaces')} style={{ marginTop: '8px' }}>
          {selectedNamespaces.map((ns) => (
            <Label key={ns} onClose={() => toggleNamespace(ns)} variant="outline">
              {ns}
            </Label>
          ))}
        </LabelGroup>
      )}
      {selectedNamespaces.length > MAX_NAMESPACES && (
        <div
          style={{
            marginTop: '8px',
            color: 'var(--pf-t--global--color--status--warning--default)',
          }}
        >
          {t('Maximum {{max}} namespaces can be queried at once.', { max: MAX_NAMESPACES })}
        </div>
      )}
    </div>
  );
};
