import {
  DocumentTitle,
  GreenCheckCircleIcon,
  K8sModel,
  K8sResourceKind,
  ListPageBody,
  ListPageHeader,
  PrometheusEndpoint,
  RedExclamationCircleIcon,
  ResourceLink,
  Timestamp,
  useK8sWatchResource,
} from '@openshift-console/dynamic-plugin-sdk';
import {
  Alert,
  AlertActionCloseButton,
  Breadcrumb,
  BreadcrumbItem,
  DescriptionList,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
  Divider,
  Grid,
  GridItem,
  PageBreadcrumb,
  PageGroup,
  PageSection,
  PaginationVariant,
  Title,
  Tooltip,
} from '@patternfly/react-core';
import DataView from '@patternfly/react-data-view/dist/dynamic/DataView';
import DataViewTable, { DataViewTr } from '@patternfly/react-data-view/dist/dynamic/DataViewTable';
import DataViewToolbar from '@patternfly/react-data-view/dist/dynamic/DataViewToolbar';
import { useDataViewSort } from '@patternfly/react-data-view/dist/dynamic/Hooks';
import { find, includes } from 'lodash-es';
import type { FC } from 'react';
import { createContext, memo, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { MonitoringProvider } from '../contexts/MonitoringContext';
import { rowFilter } from './alerting/AlertUtils';
import { EmptyBox } from './console/console-shared/src/components/empty-state/EmptyBox';
import { LoadingBox } from './console/console-shared/src/components/loading/LoadingBox';
import { LoadingInline } from './console/console-shared/src/components/loading/LoadingInline';
import { StatusBox } from './console/console-shared/src/components/status/StatusBox';
import {
  NamespaceModel,
  PodModel,
  PodMonitorModel,
  ServiceModel,
  ServiceMonitorModel,
} from './console/models';
import { LabelSelector } from './console/module/k8s/label-selector';
import { usePoll } from './console/utils/poll-hook';
import { useSafeFetch } from './console/utils/safe-fetch-hook';
import { filterTargets } from './filter-targets';
import { directedSort, localeCompareSort } from './table/sort-utils';
import { useTableColumns } from './table/useTableColumns';
import { useBoolean } from './hooks/useBoolean';
import { Labels } from './labels';
import { ITEMS_PER_PAGE, TablePagination } from './table-pagination';
import {
  TableFilter,
  TableFilterOption,
  TableFilterProps,
  TableFilters,
} from './table/TableFilters';
import { TableToolbar } from './table/TableToolbar';
import { useTableFilters } from './table/useTableFilters';
import { useTablePagination } from './table/useTablePagination';
import { AlertSource, PrometheusAPIError, Target } from './types';
import { PROMETHEUS_BASE_PATH } from './utils';

export const enum TargetsFilterOptions {
  NAME = 'name',
  STATUS = 'status',
  LABEL = 'label',
  SOURCE = 'source',
}

export interface TargetsFilters {
  [TargetsFilterOptions.NAME]: string;
  [TargetsFilterOptions.STATUS]: string[];
  [TargetsFilterOptions.LABEL]: string;
  [TargetsFilterOptions.SOURCE]: string[];
}

enum MonitorType {
  ServiceMonitor = 'serviceMonitor',
  PodMonitor = 'podMonitor',
}

type PrometheusTargetsResponse = {
  status: string;
  data: {
    activeTargets: Array<Target>;
    droppedTargets: Array<Target>;
  };
};

const ServiceMonitorsWatchContext = createContext([]);
const ServicesWatchContext = createContext([]);

const PodMonitorsWatchContext = createContext([]);
const PodsWatchContext = createContext([]);

const getReference = ({ group, version, kind }) => [group || 'core', version, kind].join('~');

export const getReferenceForModel = (model: K8sModel) =>
  getReference({ group: model.apiGroup, version: model.apiVersion, kind: model.kind });

const PodMonitor: FC<{ target: Target }> = ({ target }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  const [podMonitors, podMonitorsLoaded, podMonitorsLoadError] =
    useContext(PodMonitorsWatchContext);
  const [pods, podsLoaded] = useContext(PodsWatchContext);

  if (podMonitorsLoadError) {
    return (
      <>
        <RedExclamationCircleIcon /> {t('Error')}
      </>
    );
  }

  if (!podsLoaded || !podMonitorsLoaded) {
    return <LoadingInline />;
  }

  // First find the pod that corresponds to the target
  const pod = find(
    pods,
    ({ metadata }) =>
      metadata.name === target?.labels?.pod && metadata.namespace === target?.labels?.namespace,
  );

  // Now find the pod monitor that corresponds to the pod
  const podMonitor = find(
    podMonitors,
    ({ metadata, spec }) =>
      pod &&
      target.scrapePool.includes(`/${metadata.namespace}/${metadata.name}/`) &&
      ((spec.selector.matchLabels === undefined && spec.selector.matchExpressions === undefined) ||
        new LabelSelector(spec.selector).matchesLabels(pod.metadata.labels ?? {})) &&
      (spec.namespaceSelector?.matchNames === undefined ||
        includes(spec.namespaceSelector?.matchNames, pod.metadata.namespace)),
  );

  if (!podMonitor) {
    return <>-</>;
  }

  return (
    <ResourceLink
      kind={getReferenceForModel(PodMonitorModel)}
      name={podMonitor.metadata.name}
      namespace={podMonitor.metadata.namespace}
    />
  );
};

const ServiceMonitor: FC<{ target: Target }> = ({ target }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  const [monitors, monitorsLoaded, monitorsLoadError] = useContext(ServiceMonitorsWatchContext);
  const [services, servicesLoaded] = useContext(ServicesWatchContext);

  if (monitorsLoadError) {
    return (
      <>
        <RedExclamationCircleIcon /> {t('Error')}
      </>
    );
  }

  if (!servicesLoaded || !monitorsLoaded) {
    return <LoadingInline />;
  }

  // First find the service that corresponds to the target
  const service = find(
    services,
    ({ metadata }) =>
      metadata.name === target?.labels?.service && metadata.namespace === target?.labels?.namespace,
  );

  // Now find the service monitor that corresponds to the service
  const monitor = find(
    monitors,
    ({ metadata, spec }) =>
      service &&
      target.scrapePool.includes(`/${metadata.namespace}/${metadata.name}/`) &&
      ((spec.selector.matchLabels === undefined && spec.selector.matchExpressions === undefined) ||
        new LabelSelector(spec.selector).matchesLabels(service.metadata.labels ?? {})) &&
      (spec.namespaceSelector?.matchNames === undefined ||
        includes(spec.namespaceSelector?.matchNames, service.metadata.namespace)),
  );

  if (!monitor) {
    return <>-</>;
  }

  return (
    <ResourceLink
      kind={getReferenceForModel(ServiceMonitorModel)}
      name={monitor.metadata.name}
      namespace={monitor.metadata.namespace}
    />
  );
};

const Health: FC<{ health: 'up' | 'down' }> = memo(({ health }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  return health === 'up' ? (
    <>
      <GreenCheckCircleIcon /> {t('Up')}
    </>
  ) : (
    <>
      <RedExclamationCircleIcon /> {t('Down')}
    </>
  );
});

type WatchErrorAlertProps = {
  loadError: { code: number; message: string };
  title: string;
};

const WatchErrorAlert: FC<WatchErrorAlertProps> = ({ loadError, title }) => {
  const [showError, , , hideError] = useBoolean(true);

  if (!showError) {
    return null;
  }

  return (
    <Alert
      title={title}
      variant="danger"
      actionClose={<AlertActionCloseButton onClose={hideError} />}
    >
      {loadError.message}
    </Alert>
  );
};

type DetailsProps = {
  loaded: boolean;
  loadError: string;
  targets: Target[];
};

const Details: FC<DetailsProps> = ({ loaded, loadError, targets }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  const params = useParams<{ scrapeUrl?: string }>();

  let scrapeUrl = '';
  let target: Target | undefined;
  if (params?.scrapeUrl) {
    try {
      scrapeUrl = atob(params?.scrapeUrl);
      target = find(targets, { scrapeUrl });
    } catch {
      // Leave scrapeUrl and target unset
    }
  }

  const isServiceMonitor: boolean =
    target && target.scrapePool.includes(MonitorType.ServiceMonitor);
  const isPodMonitor: boolean = target && target.scrapePool.includes(MonitorType.PodMonitor);

  const [, , serviceMonitorsLoadError] = useContext(ServiceMonitorsWatchContext);
  const [, , podMonitorsLoadError] = useContext(PodMonitorsWatchContext);

  return (
    <>
      <DocumentTitle>{t('Target details')}</DocumentTitle>
      <StatusBox data={target} label="target" loaded={loaded} loadError={loadError}>
        <PageGroup>
          <PageBreadcrumb hasBodyWrapper={false}>
            <Breadcrumb>
              <BreadcrumbItem>
                <Link to="/monitoring/targets">{t('Targets')}</Link>
              </BreadcrumbItem>
              <BreadcrumbItem isActive>{t('Target details')}</BreadcrumbItem>
            </Breadcrumb>
          </PageBreadcrumb>
          <PageSection hasBodyWrapper={false}>
            <Title headingLevel="h1">{scrapeUrl}</Title>
          </PageSection>
          <Divider />
          <PageSection hasBodyWrapper={false}>
            <Title headingLevel="h2">{t('Target details')}</Title>
            {isServiceMonitor && serviceMonitorsLoadError && (
              <WatchErrorAlert
                loadError={serviceMonitorsLoadError}
                title={t('Error loading service monitor data')}
              />
            )}
            {isPodMonitor && podMonitorsLoadError && (
              <WatchErrorAlert
                loadError={podMonitorsLoadError}
                title={t('Error loading pod monitor data')}
              />
            )}
            <Grid sm={12} md={6}>
              <GridItem>
                <DescriptionList>
                  <DescriptionListGroup>
                    <DescriptionListTerm>{t('Endpoint')}</DescriptionListTerm>
                    <DescriptionListDescription>{scrapeUrl}</DescriptionListDescription>
                  </DescriptionListGroup>
                  <DescriptionListGroup>
                    <DescriptionListTerm>{t('Namespace')}</DescriptionListTerm>
                    <DescriptionListDescription>
                      <ResourceLink kind="Namespace" name={target?.labels?.namespace} />
                    </DescriptionListDescription>
                  </DescriptionListGroup>
                  <DescriptionListGroup>
                    <DescriptionListTerm>{t('Labels')}</DescriptionListTerm>
                    <DescriptionListDescription>
                      <Labels labels={target?.labels} />
                    </DescriptionListDescription>
                  </DescriptionListGroup>
                  <DescriptionListGroup>
                    <DescriptionListTerm>{t('Last scrape')}</DescriptionListTerm>
                    <DescriptionListDescription>
                      <Timestamp timestamp={target?.lastScrape} />
                    </DescriptionListDescription>
                  </DescriptionListGroup>
                  {target?.lastError && (
                    <Alert title={t('Scrape failed')} variant="danger">
                      {target?.lastError}
                    </Alert>
                  )}
                </DescriptionList>
              </GridItem>
              <GridItem>
                <DescriptionList>
                  <DescriptionListGroup>
                    <DescriptionListTerm>{t('Status')}</DescriptionListTerm>
                    <DescriptionListDescription>
                      <Health health={target?.health} />
                    </DescriptionListDescription>
                  </DescriptionListGroup>
                  <DescriptionListGroup>
                    <DescriptionListTerm>{t('Monitor')}</DescriptionListTerm>
                    {isServiceMonitor && (
                      <DescriptionListDescription>
                        <ServiceMonitor target={target} />
                      </DescriptionListDescription>
                    )}
                    {isPodMonitor && (
                      <DescriptionListDescription>
                        <PodMonitor target={target} />
                      </DescriptionListDescription>
                    )}
                    {!isServiceMonitor && !isPodMonitor && (
                      <DescriptionListDescription>
                        <>-</>
                      </DescriptionListDescription>
                    )}
                  </DescriptionListGroup>
                </DescriptionList>
              </GridItem>
            </Grid>
          </PageSection>
        </PageGroup>
      </StatusBox>
    </>
  );
};

type ListPageProps = {
  loaded: boolean;
  loadError: string;
  targets: Target[];
};

const ListPage: FC<ListPageProps> = ({ loaded, loadError, targets }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const [activeAttributeMenu, setActiveAttributeMenu] = useState<string>(t('Text'));

  const [, , serviceMonitorsLoadError] = useContext(ServiceMonitorsWatchContext);
  const [, , podMonitorsLoadError] = useContext(PodMonitorsWatchContext);
  const initialFilters = {
    [TargetsFilterOptions.NAME]: '',
    [TargetsFilterOptions.STATUS]: [],
    [TargetsFilterOptions.LABEL]: '',
    [TargetsFilterOptions.SOURCE]: [],
  };

  // KNOWN ISSUE: the useDataViewPagination, useDataViewFilters, and useDataViewSort functions
  // do not work together for URL initialization, so only the search parameters for the last
  // function will be set when initially loading the page
  // with no search parameters. Future changes are reflected
  const pagination = useTablePagination({
    perPage: ITEMS_PER_PAGE[0],
  });
  const { filters, onSetFilters, clearAllFilters } = useTableFilters<TargetsFilters>({
    initialFilters,
  });
  const { sortBy, direction, onSort } = useDataViewSort({
    initialSort: { sortBy: rowFilter(TargetsFilterOptions.NAME), direction: 'asc' },
  });

  const columnKeys = useMemo(() => {
    const keys = [
      { label: t('Endpoint'), key: rowFilter('scrapeUrl') },
      { label: t('Monitor'), key: rowFilter('monitor') },
      { label: t('Status'), key: rowFilter(TargetsFilterOptions.STATUS) },
      { label: t('Namespace'), key: rowFilter('namespace') },
      { label: t('Last Scrape'), key: rowFilter('lastScrape') },
      { label: t('Scrape Duration'), key: rowFilter('lastScrapeDuration') },
    ];
    return keys;
  }, [t]);

  const columns = useTableColumns(columnKeys, sortBy, direction, onSort, [1]);

  useEffect(() => {
    // When changing filters change back to being on page 1
    pagination.onSetPage(undefined, 1);
  }, [filters]); // eslint-disable-line react-hooks/exhaustive-deps

  const { page, perPage } = pagination;

  const sortedTargetsRows = useMemo(() => {
    const filteredTargets = filterTargets(targets, filters);
    const sortedTargets = sortTargets(filteredTargets, sortBy, direction);
    const mappedTargets = sortedTargets.map((sortedTarget): DataViewTr => {
      const isServiceMonitor: boolean = sortedTarget?.scrapePool?.includes(
        MonitorType.ServiceMonitor,
      );
      const isPodMonitor: boolean = sortedTarget?.scrapePool?.includes(MonitorType.PodMonitor);
      return {
        row: [
          {
            cell: <Link to={`${btoa(sortedTarget?.scrapeUrl)}`}>{sortedTarget?.scrapeUrl}</Link>,
          },
          {
            cell: (
              <>
                {isServiceMonitor && <ServiceMonitor target={sortedTarget} />}
                {isPodMonitor && <PodMonitor target={sortedTarget} />}
                {!isServiceMonitor && !isPodMonitor && <>-</>}
              </>
            ),
          },
          {
            cell:
              sortedTarget?.health === 'up' ? (
                <Health health="up" />
              ) : (
                <Tooltip content={sortedTarget?.lastError}>
                  <span>
                    <Health health="down" />
                  </span>
                </Tooltip>
              ),
          },
          {
            cell: sortedTarget?.labels?.namespace && (
              <ResourceLink
                inline
                kind={NamespaceModel.kind}
                name={sortedTarget?.labels?.namespace}
                className="pf-v6-u-mx-xs"
              />
            ),
          },
          {
            cell: <Timestamp timestamp={sortedTarget?.lastScrape} />,
          },
          sortedTarget?.lastScrapeDuration
            ? `${(1000 * sortedTarget?.lastScrapeDuration).toFixed(1)} ms`
            : '-',
        ],
      };
    });
    return mappedTargets;
  }, [targets, filters, sortBy, direction]);

  const selectedPageOfTargets = useMemo(
    () => sortedTargetsRows.slice((page - 1) * perPage, (page - 1) * perPage + perPage),
    [sortedTargetsRows, page, perPage],
  );

  const onFiltersChange = useMemo(
    () => (filterName: keyof TargetsFilters) => {
      return (_e, val) => {
        onSetFilters({ [filterName]: val });
      };
    },
    [onSetFilters],
  );

  const filterItems = useMemo<TableFilterProps<any>[]>(() => {
    const filtersVals: TableFilterProps<any>[] = [
      {
        filterId: TargetsFilterOptions.NAME,
        type: TableFilterOption.TEXT,
        title: t('Text'),
        placeholder: t('Search by endpoint or namespace...'),
        onChange: onFiltersChange(TargetsFilterOptions.NAME),
        value: filters.name,
        ouiaId: 'TargetTextFilter',
      },
      {
        filterId: TargetsFilterOptions.LABEL,
        type: TableFilterOption.LABEL,
        title: t('Label'),
        placeholder: t('Filter by Label'),
        onChange: onFiltersChange(TargetsFilterOptions.LABEL),
        labelPath: 'labels',
        data: targets,
      },
      {
        filterId: TargetsFilterOptions.STATUS,
        type: TableFilterOption.CHECKBOX,
        title: t('Status'),
        placeholder: t('Filter by Status'),
        onChange: onFiltersChange(TargetsFilterOptions.STATUS),
        value: filters[TargetsFilterOptions.STATUS],
        options: [
          { value: 'up', label: t('Up') },
          { value: 'down', label: t('Down') },
        ],
        ouiaId: 'TargetStatusFilter',
      },
      {
        filterId: TargetsFilterOptions.SOURCE,
        type: TableFilterOption.CHECKBOX,
        title: t('Source'),
        placeholder: t('Filter by Source'),
        onChange: onFiltersChange(TargetsFilterOptions.SOURCE),
        value: filters[TargetsFilterOptions.SOURCE],
        options: [
          { value: AlertSource.Platform, label: t('Platform') },
          { value: AlertSource.User, label: t('User') },
        ],
        ouiaId: 'TargetSourceFilter',
      },
    ];
    return filtersVals;
  }, [filters, t, onFiltersChange, targets]);

  const title = t('Metrics targets');

  return (
    <>
      <DocumentTitle>{title}</DocumentTitle>
      <ListPageHeader title={title} />
      <ListPageBody>
        {loadError && (
          <Alert title={t('Error loading latest targets data')} variant="danger">
            {loadError}
          </Alert>
        )}
        {serviceMonitorsLoadError && (
          <WatchErrorAlert
            loadError={serviceMonitorsLoadError}
            title={t('Error loading service monitor data')}
          />
        )}
        {podMonitorsLoadError && (
          <WatchErrorAlert
            loadError={podMonitorsLoadError}
            title={t('Error loading pod monitor data')}
          />
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
                  itemCount={sortedTargetsRows?.length}
                  variant={PaginationVariant.top}
                  {...pagination}
                />
              }
            />
            {selectedPageOfTargets?.length > 0 && (
              <>
                <DataViewTable
                  aria-label={t('Targets Table')}
                  columns={columns}
                  rows={selectedPageOfTargets}
                />
                <DataViewToolbar
                  style={{ paddingTop: '16px' }}
                  pagination={
                    <TablePagination
                      itemCount={sortedTargetsRows?.length}
                      variant={PaginationVariant.bottom}
                      {...pagination}
                    />
                  }
                />
              </>
            )}
          </DataView>
        )}
        {loaded && selectedPageOfTargets?.length === 0 && !loadError && (
          <EmptyBox customMessage={t('No metrics targets found')} />
        )}
        {!loaded && <LoadingBox />}
      </ListPageBody>
    </>
  );
};

