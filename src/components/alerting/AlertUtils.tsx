import * as React from 'react';
import {
  Action,
  Alert,
  AlertSeverity,
  AlertStates,
  BlueInfoCircleIcon,
  consoleFetchJSON,
  GreenCheckCircleIcon,
  PrometheusAlert,
  PrometheusLabels,
  RedExclamationCircleIcon,
  ResourceStatus,
  Rule,
  Silence,
  SilenceStates,
  Timestamp,
  YellowExclamationTriangleIcon,
} from '@openshift-console/dynamic-plugin-sdk';
import { AlertSource, MonitoringResource } from '../types';
import * as _ from 'lodash-es';
import { useTranslation } from 'react-i18next';
import {
  Alert as PFAlert,
  Popover,
  Button,
  Checkbox,
  Label,
  DropdownItem,
  Dropdown,
  DropdownPosition,
  KebabToggle,
  ModalVariant,
  Modal,
  Flex,
  FlexItem,
} from '@patternfly/react-core';
import {
  labelsToParams,
  refreshSilences,
  RuleResource,
  silenceMatcherEqualitySymbol,
  SilenceResource,
  silenceState,
} from '../utils';
import classNames from 'classnames';
import {
  BellIcon,
  BellSlashIcon,
  OutlinedBellIcon,
  BanIcon,
  HourglassHalfIcon,
} from '@patternfly/react-icons';
import { FormatSeriesTitle, QueryBrowser } from '../query-browser';
import { Link, RouteComponentProps, withRouter } from 'react-router-dom';
import { TFunction } from 'i18next';
import { useBoolean } from '../hooks/useBoolean';
import { usePerspective } from '../hooks/usePerspective';
import { useDispatch } from 'react-redux';
import { LoadingInline } from '../console/utils/status-box';

export const getAdditionalSources = <T extends Alert | Rule>(
  data: Array<T>,
  itemSource: (item: T) => string,
) => {
  if (data) {
    const additionalSources = new Set<string>();
    data.forEach((item) => {
      const source = itemSource(item);
      if (source !== AlertSource.Platform && source !== AlertSource.User) {
        additionalSources.add(source);
      }
    });
    return Array.from(additionalSources).map((item) => ({ id: item, title: _.startCase(item) }));
  }
  return [];
};

export const alertingRuleSource = (rule: Rule): AlertSource | string => {
  if (rule.sourceId === undefined || rule.sourceId === 'prometheus') {
    return rule.labels?.prometheus === 'openshift-monitoring/k8s'
      ? AlertSource.Platform
      : AlertSource.User;
  }

  return rule.sourceId;
};

export const alertSource = (alert: Alert): AlertSource | string => alertingRuleSource(alert.rule);

export const SilencesNotLoadedWarning: React.FC<{ silencesLoadError: any }> = ({
  silencesLoadError,
}) => {
  const { t } = useTranslation('plugin__monitoring-plugin');

  return (
    <PFAlert
      className="co-alert"
      isInline
      title={t(
        'Error loading silences from Alertmanager. Some of the alerts below may actually be silenced.',
      )}
      variant="warning"
    >
      {silencesLoadError.json?.error || silencesLoadError.message}
    </PFAlert>
  );
};

type ActionWithHref = Omit<Action, 'cta'> & { cta: { href: string; external?: boolean } };
export const isActionWithHref = (action: Action): action is ActionWithHref => 'href' in action.cta;

export const ruleURL = (rule: Rule) => `${RuleResource.plural}/${_.get(rule, 'id')}`;
export const devRuleURL = (rule: Rule, namespace: string) =>
  `/dev-monitoring/ns/${namespace}/rules/${rule?.id}`;

export const silenceAlertURL = (alert: PrometheusAlert) =>
  `${SilenceResource.plural}/~new?${labelsToParams(alert.labels)}`;

export const devSilenceAlertURL = (alert: PrometheusAlert, namespace: string) =>
  `/dev-monitoring/ns/${namespace}/silences/~new?${labelsToParams(alert.labels)}`;

type ActionWithCallBack = Omit<Action, 'cta'> & { cta: () => void };
export const isActionWithCallback = (action: Action): action is ActionWithCallBack =>
  typeof action.cta === 'function';

