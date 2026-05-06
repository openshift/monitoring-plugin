import {
  AlertSeverity,
  AlertStates,
  DocumentTitle,
  PrometheusAlert,
  ResourceIcon,
  Rule,
} from '@openshift-console/dynamic-plugin-sdk';
import * as _ from 'lodash-es';
import type { FC } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { AlertSource } from '../types';
import { alertingRuleStateSort, RuleResource, severitySort } from '../utils';

import { Flex, FlexItem, PageSection, PaginationVariant, Truncate } from '@patternfly/react-core';
import DataView from '@patternfly/react-data-view/dist/dynamic/DataView';
import DataViewTable, { DataViewTr } from '@patternfly/react-data-view/dist/dynamic/DataViewTable';
import DataViewToolbar from '@patternfly/react-data-view/dist/dynamic/DataViewToolbar';
import { useDataViewSort } from '@patternfly/react-data-view/dist/dynamic/Hooks';
import { MonitoringProvider } from '../../contexts/MonitoringContext';
import { useAlerts } from '../../hooks/useAlerts';
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
import { LoadingBox } from '../console/console-shared/src/components/loading/LoadingBox';
import { DataTestIDs } from '../data-test';
import { useMonitoringNamespace } from '../hooks/useMonitoringNamespace';
import { getRuleUrl, usePerspective } from '../hooks/usePerspective';
import { ITEMS_PER_PAGE, TablePagination } from '../table-pagination';
import {
  TableFilter,
  TableFilterOption,
  TableFilterProps,
  TableFilters,
} from '../table/TableFilters';
import { TableToolbar } from '../table/TableToolbar';
import { directedSort, localeCompareSort } from '../table/sort-utils';
import { useTableColumns } from '../table/useTableColumns';
import { useTableFilters } from '../table/useTableFilters';
import { useTablePagination } from '../table/useTablePagination';
import { filterRules } from './filter-rules';

export const enum AlertRulesFilterOptions {
  NAME = 'name',
  STATE = 'alert-state',
  SEVERITY = 'alert-severity',
  SOURCE = 'alert-source',
  LABEL = 'label',
}

export interface AlertRulesFilters {
  [AlertRulesFilterOptions.NAME]: string;
  [AlertRulesFilterOptions.STATE]: string[];
  [AlertRulesFilterOptions.SEVERITY]: string[];
  [AlertRulesFilterOptions.SOURCE]?: AlertSource[];
  [AlertRulesFilterOptions.LABEL]: string;
}

const AlertRulesPage_: FC = () => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  const { namespace } = useMonitoringNamespace();
  const { defaultAlertTenant, perspective } = usePerspective();
  const [activeAttributeMenu, setActiveAttributeMenu] = useState<string>(t('Name'));
  const initialFilters = useMemo(() => {
    const filters = {
      [AlertRulesFilterOptions.NAME]: '',
      [AlertRulesFilterOptions.STATE]: [],
      [AlertRulesFilterOptions.SEVERITY]: [],
      [AlertRulesFilterOptions.SOURCE]: defaultAlertTenant,
      [AlertRulesFilterOptions.LABEL]: '',
    };
    return filters;
  }, [defaultAlertTenant]);

  // KNOWN ISSUE: the useDataViewPagination, useDataViewFilters, and useDataViewSort functions
  // do not work together for URL initialization, so only the search parameters for the last
  // function will be set when initially loading the page
  // with no search parameters. Future changes are reflected
  const pagination = useTablePagination({
    perPage: ITEMS_PER_PAGE[0],
  });
  const { filters, onSetFilters, clearAllFilters } = useTableFilters<AlertRulesFilters>({
    initialFilters,
  });
  const { sortBy, direction, onSort } = useDataViewSort({
    initialSort: { sortBy: rowFilter(AlertRulesFilterOptions.NAME), direction: 'asc' },
  });

  const columnKeys = useMemo(() => {
    const keys = [
      { label: t('Name'), key: rowFilter(AlertRulesFilterOptions.NAME) },
      { label: t('Severity'), key: rowFilter(AlertRulesFilterOptions.SEVERITY) },
      { label: t('State'), key: rowFilter(AlertRulesFilterOptions.STATE) },
      { label: t('Source'), key: rowFilter(AlertRulesFilterOptions.SOURCE) },
    ];
    return keys;
  }, [t]);

  const columns = useTableColumns(columnKeys, sortBy, direction, onSort);

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
      {
        filterId: AlertRulesFilterOptions.LABEL,
        type: TableFilterOption.LABEL,
        title: t('Label'),
        placeholder: t('Filter by Label'),
        onChange: onFiltersChange(AlertRulesFilterOptions.LABEL),
        value: filters[AlertRulesFilterOptions.LABEL],
        labelPath: 'labels',
        data: rules,
      },
    ];
    return filtersVals;
  }, [filters, t, onFiltersChange, additionalRuleSourceLabels, rules]);

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
                  aria-label={t('Alert Rules Table')}
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

  if (sortBy === rowFilter(AlertRulesFilterOptions.NAME)) {
    return [...data].sort((a, b) => localeCompareSort(a.name, b.name, direction));
  } else if (sortBy === rowFilter(AlertRulesFilterOptions.SEVERITY)) {
    return [...data].sort((a, b) => directedSort(severitySort(a, b), direction));
  } else if (sortBy === rowFilter(AlertRulesFilterOptions.STATE)) {
    return [...data].sort((a, b) => directedSort(alertingRuleStateSort(a, b), direction));
  } else if (sortBy === rowFilter(AlertRulesFilterOptions.SOURCE)) {
    return [...data].sort((a, b) =>
      localeCompareSort(alertingRuleSource(a), alertingRuleSource(b), direction),
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
