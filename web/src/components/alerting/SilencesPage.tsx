import {
  consoleFetchJSON,
  DocumentTitle,
  ResourceIcon,
  Silence,
  SilenceStates,
} from '@openshift-console/dynamic-plugin-sdk';
import { BulkSelect, BulkSelectValue } from '@patternfly/react-component-groups';
import {
  Button,
  Flex,
  FlexItem,
  PageSection,
  PaginationVariant,
  Alert as PFAlert,
  Stack,
  StackItem,
} from '@patternfly/react-core';
import DataView from '@patternfly/react-data-view/dist/dynamic/DataView';
import DataViewTable, { DataViewTr } from '@patternfly/react-data-view/dist/dynamic/DataViewTable';
import DataViewToolbar from '@patternfly/react-data-view/dist/dynamic/DataViewToolbar';
import {
  useDataViewSelection,
  useDataViewSort,
} from '@patternfly/react-data-view/dist/dynamic/Hooks';
import { ActionsColumn, BaseCellProps, IAction } from '@patternfly/react-table';
import { t_global_spacer_xs } from '@patternfly/react-tokens';
import * as _ from 'lodash-es';
import type { FC } from 'react';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { MonitoringProvider } from '../../contexts/MonitoringContext';
import { useAlerts } from '../../hooks/useAlerts';
import withFallback from '../console/console-shared/error/fallbacks/withFallback';
import { EmptyBox } from '../console/console-shared/src/components/empty-state/EmptyBox';
import { LoadingBox } from '../console/console-shared/src/components/loading/LoadingBox';
import { DataTestIDs } from '../data-test';
import { useBoolean } from '../hooks/useBoolean';
import { useDeepMemo } from '../hooks/useDeepMemo';
import { useMonitoringNamespace } from '../hooks/useMonitoringNamespace';
import {
  getEditSilenceAlertUrl,
  getFetchSilenceUrl,
  getNewSilenceUrl,
  getSilenceAlertUrl,
  usePerspective,
} from '../hooks/usePerspective';
import { directedSort, localeCompareSort } from '../table/sort-utils';
import { useTableColumns } from '../table/useTableColumns';
import { ITEMS_PER_PAGE, TablePagination } from '../table-pagination';
import {
  TableFilter,
  TableFilterOption,
  TableFilterProps,
  TableFilters,
} from '../table/TableFilters';
import { TableToolbar } from '../table/TableToolbar';
import { useTableFilters } from '../table/useTableFilters';
import { useTablePagination } from '../table/useTablePagination';
import { severitySort, SilenceResource, silenceState } from '../utils';
import { rowFilter, SeverityCounts, StateTimestamp } from './AlertUtils';
import { filterSilences } from './filter-silences';
import { ExpireSilenceModal, SilenceMatchersList, SilenceState } from './SilencesUtils';

export const enum SilenceFilterOptions {
  NAME = 'name',
  STATE = 'silence-state',
  CLUSTER = 'silence-cluster',
}

export interface SilenceFilters {
  [SilenceFilterOptions.NAME]: string;
  [SilenceFilterOptions.STATE]: string[];
  [SilenceFilterOptions.CLUSTER]?: string[];
}