export const MonitoringResourceIcon: React.FC<MonitoringResourceIconProps> = ({
  className,
  resource,
}) => (
  <span
    className={classNames(
      `co-m-resource-icon co-m-resource-${resource.kind.toLowerCase()}`,
      className,
    )}
    title={resource.label}
  >
    {resource.abbr}
  </span>
);

type MonitoringResourceIconProps = {
  className?: string;
  resource: MonitoringResource;
};

export const Severity: React.FC<{ severity: string }> = React.memo(({ severity }) => {
  const { t } = useTranslation('plugin__monitoring-plugin');

  const getSeverityKey = (severityData: string) => {
    switch (severityData) {
      case AlertSeverity.Critical:
        return t('Critical');
      case AlertSeverity.Info:
        return t('Info');
      case AlertSeverity.Warning:
        return t('Warning');
      case AlertSeverity.None:
        return t('None');
      default:
        return severityData;
    }
  };

  return _.isNil(severity) ? (
    <>-</>
  ) : (
    <>
      <SeverityIcon severity={severity} /> {getSeverityKey(severity)}
    </>
  );
});

export const SeverityIcon: React.FC<{ severity: string }> = React.memo(({ severity }) => {
  const Icon =
    {
      [AlertSeverity.Critical]: RedExclamationCircleIcon,
      [AlertSeverity.Info]: BlueInfoCircleIcon,
      [AlertSeverity.None]: BlueInfoCircleIcon,
      [AlertSeverity.Warning]: YellowExclamationTriangleIcon,
    }[severity] || YellowExclamationTriangleIcon;
  return <Icon />;
});

export const AlertState: React.FC<AlertStateProps> = React.memo(({ state }) => {
  const { t } = useTranslation('plugin__monitoring-plugin');

  const icon = <AlertStateIcon state={state} />;

  return icon ? (
    <>
      {icon} {getAlertStateKey(state, t)}
    </>
  ) : null;
});

type AlertStateProps = {
  state: AlertStates;
};

export const AlertStateIcon: React.FC<{ state: string }> = React.memo(({ state }) => {
  switch (state) {
    case AlertStates.Firing:
      return <BellIcon />;
    case AlertStates.Pending:
      return <OutlinedBellIcon />;
    case AlertStates.Silenced:
      return <BellSlashIcon className="text-muted" />;
    default:
      return null;
  }
});

export const getAlertStateKey = (state, t) => {
  switch (state) {
    case AlertStates.Firing:
      return t('Firing');
    case AlertStates.Pending:
      return t('Pending');
    case AlertStates.Silenced:
      return t('Silenced');
    default:
      return t('Not Firing');
  }
};

export const AlertStateDescription: React.FC<{ alert: Alert }> = ({ alert }) => {
  const { t } = useTranslation('plugin__monitoring-plugin');

  if (alert && !_.isEmpty(alert.silencedBy)) {
    return <StateTimestamp text={t('Ends')} timestamp={_.max(_.map(alert.silencedBy, 'endsAt'))} />;
  }
  if (alert && alert.activeAt) {
    return <StateTimestamp text={t('Since')} timestamp={alert.activeAt} />;
  }
  return null;
};

const StateTimestamp = ({ text, timestamp }) => (
  <div className="text-muted monitoring-timestamp">
    {text}&nbsp;
    <Timestamp timestamp={timestamp} />
  </div>
);

export const SeverityBadge: React.FC<{ severity: string }> = React.memo(({ severity }) =>
  _.isNil(severity) || severity === 'none' ? null : (
    <ResourceStatus>
      <Severity severity={severity} />
    </ResourceStatus>
  ),
);

export const PopoverField: React.FC<{ bodyContent: React.ReactNode; label: string }> = ({
  bodyContent,
  label,
}) => (
  <Popover headerContent={label} bodyContent={bodyContent}>
    <Button variant="plain" className="details-item__popover-button">
      {label}
    </Button>
  </Popover>
);

