import { Timestamp } from '@openshift-console/dynamic-plugin-sdk';
import {
  EmptyState,
  EmptyStateBody,
  EmptyStateVariant,
  Title,
  Tooltip,
} from '@patternfly/react-core';
import DataView from '@patternfly/react-data-view/dist/dynamic/DataView';
import {
  DataViewTable,
  type DataViewTr,
} from '@patternfly/react-data-view/dist/dynamic/DataViewTable';
import { DataViewToolbar } from '@patternfly/react-data-view/dist/dynamic/DataViewToolbar';
import { useDataViewSort } from '@patternfly/react-data-view/dist/dynamic/Hooks';
import { ActionsColumn } from '@patternfly/react-table';
import type { DashboardResource } from '@perses-dev/core';
import { type FC, memo, type ReactNode, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';

import {
  DeleteActionModal,
  DuplicateActionModal,
  RenameActionModal,
} from '@/features/perses-dashboards/components/DashboardActionModals';
import { useDashboardsData } from '@/features/perses-dashboards/hooks/useDashboardsData';
import { useEditableProjects } from '@/features/perses-dashboards/hooks/useEditableProjects';
import { usePersesEditPermissions } from '@/features/perses-dashboards/hooks/usePersesEditPermissions';
import { DashboardListFrame } from '@/features/perses-dashboards/pages/dashboard-list-page/DashboardListFrame';
import { useTableColumns } from '@/shared/components/table/hooks/useTableColumns';
import { rowFilter, useTableFilters } from '@/shared/components/table/hooks/useTableFilters';
import { useTablePagination } from '@/shared/components/table/hooks/useTablePagination';
import { localeCompareSort } from '@/shared/components/table/sort-utils';
import {
  TableFilter,
  TableFilterOption,
  type TableFilterProps,
  TableFilters,
} from '@/shared/components/table/TableFilters';
import { ITEMS_PER_PAGE, TablePagination } from '@/shared/components/table/TablePagination';
import { TableToolbar } from '@/shared/components/table/TableToolbar';
import { listPersesDashboardsDataTestIDs } from '@/shared/constants/data-test';
import { getDashboardUrl, usePerspective } from '@/shared/hooks/usePerspective';
import { ALL_NAMESPACES_KEY } from '@/shared/utils/utils';

const DashboardActionsCell = memo(
  ({
    project,
    dashboard,
    onRename,
    onDuplicate,
    onDelete,
    emptyActions,
  }: {
    project: string;
    dashboard: DashboardResource;
    onRename: (dashboard: DashboardResource) => void;
    onDuplicate: (dashboard: DashboardResource) => void;
    onDelete: (dashboard: DashboardResource) => void;
    emptyActions: { title: string; onClick: () => void }[];
  }) => {
    const { t } = useTranslation(process.env.I18N_NAMESPACE);

    const { permissionsLoading } = useEditableProjects();
    const { canEdit } = usePersesEditPermissions(project);
    const disabled = !canEdit;

    const rowSpecificActions = useMemo(
      () => [
        {
          title: t('Rename dashboard'),
          onClick: () => onRename(dashboard),
        },
        {
          title: t('Duplicate dashboard'),
          onClick: () => onDuplicate(dashboard),
        },
        {
          title: t('Delete dashboard'),
          onClick: () => onDelete(dashboard),
        },
      ],
      [dashboard, onRename, onDuplicate, onDelete, t],
    );

    if (disabled) {
      return (
        <Tooltip content={t("You don't have permissions for dashboard actions")}>
          <div>
            <ActionsColumn items={emptyActions} isDisabled={true} />
          </div>
        </Tooltip>
      );
    }
    if (permissionsLoading) {
      return (
        <Tooltip content={t('Checking permissions...')}>
          <div>
            <ActionsColumn items={emptyActions} isDisabled={true} />
          </div>
        </Tooltip>
      );
    }

    return <ActionsColumn items={rowSpecificActions} isDisabled={false} />;
  },
);

DashboardActionsCell.displayName = 'DashboardActionsCell';

interface DashboardRowNameLink {
  link: ReactNode;
  label: string;
}

interface DashboardRow {
  name: DashboardRowNameLink;
  project: string;
  created: ReactNode;
  modified: ReactNode;
  // Raw values for sorting
  createdAt?: string;
  updatedAt?: string;
  // Reference to original dashboard data
  dashboard: DashboardResource;
}

interface DashboardRowFilters {
  name?: string;
  'project-filter'?: string;
}

const sortDashboardData = (
  data: DashboardRow[],
  sortBy: string | undefined,
  direction: 'asc' | 'desc' | undefined,
): DashboardRow[] => {
  if (!sortBy || !direction) {
    return data;
  }
  if (sortBy === rowFilter('name')) {
    return [...data].sort((a, b) => localeCompareSort(a.name.label, b.name.label, direction));
  }
  if (sortBy === rowFilter('project')) {
    return [...data].sort((a, b) => localeCompareSort(a.project, b.project, direction));
  }
  if (sortBy === rowFilter('created')) {
    return [...data].sort((a, b) => localeCompareSort(a.createdAt, b.createdAt, direction));
  }
  if (sortBy === rowFilter('modified')) {
    return [...data].sort((a, b) => localeCompareSort(a.updatedAt, b.updatedAt, direction));
  }
  return data;
};

interface DashboardsTableProps {
  persesDashboards: DashboardResource[];
  persesDashboardsLoading: boolean;
  activeProject: string | null;
}

const DashboardsTable: FC<DashboardsTableProps> = ({
  persesDashboards,
  persesDashboardsLoading,
  activeProject,
}) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  const { perspective } = usePerspective();
  const dashboardBaseURL = getDashboardUrl(perspective);

  const [searchParams, setSearchParams] = useSearchParams();
  const { sortBy, direction, onSort } = useDataViewSort({ searchParams, setSearchParams });

  const { filters, onSetFilters, clearAllFilters } = useTableFilters<DashboardRowFilters>({
    initialFilters: { name: '', 'project-filter': '' },
  });
  const pagination = useTablePagination({ perPage: ITEMS_PER_PAGE[0] });
  const { page, perPage, onSetPage } = pagination;

  const [activeAttributeMenu, setActiveAttributeMenu] = useState<string>(t('Dashboard'));

  const columnKeys = useMemo(
    () => [
      { label: t('Dashboard'), key: rowFilter('name') },
      { label: t('Project'), key: rowFilter('project') },
      { label: t('Created on'), key: rowFilter('created') },
      { label: t('Last Modified'), key: rowFilter('modified') },
    ],
    [t],
  );

  const columns = useTableColumns(columnKeys, sortBy, direction, onSort);

  const tableRows: DashboardRow[] = useMemo(() => {
    if (persesDashboardsLoading) {
      return [];
    }
    return persesDashboards.map((board) => {
      const metadata = board?.metadata;
      const displayName = board?.spec?.display?.name || metadata?.name;
      const dashboardsParams = `?dashboard=${metadata?.name}&project=${metadata?.project}`;
      const dashboardName: DashboardRowNameLink = {
        link: (
          <Link
            to={`${dashboardBaseURL}${dashboardsParams}`}
            data-test={`perseslistpage-${board?.metadata?.name}`}
          >
            {displayName}
          </Link>
        ),
        label: displayName || '',
      };

      return {
        name: dashboardName,
        project: board?.metadata?.project || '',
        created: <Timestamp timestamp={metadata?.createdAt} />,
        modified: <Timestamp timestamp={metadata?.updatedAt} />,
        createdAt: metadata?.createdAt,
        updatedAt: metadata?.updatedAt,
        dashboard: board,
      };
    });
  }, [dashboardBaseURL, persesDashboards, persesDashboardsLoading]);

  const sortedAndFilteredData = useMemo(
    () =>
      sortDashboardData(
        tableRows.filter(
          (item) =>
            (!filters.name ||
              item.name?.label?.toLocaleLowerCase().includes(filters.name?.toLocaleLowerCase())) &&
            (!filters['project-filter'] ||
              item.project
                ?.toLocaleLowerCase()
                .includes(filters['project-filter']?.toLocaleLowerCase())) &&
            (activeProject === ALL_NAMESPACES_KEY || item.project === activeProject),
        ),
        sortBy,
        direction,
      ),
    [filters, tableRows, activeProject, direction, sortBy],
  );

  const [targetedDashboard, setTargetedDashboard] = useState<DashboardResource>();
  const [isRenameModalOpen, setIsRenameModalOpen] = useState<boolean>(false);
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState<boolean>(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);

  const handleRenameModalOpen = useCallback((dashboard: DashboardResource) => {
    setTargetedDashboard(dashboard);
    setIsRenameModalOpen(true);
  }, []);

  const handleRenameModalClose = useCallback(() => {
    setIsRenameModalOpen(false);
    setTargetedDashboard(undefined);
  }, []);

  const handleDuplicateModalOpen = useCallback((dashboard: DashboardResource) => {
    setTargetedDashboard(dashboard);
    setIsDuplicateModalOpen(true);
  }, []);

  const handleDuplicateModalClose = useCallback(() => {
    setIsDuplicateModalOpen(false);
    setTargetedDashboard(undefined);
  }, []);

  const handleDeleteModalOpen = useCallback((dashboard: DashboardResource) => {
    setTargetedDashboard(dashboard);
    setIsDeleteModalOpen(true);
  }, []);

  const handleDeleteModalClose = useCallback(() => {
    setIsDeleteModalOpen(false);
    setTargetedDashboard(undefined);
  }, []);

  const emptyRowActions = useMemo(
    () => [
      {
        title: t("You don't have permissions for dashboard actions"),
        onClick: () => {},
      },
    ],
    [t],
  );

  const pageRows: DataViewTr[] = useMemo(() => {
    return sortedAndFilteredData
      .slice((page - 1) * perPage, (page - 1) * perPage + perPage)
      .map(({ name, project, created, modified, dashboard }) => [
        name.link,
        project,
        created,
        modified,
        {
          cell: (
            <DashboardActionsCell
              project={project}
              dashboard={dashboard}
              onRename={handleRenameModalOpen}
              onDuplicate={handleDuplicateModalOpen}
              onDelete={handleDeleteModalOpen}
              emptyActions={emptyRowActions}
            />
          ),
          props: { isActionCell: true },
        },
      ]);
  }, [
    sortedAndFilteredData,
    page,
    perPage,
    emptyRowActions,
    handleRenameModalOpen,
    handleDuplicateModalOpen,
    handleDeleteModalOpen,
  ]);

  const onFiltersChange = useMemo(
    () => (filterName: keyof DashboardRowFilters) => {
      return (_e, val) => {
        onSetFilters({ [filterName]: val });
        onSetPage(undefined, 1);
      };
    },
    [onSetFilters, onSetPage],
  );

  const filterItems = useMemo<TableFilterProps<never>[]>(
    () => [
      {
        filterId: 'name',
        type: TableFilterOption.TEXT,
        title: t('Dashboard'),
        placeholder: t('Filter by name'),
        onChange: onFiltersChange('name'),
        value: filters.name ?? '',
        'data-test': listPersesDashboardsDataTestIDs.NameFilter,
      },
      {
        filterId: 'project-filter',
        type: TableFilterOption.TEXT,
        title: t('Project'),
        placeholder: t('Filter by project'),
        onChange: onFiltersChange('project-filter'),
        value: filters['project-filter'] ?? '',
        'data-test': listPersesDashboardsDataTestIDs.ProjectFilter,
      },
    ],
    [t, filters, onFiltersChange],
  );

  const hasFiltersApplied = filters.name || filters['project-filter'];
  const hasData = sortedAndFilteredData.length > 0;

  return (
    <DataView className="pf-v6-u-m-lg">
      <TableToolbar
        ouiaId="PersesDashList-DataViewHeader"
        clearAllFilters={clearAllFilters}
        pagination={<TablePagination itemCount={sortedAndFilteredData.length} {...pagination} />}
        filters={
          <TableFilters
            activeAttributeMenu={activeAttributeMenu}
            setActiveAttributeMenu={setActiveAttributeMenu}
            filterItems={filterItems}
          >
            {filterItems.map((filterItem) => (
              <TableFilter
                key={`table-filter-${filterItem.filterId}`}
                {...filterItem}
                showToolbarItem={filterItem.title === activeAttributeMenu}
              />
            ))}
          </TableFilters>
        }
      />
      {hasData ? (
        <>
          <RenameActionModal
            dashboard={targetedDashboard}
            isOpen={isRenameModalOpen}
            onClose={handleRenameModalClose}
            handleModalClose={handleRenameModalClose}
          />
          <DuplicateActionModal
            dashboard={targetedDashboard}
            isOpen={isDuplicateModalOpen}
            onClose={handleDuplicateModalClose}
            handleModalClose={handleDuplicateModalClose}
          />
          <DeleteActionModal
            dashboard={targetedDashboard}
            isOpen={isDeleteModalOpen}
            onClose={handleDeleteModalClose}
            handleModalClose={handleDeleteModalClose}
          />
          <DataViewTable
            aria-label="Perses Dashboards List"
            ouiaId={'PersesDashList-DataViewTable'}
            columns={columns}
            rows={pageRows}
          />
        </>
      ) : (
        <EmptyState variant={EmptyStateVariant.sm}>
          <Title
            headingLevel="h4"
            size="lg"
            data-test={listPersesDashboardsDataTestIDs.EmptyStateTitle}
          >
            {hasFiltersApplied ? t('No results found') : t('No dashboards found')}
          </Title>
          <EmptyStateBody data-test={listPersesDashboardsDataTestIDs.EmptyStateBody}>
            {hasFiltersApplied
              ? t('No results match the filter criteria. Clear filters to show results.')
              : t('No Perses dashboards are currently available in this project.')}
          </EmptyStateBody>
        </EmptyState>
      )}
      <DataViewToolbar
        ouiaId="PersesDashList-DataViewFooter"
        pagination={<TablePagination itemCount={sortedAndFilteredData.length} {...pagination} />}
      />
    </DataView>
  );
};

export const DashboardList: FC = () => {
  const { activeProject, persesDashboards, combinedInitialLoad } = useDashboardsData();

  return (
    <DashboardListFrame activeProject={activeProject}>
      <DashboardsTable
        persesDashboards={persesDashboards}
        persesDashboardsLoading={combinedInitialLoad}
        activeProject={activeProject}
      />
    </DashboardListFrame>
  );
};