const SilencesPage_: FC = () => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const { namespace } = useMonitoringNamespace();
  const { perspective } = usePerspective();
  const navigate = useNavigate();
  const [activeAttributeMenu, setActiveAttributeMenu] = useState<string>(t('Name'));
  const [errorMessage, setErrorMessage] = useState();
  const [modalState, setModalState] = useState({ modalOpen: false, silenceID: '' });
  const setModalClosed = () => {
    setModalState({ modalOpen: false, silenceID: '' });
  };

  const initialFilters = useDeepMemo(() => {
    const filters = {
      [SilenceFilterOptions.NAME]: '',
      [SilenceFilterOptions.STATE]: [SilenceStates.Active, SilenceStates.Pending],
    };
    if (perspective === 'acm') {
      filters[SilenceFilterOptions.CLUSTER] = [];
    }
    return filters;
  }, [perspective, namespace]);

  const rowActions = useCallback(
    (silence: Silence): IAction[] => {
      const editSilence = () => {
        navigate(getEditSilenceAlertUrl(perspective, silence.id, namespace));
      };
      if (silenceState(silence) === SilenceStates.Expired) {
        return [
          {
            title: t('Recreate silence'),
            onClick: editSilence,
          },
        ];
      }
      return [
        {
          title: t('Edit silence'),
          onClick: editSilence,
        },
        {
          title: t('Expire silence'),
          onClick: () => setModalState({ modalOpen: true, silenceID: silence.id }),
        },
      ];
    },
    [t, navigate, namespace, perspective],
  );

  // KNOWN ISSUE: the useDataViewPagination, useDataViewFilters, and useDataViewSort functions
  // do not work together for URL initialization, so only the search parameters for the last
  // function will be set when initially loading the page
  // with no search parameters. Future changes are reflected
  const pagination = useTablePagination({
    perPage: ITEMS_PER_PAGE[0],
  });
  const { filters, onSetFilters, clearAllFilters } = useTableFilters<SilenceFilters>({
    initialFilters,
  });
  const { sortBy, direction, onSort } = useDataViewSort({
    initialSort: { sortBy: rowFilter(SilenceFilterOptions.NAME), direction: 'asc' },
  });
  const selection = useDataViewSelection({
    matchOption: (a, b) => a?.silence?.name === b?.silence?.name,
  });
  const { selected, onSelect, setSelected } = selection;

  const columnKeys = useMemo(() => {
    const keys = [
      { label: t('Name'), key: rowFilter(SilenceFilterOptions.NAME) },
      {
        label: t('Firing alerts'),
        key: rowFilter('firing-alerts'),
        props: { width: 10 as BaseCellProps['width'] },
      },
      { label: t('State'), key: rowFilter(SilenceFilterOptions.STATE) },
      { label: t('Creator'), key: rowFilter('createdBy') },
    ];
    if (perspective === 'acm') {
      keys.push({ label: t('Cluster'), key: rowFilter(SilenceFilterOptions.CLUSTER) });
    }
    return keys;
  }, [t, perspective]);

  const columns = useTableColumns(columnKeys, sortBy, direction, onSort);

  useEffect(() => {
    // When changing filters change back to being on page 1
    pagination.onSetPage(undefined, 1);
  }, [filters]); // eslint-disable-line react-hooks/exhaustive-deps

  const { page, perPage } = pagination;

  const { silences, silenceClusterLabels } = useAlerts();

  /**
   * Filters silences based on the selected namespace.
   * "All Projects": returns all silences, including those without a namespace matcher.
   */
  const namespacedSilences = useMemo<
    Array<DataViewTr & { silence: Silence; index: number }>
  >(() => {
    // TODO convert to a filterSilences function
    const filteredSilences = filterSilences(silences?.data ?? [], filters, namespace, perspective);

    const sortedSilences = sortSilences(filteredSilences, sortBy, direction, silenceClusterLabels);
    const mappedSilences = sortedSilences.map(
      (silence, index): DataViewTr & { silence: Silence; index: number } => {
        return {
          row: [
            {
              cell: (
                <>
                  <Flex
                    spaceItems={{ default: 'spaceItemsNone' }}
                    flexWrap={{ default: 'nowrap' }}
                    style={{ paddingBottom: t_global_spacer_xs.var }}
                  >
                    <FlexItem data-test={DataTestIDs.SilenceResourceIcon}>
                      <ResourceIcon kind={SilenceResource.kind} />
                    </FlexItem>
                    <FlexItem>
                      <Link
                        data-test-id="silence-resource-link"
                        title={silence.id}
                        to={getSilenceAlertUrl(perspective, silence.id, namespace)}
                        data-test={DataTestIDs.SilenceResourceLink}
                      >
                        {silence.name}
                      </Link>
                    </FlexItem>
                  </Flex>
                  <SilenceMatchersList silence={silence} />
                </>
              ),
            },
            { cell: <SeverityCounts alerts={silence.firingAlerts} /> },
            {
              cell: (
                <Stack>
                  <StackItem>
                    <SilenceState silence={silence} />
                  </StackItem>
                  <StackItem>
                    {silenceState(silence) === SilenceStates.Pending && (
                      <StateTimestamp text={t('Starts')} timestamp={silence.startsAt} />
                    )}
                    {silenceState(silence) === SilenceStates.Active && (
                      <StateTimestamp text={t('Ends')} timestamp={silence.endsAt} />
                    )}
                    {silenceState(silence) === SilenceStates.Expired && (
                      <StateTimestamp text={t('Expired')} timestamp={silence.endsAt} />
                    )}
                  </StackItem>
                </Stack>
              ),
            },
            silence.createdBy || '',
            ...(perspective === 'acm'
              ? [silence.matchers.find((label) => label.name === 'cluster')?.value ?? '']
              : []),
            { cell: <ActionsColumn items={rowActions(silence)} />, props: { isActionCell: true } },
          ],
          silence: silence,
          index,
        };
      },
    );
    return mappedSilences;
  }, [
    namespace,
    silences,
    perspective,
    t,
    rowActions,
    sortBy,
    direction,
    silenceClusterLabels,
    filters,
  ]);

  const handleBulkSelect = (value: BulkSelectValue) => {
    if (value === BulkSelectValue.none) {
      onSelect(false);
    }
    if (value === BulkSelectValue.all) {
      onSelect(true, namespacedSilences);
    }
  };

  const selectedPageOfSilences = useMemo(
    () => namespacedSilences.slice((page - 1) * perPage, (page - 1) * perPage + perPage),
    [namespacedSilences, page, perPage],
  );

  const loaded = !!silences?.loaded;
  const loadError = silences?.loadError ? silences.loadError : undefined;

  const onFiltersChange = useMemo(
    () => (filterName: keyof SilenceFilters) => {
      return (_e, val) => {
        onSetFilters({ [filterName]: val });
      };
    },
    [onSetFilters],
  );

  const filterItems = useMemo<TableFilterProps<any>[]>(() => {
    const filtersVals: TableFilterProps<any>[] = [
      {
        filterId: SilenceFilterOptions.NAME,
        type: TableFilterOption.TEXT,
        title: t('Name'),
        placeholder: t('Filter by Name'),
        onChange: onFiltersChange(SilenceFilterOptions.NAME),
        value: filters.name,
        ouiaId: 'SilenceNameFilter',
      },
      {
        filterId: SilenceFilterOptions.STATE,
        type: TableFilterOption.CHECKBOX,
        title: t('Silence State'),
        placeholder: t('Filter by State'),
        onChange: onFiltersChange(SilenceFilterOptions.STATE),
        value: filters[SilenceFilterOptions.STATE],
        options: [
          { value: SilenceStates.Active, label: t('Active') },
          { value: SilenceStates.Pending, label: t('Pending') },
          { value: SilenceStates.Expired, label: t('Expired') },
        ],
        ouiaId: 'SilenceStateFilter',
      },
    ];
    if (perspective === 'acm') {
      filtersVals.push({
        filterId: SilenceFilterOptions.CLUSTER,
        type: TableFilterOption.CHECKBOX,
        title: t('Cluster'),
        placeholder: t('Filter by Cluster'),
        onChange: onFiltersChange(SilenceFilterOptions.CLUSTER),
        value: filters[SilenceFilterOptions.CLUSTER],
        options: silenceClusterLabels.map((clusterName) => ({
          value: clusterName,
          label: clusterName?.length > 50 ? clusterName.slice(0, 50) + '...' : clusterName,
        })),
        ouiaId: 'SilenceClusterFilter',
      });
    }
    return filtersVals;
  }, [filters, t, onFiltersChange, perspective, silenceClusterLabels]);

  return (
    <>
      <DocumentTitle>{t('Alerting')}</DocumentTitle>
      <PageSection hasBodyWrapper={false} type="subnav">
        {loaded && (
          <DataView selection={selection}>
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
              bulkSelect={
                <BulkSelect
                  canSelectAll
                  isDataPaginated={false}
                  totalCount={namespacedSilences.length}
                  selectedCount={selected.length}
                  onSelect={handleBulkSelect}
                />
              }
              actions={[
                <CreateSilenceButton key={0} />,
                <ExpireAllSilencesButton
                  key={1}
                  selectedSilences={selected}
                  setSelectedSilences={setSelected}
                  setErrorMessage={setErrorMessage}
                />,
              ]}
              pagination={
                <TablePagination
                  itemCount={namespacedSilences?.length}
                  variant={PaginationVariant.top}
                  {...pagination}
                />
              }
            />
            {selectedPageOfSilences?.length > 0 && (
              <>
                <DataViewTable
                  aria-label={t('Silences Table')}
                  columns={columns}
                  rows={selectedPageOfSilences}
                />
                <DataViewToolbar
                  style={{ paddingTop: '16px' }}
                  pagination={
                    <TablePagination
                      itemCount={namespacedSilences?.length}
                      variant={PaginationVariant.bottom}
                      {...pagination}
                    />
                  }
                />
              </>
            )}
          </DataView>
        )}
        {loadError && (
          <PFAlert
            isInline
            title={t('Error loading silences from Alertmanager. Alertmanager may be unavailable.')}
            variant="danger"
          >
            {typeof silences?.loadError === 'string'
              ? silences?.loadError
              : silences?.loadError.message}
          </PFAlert>
        )}
        {loaded && selectedPageOfSilences?.length === 0 && !loadError && (
          <EmptyBox customMessage={t('No silences found')} />
        )}
        {errorMessage && (
          <PFAlert isInline title={t('Error')} variant="danger">
            {errorMessage}
          </PFAlert>
        )}
        {!loaded && <LoadingBox />}
      </PageSection>
      <ExpireSilenceModal
        isOpen={modalState.modalOpen}
        setClosed={setModalClosed}
        silenceID={modalState.silenceID}
      />
    </>
  );
};
const SilencesPageWithFallback = withFallback(SilencesPage_);