export const Graph: React.FC<GraphProps> = ({
  filterLabels = undefined,
  formatSeriesTitle,
  namespace,
  query,
  ruleDuration,
}) => {
  const { t } = useTranslation('plugin__monitoring-plugin');

  // 3 times the rule's duration, but not less than 30 minutes
  const timespan = Math.max(3 * ruleDuration, 30 * 60) * 1000;

  const GraphLink = () =>
    query ? (
      <Link aria-label={t('View in Metrics')} to={queryBrowserURL(query, namespace)}>
        {t('View in Metrics')}
      </Link>
    ) : null;

  return (
    <QueryBrowser
      namespace={namespace}
      defaultTimespan={timespan}
      filterLabels={filterLabels}
      formatSeriesTitle={formatSeriesTitle}
      GraphLink={GraphLink}
      pollInterval={Math.round(timespan / 120)}
      queries={[query]}
    />
  );
};

type GraphProps = {
  filterLabels?: PrometheusLabels;
  formatSeriesTitle?: FormatSeriesTitle;
  namespace?: string;
  query: string;
  ruleDuration: number;
  showLegend?: boolean;
};

export const queryBrowserURL = (query: string, namespace: string) =>
  namespace
    ? `/dev-monitoring/ns/${namespace}/metrics?query0=${encodeURIComponent(query)}`
    : `/monitoring/query-browser?query0=${encodeURIComponent(query)}`;

export const SeverityHelp: React.FC = () => {
  const { t } = useTranslation('plugin__monitoring-plugin');

  return (
    <dl className="co-inline">
      <dt>
        <SeverityIcon severity={AlertSeverity.Critical} /> <strong>{t('Critical: ')}</strong>
      </dt>
      <dd>
        {t(
          'The condition that triggered the alert could have a critical impact. The alert requires immediate attention when fired and is typically paged to an individual or to a critical response team.',
        )}
      </dd>
      <dt>
        <SeverityIcon severity={AlertSeverity.Warning} /> <strong>{t('Warning: ')}</strong>
      </dt>
      <dd>
        {t(
          'The alert provides a warning notification about something that might require attention in order to prevent a problem from occurring. Warnings are typically routed to a ticketing system for non-immediate review.',
        )}
      </dd>
      <dt>
        <SeverityIcon severity={AlertSeverity.Info} /> <strong>{t('Info: ')}</strong>
      </dt>
      <dd>{t('The alert is provided for informational purposes only.')}</dd>
      <dt>
        <SeverityIcon severity={AlertSeverity.None} /> <strong>{t('None: ')}</strong>
      </dt>
      <dd>{t('The alert has no defined severity.')}</dd>
      <dd>{t('You can also create custom severity definitions for user workload alerts.')}</dd>
    </dl>
  );
};

export const SourceHelp: React.FC = () => {
  const { t } = useTranslation('plugin__monitoring-plugin');

  return (
    <dl className="co-inline">
      <dt>
        <strong>{t('Platform: ')}</strong>
      </dt>
      <dd>
        {t(
          'Platform-level alerts relate only to OpenShift namespaces. OpenShift namespaces provide core OpenShift functionality.',
        )}
      </dd>
      <dt>
        <strong>{t('User: ')}</strong>
      </dt>
      <dd>
        {t(
          'User workload alerts relate to user-defined namespaces. These alerts are user-created and are customizable. User workload monitoring can be enabled post-installation to provide observability into your own services.',
        )}
      </dd>
    </dl>
  );
};

export const getSourceKey = (source, t: TFunction) => {
  switch (source) {
    case 'Platform':
      return t('Platform');
    case 'User':
      return t('User');
    default:
      return source;
  }
};

export const tableSilenceClasses = [
  'pf-c-table__action', // Checkbox
  'pf-u-w-50 pf-u-w-33-on-sm', // Name
  'pf-m-hidden pf-m-visible-on-sm', // Firing alerts
  '', // State
  'pf-m-hidden pf-m-visible-on-sm', // Creator
  'dropdown-kebab-pf pf-c-table__action',
];

