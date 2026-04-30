import {
  AlertSeverity,
  AlertStates,
  DocumentTitle,
  PrometheusAlert,
  ResourceIcon,
  Rule,
} from '@openshift-console/dynamic-plugin-sdk';
import { ThProps } from '@patternfly/react-table';
import * as _ from 'lodash-es';
import type { FC } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';

import { AlertSource } from '../types';
import { alertingRuleStateOrder, RuleResource } from '../utils';

import { Flex, FlexItem, PageSection, PaginationVariant, Truncate } from '@patternfly/react-core';
import {
  alertingRuleSource,
  AlertStateIcon,
  getAlertStateKey,
  rowFilter,
  SeverityBadge,
  SilencesNotLoadedWarning,
} from '../alerting/AlertUtils';
import withFallback from '../console/console-shared/error/fallbacks/withFallback';
import { EmptyBox } from '../console/console-shared/src/components/empty-state/EmptyBox';
import { getRuleUrl, usePerspective } from '../hooks/usePerspective';
import { MonitoringProvider } from '../../contexts/MonitoringContext';
import { DataTestIDs } from '../data-test';
import { useAlerts } from '../../hooks/useAlerts';
import { useMonitoringNamespace } from '../hooks/useMonitoringNamespace';
import { useTablePagination } from '../table/useTablePagination';
import { ITEMS_PER_PAGE, TablePagination } from '../table-pagination';
import { useTableFilters } from '../table/useTableFilters';
import { useDataViewSort } from '@patternfly/react-data-view/dist/dynamic/Hooks';
import DataViewTable, {
  DataViewTh,
  DataViewTr,
} from '@patternfly/react-data-view/dist/dynamic/DataViewTable';
import { filterRules } from './filter-rules';
import {
  TableFilter,
  TableFilterOption,
  TableFilterProps,
  TableFilters,
} from '../table/TableFilters';
import DataView from '@patternfly/react-data-view/dist/dynamic/DataView';
import { TableToolbar } from '../table/TableToolbar';
import DataViewToolbar from '@patternfly/react-data-view/dist/dynamic/DataViewToolbar';
import { LoadingBox } from '../console/console-shared/src/components/loading/LoadingBox';

export const enum AlertRulesFilterOptions {
  NAME = 'name',
  STATE = 'alert-state',
  SEVERITY = 'alert-severity',
  SOURCE = 'alert-source',
}

export interface AlertRulesFilters {
  [AlertRulesFilterOptions.NAME]: string;
  [AlertRulesFilterOptions.STATE]: string[];
  [AlertRulesFilterOptions.SEVERITY]: string[];
  [AlertRulesFilterOptions.SOURCE]?: AlertSource[];
}

