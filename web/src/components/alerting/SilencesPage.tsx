import {
  AlertSeverity,
  consoleFetchJSON,
  ListPageFilter,
  RowProps,
  Silence,
  SilenceStates,
  TableColumn,
  useListPageFilter,
  VirtualizedTable,
} from '@openshift-console/dynamic-plugin-sdk';
import { RowFilter } from '@openshift-console/dynamic-plugin-sdk-internal/lib/extensions/console-types';
import {
  Button,
  Checkbox,
  Flex,
  FlexItem,
  PageSection,
  Alert as PFAlert,
} from '@patternfly/react-core';
import { sortable } from '@patternfly/react-table';
import * as _ from 'lodash-es';
import type { FC } from 'react';
import { useContext, useState, useMemo, useCallback, memo } from 'react';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom-v5-compat';
import withFallback from '../console/console-shared/error/fallbacks/withFallback';
import { EmptyBox } from '../console/console-shared/src/components/empty-state/EmptyBox';
import { useBoolean } from '../hooks/useBoolean';
import { getFetchSilenceUrl, getNewSilenceUrl, usePerspective } from '../hooks/usePerspective';
import { fuzzyCaseInsensitive, silenceCluster, silenceState } from '../utils';
import { SelectedSilencesContext, SilenceTableRow } from './SilencesUtils';
import { MonitoringProvider } from '../../contexts/MonitoringContext';
import { DataTestIDs } from '../data-test';
import { useAlerts } from '../../hooks/useAlerts';

const SilencesPage_: FC = () => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  const { perspective } = usePerspective();

  const [selectedSilences, setSelectedSilences] = useState(new Set());
  const [errorMessage, setErrorMessage] = useState();

  const { silences, silenceClusterLabels } = useAlerts();

  const rowFilters: RowFilter[] = useMemo(() => {
    const filters = [
      // TODO: The "name" filter doesn't really fit useListPageFilter's idea of a RowFilter, but
      //       useListPageFilter doesn't yet provide a better way to add a filter like this
      {
        filter: (filter, silence: Silence) =>
          fuzzyCaseInsensitive(filter.selected?.[0], silence.name),
        filterGroupName: '',
        items: [],
        type: 'name',
      } as RowFilter,
      {
        defaultSelected: [SilenceStates.Active, SilenceStates.Pending],
        filter: (filter, silence: Silence) =>
          filter.selected?.includes(silenceState(silence)) || _.isEmpty(filter.selected),
        filterGroupName: t('Silence State'),
        items: [
          { id: SilenceStates.Active, title: t('Active') },
          { id: SilenceStates.Pending, title: t('Pending') },
          { id: SilenceStates.Expired, title: t('Expired') },
        ],
        reducer: silenceState,
        type: 'silence-state',
      },
    ];

    if (perspective === 'acm') {
      filters.splice(-1, 0, {
        type: 'silence-cluster',
        filter: (filter, silence: Silence) =>
          filter.selected.length === 0 ||
          filter.selected.some((selectedFilter) =>
            fuzzyCaseInsensitive(
              selectedFilter,
              silence.matchers.find((label) => label.name === 'cluster')?.value,
            ),
          ),
        filterGroupName: t('Cluster'),
        items: silenceClusterLabels.map((clusterName) => ({
          id: clusterName,
          title: clusterName?.length > 50 ? clusterName.slice(0, 50) + '...' : clusterName,
        })),
        reducer: silenceCluster,
        isMatch: (silence: Silence, clusterName: string) =>
          fuzzyCaseInsensitive(
            clusterName,
            silence.matchers.find((label) => label.name === 'cluster')?.value,
          ),
      } as RowFilter);
    }
    return filters;
  }, [perspective, t, silenceClusterLabels]);

  const [staticData, filteredData, onFilterChange] = useListPageFilter(silences?.data, rowFilters);

  const columns = useMemo<Array<TableColumn<Silence>>>(() => {
    const cols: Array<TableColumn<Silence>> = [
      {
        id: 'checkbox',
        title: (<SelectAllCheckbox silences={filteredData} />) as any,
        props: { width: 10 },
      },
      {
        id: 'name',
        sort: 'name',
        title: t('Name'),
        transforms: [sortable],
        props: { width: 40 },
      },
      {
        id: 'firingAlerts',
        sort: (silences: Silence[], direction: 'asc' | 'desc') =>
          _.orderBy(silences, silenceFiringAlertsOrder, [direction]),
        title: t('Firing alerts'),
        transforms: [sortable],
        props: { width: 15 },
      },
      {
        id: 'state',
        sort: (silences: Silence[], direction: 'asc' | 'desc') =>
          _.orderBy(silences, silenceStateOrder, [direction]),
        title: t('State'),
        transforms: [sortable],
        props: { width: 20 },
      },
      {
        id: 'createdBy',
        sort: 'createdBy',
        title: t('Creator'),
        transforms: [sortable],
        props: { width: 15 },
      },
      {
        id: 'actions',
        title: '',
        props: { width: 10 },
      },
    ];

    if (perspective === 'acm') {
      cols.splice(-1, 0, {
        id: 'cluster',
        sort: (silences: Silence[], direction: 'asc' | 'desc') =>
          _.orderBy(silences, silenceClusterOrder(silenceClusterLabels), [direction]),
        title: t('Cluster'),
        transforms: [sortable],
        props: { width: 15 },
      });
    }
    return cols;
  }, [filteredData, t, perspective, silenceClusterLabels]);

  return (
    <>
      <Helmet>
        <title>Alerting</title>
      </Helmet>
      <PageSection hasBodyWrapper={false}>
        <SelectedSilencesContext.Provider value={{ selectedSilences, setSelectedSilences }}>
          <Flex>
            <FlexItem>
              <ListPageFilter
                data={staticData}
                hideLabelFilter
                loaded={!!silences?.loaded}
                onFilterChange={onFilterChange}
                rowFilters={rowFilters}
              />
            </FlexItem>
            <FlexItem>
              <CreateSilenceButton />
            </FlexItem>
            <FlexItem>
              <ExpireAllSilencesButton setErrorMessage={setErrorMessage} />
            </FlexItem>
          </Flex>
          {silences?.loadError && (
            <PFAlert
              isInline
              title={t(
                'Error loading silences from Alertmanager. Alertmanager may be unavailable.',
              )}
              variant="danger"
            >
              {typeof silences?.loadError === 'string'
                ? silences?.loadError
                : silences?.loadError.message}
            </PFAlert>
          )}
          {errorMessage && (
            <PFAlert isInline title={t('Error')} variant="danger">
              {errorMessage}
            </PFAlert>
          )}
          <div id="silences-table-scroll">
            <VirtualizedTable<Silence>
              aria-label={t('Silences')}
              label={t('Silences')}
              columns={columns}
              data={filteredData ?? []}
              loaded={!!silences?.loaded}
              loadError={silences?.loadError ?? ''}
              Row={SilenceTableRowWithCheckbox}
              unfilteredData={silences?.data ?? []}
              NoDataEmptyMsg={() => {
                return <EmptyBox label={t('Silences')} />;
              }}
              scrollNode={() => document.getElementById('silences-table-scroll')}
            />
          </div>
        </SelectedSilencesContext.Provider>
      </PageSection>
    </>
  );
};
const SilencesPageWithFallback = withFallback(SilencesPage_);