const POLL_INTERVAL = 15 * 1000;

const sortTargets = (
  data: Target[],
  sortBy: string | undefined,
  direction: 'asc' | 'desc' | undefined,
) => {
  if (!sortBy || !direction) {
    return data;
  }

  if (sortBy === rowFilter('scrapeUrl')) {
    return [...data].sort((a, b) => localeCompareSort(a.scrapeUrl, b.scrapeUrl, direction));
  } else if (sortBy === rowFilter('health')) {
    return [...data].sort((a, b) => localeCompareSort(a.health, b.health, direction));
  } else if (sortBy === rowFilter('namespace')) {
    return [...data].sort((a, b) =>
      localeCompareSort(a.labels?.namespace, b.labels?.namespace, direction),
    );
  } else if (sortBy === rowFilter('lastScrape')) {
    return [...data].sort((a, b) => localeCompareSort(a.lastScrape, b.lastScrape, direction));
  } else if (sortBy === rowFilter('lastScrapeDuration')) {
    return [...data].sort((a, b) =>
      directedSort(a.lastScrapeDuration - b.lastScrapeDuration, direction),
    );
  } else if (sortBy === rowFilter(TargetsFilterOptions.STATUS)) {
    return [...data].sort((a, b) => localeCompareSort(a.health, b.health, direction));
  }
  return data;
};