const AlertRulesPage_: FC = () => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  const { namespace } = useMonitoringNamespace();
  const { defaultAlertTenant, perspective } = usePerspective();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeAttributeMenu, setActiveAttributeMenu] = useState<string>(t('Name'));
  const initialFilters = useMemo(() => {
    const filters = {
      [AlertRulesFilterOptions.NAME]: '',
      [AlertRulesFilterOptions.STATE]: [],
      [AlertRulesFilterOptions.SEVERITY]: [],
      [AlertRulesFilterOptions.SOURCE]: defaultAlertTenant,
    };
    return filters;
  }, [defaultAlertTenant]);

  // KNOWN ISSUE: the useDataViewPagination, useDataViewFilters, and useDataViewSort functions
  // do not work together for URL initialization, so only the search parameters for the last
  // function will be set when initially loading the page
  // with no search parameters. Future changes are reflected
  const pagination = useTablePagination({
    perPage: ITEMS_PER_PAGE[0],
    searchParams,
    setSearchParams,
  });
  const { filters, onSetFilters, clearAllFilters } = useTableFilters<AlertRulesFilters>({
    initialFilters,
    searchParams,
    setSearchParams,
  });
  const { sortBy, direction, onSort } = useDataViewSort({
    initialSort: { sortBy: rowFilter(AlertRulesFilterOptions.NAME), direction: 'asc' },
    searchParams,
    setSearchParams,
  });

  const columnKeys = useMemo(() => {
    const keys = [
      { label: t('Name'), key: rowFilter(AlertRulesFilterOptions.NAME) },
      { label: t('Severity'), key: rowFilter(AlertRulesFilterOptions.SEVERITY) },
      { label: t('State'), key: rowFilter(AlertRulesFilterOptions.STATE) },
      { label: t('Total'), key: rowFilter(AlertRulesFilterOptions.SOURCE) },
    ];
    return keys;
  }, [t]);

  const sortByIndex = useMemo(
    () => columnKeys.findIndex((item) => item.key === sortBy),
    [sortBy, columnKeys],
  );

  const getSortParams = useCallback(
    (columnIndex: number): ThProps['sort'] => {
      return {
        sortBy: {
          index: sortByIndex,
          direction,
          defaultDirection: 'asc',
        },
        onSort: (_event, index, direction) => onSort(_event, columnKeys[index].key, direction),
        columnIndex,
      };
    },
    [columnKeys, direction, onSort, sortByIndex],
  );

  const columns: DataViewTh[] = useMemo(
    () =>
      columnKeys.map((column, index) => ({
        cell: column.label,
        props: { sort: getSortParams(index) },
      })),
    [getSortParams, columnKeys],
  );

  useEffect(() => {
    // When changing filters change back to being on page 1
    pagination.onSetPage(undefined, 1);
  }, [filters]); // eslint-disable-line react-hooks/exhaustive-deps

  const { page, perPage } = pagination;

  const { rules, additionalRuleSourceLabels, rulesAlertLoading, silences } = useAlerts();

  const sortedRuleRows = useMemo(() => {
    const filteredRules = filterRules(rules, filters);
    const sortedRules = sortRules(filteredRules, sortBy, direction);
    const mappedRules = sortedRules.map((sortedRule): DataViewTr => {
      return {
        row: [
          {
            cell: (
              <Flex spaceItems={{ default: 'spaceItemsNone' }} flexWrap={{ default: 'nowrap' }}>
                <FlexItem data-test={DataTestIDs.AlertingRuleResourceIcon}>
                  <ResourceIcon kind={RuleResource.kind} />
                </FlexItem>
                <FlexItem>
                  <Link
                    to={getRuleUrl(perspective, sortedRule, namespace)}
                    data-test={DataTestIDs.AlertingRuleResourceLink}
                  >
                    <Truncate content={sortedRule.name} />
                  </Link>
                </FlexItem>
              </Flex>
            ),
          },
          {
            cell: (
              <span data-test={DataTestIDs.SeverityBadge}>
                <SeverityBadge severity={sortedRule.labels?.severity} />
              </span>
            ),
          },
          {
            cell: (
              <span data-test={DataTestIDs.AlertingRuleStateBadge}>
                {_.isEmpty(sortedRule.alerts) ? '-' : <StateCounts alerts={sortedRule.alerts} />}
              </span>
            ),
          },
          alertingRuleSource(sortedRule) === AlertSource.User ? t('User') : t('Platform'),
        ],
      };
    });
    return mappedRules;
  }, [rules, filters, sortBy, direction, perspective, namespace, t]);

  const selectedPageOfRules = useMemo(
    () => sortedRuleRows.slice((page - 1) * perPage, (page - 1) * perPage + perPage),
    [sortedRuleRows, page, perPage],
  );

  const loaded = rulesAlertLoading?.loaded ?? false;
  const loadError = rulesAlertLoading?.loadError;

  const onFiltersChange = useMemo(
    () => (filterName: keyof AlertRulesFilters) => {
      return (_e, val) => {
        onSetFilters({ [filterName]: val });
      };
    },
    [onSetFilters],
  );

  const filterItems = useMemo<TableFilterProps<any>[]>(() => {
    const filtersVals: TableFilterProps<any>[] = [
      {
        filterId: AlertRulesFilterOptions.NAME,
        type: TableFilterOption.TEXT,
        title: t('Name'),
        placeholder: t('Filter by Name'),
        onChange: onFiltersChange(AlertRulesFilterOptions.NAME),
        value: filters.name,
        ouiaId: 'RuleNameFilter',
      },
      {
        filterId: AlertRulesFilterOptions.STATE,
        type: TableFilterOption.CHECKBOX,
        title: t('Alert State'),
        placeholder: t('Filter by State'),
        onChange: onFiltersChange(AlertRulesFilterOptions.STATE),
        value: filters[AlertRulesFilterOptions.STATE],
        options: [
          { value: AlertStates.Firing, label: t('Firing') },
          { value: AlertStates.Pending, label: t('Pending') },
          { value: AlertStates.Silenced, label: t('Silenced') },
          { value: AlertStates.NotFiring, label: t('Not Firing') },
        ],
        ouiaId: 'RuleStateFilter',
      },
      {
        filterId: AlertRulesFilterOptions.SEVERITY,
        type: TableFilterOption.CHECKBOX,
        title: t('Severity'),
        placeholder: t('Filter by Severity'),
        onChange: onFiltersChange(AlertRulesFilterOptions.SEVERITY),
        value: filters[AlertRulesFilterOptions.SEVERITY],
        options: [
          { value: AlertSeverity.Critical, label: t('Critical') },
          { value: AlertSeverity.Warning, label: t('Warning') },
          { value: AlertSeverity.Info, label: t('Info') },
          { value: AlertSeverity.None, label: t('None') },
        ],
        ouiaId: 'RuleSeverityFilter',
      },
      {
        filterId: AlertRulesFilterOptions.SOURCE,
        type: TableFilterOption.CHECKBOX,
        title: t('Source'),
        placeholder: t('Filter by Source'),
        onChange: onFiltersChange(AlertRulesFilterOptions.SOURCE),
        value: filters[AlertRulesFilterOptions.SOURCE],
        options: [
          { value: AlertSource.Platform, label: t('Platform') },
          { value: AlertSource.User, label: t('User') },
          ...additionalRuleSourceLabels,
        ],
        ouiaId: 'RuleSourceFilter',
      },
    ];
    return filtersVals;
  }, [filters, t, onFiltersChange, additionalRuleSourceLabels]);

  return (
    <>
      <DocumentTitle>{t('Alerting')}</DocumentTitle>
      <PageSection hasBodyWrapper={false} type="subnav">
        {silences?.loadError && !rulesAlertLoading?.loadError && (
          <SilencesNotLoadedWarning silencesLoadError={silences.loadError} />
        )}
        {loaded && (
          <DataView>
            <TableToolbar
              clearAllFilters={clearAllFilters}
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
              pagination={
                <TablePagination
                  itemCount={sortedRuleRows?.length}
                  variant={PaginationVariant.top}
                  {...pagination}
                />
              }
            />
            {selectedPageOfRules?.length > 0 && (
              <>
                <DataViewTable
                  aria-label="Repositories table"
                  columns={columns}
                  rows={selectedPageOfRules}
                />
                <DataViewToolbar
                  style={{ paddingTop: '16px' }}
                  pagination={
                    <TablePagination
                      itemCount={sortedRuleRows?.length}
                      variant={PaginationVariant.bottom}
                      {...pagination}
                    />
                  }
                />
              </>
            )}
          </DataView>
        )}
        {loaded && selectedPageOfRules?.length === 0 && !loadError && (
          <EmptyBox customMessage={t('No alerting rules found')} />
        )}
        {!loaded && <LoadingBox />}
      </PageSection>
    </>
  );
};
const AlertRulesPageWithFallback = withFallback(AlertRulesPage_);

