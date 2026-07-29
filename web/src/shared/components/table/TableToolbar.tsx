import {
  Button,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
  ToolbarItemVariant,
  ToolbarProps,
} from '@patternfly/react-core';
import { FC, PropsWithChildren, ReactNode, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

/** extends ToolbarProps */
export interface DataViewToolbarProps extends Omit<PropsWithChildren<ToolbarProps>, 'ref'> {
  /** Custom OUIA ID */
  ouiaId?: string;
  /** React node to display bulk select */
  bulkSelect?: ReactNode;
  /** React node to display pagination */
  pagination?: ReactNode;
  /** React node to display actions */
  actions?: ReactNode;
  /** React node to display filters */
  filters?: ReactNode;
}

export const TableToolbar: FC<DataViewToolbarProps> = ({
  ouiaId = 'DataViewToolbar',
  bulkSelect,
  actions,
  pagination,
  filters,
  clearAllFilters,
  children,
  ...props
}: DataViewToolbarProps) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  const defaultClearFilters = useMemo(
    () => (
      <ToolbarItem>
        <Button
          ouiaId={`${ouiaId}-clear-all-filters`}
          variant="link"
          onClick={clearAllFilters}
          isInline
        >
          {t('Clear all filters')}
        </Button>
      </ToolbarItem>
    ),
    [ouiaId, clearAllFilters, t],
  );
  return (
    <Toolbar ouiaId={ouiaId} customLabelGroupContent={defaultClearFilters} {...props}>
      <ToolbarContent>
        {bulkSelect && (
          <ToolbarItem data-ouia-component-id={`${ouiaId}-bulk-select`}>{bulkSelect}</ToolbarItem>
        )}
        {filters && <ToolbarItem>{filters}</ToolbarItem>}
        {actions && <ToolbarItem>{actions}</ToolbarItem>}
        {pagination && (
          <ToolbarItem
            variant={ToolbarItemVariant.pagination}
            data-ouia-component-id={`${ouiaId}-pagination`}
          >
            {pagination}
          </ToolbarItem>
        )}
        {children}
      </ToolbarContent>
    </Toolbar>
  );
};
