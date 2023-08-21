import {
  GreenCheckCircleIcon,
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
  Tooltip,
} from '@patternfly/react-core';
import { sortable } from '@patternfly/react-table';
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
import { LabelSelector } from './console/module/k8s/label-selector';
import { referenceForModel } from './console/module/k8s/k8s-ref';
import { K8sResourceKind } from './console/module/k8s/types';
import { SectionHeading } from './console/utils/headings';
import { usePoll } from './console/utils/poll-hook';
import { useSafeFetch } from './console/utils/safe-fetch-hook';
import { LoadingInline, StatusBox } from './console/utils/status-box';

import { useBoolean } from './hooks/useBoolean';
import { Labels } from './labels';
import { AlertSource, PrometheusAPIError, Target } from './types';
import { fuzzyCaseInsensitive, PROMETHEUS_BASE_PATH, targetSource } from './utils';

enum MonitorType {
  ServiceMonitor = 'serviceMonitor',
  PodMonitor = 'podMonitor',
}

const ServiceMonitorsWatchContext = React.createContext([]);
const ServicesWatchContext = React.createContext([]);

const PodMonitorsWatchContext = React.createContext([]);
const PodsWatchContext = React.createContext([]);

const PodMonitor: React.FC<{ target: Target }> = ({ target }) => {
  const { t } = useTranslation('plugin__monitoring-plugin');

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
      kind={referenceForModel(PodMonitorModel)}
      name={podMonitor.metadata.name}
      namespace={podMonitor.metadata.namespace}
    />
  );
};

const ServiceMonitor: React.FC<{ target: Target }> = ({ target }) => {
  const { t } = useTranslation('plugin__monitoring-plugin');

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
      kind={referenceForModel(ServiceMonitorModel)}
      name={monitor.metadata.name}
      namespace={monitor.metadata.namespace}
    />
  );
};

const Health: React.FC<{ health: 'up' | 'down' }> = React.memo(({ health }) => {
  const { t } = useTranslation('plugin__monitoring-plugin');

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
      className="co-alert"
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
  const { t } = useTranslation('plugin__monitoring-plugin');

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
      <div className="pf-c-page__main-breadcrumb">
        <Breadcrumb className="co-breadcrumb">
          <BreadcrumbItem>
            <Link className="pf-c-breadcrumb__link" to="/monitoring/targets">
              {t('Targets')}
            </Link>
          </BreadcrumbItem>
          <BreadcrumbItem isActive>{t('Target details')}</BreadcrumbItem>
        </Breadcrumb>
      </div>
      <div className="co-m-nav-title co-m-nav-title--detail co-m-nav-title--breadcrumbs">
        <h1 className="co-m-pane__heading">
          <div className="co-resource-item">{scrapeUrl}</div>
        </h1>
      </div>
      <StatusBox data={target} label="target" loaded={loaded} loadError={loadError}>
        <div className="co-m-pane__body">
          <SectionHeading text={t('Target details')} />
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
          <div className="co-m-pane__body-group">
            <div className="row">
              <div className="col-sm-6">
                <dl className="co-m-pane__details">
                  <dt>{t('Endpoint')}</dt>
                  <dd>{scrapeUrl}</dd>
                  <dt>{t('Namespace')}</dt>
                  <dd>
                    <ResourceLink kind="Namespace" name={target?.labels?.namespace} />
                  </dd>
                  <dt>{t('Labels')}</dt>
                  <dd>
                    <Labels kind="metricstarget" labels={target?.labels} />
                  </dd>
                  <dt>{t('Last scrape')}</dt>
                  <dd>
                    <Timestamp timestamp={target?.lastScrape} />
                  </dd>
                  {target?.lastError && (
                    <Alert className="co-alert" title={t('Scrape failed')} variant="danger">
                      {target?.lastError}
                    </Alert>
                  )}
                </dl>
              </div>
              <div className="col-sm-6">
                <dl className="co-m-pane__details">
                  <dt>{t('Status')}</dt>
                  <dd>
                    <Health health={target?.health} />
                  </dd>
                  <dt>{t('Monitor')}</dt>
                  {isServiceMonitor && (
                    <dd>
                      <ServiceMonitor target={target} />
                    </dd>
                  )}
                  {isPodMonitor && (
                    <dd>
                      <PodMonitor target={target} />
                    </dd>
                  )}
                  {!isServiceMonitor && !isPodMonitor && (
                    <dd>
                      <>-</>
                    </dd>
                  )}
                </dl>
              </div>
            </div>
          </div>
        </div>
      </StatusBox>
    </>
  );
};

const tableClasses = [
  'pf-u-w-25-on-md', // Endpoint
  'pf-u-w-16-on-md', // Monitor
  '', // Status
  'pf-u-w-16-on-md', // Namespace
  'pf-m-hidden pf-m-visible-on-md', // Last Scrape
  'pf-m-hidden pf-m-visible-on-md', // Scrape Duration
];

