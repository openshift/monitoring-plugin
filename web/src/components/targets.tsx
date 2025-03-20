import {
  GreenCheckCircleIcon,
  K8sModel,
  K8sResourceKind,
  ListPageBody,
  ListPageFilter,
  ListPageHeader,
  PrometheusEndpoint,
  RedExclamationCircleIcon,
  ResourceLink,
  RowFilter,
  RowProps,
  TableColumn,
  Timestamp,
  useK8sWatchResource,
  useListPageFilter,
  VirtualizedTable,
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
  Title,
  Tooltip,
} from '@patternfly/react-core';
import { sortable, Td } from '@patternfly/react-table';
import { find, includes, isEmpty } from 'lodash-es';
import * as React from 'react';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';
import { Link, Route, Switch, useRouteMatch } from 'react-router-dom';

import {
  NamespaceModel,
  PodModel,
  PodMonitorModel,
  ServiceModel,
  ServiceMonitorModel,
} from './console/models';
import { usePoll } from './console/utils/poll-hook';
import { useSafeFetch } from './console/utils/safe-fetch-hook';

import { useBoolean } from './hooks/useBoolean';
import { Labels } from './labels';
import { AlertSource, PrometheusAPIError, Target } from './types';
import { fuzzyCaseInsensitive, targetSource } from './utils';
import { PROMETHEUS_BASE_PATH } from './console/graphs/helpers';
import { LoadingInline } from './console/console-shared/src/components/loading/LoadingInline';
import { StatusBox } from './console/console-shared/src/components/status/StatusBox';
import { EmptyBox } from './console/console-shared/src/components/empty-state/EmptyBox';
import { LabelSelector } from './console/module/k8s/label-selector';

enum MonitorType {
  ServiceMonitor = 'serviceMonitor',
  PodMonitor = 'podMonitor',
}

const ServiceMonitorsWatchContext = React.createContext([]);
const ServicesWatchContext = React.createContext([]);

const PodMonitorsWatchContext = React.createContext([]);
const PodsWatchContext = React.createContext([]);

const getReference = ({ group, version, kind }) => [group || 'core', version, kind].join('~');

export const getReferenceForModel = (model: K8sModel) =>
  getReference({ group: model.apiGroup, version: model.apiVersion, kind: model.kind });