const StateCounts: FC<{ alerts: PrometheusAlert[] }> = ({ alerts }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  const counts = _.countBy(alerts, 'state');
  const states = [AlertStates.Firing, AlertStates.Pending, AlertStates.Silenced].filter(
    (s) => counts[s] > 0,
  );

  return (
    <>
      {states.map((s) => (
        <div key={s}>
          <AlertStateIcon state={s} /> {counts[s]} {getAlertStateKey(s, t)}
        </div>
      ))}
    </>
  );
};

const sortRules = (
  data: Rule[],
  sortBy: string | undefined,
  direction: 'asc' | 'desc' | undefined,
) => {
  if (!sortBy || !direction) {
    return data;
  }
  const lower = direction === 'asc' ? 0 : 1;
  const upper = direction === 'asc' ? 1 : 0;

  if (sortBy === rowFilter(AlertRulesFilterOptions.NAME)) {
    return [...data].sort((a, b) =>
      a.name?.toLocaleLowerCase() < b.name?.toLocaleLowerCase() ? lower : upper,
    );
  } else if (sortBy === rowFilter(AlertRulesFilterOptions.SEVERITY)) {
    return [...data].sort((a, b) => (a?.labels?.severity > b?.labels?.severity ? lower : upper));
  } else if (sortBy === rowFilter(AlertRulesFilterOptions.STATE)) {
    return [...data].sort((a, b) =>
      alertingRuleStateOrder(a) > alertingRuleStateOrder(b) ? lower : upper,
    );
  } else if (sortBy === rowFilter(AlertRulesFilterOptions.SOURCE)) {
    return [...data].sort((a, b) =>
      alertingRuleSource(a) > alertingRuleSource(b) ? lower : upper,
    );
  }
  return data;
};

export const MpCmoAlertRulesPage = () => {
  return (
    <MonitoringProvider monitoringContext={{ plugin: 'monitoring-plugin', prometheus: 'cmo' }}>
      <AlertRulesPageWithFallback />
    </MonitoringProvider>
  );
};

export const McpAcmAlertRulesPage = () => {
  return (
    <MonitoringProvider
      monitoringContext={{ plugin: 'monitoring-console-plugin', prometheus: 'acm' }}
    >
      <AlertRulesPageWithFallback />
    </MonitoringProvider>
  );
};