const Row: React.FC<RowProps<Target>> = ({ obj }) => {
  const { health, labels, lastError, lastScrape, lastScrapeDuration, scrapePool, scrapeUrl } = obj;

  const isServiceMonitor: boolean = scrapePool?.includes(MonitorType.ServiceMonitor);
  const isPodMonitor: boolean = scrapePool?.includes(MonitorType.PodMonitor);

  return (
    <>
      <td className={tableClasses[0]}>
        <Link to={`./targets/${btoa(scrapeUrl)}`}>{scrapeUrl}</Link>
      </td>
      <td className={tableClasses[1]}>
        {isServiceMonitor && <ServiceMonitor target={obj} />}
        {isPodMonitor && <PodMonitor target={obj} />}
        {!isServiceMonitor && !isPodMonitor && <>-</>}
      </td>
      <td className={tableClasses[2]}>
        {health === 'up' ? (
          <Health health="up" />
        ) : (
          <Tooltip content={lastError}>
            <span>
              <Health health="down" />
            </span>
          </Tooltip>
        )}
      </td>
      <td className={tableClasses[3]}>
        {labels?.namespace && (
          <ResourceLink inline kind={NamespaceModel.kind} name={labels?.namespace} />
        )}
      </td>
      <td className={tableClasses[4]}>
        <Timestamp timestamp={lastScrape} />
      </td>
      <td className={tableClasses[5]}>
        {lastScrapeDuration ? `${(1000 * lastScrapeDuration).toFixed(1)} ms` : '-'}
      </td>
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
  const { t } = useTranslation('plugin__monitoring-plugin');

  const columns = React.useMemo<TableColumn<Target>[]>(
    () => [
      {
        id: 'scrapeUrl',
        title: t('Endpoint'),
        sort: 'scrapeUrl',
        transforms: [sortable],
        props: { className: tableClasses[0] },
      },
      {
        id: 'monitor',
        title: t('Monitor'),
        props: { className: tableClasses[1] },
      },
      {
        id: 'health',
        title: t('Status'),
        sort: 'health',
        transforms: [sortable],
        props: { className: tableClasses[2] },
      },
      {
        id: 'namespace',
        title: t('Namespace'),
        sort: 'labels.namespace',
        transforms: [sortable],
        props: { className: tableClasses[3] },
      },
      {
        id: 'lastScrape',
        title: t('Last Scrape'),
        sort: 'lastScrape',
        transforms: [sortable],
        props: { className: tableClasses[4] },
      },
      {
        id: 'lastScrapeDuration',
        title: t('Scrape Duration'),
        sort: 'lastScrapeDuration',
        transforms: [sortable],
        props: { className: tableClasses[5] },
      },
    ],
    [t],
  );

  return (
    <VirtualizedTable<Target>
      aria-label="metrics targets"
      columns={columns}
      data={data}
      loaded={loaded}
      loadError={loadError}
      Row={Row}
      unfilteredData={unfilteredData}
    />
  );
};

type ListPageProps = {
  loaded: boolean;
  loadError: string;
  targets: Target[];
};

const ListPage: React.FC<ListPageProps> = ({ loaded, loadError, targets }) => {
  const { t } = useTranslation('plugin__monitoring-plugin');

  const [, , serviceMonitorsLoadError] = React.useContext(ServiceMonitorsWatchContext);
  const [, , podMonitorsLoadError] = React.useContext(PodMonitorsWatchContext);

  const nameFilter: RowFilter = {
    filter: (filter, target: Target) =>
      fuzzyCaseInsensitive(filter.selected?.[0], target.scrapeUrl) ||
      fuzzyCaseInsensitive(filter.selected?.[0], target.monitor) ||
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
      {/*
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore TODO */}
      <ListPageBody>
        {loadError && (
          <Alert
            className="co-alert"
            title={t('Error loading latest targets data')}
            variant="danger"
          >
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
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore TODO
          labelFilter="observe-target-labels"
          labelPath="labels"
          loaded={loaded}
          nameFilterPlaceholder={t('Search by endpoint, target, or namespace...')}
          nameFilterTitle={t('Text')}
          onFilterChange={onFilterChange}
          rowFilters={rowFilters}
        />
        <div className="row">
          <div className="col-xs-12">
            <List
              data={filteredData ?? []}
              loaded={loaded}
              loadError={loadError}
              unfilteredData={targets}
            />
          </div>
        </div>
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
    kind: referenceForModel(ServiceMonitorModel),
  });

  const podsWatch = useK8sWatchResource<K8sResourceKind[]>({
    isList: true,
    kind: PodModel.kind,
  });

  const podMonitorsWatch = useK8sWatchResource<K8sResourceKind[]>({
    isList: true,
    kind: referenceForModel(PodMonitorModel),
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
            </Switch>
          </PodsWatchContext.Provider>
        </PodMonitorsWatchContext.Provider>
      </ServicesWatchContext.Provider>
    </ServiceMonitorsWatchContext.Provider>
  );
};
