import React, { ReactNode, useMemo, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { DashboardLayout } from './dashboard-layout';
import { useDashboardsData } from './hooks/useDashboardsData';

import { Pagination } from '@patternfly/react-core';
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

const perPageOptions = [
  { title: '10', value: 10 },
  { title: '20', value: 20 },
];

interface DashboardName {
  link: ReactNode;
  label: string;
}

interface DashboardRow {
  name: DashboardName;
  project: string;
  created: string;
  modified: string;
}

interface DashboardRowFilters {
  name?: string;
  'project-filter'?: string;
}

const sortDashboardData = (
  data: DashboardRow[],
  sortBy: keyof DashboardRow | undefined,
  direction: 'asc' | 'desc' | undefined,
): DashboardRow[] =>
  sortBy && direction
    ? [...data].sort((a, b) => {
        const aValue = sortBy === 'name' ? a.name.label : a[sortBy];
        const bValue = sortBy === 'name' ? b.name.label : b[sortBy];

        if (direction === 'asc') {
          return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
        } else {
          return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
        }
      })
    : data;

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
      const dashboardName: DashboardName = {
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
        created: board?.metadata?.createdAt || '',
        modified: board?.metadata?.updatedAt || '',
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

  return (
    <DataView>
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
      <DataViewTable
        aria-label="Perses Dashboards List"
        ouiaId={'PersesDashList-DataViewTable'}
        columns={tableColumns}
        rows={pageRows}
      />
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
