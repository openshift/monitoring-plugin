import {
  Flex,
  HelperText,
  HelperTextItem,
  MenuSearch,
  MenuSearchInput,
  MenuToggle,
  SearchInput,
  Select,
  SelectList,
  SelectOption,
} from '@patternfly/react-core';
import { ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AlertFilterLabel } from '@/features/alert-management-api/components/AlertFilterLabel';
import { AlertFilterOption } from '@/features/alert-management-api/types/types';
import { DataTestIDs } from '@/shared/constants/data-test';

type Props = {
  filterKey: string;
  label: string;
  hideLabel?: boolean;
  placeholder: string;
  options: AlertFilterOption[];
  renderOptionLabel?: (option: AlertFilterOption) => ReactNode;
  selected: string[];
  onChange: (selected: string[]) => void;
  emptyHint?: string;
  icon?: ReactNode;
  emptyOptionsLabel?: string;
  labelTooltip?: string;
  searchLabel?: string;
  searchPlaceholder?: string;
};

export function AlertFilterSelect({
  filterKey,
  label,
  hideLabel = false,
  placeholder,
  options,
  renderOptionLabel,
  selected,
  onChange,
  emptyHint,
  icon,
  emptyOptionsLabel,
  labelTooltip,
  searchLabel,
  searchPlaceholder,
}: Props) {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const [isOpen, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const selectedText =
    selected.length === 0
      ? t(placeholder)
      : selected.length === 1
        ? (options.find((option) => option.value === selected[0])?.label ?? selected[0])
        : `${t(placeholder)} (${selected.length})`;
  const visibleOptions = options.filter((option) =>
    option.label.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
  );

  const setOpenState = (open: boolean) => {
    setOpen(open);
    if (!open) setSearch('');
  };

  return (
    <Flex
      direction={{ default: 'column' }}
      alignItems={{ default: 'alignItemsStretch' }}
      spaceItems={{ default: 'spaceItemsSm' }}
    >
      {!hideLabel &&
        (labelTooltip ? (
          <AlertFilterLabel label={label} tooltip={labelTooltip} />
        ) : (
          <strong>{t(label)}</strong>
        ))}
      <Select
        id={`${DataTestIDs.AlertManagementAPI.FilterSelectPrefix}-${filterKey}`}
        role="menu"
        aria-label={t(label)}
        isOpen={isOpen}
        selected={selected}
        onOpenChange={setOpenState}
        onSelect={(_event, value) => {
          if (typeof value !== 'string') return;
          onChange(
            selected.includes(value)
              ? selected.filter((selectedValue) => selectedValue !== value)
              : [...selected, value],
          );
        }}
        toggle={(toggleRef) => (
          <MenuToggle
            ref={toggleRef}
            isExpanded={isOpen}
            isFullWidth
            isInForm
            icon={icon}
            onClick={() => setOpenState(!isOpen)}
          >
            {selectedText}
          </MenuToggle>
        )}
        shouldFocusToggleOnSelect
      >
        {searchLabel && (
          <MenuSearch>
            <MenuSearchInput>
              <SearchInput
                id={`${DataTestIDs.AlertManagementAPI.FilterSearchInputPrefix}-${filterKey}`}
                aria-label={t(searchLabel)}
                placeholder={t(searchPlaceholder ?? searchLabel)}
                value={search}
                onChange={(_event, value) => setSearch(value)}
                onClear={() => setSearch('')}
              />
            </MenuSearchInput>
          </MenuSearch>
        )}
        <SelectList>
          {visibleOptions.length === 0 ? (
            <SelectOption isDisabled>
              {t(emptyOptionsLabel ?? 'No filter options found')}
            </SelectOption>
          ) : (
            visibleOptions.map((option) => (
              <SelectOption
                key={option.value}
                value={option.value}
                hasCheckbox
                isSelected={selected.includes(option.value)}
              >
                {renderOptionLabel ? renderOptionLabel(option) : option.label} ({option.count})
              </SelectOption>
            ))
          )}
        </SelectList>
      </Select>
      {emptyHint && selected.length === 0 && (
        <HelperText>
          <HelperTextItem>
            <em style={{ color: 'var(--pf-t--global--text--color--subtle)' }}>{t(emptyHint)}</em>
          </HelperTextItem>
        </HelperText>
      )}
    </Flex>
  );
}
