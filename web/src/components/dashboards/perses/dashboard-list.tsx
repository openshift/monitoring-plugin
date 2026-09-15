import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useDashboardsData } from './hooks/useDashboardsData';

import {
  Button,
  EmptyState,
  EmptyStateBody,
  EmptyStateVariant,
  MenuToggle,
  Pagination,
  Title,
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
import { Link, useLocation, useHistory } from 'react-router-dom';

import { getDashboardsListUrl, getDashboardUrl, usePerspective } from '../../hooks/usePerspective';
import { NamespaceBar, Timestamp } from '@openshift-console/dynamic-plugin-sdk';
import { usePersesDashboardAccess } from './hooks/usePersesDashboardAccess';
import { DashboardResource } from '@perses-dev/core';
import { useNavigate } from 'react-router-dom-v5-compat';
import {
  DeleteActionModal,
  DuplicateActionModal,
  RenameActionModal,
} from './dashboard-action-modals';
import { Helmet } from 'react-helmet';
import { DashboardListPageHeader } from './dashboard-header';
import { EllipsisVIcon } from '@patternfly/react-icons';
import { ALL_NAMESPACES_KEY } from './hooks/useActiveProject';
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
  }: {
    project: string;
    dashboard: DashboardResource;
    onRename: (dashboard: DashboardResource) => void;
    onDuplicate: (dashboard: DashboardResource) => void;
    onDelete: (dashboard: DashboardResource) => void;
  }) => {
    const { t } = useTranslation(process.env.I18N_NAMESPACE);
    const [isDropdownOpen, setIsDropdownOpen] = React.useState(false);
    const [canUpdate, updateChecking] = usePersesDashboardAccess('update', project, isDropdownOpen);
    const [canDelete, deleteChecking] = usePersesDashboardAccess('delete', project, isDropdownOpen);

    const rowSpecificActions = React.useMemo(
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
        isDisabled={false}
        actionsToggle={({ onToggle, toggleRef, isOpen, isDisabled }) => (
          <MenuToggle
            aria-label="Kebab toggle"
            ref={toggleRef}
            onClick={(e) => {
              onToggle(e);
              setIsDropdownOpen(true);
            }}
            isExpanded={isOpen}
            isDisabled={isDisabled}
            variant="plain"
          >
            <EllipsisVIcon />
          </MenuToggle>
        )}
      />
    );
  },
);

interface DashboardRowNameLink {
  link: React.ReactNode;
  label: string;
}

interface DashboardRow {
  name: DashboardRowNameLink;
  project: string;
  created: React.ReactNode;
  modified: React.ReactNode;
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

  const location = useLocation();
  const history = useHistory();
  const searchParams = new URLSearchParams(location.search);
  const setSearchParams = (params: URLSearchParams) => {
    history.push({ search: params.toString() });
  };
  const { sortBy, direction, onSort } = useDataViewSort({ searchParams, setSearchParams });

  const { filters, onSetFilters, clearAllFilters } = useDataViewFilters<DashboardRowFilters>({
    initialFilters: { name: '', 'project-filter': '' },
    searchParams,
    setSearchParams,
  });
  const pagination = useDataViewPagination({ perPage: perPageOptions[0].value });
  const { page, perPage } = pagination;

  const DASHBOARD_COLUMNS = React.useMemo(
    () => [
      { label: t('Dashboard'), key: 'name' as keyof DashboardRow, index: 0 },
      { label: t('Project'), key: 'project' as keyof DashboardRow, index: 1 },
      { label: t('Created on'), key: 'created' as keyof DashboardRow, index: 2 },
      { label: t('Last Modified'), key: 'modified' as keyof DashboardRow, index: 3 },
    ],
    [t],
  );
  const sortByIndex = React.useMemo(() => {
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

  const tableRows: DashboardRow[] = React.useMemo(() => {
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

  const filteredData = React.useMemo(
    () =>
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
    [filters, tableRows, activeProject],
  );

  const sortedAndFilteredData = React.useMemo(
    () => sortDashboardData(filteredData, sortBy as keyof DashboardRow, direction),
    [filteredData, sortBy, direction],
  );

  const [targetedDashboard, setTargetedDashboard] = React.useState<DashboardResource>();
  const [isRenameModalOpen, setIsRenameModalOpen] = React.useState<boolean>(false);
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = React.useState<boolean>(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = React.useState<boolean>(false);

  const handleRenameModalOpen = React.useCallback((dashboard: DashboardResource) => {
    setTargetedDashboard(dashboard);
    setIsRenameModalOpen(true);
  }, []);

  const handleRenameModalClose = React.useCallback(() => {
    setIsRenameModalOpen(false);
    setTargetedDashboard(undefined);
  }, []);

  const handleDuplicateModalOpen = React.useCallback((dashboard: DashboardResource) => {
    setTargetedDashboard(dashboard);
    setIsDuplicateModalOpen(true);
  }, []);

  const handleDuplicateModalClose = React.useCallback(() => {
    setIsDuplicateModalOpen(false);
    setTargetedDashboard(undefined);
  }, []);

  const handleDeleteModalOpen = React.useCallback((dashboard: DashboardResource) => {
    setTargetedDashboard(dashboard);
    setIsDeleteModalOpen(true);
  }, []);

  const handleDeleteModalClose = React.useCallback(() => {
    setIsDeleteModalOpen(false);
    setTargetedDashboard(undefined);
  }, []);

  const pageRows: DataViewTr[] = React.useMemo(() => {
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
    <DataView className="pf-v5-u-m-lg">
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
            />
            <DataViewTextFilter
              filterId="project-filter"
              title={t('Project')}
              placeholder={t('Filter by project')}
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
          <Title headingLevel="h4" size="lg">
            {hasFiltersApplied ? t('No results found') : t('No dashboards found')}
          </Title>
          <EmptyStateBody>
            {hasFiltersApplied
              ? t('No results match the filter criteria. Clear filters to show results.')
              : t('No Perses dashboards are currently available in this project.')}
          </EmptyStateBody>
          {hasFiltersApplied && (
            <Button onClick={clearAllFilters} className="pf-c-button pf-m-link">
              {t('Clear all filters')}
            </Button>
          )}
        </EmptyState>
      )}
      <DataViewToolbar ouiaId="PersesDashList-DataViewFooter" pagination={<PaginationTool />} />
    </DataView>
  );
};

export const DashboardList: React.FC = () => {
  const { activeProject, persesDashboards, combinedInitialLoad } = useDashboardsData();
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const { perspective } = usePerspective();
  const navigate = useNavigate();

  return (
    <>
      <NamespaceBar onNamespaceChange={() => navigate(getDashboardsListUrl(perspective))} />
      <Helmet>
        <title>{t('Metrics dashboards')}</title>
      </Helmet>
      <DashboardListPageHeader />
      <DashboardsTable
        persesDashboards={persesDashboards}
        persesDashboardsLoading={combinedInitialLoad}
        activeProject={activeProject}
      />
    </>
  );
};