export const SilenceTableRow: React.FC<SilenceTableRowProps> = ({ obj, showCheckbox }) => {
  const { t } = useTranslation('plugin__monitoring-plugin');

  const { createdBy, endsAt, firingAlerts, id, name, startsAt } = obj;
  const state = silenceState(obj);

  const { selectedSilences, setSelectedSilences } = React.useContext(SelectedSilencesContext);

  const onCheckboxChange = React.useCallback(
    (isChecked: boolean) => {
      setSelectedSilences((oldSet) => {
        const newSet = new Set(oldSet);
        if (isChecked) {
          newSet.add(id);
        } else {
          newSet.delete(id);
        }
        return newSet;
      });
    },
    [id, setSelectedSilences],
  );

  return (
    <>
      {showCheckbox && (
        <td className={tableSilenceClasses[0]}>
          <Checkbox
            id={id}
            isChecked={selectedSilences.has(id)}
            isDisabled={state === SilenceStates.Expired}
            onChange={onCheckboxChange}
          />
        </td>
      )}
      <td className={tableSilenceClasses[1]}>
        <div className="co-resource-item">
          <MonitoringResourceIcon resource={SilenceResource} />
          <Link
            className="co-resource-item__resource-name"
            data-test-id="silence-resource-link"
            title={id}
            to={`${SilenceResource.plural}/${id}`}
          >
            {name}
          </Link>
        </div>
        <div className="monitoring-label-list">
          <SilenceMatchersList silence={obj} />
        </div>
      </td>
      <td className={tableSilenceClasses[2]}>
        <SeverityCounts alerts={firingAlerts} />
      </td>
      <td className={classNames(tableSilenceClasses[3], 'co-break-word')}>
        <SilenceState silence={obj} />
        {state === SilenceStates.Pending && (
          <StateTimestamp text={t('Starts')} timestamp={startsAt} />
        )}
        {state === SilenceStates.Active && <StateTimestamp text={t('Ends')} timestamp={endsAt} />}
        {state === SilenceStates.Expired && (
          <StateTimestamp text={t('Expired')} timestamp={endsAt} />
        )}
      </td>
      <td className={tableSilenceClasses[4]}>{createdBy || '-'}</td>
      <td className={tableSilenceClasses[5]}>
        <SilenceDropdownKebab silence={obj} />
      </td>
    </>
  );
};

type SilenceTableRowProps = {
  obj: Silence;
  showCheckbox?: boolean;
};

export const SelectedSilencesContext = React.createContext({
  selectedSilences: new Set(),
  setSelectedSilences: undefined,
});

export const SilenceMatchersList = ({ silence }) => (
  <div className={`co-text-${SilenceResource.kind.toLowerCase()}`}>
    {_.map(silence.matchers, ({ name, isEqual, isRegex, value }, i) => (
      <Label className="co-label" key={i}>
        <span className="co-label__key">{name}</span>
        <span className="co-label__eq">{silenceMatcherEqualitySymbol(isEqual, isRegex)}</span>
        <span className="co-label__value">{value}</span>
      </Label>
    ))}
  </div>
);

export const SeverityCounts: React.FC<{ alerts: Alert[] }> = ({ alerts }) => {
  if (_.isEmpty(alerts)) {
    return <>-</>;
  }

  const counts = _.countBy(alerts, (a) => {
    const { severity } = a.labels;
    return severity === AlertSeverity.Critical || severity === AlertSeverity.Warning
      ? severity
      : AlertSeverity.Info;
  });

  const severities = [AlertSeverity.Critical, AlertSeverity.Warning, AlertSeverity.Info].filter(
    (s) => counts[s] > 0,
  );

  return (
    <>
      {severities.map((s) => (
        <span className="monitoring-icon-wrap" key={s}>
          <SeverityIcon severity={s} /> {counts[s]}
        </span>
      ))}
    </>
  );
};

export const SilenceState = ({ silence }) => {
  const { t } = useTranslation('plugin__monitoring-plugin');

  const state = silenceState(silence);
  const icon = {
    [SilenceStates.Active]: <GreenCheckCircleIcon />,
    [SilenceStates.Pending]: <HourglassHalfIcon className="monitoring-state-icon--pending" />,
    [SilenceStates.Expired]: <BanIcon className="text-muted" data-test-id="ban-icon" />,
  }[state];

  const getStateKey = (stateData) => {
    switch (stateData) {
      case SilenceStates.Active:
        return t('Active');
      case SilenceStates.Pending:
        return t('Pending');
      default:
        return t('Expired');
    }
  };

  return icon ? (
    <>
      {icon} {getStateKey(state)}
    </>
  ) : null;
};

