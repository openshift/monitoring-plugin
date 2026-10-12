import {
  Button,
  Checkbox,
  Content,
  DataList,
  DataListCell,
  DataListItem,
  DataListItemCells,
  DataListItemRow,
  Flex,
  FlexItem,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalVariant,
  Panel,
  PanelMain,
} from '@patternfly/react-core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import '@/features/alert-management-api/assets/manage-columns-modal.css';
import {
  maxAlertColumns,
  optionalAlertColumns,
} from '@/features/alert-management-api/pages/alerts-page/utils/alert-columns';
import type { OptionalAlertColumn } from '@/features/alert-management-api/pages/alerts-page/utils/alert-columns';
import { DataTestIDs } from '@/shared/constants/data-test';

type Props = {
  isOpen: boolean;
  isAggregated: boolean;
  columns: Set<OptionalAlertColumn>;
  onSave: (newColumns: Set<OptionalAlertColumn>) => void;
  onClose: () => void;
};

export function ManageColumnsModal({ isOpen, isAggregated, columns, onSave, onClose }: Props) {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const [draftColumns, setDraftColumns] = useState(columns);
  const visibleColumnCount =
    2 + [...draftColumns].filter((column) => column !== 'total' || isAggregated).length;
  const requiredColumns = [
    { id: DataTestIDs.AlertManagementAPI.ColumnNameCheckbox, label: t('Alert name') },
    { id: DataTestIDs.AlertManagementAPI.ColumnSeverityCheckbox, label: t('Severity') },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      variant={ModalVariant.small}
      aria-labelledby={DataTestIDs.AlertManagementAPI.ColumnsModalTitle}
      aria-describedby={DataTestIDs.AlertManagementAPI.ColumnsModalDescription}
    >
      <ModalHeader
        title={t('Manage columns')}
        labelId={DataTestIDs.AlertManagementAPI.ColumnsModalTitle}
        description={t('Selected categories will be displayed in the table.')}
        descriptorId={DataTestIDs.AlertManagementAPI.ColumnsModalDescription}
      />
      <ModalBody>
        <Flex
          direction={{ default: 'column' }}
          alignItems={{ default: 'alignItemsStretch' }}
          spaceItems={{ default: 'spaceItemsMd' }}
        >
          <FlexItem alignSelf={{ default: 'alignSelfFlexStart' }}>
            <Button
              variant="link"
              onClick={() =>
                setDraftColumns(
                  new Set(
                    optionalAlertColumns
                      .map(({ key }) => key)
                      .filter((key) => isAggregated || key !== 'total'),
                  ),
                )
              }
              isInline
            >
              {t('Select all')}
            </Button>
          </FlexItem>
          <Panel variant="bordered" isScrollable>
            <PanelMain maxHeight="25rem">
              <DataList
                aria-label={t('Alert columns')}
                className="manage-columns-modal__list"
                isCompact
                gridBreakpoint="none"
              >
                {requiredColumns.map(({ id, label }) => (
                  <ColumnRow
                    id={id}
                    label={label}
                    key={id}
                    isChecked
                    isDisabled
                    onChange={() => {}}
                  />
                ))}
                {optionalAlertColumns.map(({ key, label }) => {
                  const id = `${DataTestIDs.AlertManagementAPI.ColumnCheckboxPrefix}-${key}`;
                  const isChecked = draftColumns.has(key) && (key !== 'total' || isAggregated);
                  const isAtLimit = !isChecked && visibleColumnCount >= maxAlertColumns;
                  const isDisabled = (key === 'total' && !isAggregated) || isAtLimit;
                  return (
                    <ColumnRow
                      id={id}
                      label={t(label)}
                      key={id}
                      isChecked={isChecked}
                      isDisabled={isDisabled}
                      onChange={(_event, checked) => {
                        const nextColumns = new Set(draftColumns);
                        if (checked) nextColumns.add(key);
                        else nextColumns.delete(key);
                        setDraftColumns(nextColumns);
                      }}
                    />
                  );
                })}
              </DataList>
            </PanelMain>
          </Panel>
          <Content component="small">
            {t(
              'Maximum {{maximum}} columns can be displayed. Currently showing {{current}} columns.',
              {
                maximum: maxAlertColumns,
                current: visibleColumnCount,
              },
            )}
          </Content>
        </Flex>
      </ModalBody>
      <ModalFooter>
        <Button onClick={() => onSave(draftColumns)}>{t('Save')}</Button>
        <Button variant="link" onClick={onClose}>
          {t('Cancel')}
        </Button>
      </ModalFooter>
    </Modal>
  );
}

function ColumnRow({
  id,
  label,
  isChecked,
  isDisabled,
  onChange,
}: {
  id: string;
  label: string;
  isChecked: boolean;
  isDisabled: boolean;
  onChange: (event: React.FormEvent<HTMLInputElement>, checked: boolean) => void;
}) {
  return (
    <DataListItem key={id} aria-labelledby={id}>
      <DataListItemRow>
        <DataListItemCells
          dataListCells={[
            <DataListCell key="checkbox">
              {
                <Checkbox
                  id={id}
                  label={label}
                  isChecked={isChecked}
                  isDisabled={isDisabled}
                  onChange={onChange}
                />
              }
            </DataListCell>,
          ]}
        />
      </DataListItemRow>
    </DataListItem>
  );
}