const silenceFiringAlertsOrder = (silenceA: Silence, silenceB: Silence): number => {
  const aAlerts = silenceA.firingAlerts || [];
  const bAlerts = silenceB.firingAlerts || [];
  if (aAlerts.length !== bAlerts.length) {
    return aAlerts.length - bAlerts.length;
  }

  const severitySortedA = [...aAlerts].sort(severitySort);
  const severitySortedB = [...bAlerts].sort(severitySort);
  const highestSeverityA = severitySortedA[0];
  const highestSeverityB = severitySortedB[0];
  if (highestSeverityA && highestSeverityB) {
    return severitySort(highestSeverityA, highestSeverityB);
  } else if (highestSeverityA) {
    return -1;
  } else if (highestSeverityB) {
    return 1;
  }

  return new Date(silenceB.endsAt).getTime() - new Date(silenceA.endsAt).getTime();
};

const silenceStateOrder = (silenceA: Silence, silenceB: Silence): number => {
  const stateA = silenceState(silenceA);
  const stateB = silenceState(silenceB);
  if (stateA === stateB) {
    if (stateA === SilenceStates.Pending) {
      return new Date(silenceB.startsAt).getTime() - new Date(silenceA.startsAt).getTime();
    }
    return new Date(silenceB.endsAt).getTime() - new Date(silenceA.endsAt).getTime();
  }
  if (stateA === SilenceStates.Active) {
    return -1;
  }
  if (stateB === SilenceStates.Active) {
    return 1;
  }
  if (stateA === SilenceStates.Pending) {
    return -1;
  }
  if (stateB === SilenceStates.Pending) {
    return 1;
  }
  return 0;
};

