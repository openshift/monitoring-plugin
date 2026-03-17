import React, { ReactNode, useCallback, useMemo, useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { useDashboardsData } from './hooks/useDashboardsData';

import {
  Button,
  EmptyState,
  EmptyStateBody,
  EmptyStateVariant,
  Pagination,
  Title,
  Tooltip,
} from '@patternfly/react-core';
import { DataView } from '@patternfly/react-data-view/dist/dynamic/DataView';
import { DataViewFilters } from '@patternfly/react-data-view/dist/dynamic/DataViewFilters';
import {
  DataViewTable,
  DataViewTh,
  DataViewTr,
} from '@patternfly/react-data-view/dist/dynamic/DataViewTable';
import { DataViewTextFilter } from '@patternfly/react-data-view/dist/dynamic/DataViewTextFilter';
import { DataViewToolbar } from '@patternfly/react-data-view/dist/dynamic/DataViewToolbar';
import { useDataViewFilters, useDataViewSort } from '@patternfly/react-data-view';
import { useDataViewPagination } from '@patternfly/react-data-view/dist/dynamic/Hooks';
import { ActionsColumn, ThProps } from '@patternfly/react-table';
import { Link, useSearchParams } from 'react-router-dom-v5-compat';

import { getDashboardUrl, usePerspective } from '../../hooks/usePerspective';
import { Timestamp } from '@openshift-console/dynamic-plugin-sdk';
import { listPersesDashboardsDataTestIDs } from '../../../components/data-test';
import { DashboardListFrame } from './dashboard-list-frame';
import { usePersesEditPermissions } from './dashboard-toolbar';
import { DashboardResource } from '@perses-dev/core';
import {
  DeleteActionModal,
  DuplicateActionModal,
  RenameActionModal,
} from './dashboard-action-modals';
import { useEditableProjects } from './hooks/useEditableProjects';
const perPageOptions = [
  { title: '10', value: 10 },
  { title: '20', value: 20 },
];

const DashboardActionsCell = React.memo(
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
    emptyActions: any[];
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
  sortBy: keyof DashboardRow | undefined,
  direction: 'asc' | 'desc' | undefined,
): DashboardRow[] => {
  if (!sortBy || !direction) return data;

  return [...data].sort((a, b) => {
    let aValue: any;
    let bValue: any;

    if (sortBy === 'name') {
      aValue = a.name.label;
      bValue = b.name.label;
    } else if (sortBy === 'created') {
      aValue = a.createdAt;
      bValue = b.createdAt;
    } else if (sortBy === 'modified') {
      aValue = a.updatedAt;
      bValue = b.updatedAt;
    } else {
      aValue = a[sortBy];
      bValue = b[sortBy];
    }

    if (direction === 'asc') {
      return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
    } else {
      return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
    }
  });
};

interface DashboardsTableProps {
  persesDashboards: DashboardResource[];
  persesDashboardsLoading: boolean;
  activeProject: string | null;
}

const DashboardsTable: React.FunctionComponent<DashboardsTableProps> = ({
  persesDashboards,
  persesDashboardsLoading,
  activeProject,
}) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  const { perspective } = usePerspective();
  const dashboardBaseURL = getDashboardUrl(perspective);

  const [searchParams, setSearchParams] = useSearchParams();
  const { sortBy, direction, onSort } = useDataViewSort({ searchParams, setSearchParams });

  const { filters, onSetFilters, clearAllFilters } = useDataViewFilters<DashboardRowFilters>({
    initialFilters: { name: '', 'project-filter': '' },
    searchParams,
    setSearchParams,
  });
  const pagination = useDataViewPagination({ perPage: perPageOptions[0].value });
  const { page, perPage } = pagination;

  const DASHBOARD_COLUMNS = useMemo(
    () => [
      { label: t('Dashboard'), key: 'name' as keyof DashboardRow, index: 0 },
      { label: t('Project'), key: 'project' as keyof DashboardRow, index: 1 },
      { label: t('Created on'), key: 'created' as keyof DashboardRow, index: 2 },
      { label: t('Last Modified'), key: 'modified' as keyof DashboardRow, index: 3 },
    ],
    [t],
  );
  const sortByIndex = useMemo(() => {
    return DASHBOARD_COLUMNS.findIndex((item) => item.key === sortBy);
  }, [DASHBOARD_COLUMNS, sortBy]);

  const getSortParams = (columnIndex: number): ThProps['sort'] => ({
    sortBy: {
      index: sortByIndex,
      direction,
      defaultDirection: 'asc',
    },
    onSort: (_event, index, direction) => onSort(_event, DASHBOARD_COLUMNS[index].key, direction),
    columnIndex,
  });

  const tableColumns: DataViewTh[] = DASHBOARD_COLUMNS.map((column, index) => ({
    cell: t(column.label),
    props: { sort: getSortParams(index) },
  }));

  const tableRows: DashboardRow[] = useMemo(() => {
    if (persesDashboardsLoading) {
      return [];
    }
    return persesDashboards.map((board) => {
      const metadata = board?.metadata;
      const displayName = board?.spec?.display?.name;
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

  const filteredData = useMemo(
    () =>
      tableRows.filter(
        (item) =>
          (!filters.name ||
            item.name?.label?.toLocaleLowerCase().includes(filters.name?.toLocaleLowerCase())) &&
          (!filters['project-filter'] ||
            item.project
              ?.toLocaleLowerCase()
              .includes(filters['project-filter']?.toLocaleLowerCase())) &&
          (!activeProject || item.project === activeProject),
      ),
    [filters, tableRows, activeProject],
  );

  const sortedAndFilteredData = useMemo(
    () => sortDashboardData(filteredData, sortBy as keyof DashboardRow, direction),
    [filteredData, sortBy, direction],
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

  const PaginationTool = () => {
    return (
      <Pagination
        perPageOptions={perPageOptions}
        itemCount={sortedAndFilteredData.length}
        {...pagination}
      />
    );
  };

  const hasFiltersApplied = filters.name || filters['project-filter'];
  const hasData = sortedAndFilteredData.length > 0;

  return (
    <DataView className="pf-v6-u-m-lg">
      <DataViewToolbar
        ouiaId="PersesDashList-DataViewHeader"
        clearAllFilters={clearAllFilters}
        pagination={<PaginationTool />}
        filters={
          <DataViewFilters onChange={(_e, values) => onSetFilters(values)} values={filters}>
            <DataViewTextFilter
              filterId="name"
              title={t('Name')}
              placeholder={t('Filter by name')}
              data-test={listPersesDashboardsDataTestIDs.NameFilter}
            />
            <DataViewTextFilter
              filterId="project-filter"
              title={t('Project')}
              placeholder={t('Filter by project')}
              data-test={listPersesDashboardsDataTestIDs.ProjectFilter}
            />
          </DataViewFilters>
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
            columns={tableColumns}
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
          {hasFiltersApplied && (
            <Button
              onClick={clearAllFilters}
              className="pf-c-button pf-m-link"
              data-test={listPersesDashboardsDataTestIDs.ClearAllFiltersButton}
            >
              {t('Clear all filters')}
            </Button>
          )}
        </EmptyState>
      )}
      <DataViewToolbar ouiaId="PersesDashList-DataViewFooter" pagination={<PaginationTool />} />
    </DataView>
  );
};

export const DashboardList: FC = () => {
  const {
    activeProjectDashboardsMetadata,
    changeBoard,
    dashboardName,
    setActiveProject,
    activeProject,
    persesDashboards,
    combinedInitialLoad,
  } = useDashboardsData();

  return (
    <DashboardListFrame
      activeProject={activeProject}
      setActiveProject={setActiveProject}
      activeProjectDashboardsMetadata={activeProjectDashboardsMetadata}
      changeBoard={changeBoard}
      dashboardName={dashboardName}
    >
      <DashboardsTable
        persesDashboards={persesDashboards}
        persesDashboardsLoading={combinedInitialLoad}
        activeProject={activeProject}
      />
    </DashboardListFrame>
  );
};