const SelectAllCheckbox: FC<{ silences: Silence[] }> = ({ silences }) => {
  const { selectedSilences, setSelectedSilences } = useContext(SelectedSilencesContext);

  const activeSilences = _.filter(silences, (s) => silenceState(s) !== SilenceStates.Expired);
  const isAllSelected =
    activeSilences.length > 0 && _.every(activeSilences, (s) => selectedSilences.has(s.id));

  const onChange = useCallback(
    (isChecked: boolean) => {
      const ids = isChecked ? activeSilences.map((s) => s.id) : [];
      setSelectedSilences(new Set(ids));
    },
    [activeSilences, setSelectedSilences],
  );

  return (
    <Checkbox
      id="select-all-silences-checkbox"
      isChecked={isAllSelected}
      isDisabled={activeSilences.length === 0}
      onChange={(_e, checked) => (typeof _e === 'boolean' ? onChange(_e) : onChange(checked))}
    />
  );
};

const silenceFiringAlertsOrder = (silence: Silence) => {
  const counts = _.countBy(silence.firingAlerts, 'labels.severity');
  return [
    Number.MAX_SAFE_INTEGER - (counts[AlertSeverity.Critical] ?? 0),
    Number.MAX_SAFE_INTEGER - (counts[AlertSeverity.Warning] ?? 0),
    silence.firingAlerts.length,
  ];
};

const silenceStateOrder = (silence: Silence) => [
  [SilenceStates.Active, SilenceStates.Pending, SilenceStates.Expired].indexOf(
    silenceState(silence),
  ),
  _.get(silence, silenceState(silence) === SilenceStates.Pending ? 'startsAt' : 'endsAt'),
];

const silenceClusterOrder = (clusters: Array<string>) => {
  clusters.sort();
  return (silence: Silence) => [
    clusters.indexOf(silence.matchers.find((label) => label.name === 'cluster')?.value),
  ];
};

const ExpireAllSilencesButton: FC<ExpireAllSilencesButtonProps> = ({ setErrorMessage }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const { trigger: refetchSilencesAndAlerts } = useAlerts();

  const { perspective } = usePerspective();

  const [isInProgress, , setInProgress, setNotInProgress] = useBoolean(false);

  const { selectedSilences, setSelectedSilences } = useContext(SelectedSilencesContext);

  const onClick = () => {
    setInProgress();
    Promise.allSettled(
      [...selectedSilences].map((silenceID: string) =>
        consoleFetchJSON.delete(getFetchSilenceUrl(perspective, silenceID)),
      ),
    ).then((values) => {
      setNotInProgress();
      setSelectedSilences(new Set());
      refetchSilencesAndAlerts();
      const errors = values
        .filter((v) => v.status === 'rejected')
        .map((v: PromiseRejectedResult) => v.reason);
      if (errors.length > 0) {
        const messages = errors.map(
          (err) => _.get(err, 'json.error') || err.message || 'Error expiring silence',
        );
        setErrorMessage(messages.join(', '));
      }
    });
  };

  return (
    <Button
      isDisabled={selectedSilences.size === 0}
      isLoading={isInProgress}
      onClick={onClick}
      variant="secondary"
      data-test={DataTestIDs.ExpireXSilencesButton}
    >
      {t('Expire {{count}} silence', { count: selectedSilences.size })}
    </Button>
  );
};

const SilenceTableRowWithCheckbox: FC<RowProps<Silence>> = ({ obj }) => (
  <SilenceTableRow showCheckbox={true} obj={obj} />
);

const CreateSilenceButton: FC = memo(() => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const { perspective } = usePerspective();

  return (
    <Link to={getNewSilenceUrl(perspective)}>
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
};