const silenceClusterOrder = (clusters: Array<string>) => {
  const sortedClusters = [...clusters].sort();
  return (silenceA: Silence, silenceB: Silence): number => {
    const clusterA = silenceA.matchers.find((label) => label.name === 'cluster')?.value;
    const clusterB = silenceB.matchers.find((label) => label.name === 'cluster')?.value;
    return sortedClusters.indexOf(clusterA) - sortedClusters.indexOf(clusterB);
  };
};

const sortSilences = (
  data: Silence[],
  sortBy: string | undefined,
  direction: 'asc' | 'desc' | undefined,
  silenceClusterLabels: string[],
) => {
  if (!sortBy || !direction) {
    return data;
  }
  const clusterSort = silenceClusterOrder(silenceClusterLabels);

  if (sortBy === rowFilter(SilenceFilterOptions.NAME)) {
    return [...data].sort((a, b) => localeCompareSort(a.name, b.name, direction));
  } else if (sortBy === rowFilter('firing-alerts')) {
    return [...data].sort((a, b) => directedSort(silenceFiringAlertsOrder(a, b), direction));
  } else if (sortBy === rowFilter(SilenceFilterOptions.STATE)) {
    return [...data].sort((a, b) => directedSort(silenceStateOrder(a, b), direction));
  } else if (sortBy === rowFilter('createdBy')) {
    return [...data].sort((a, b) => localeCompareSort(a.createdBy, b.createdBy, direction));
  } else if (sortBy === rowFilter(SilenceFilterOptions.CLUSTER)) {
    return [...data].sort((a, b) => directedSort(clusterSort(a, b), direction));
  }
  return data;
};

