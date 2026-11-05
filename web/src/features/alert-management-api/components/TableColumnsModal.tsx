import ColumnManagementModal from '@patternfly/react-component-groups/dist/dynamic/ColumnManagementModal';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

type TableColumnsModalProps<K extends string> = {
  isOpen: boolean;
  definitions: ReadonlyArray<{ key: K; label: string }>;
  columns: K[];
  defaults: K[];
  required: K[];
  onSave: (columns: K[]) => void;
  onClose: () => void;
};

export function TableColumnsModal<K extends string>({
  isOpen,
  definitions,
  columns,
  defaults,
  required,
  onSave,
  onClose,
}: TableColumnsModalProps<K>) {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const appliedColumns = useMemo(() => {
    const ordered = [
      ...columns,
      ...definitions.map(({ key }) => key).filter((key) => !columns.includes(key)),
    ];
    return ordered.flatMap((key) => {
      const definition = definitions.find((column) => column.key === key);
      if (!definition) return [];
      return [
        {
          key,
          title: t(definition.label),
          isShown: columns.includes(key),
          isShownByDefault: defaults.includes(key),
          isUntoggleable: required.includes(key),
        },
      ];
    });
  }, [definitions, columns, defaults, required, t]);

  return (
    <ColumnManagementModal
      isOpen={isOpen}
      onClose={onClose}
      title={t('Manage columns')}
      description={t('Selected categories will be displayed in the table.')}
      enableDragDrop
      appliedColumns={appliedColumns}
      applyColumns={(updated) =>
        onSave(updated.filter(({ isShown }) => isShown).map(({ key }) => key as K))
      }
    />
  );
}
