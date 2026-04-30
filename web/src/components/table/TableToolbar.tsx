import { FC, PropsWithChildren, useRef } from 'react';
import {
  Button,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
  ToolbarItemVariant,
  ToolbarProps,
} from '@patternfly/react-core';

/** extends ToolbarProps */
export interface DataViewToolbarProps extends Omit<PropsWithChildren<ToolbarProps>, 'ref'> {
  /** Custom OUIA ID */
  ouiaId?: string;
  /** React node to display bulk select */
  bulkSelect?: React.ReactNode;
  /** React node to display pagination */
  pagination?: React.ReactNode;
  /** React node to display actions */
  actions?: React.ReactNode;
  /** React node to display filters */
  filters?: React.ReactNode;
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
  const defaultClearFilters = useRef(
    <ToolbarItem>
      <Button
        ouiaId={`${ouiaId}-clear-all-filters`}
        variant="link"
        onClick={clearAllFilters}
        isInline
      >
        Clear filters
      </Button>
    </ToolbarItem>,
  );
  return (
    <Toolbar ouiaId={ouiaId} customLabelGroupContent={defaultClearFilters.current} {...props}>
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
