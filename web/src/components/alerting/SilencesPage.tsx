import * as React from 'react';
import { useSelector, useDispatch } from 'react-redux';

import { useTranslation } from 'react-i18next';
import {
  getNewSilenceUrl,
  getLegacyObserveState,
  getFetchSilenceUrl,
  usePerspective,
} from '../hooks/usePerspective';
import { Silences } from '../types';
import { MonitoringState } from 'src/reducers/observe';
import { RowFilter } from '@openshift-console/dynamic-plugin-sdk-internal/lib/extensions/console-types';
import {
  AlertSeverity,
  consoleFetchJSON,
  ListPageFilter,
  RowProps,
  Silence,
  SilenceStates,
  TableColumn,
  useActiveNamespace,
  useListPageFilter,
  VirtualizedTable,
} from '@openshift-console/dynamic-plugin-sdk';
import { Helmet } from 'react-helmet';
import { fuzzyCaseInsensitive, refreshSilences, silenceCluster, silenceState } from '../utils';
import * as _ from 'lodash-es';
import { sortable } from '@patternfly/react-table';
import { SelectedSilencesContext, SilenceTableRow } from './SilencesUtils';
import {
  Button,
  Checkbox,
  Flex,
  FlexItem,
  PageSection,
  Alert as PFAlert,
} from '@patternfly/react-core';
import { useBoolean } from '../hooks/useBoolean';
import { Link } from 'react-router-dom';
import { EmptyBox } from '../console/console-shared/src/components/empty-state/EmptyBox';
import withFallback from '../console/console-shared/error/fallbacks/withFallback';

const SilencesPage_: React.FC = () => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  const { silencesKey, perspective } = usePerspective();

  const [selectedSilences, setSelectedSilences] = React.useState(new Set());
  const [errorMessage, setErrorMessage] = React.useState();

  const {
    data,
    loaded = false,
    loadError,
  }: Silences = useSelector(
    (state: MonitoringState) => getLegacyObserveState(perspective, state)?.get(silencesKey) || {},
  );

  const clusters = React.useMemo(() => {
    const clusterSet = new Set<string>();
    data?.forEach((silence) => {
      const clusterName = silenceCluster(silence);
      if (clusterName) {
        clusterSet.add(clusterName);
      }
    });

    const clusterArray = Array.from(clusterSet);
    return clusterArray.sort();
  }, [data]);

  const rowFilters: RowFilter[] = [
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
    rowFilters.splice(-1, 0, {
      type: 'silence-cluster',
      filter: (filter, silence: Silence) =>
        filter.selected.length === 0 ||
        filter.selected.some((selectedFilter) =>
          fuzzyCaseInsensitive(
            selectedFilter,
            silence.matchers.find((label) => label.name === 'cluster').value,
          ),
        ),
      filterGroupName: t('Cluster'),
      items: clusters.map((clusterName) => ({ id: clusterName, title: clusterName })),
      reducer: silenceCluster,
      isMatch: (silence: Silence, clusterName: string) =>
        fuzzyCaseInsensitive(
          clusterName,
          silence.matchers.find((label) => label.name === 'cluster').value,
        ),
    } as RowFilter);
  }

  const [staticData, filteredData, onFilterChange] = useListPageFilter(data, rowFilters);

  const columns = React.useMemo<Array<TableColumn<Silence>>>(() => {
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
          _.orderBy(silences, silenceClusterOrder(clusters), [direction]),
        title: t('Cluster'),
        transforms: [sortable],
      });
    }
    return cols;
  }, [filteredData, t, perspective, clusters]);

  return (
    <>
      <Helmet>{perspective === 'dev' ? <title>Silences</title> : <title>Alerting</title>}</Helmet>
      <PageSection hasBodyWrapper={false}>
        <SelectedSilencesContext.Provider value={{ selectedSilences, setSelectedSilences }}>
          <Flex>
            <FlexItem>
              <ListPageFilter
                data={staticData}
                hideLabelFilter
                loaded={loaded}
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
          {loadError && (
            <PFAlert
              isInline
              title={t(
                'Error loading silences from Alertmanager. Alertmanager may be unavailable.',
              )}
              variant="danger"
            >
              {typeof loadError === 'string' ? loadError : loadError.message}
            </PFAlert>
          )}
          {errorMessage && (
            <PFAlert isInline title={t('Error')} variant="danger">
              {errorMessage}
            </PFAlert>
          )}
          <VirtualizedTable<Silence>
            aria-label={t('Silences')}
            label={t('Silences')}
            columns={columns}
            data={filteredData ?? []}
            loaded={loaded}
            loadError={loadError}
            Row={SilenceTableRowWithCheckbox}
            unfilteredData={data}
            NoDataEmptyMsg={() => {
              return <EmptyBox label={t('Silences')} />;
            }}
          />
        </SelectedSilencesContext.Provider>
      </PageSection>
    </>
  );
};
const SilencesPage = withFallback(SilencesPage_);

const SelectAllCheckbox: React.FC<{ silences: Silence[] }> = ({ silences }) => {
  const { selectedSilences, setSelectedSilences } = React.useContext(SelectedSilencesContext);

  const activeSilences = _.filter(silences, (s) => silenceState(s) !== SilenceStates.Expired);
  const isAllSelected =
    activeSilences.length > 0 && _.every(activeSilences, (s) => selectedSilences.has(s.id));

  const onChange = React.useCallback(
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

const ExpireAllSilencesButton: React.FC<ExpireAllSilencesButtonProps> = ({ setErrorMessage }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  const { perspective, silencesKey } = usePerspective();

  const [isInProgress, , setInProgress, setNotInProgress] = useBoolean(false);

  const dispatch = useDispatch();

  const { selectedSilences, setSelectedSilences } = React.useContext(SelectedSilencesContext);

  const [namespace] = useActiveNamespace();

  const onClick = () => {
    setInProgress();
    Promise.allSettled(
      [...selectedSilences].map((silenceID: string) =>
        consoleFetchJSON.delete(getFetchSilenceUrl(perspective, silenceID, namespace)),
      ),
    ).then((values) => {
      setNotInProgress();
      setSelectedSilences(new Set());
      refreshSilences(dispatch, perspective, silencesKey);
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
    >
      {t('Expire {{count}} silence', { count: selectedSilences.size })}
    </Button>
  );
};

const SilenceTableRowWithCheckbox: React.FC<RowProps<Silence>> = ({ obj }) => (
  <SilenceTableRow showCheckbox={true} obj={obj} />
);

const CreateSilenceButton: React.FC = React.memo(() => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const { perspective } = usePerspective();
  const [namespace] = useActiveNamespace();

  return (
    <Link to={getNewSilenceUrl(perspective, namespace)}>
      <Button data-test="create-silence-btn" variant="primary">
        {t('Create silence')}
      </Button>
    </Link>
  );
});

export default SilencesPage;

type ExpireAllSilencesButtonProps = {
  setErrorMessage: (string) => void;
};