const TargetsPage_: FC = () => {
  const [error, setError] = useState<PrometheusAPIError>();
  const [loaded, setLoaded] = useState(false);
  const [targets, setTargets] = useState<Target[]>();
  const { scrapeUrl } = useParams<{ scrapeUrl?: string }>();

  const servicesWatch = useK8sWatchResource<K8sResourceKind[]>({
    isList: true,
    kind: ServiceModel.kind,
  });

  const monitorsWatch = useK8sWatchResource<K8sResourceKind[]>({
    isList: true,
    kind: getReferenceForModel(ServiceMonitorModel),
  });

  const podsWatch = useK8sWatchResource<K8sResourceKind[]>({
    isList: true,
    kind: PodModel.kind,
  });

  const podMonitorsWatch = useK8sWatchResource<K8sResourceKind[]>({
    isList: true,
    kind: getReferenceForModel(PodMonitorModel),
  });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const safeFetch = useCallback(useSafeFetch(), []);

  const tick = () =>
    safeFetch<PrometheusTargetsResponse>(
      `${PROMETHEUS_BASE_PATH}/${PrometheusEndpoint.TARGETS}?state=active`,
    )
      .then((response) => {
        setError(undefined);
        setLoaded(true);
        setTargets(response?.data?.activeTargets);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          setError(err);
          setLoaded(true);
        }
      });

  usePoll(tick, POLL_INTERVAL);

  const loadError = error?.json?.error || error?.message;

  return (
    <ServiceMonitorsWatchContext.Provider value={monitorsWatch}>
      <ServicesWatchContext.Provider value={servicesWatch}>
        <PodMonitorsWatchContext.Provider value={podMonitorsWatch}>
          <PodsWatchContext.Provider value={podsWatch}>
            {scrapeUrl ? (
              <Details loaded={loaded} loadError={loadError} targets={targets} />
            ) : (
              <ListPage loaded={loaded} loadError={loadError} targets={targets} />
            )}
          </PodsWatchContext.Provider>
        </PodMonitorsWatchContext.Provider>
      </ServicesWatchContext.Provider>
    </ServiceMonitorsWatchContext.Provider>
  );
};

export const MpCmoTargetsPage: React.FC = () => {
  return (
    <MonitoringProvider monitoringContext={{ plugin: 'monitoring-plugin', prometheus: 'cmo' }}>
      <TargetsPage_ />
    </MonitoringProvider>
  );
};