const ExpireAllSilencesButton: FC<ExpireAllSilencesButtonProps> = ({
  selectedSilences,
  setSelectedSilences,
  setErrorMessage,
}) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const { trigger: refetchSilencesAndAlerts } = useAlerts();
  const activeAlerts = selectedSilences.filter(
    (selectedSilence) => selectedSilence.silence.status.state === SilenceStates.Active,
  );

  const { perspective } = usePerspective();
  const { namespace } = useMonitoringNamespace();

  const [isInProgress, , setInProgress, setNotInProgress] = useBoolean(false);

  const onClick = () => {
    setInProgress();
    Promise.allSettled(
      [...activeAlerts].map((selectedSilence) =>
        consoleFetchJSON.delete(
          getFetchSilenceUrl(perspective, selectedSilence.silence.id, namespace),
        ),
      ),
    ).then((values) => {
      setNotInProgress();
      setSelectedSilences([]);
      refetchSilencesAndAlerts();
      const errors = values
        .filter((v) => v.status === 'rejected')
        .map((v: PromiseRejectedResult) => v.reason);
      if (errors.length > 0) {
        const messages = errors.map(
          (err) => _.get(err, 'json.error') || err.message || 'Error expiring silence',
        );
        setErrorMessage(messages.join(', '));
      } else {
        setErrorMessage('');
      }
    });
  };

  return (
    <Button
      isDisabled={activeAlerts.length === 0}
      isLoading={isInProgress}
      onClick={onClick}
      variant="secondary"
      data-test={DataTestIDs.ExpireXSilencesButton}
    >
      {t('Expire {{count}} silence', { count: activeAlerts.length })}
    </Button>
  );
};

const CreateSilenceButton: FC = memo(() => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const { perspective } = usePerspective();
  const { namespace } = useMonitoringNamespace();

  return (
    <Link to={getNewSilenceUrl(perspective, namespace)}>
      <Button data-test={DataTestIDs.SilenceButton} variant="primary">
        {t('Create silence')}
      </Button>
    </Link>
  );
});

export const MpCmoSilencesPage = () => {
  return (
    <MonitoringProvider monitoringContext={{ plugin: 'monitoring-plugin', prometheus: 'cmo' }}>
      <SilencesPageWithFallback />
    </MonitoringProvider>
  );
};

export const McpAcmSilencesPage = () => {
  return (
    <MonitoringProvider
      monitoringContext={{ plugin: 'monitoring-console-plugin', prometheus: 'acm' }}
    >
      <SilencesPageWithFallback />
    </MonitoringProvider>
  );
};

type ExpireAllSilencesButtonProps = {
  setErrorMessage: (string) => void;
  selectedSilences: Array<DataViewTr & { silence: Silence; index: number }>;
  setSelectedSilences: (selected: []) => void;
};