const SilenceDropdownKebab: React.FC<{ silence: Silence }> = ({ silence }) => (
  <SilenceDropdown isPlain silence={silence} Toggle={KebabToggle} />
);

const SilenceDropdown_: React.FC<SilenceDropdownProps> = ({
  className,
  history,
  isPlain,
  silence,
  Toggle,
}) => {
  const { t } = useTranslation('plugin__monitoring-plugin');

  const [isOpen, setIsOpen, , setClosed] = useBoolean(false);
  const [isModalOpen, , setModalOpen, setModalClosed] = useBoolean(false);

  const editSilence = () => {
    history.push(`${SilenceResource.plural}/${silence.id}/edit`);
  };

  const dropdownItems =
    silenceState(silence) === SilenceStates.Expired
      ? [
          <DropdownItem key="edit-silence" component="button" onClick={editSilence}>
            {t('Recreate silence')}
          </DropdownItem>,
        ]
      : [
          <DropdownItem key="edit-silence" component="button" onClick={editSilence}>
            {t('Edit silence')}
          </DropdownItem>,
          <DropdownItem key="cancel-silence" component="button" onClick={setModalOpen}>
            {t('Expire silence')}
          </DropdownItem>,
        ];

  return (
    <>
      <Dropdown
        className={className}
        data-test="silence-actions"
        dropdownItems={dropdownItems}
        isOpen={isOpen}
        isPlain={isPlain}
        onSelect={setClosed}
        position={DropdownPosition.right}
        toggle={<Toggle onToggle={setIsOpen} />}
      />
      <ExpireSilenceModal isOpen={isModalOpen} setClosed={setModalClosed} silenceID={silence.id} />
    </>
  );
};
export const SilenceDropdown = withRouter(SilenceDropdown_);

const ExpireSilenceModal: React.FC<ExpireSilenceModalProps> = ({
  isOpen,
  setClosed,
  silenceID,
}) => {
  const { t } = useTranslation('plugin__monitoring-plugin');
  const { perspective } = usePerspective();

  const dispatch = useDispatch();

  const [isInProgress, , setInProgress, setNotInProgress] = useBoolean(false);
  const [errorMessage, setErrorMessage] = React.useState();

  const expireSilence = () => {
    setInProgress();
    consoleFetchJSON
      .delete(`${window.SERVER_FLAGS.alertManagerBaseURL}/api/v2/silence/${silenceID}`)
      .then(() => {
        refreshSilences(dispatch, perspective);
        setClosed();
      })
      .catch((err) => {
        setErrorMessage(_.get(err, 'json.error') || err.message || 'Error expiring silence');
        setNotInProgress();
      })
      .then(setNotInProgress);
  };

  return (
    <Modal
      isOpen={isOpen}
      position="top"
      showClose={false}
      title={t('Expire silence')}
      variant={ModalVariant.small}
    >
      <Flex direction={{ default: 'column' }}>
        <FlexItem>{t('Are you sure you want to expire this silence?')}</FlexItem>
        <Flex direction={{ default: 'column' }}>
          <FlexItem>
            {errorMessage && (
              <PFAlert
                className="co-alert co-alert--scrollable"
                isInline
                title={t('An error occurred')}
                variant="danger"
              >
                <div className="co-pre-line">{errorMessage}</div>
              </PFAlert>
            )}
          </FlexItem>
          <Flex>
            <FlexItem>{isInProgress && <LoadingInline />}</FlexItem>
            <FlexItem align={{ default: 'alignRight' }}>
              <Button variant="secondary" onClick={setClosed}>
                {t('Cancel')}
              </Button>
            </FlexItem>
            <FlexItem>
              <Button variant="primary" onClick={expireSilence}>
                {t('Expire silence')}
              </Button>
            </FlexItem>
          </Flex>
        </Flex>
      </Flex>
    </Modal>
  );
};

type SilenceDropdownProps = RouteComponentProps & {
  className?: string;
  isPlain?: boolean;
  silence: Silence;
  Toggle: React.FC<{ onToggle: OnToggle }>;
};

export type OnToggle = (value: boolean, e: MouseEvent) => void;

type ExpireSilenceModalProps = {
  isOpen: boolean;
  setClosed: () => void;
  silenceID: string;
};
