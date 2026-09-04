import { Timestamp } from '@openshift-console/dynamic-plugin-sdk';
import {
  EmptyState,
  EmptyStateBody,
  EmptyStateVariant,
  Flex,
  FlexItem,
  Label,
  MenuToggle,
  Title,
} from '@patternfly/react-core';
import DataView from '@patternfly/react-data-view/dist/dynamic/DataView';
import {
  DataViewTable,
  type DataViewTr,
} from '@patternfly/react-data-view/dist/dynamic/DataViewTable';
import { DataViewToolbar } from '@patternfly/react-data-view/dist/dynamic/DataViewToolbar';
import { useDataViewSort } from '@patternfly/react-data-view/dist/dynamic/Hooks';
import RhUiEllipsisVerticalFillIcon from '@patternfly/react-icons/dist/esm/icons/rh-ui-ellipsis-vertical-fill-icon';
import { ActionsColumn } from '@patternfly/react-table';
import type { DashboardResource } from '@perses-dev/client';
import { type FC, memo, type ReactNode, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';

import {
  DeleteActionModal,
  DuplicateActionModal,
  RenameActionModal,
} from '@/features/perses-dashboards/components/DashboardActionModals';
import { useDashboardsData } from '@/features/perses-dashboards/hooks/useDashboardsData';
import { usePersesDashboardAccess } from '@/features/perses-dashboards/hooks/usePersesDashboardAccess';
import { DashboardListFrame } from '@/features/perses-dashboards/pages/dashboard-list-page/DashboardListFrame';
import { useTableColumns } from '@/shared/components/table/hooks/useTableColumns';
import { rowFilter, useTableFilters } from '@/shared/components/table/hooks/useTableFilters';
import { useTablePagination } from '@/shared/components/table/hooks/useTablePagination';
import { directedSort, localeCompareSort } from '@/shared/components/table/sort-utils';
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
  }: {
    project: string;
    dashboard: DashboardResource;
    onRename: (dashboard: DashboardResource) => void;
    onDuplicate: (dashboard: DashboardResource) => void;
    onDelete: (dashboard: DashboardResource) => void;
  }) => {
    const { t } = useTranslation(process.env.I18N_NAMESPACE);
    const [checkAccess, setCheckAccess] = useState(false);

    const [canUpdate, updateChecking] = usePersesDashboardAccess('update', project, checkAccess);
    const [canDelete, deleteChecking] = usePersesDashboardAccess('delete', project, checkAccess);

    const rowSpecificActions = useMemo(
      () => [
        {
          title: t('Rename dashboard'),
          onClick: () => onRename(dashboard),
          isAriaDisabled: updateChecking || !canUpdate,
          tooltipProps:
            !updateChecking && !canUpdate
              ? { content: t('You do not have permission to edit dashboards in this project.') }
              : undefined,
        },
        {
          title: t('Duplicate dashboard'),
          onClick: () => onDuplicate(dashboard),
        },
        {
          title: t('Delete dashboard'),
          onClick: () => onDelete(dashboard),
          isAriaDisabled: deleteChecking || !canDelete,
          tooltipProps:
            !deleteChecking && !canDelete
              ? { content: t('You do not have permission to delete dashboards in this project.') }
              : undefined,
        },
      ],
      [
        dashboard,
        onRename,
        onDuplicate,
        onDelete,
        t,
        canUpdate,
        updateChecking,
        canDelete,
        deleteChecking,
      ],
    );

    return (
      <ActionsColumn
        items={rowSpecificActions}
        actionsToggle={({ onToggle, isOpen, isDisabled, toggleRef }) => (
          <MenuToggle
            aria-label={t('Actions')}
            ref={toggleRef}
            onClick={(event) => {
              if (!isOpen) {
                setCheckAccess(true);
              }
              onToggle(event);
            }}
            isExpanded={isOpen}
            isDisabled={isDisabled}
            variant="plain"
            icon={<RhUiEllipsisVerticalFillIcon />}
          />
        )}
      />
    );
  },
);

DashboardActionsCell.displayName = 'DashboardActionsCell';

interface DashboardRowNameLink {
  link: ReactNode;
  label: string;
}

interface DashboardRow {
  name: DashboardRowNameLink;
  tags: ReactNode;
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
  tags?: string;
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
  if (sortBy === rowFilter('tags')) {
    return [...data].sort((a, b) =>
      directedSort(
        (a.dashboard.metadata?.tags?.length || 0) - (b.dashboard.metadata?.tags?.length || 0),
        direction,
      ),
    );
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
    initialFilters: { name: '', 'project-filter': '', tags: '' },
  });
  const pagination = useTablePagination({ perPage: ITEMS_PER_PAGE[0] });
  const { page, perPage, onSetPage } = pagination;

  const [activeAttributeMenu, setActiveAttributeMenu] = useState<string>(t('Dashboard'));

  const columnKeys = useMemo(
    () => [
      { label: t('Dashboard'), key: rowFilter('name') },
      { label: t('Project'), key: rowFilter('project') },
      { label: t('Tags'), key: rowFilter('tags') },
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

      const sortedTags = board?.metadata?.tags ? board.metadata.tags.slice().sort() : [];

      const dashboardTags = (
        <Flex spaceItems={{ default: 'spaceItemsXs' }} wrap="wrap">
          {sortedTags.map((tag, ix) => (
            <FlexItem key={ix}>
              <Label variant="outline" isCompact>
                {tag}
              </Label>
            </FlexItem>
          ))}
        </Flex>
      );

      return {
        name: dashboardName,
        project: board?.metadata?.project || '',
        tags: dashboardTags,
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

  const pageRows: DataViewTr[] = useMemo(() => {
    return sortedAndFilteredData
      .slice((page - 1) * perPage, (page - 1) * perPage + perPage)
      .map(({ name, project, tags, created, modified, dashboard }) => [
        name.link,
        project,
        tags,
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
            />
          ),
          props: { isActionCell: true },
        },
      ]);
  }, [
    sortedAndFilteredData,
    page,
    perPage,
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
    <DashboardListFrame>
      <DashboardsTable
        persesDashboards={persesDashboards}
        persesDashboardsLoading={combinedInitialLoad}
        activeProject={activeProject}
      />
    </DashboardListFrame>
  );
};
