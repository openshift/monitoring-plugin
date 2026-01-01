import React, { ReactNode, useMemo, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { DashboardLayout } from './dashboard-layout';
import { useDashboardsData } from './hooks/useDashboardsData';

import {
  Button,
  EmptyState,
  EmptyStateBody,
  EmptyStateVariant,
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
import { ThProps } from '@patternfly/react-table';
import { Link, useSearchParams } from 'react-router-dom-v5-compat';

import { getDashboardUrl, usePerspective } from '../../hooks/usePerspective';
import { Timestamp } from '@openshift-console/dynamic-plugin-sdk';
import { listPersesDashboardsDataTestIDs } from 'src/components/data-test';
const perPageOptions = [
  { title: '10', value: 10 },
  { title: '20', value: 20 },
];

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
  persesDashboards: Array<{
    metadata?: {
      name?: string;
      project?: string;
      createdAt?: string;
      updatedAt?: string;
    };
  }>;
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
      const dashboardsParams = `?dashboard=${metadata?.name}&project=${metadata?.project}`;
      const dashboardName: DashboardRowNameLink = {
        link: (
          <Link
            to={`${dashboardBaseURL}${dashboardsParams}`}
            data-test={`perseslistpage-${board?.metadata?.name}`}
          >
            {metadata?.name}
          </Link>
        ),
        label: metadata?.name || '',
      };

      return {
        name: dashboardName,
        project: board?.metadata?.project || '',
        created: <Timestamp timestamp={metadata?.createdAt} />,
        modified: <Timestamp timestamp={metadata?.updatedAt} />,
        createdAt: metadata?.createdAt,
        updatedAt: metadata?.updatedAt,
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

  const pageRows: DataViewTr[] = useMemo(
    () =>
      sortedAndFilteredData
        .slice((page - 1) * perPage, (page - 1) * perPage + perPage)
        .map(({ name, project, created, modified }) => [name.link, project, created, modified]),
    [page, perPage, sortedAndFilteredData],
  );

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
        <DataViewTable
          aria-label="Perses Dashboards List"
          ouiaId={'PersesDashList-DataViewTable'}
          columns={tableColumns}
          rows={pageRows}
        />
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
    <DashboardLayout
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
    </DashboardLayout>
  );
};
