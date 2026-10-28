import ColumnManagementModal from '@patternfly/react-component-groups/dist/dynamic/ColumnManagementModal';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import {
  alertColumns,
  defaultAlertColumns,
} from '@/features/alert-management-api/pages/alerts-page/utils/alert-columns';
import type { AlertColumn } from '@/features/alert-management-api/pages/alerts-page/utils/alert-columns';

type ManageColumsModalProps = {
  isOpen: boolean;
  isAggregated: boolean;
  columns: AlertColumn[];
  onSave: (newColumns: AlertColumn[]) => void;
  onClose: () => void;
};

export function ManageColumnsModal({
  isOpen,
  isAggregated,
  columns,
  onSave,
  onClose,
}: ManageColumsModalProps) {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const appliedColumns = useMemo(() => {
    const orderedColumns = [
      ...columns,
      ...alertColumns.map((alertColumn) => alertColumn.key).filter((key) => !columns.includes(key)),
    ];
    return orderedColumns
      .filter((key) => isAggregated || key !== 'total')
      .map((key) => ({
        key,
        title: t(alertColumns.find((column) => column.key === key)!.label),
        isShown: columns.includes(key),
        isShownByDefault: defaultAlertColumns.includes(key),
        isUntoggleable: key === 'name' || key === 'severity',
      }));
  }, [columns, isAggregated, t]);

  return (
    <ColumnManagementModal
      isOpen={isOpen}
      onClose={onClose}
      title={t('Manage columns')}
      description={t('Selected categories will be displayed in the table.')}
      enableDragDrop
      appliedColumns={appliedColumns}
      applyColumns={(updatedColumns) => {
        const newColumnList = updatedColumns
          .filter((updatedColumn) => updatedColumn.isShown)
          .map((updatedColumn) => updatedColumn.key as AlertColumn);
        if (!isAggregated && columns.includes('total')) {
          newColumnList.splice(
            Math.min(columns.indexOf('total'), newColumnList.length),
            0,
            'total',
          );
        }
        onSave(newColumnList);
      }}
    />
  );
}