const PodMonitor: React.FC<{ target: Target }> = ({ target }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  const [podMonitors, podMonitorsLoaded, podMonitorsLoadError] =
    React.useContext(PodMonitorsWatchContext);
  const [pods, podsLoaded] = React.useContext(PodsWatchContext);

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

const ServiceMonitor: React.FC<{ target: Target }> = ({ target }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  const [monitors, monitorsLoaded, monitorsLoadError] = React.useContext(
    ServiceMonitorsWatchContext,
  );
  const [services, servicesLoaded] = React.useContext(ServicesWatchContext);

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

const Health: React.FC<{ health: 'up' | 'down' }> = React.memo(({ health }) => {
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

const WatchErrorAlert: React.FC<WatchErrorAlertProps> = ({ loadError, title }) => {
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

const Details: React.FC<DetailsProps> = ({ loaded, loadError, targets }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  const match = useRouteMatch<{ scrapeUrl?: string }>();

  let scrapeUrl = '';
  let target: Target | undefined;
  if (match?.params?.scrapeUrl) {
    try {
      scrapeUrl = atob(match?.params?.scrapeUrl);
      target = find(targets, { scrapeUrl });
    } catch {
      // Leave scrapeUrl and target unset
    }
  }

  const isServiceMonitor: boolean =
    target && target.scrapePool.includes(MonitorType.ServiceMonitor);
  const isPodMonitor: boolean = target && target.scrapePool.includes(MonitorType.PodMonitor);

  const [, , serviceMonitorsLoadError] = React.useContext(ServiceMonitorsWatchContext);
  const [, , podMonitorsLoadError] = React.useContext(PodMonitorsWatchContext);

  return (
    <>
      <Helmet>
        <title>{t('Target details')}</title>
      </Helmet>
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
      </PageGroup>
      <Divider />
      <StatusBox data={target} label="target" loaded={loaded} loadError={loadError}>
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
                    <Labels kind="metricstarget" labels={target?.labels} />
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
      </StatusBox>
    </>
  );
};

const Row: React.FC<RowProps<Target>> = ({ obj }) => {
  const { health, labels, lastError, lastScrape, lastScrapeDuration, scrapePool, scrapeUrl } = obj;

  const isServiceMonitor: boolean = scrapePool?.includes(MonitorType.ServiceMonitor);
  const isPodMonitor: boolean = scrapePool?.includes(MonitorType.PodMonitor);

  return (
    <>
      <Td>
        <Link to={`./targets/${btoa(scrapeUrl)}`}>{scrapeUrl}</Link>
      </Td>
      <Td>
        {isServiceMonitor && <ServiceMonitor target={obj} />}
        {isPodMonitor && <PodMonitor target={obj} />}
        {!isServiceMonitor && !isPodMonitor && <>-</>}
      </Td>
      <Td>
        {health === 'up' ? (
          <Health health="up" />
        ) : (
          <Tooltip content={lastError}>
            <span>
              <Health health="down" />
            </span>
          </Tooltip>
        )}
      </Td>
      <Td>
        {labels?.namespace && (
          <ResourceLink inline kind={NamespaceModel.kind} name={labels?.namespace} />
        )}
      </Td>
      <Td>
        <Timestamp timestamp={lastScrape} />
      </Td>
      <Td>{lastScrapeDuration ? `${(1000 * lastScrapeDuration).toFixed(1)} ms` : '-'}</Td>
    </>
  );
};

type ListProps = {
  data: Target[];
  loaded: boolean;
  loadError: string;
  unfilteredData: Target[];
};

const List: React.FC<ListProps> = ({ data, loaded, loadError, unfilteredData }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  const columns = React.useMemo<TableColumn<Target>[]>(
    () => [
      {
        id: 'scrapeUrl',
        title: t('Endpoint'),
        sort: 'scrapeUrl',
        transforms: [sortable],
      },
      {
        id: 'monitor',
        title: t('Monitor'),
      },
      {
        id: 'health',
        title: t('Status'),
        sort: 'health',
        transforms: [sortable],
      },
      {
        id: 'namespace',
        title: t('Namespace'),
        sort: 'labels.namespace',
        transforms: [sortable],
      },
      {
        id: 'lastScrape',
        title: t('Last Scrape'),
        sort: 'lastScrape',
        transforms: [sortable],
      },
      {
        id: 'lastScrapeDuration',
        title: t('Scrape Duration'),
        sort: 'lastScrapeDuration',
        transforms: [sortable],
      },
    ],
    [t],
  );

  return (
    <VirtualizedTable<Target>
      aria-label={t('Metrics targets')}
      label={t('Metrics targets')}
      columns={columns}
      data={data}
      loaded={loaded}
      loadError={loadError}
      Row={Row}
      unfilteredData={unfilteredData}
      NoDataEmptyMsg={() => {
        return <EmptyBox label={t('Metrics targets')} />;
      }}
    />
  );
};

type ListPageProps = {
  loaded: boolean;
  loadError: string;
  targets: Target[];
};

const ListPage: React.FC<ListPageProps> = ({ loaded, loadError, targets }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  const [, , serviceMonitorsLoadError] = React.useContext(ServiceMonitorsWatchContext);
  const [, , podMonitorsLoadError] = React.useContext(PodMonitorsWatchContext);

  const nameFilter: RowFilter = {
    filter: (filter, target: Target) =>
      fuzzyCaseInsensitive(filter.selected?.[0], target.scrapeUrl) ||
      fuzzyCaseInsensitive(filter.selected?.[0], target.labels?.namespace),
    items: [],
    type: 'name',
  } as RowFilter;

  const rowFilters: RowFilter[] = [
    {
      filter: (filter, target: Target) =>
        filter.selected?.includes(target.health) || isEmpty(filter.selected),
      filterGroupName: t('Status'),
      items: [
        { id: 'up', title: t('Up') },
        { id: 'down', title: t('Down') },
      ],
      reducer: (target: Target) => target?.health,
      type: 'observe-target-health',
    },
    {
      filter: (filter, target: Target) =>
        filter.selected?.includes(targetSource(target)) || isEmpty(filter.selected),
      filterGroupName: t('Source'),
      items: [
        { id: AlertSource.Platform, title: t('Platform') },
        { id: AlertSource.User, title: t('User') },
      ],
      reducer: targetSource,
      type: 'observe-target-source',
    },
  ];

  const allFilters: RowFilter[] = [nameFilter, ...rowFilters];

  const [staticData, filteredData, onFilterChange] = useListPageFilter(targets, allFilters);

  const title = t('Metrics targets');

  return (
    <>
      <Helmet>
        <title>{title}</title>
      </Helmet>
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
        <ListPageFilter
          data={staticData}
          labelFilter="observe-target-labels"
          labelPath="labels"
          loaded={loaded}
          nameFilterPlaceholder={t('Search by endpoint or namespace...')}
          nameFilterTitle={t('Text')}
          onFilterChange={onFilterChange}
          rowFilters={rowFilters}
        />
        <List
          data={filteredData ?? []}
          loaded={loaded}
          loadError={loadError}
          unfilteredData={targets}
        />
      </ListPageBody>
    </>
  );
};

const POLL_INTERVAL = 15 * 1000;

export const TargetsUI: React.FC = () => {
  const [error, setError] = React.useState<PrometheusAPIError>();
  const [loaded, setLoaded] = React.useState(false);
  const [targets, setTargets] = React.useState<Target[]>();

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
  const safeFetch = React.useCallback(useSafeFetch(), []);

  const tick = () =>
    safeFetch(`${PROMETHEUS_BASE_PATH}/${PrometheusEndpoint.TARGETS}?state=active`)
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
            <Switch>
              <Route path="/monitoring/targets" exact>
                <ListPage loaded={loaded} loadError={loadError} targets={targets} />
              </Route>
              <Route path="/monitoring/targets/:scrapeUrl?" exact>
                <Details loaded={loaded} loadError={loadError} targets={targets} />
              </Route>
              <Route path="/virt-monitoring/targets" exact>
                <ListPage loaded={loaded} loadError={loadError} targets={targets} />
              </Route>
              <Route path="/virt-monitoring/targets/:scrapeUrl?" exact>
                <Details loaded={loaded} loadError={loadError} targets={targets} />
              </Route>
            </Switch>
          </PodsWatchContext.Provider>
        </PodMonitorsWatchContext.Provider>
      </ServicesWatchContext.Provider>
    </ServiceMonitorsWatchContext.Provider>
  );
};
