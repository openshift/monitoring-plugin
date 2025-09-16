import type { FC, ReactNode } from 'react';
import { memo } from 'react';
import {
  Action,
  Alert,
  AlertSeverity,
  AlertStates,
  PrometheusAlert,
  PrometheusLabels,
  PrometheusRule,
  RowFilter,
  Rule,
  RuleStates,
  Silence,
  SilenceStates,
  Timestamp,
} from '@openshift-console/dynamic-plugin-sdk';
import { AlertSource } from '../types';
import * as _ from 'lodash-es';
import { useTranslation } from 'react-i18next';
import {
  Alert as PFAlert,
  Popover,
  Button,
  DescriptionList,
  DescriptionListGroup,
  DescriptionListTerm,
  DescriptionListDescription,
  Label,
  Tooltip,
} from '@patternfly/react-core';
import {
  BellIcon,
  BellSlashIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  InfoCircleIcon,
  OutlinedBellIcon,
  SeverityUndefinedIcon,
} from '@patternfly/react-icons';
import { FormatSeriesTitle, QueryBrowser } from '../query-browser';
import { Link } from 'react-router-dom-v5-compat';
import { TFunction } from 'i18next';
import { getQueryBrowserUrl, usePerspective } from '../hooks/usePerspective';
import { NamespaceModel } from '../console/models';
import {
  t_global_border_color_status_info_default,
  t_global_color_status_danger_default,
  t_global_color_status_info_default,
  t_global_color_status_warning_default,
  t_global_icon_color_disabled,
  t_global_icon_color_severity_undefined_default,
  t_global_text_color_disabled,
  t_global_text_color_subtle,
} from '@patternfly/react-tokens';
import { ALL_NAMESPACES_KEY } from '../utils';

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
export const alertCluster = (alert: Alert): string => alert.labels?.cluster ?? '';

export const SilencesNotLoadedWarning: FC<{ silencesLoadError: any }> = ({ silencesLoadError }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  return (
    <PFAlert
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

type ActionWithCallBack = Omit<Action, 'cta'> & { cta: () => void };
export const isActionWithCallback = (action: Action): action is ActionWithCallBack =>
  typeof action.cta === 'function';

const getSeverityKey = (severity: string, t) => {
  switch (severity) {
    case AlertSeverity.Critical:
      return t('Critical');
    case AlertSeverity.Info:
      return t('Info');
    case AlertSeverity.Warning:
      return t('Warning');
    case AlertSeverity.None:
      return t('None');
    default:
      return severity;
  }
};

export const SeverityIcon: FC<{ severity: string }> = memo(({ severity }) => {
  switch (severity) {
    case AlertSeverity.Critical:
      return <ExclamationCircleIcon color={t_global_color_status_danger_default.var} />;
    case AlertSeverity.Warning:
      return <ExclamationTriangleIcon color={t_global_color_status_warning_default.var} />;
    case AlertSeverity.Info:
      return <InfoCircleIcon color={t_global_color_status_info_default.var} />;
    case AlertSeverity.None:
      return <SeverityUndefinedIcon color={t_global_icon_color_severity_undefined_default.var} />;
    default:
      return <BellIcon color={t_global_border_color_status_info_default.var} />;
  }
});

export const AlertState: FC<AlertStateProps> = memo(({ state }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  const icon = <AlertStateIcon state={state} />;

  return icon ? (
    <span
      style={{
        color: state === AlertStates.Silenced ? t_global_text_color_disabled.var : undefined,
      }}
    >
      {icon} {getAlertStateKey(state, t)}
    </span>
  ) : null;
});

type AlertStateProps = {
  state: AlertStates;
};

export const AlertStateIcon: FC<{ state: string }> = memo(({ state }) => {
  switch (state) {
    case AlertStates.Firing:
      return <BellIcon />;
    case AlertStates.Pending:
      return <OutlinedBellIcon />;
    case AlertStates.Silenced:
      return <BellSlashIcon color={t_global_icon_color_disabled.var} />;
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

export const AlertStateDescription: FC<{ alert: Alert }> = ({ alert }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  if (alert && !_.isEmpty(alert.silencedBy)) {
    return <StateTimestamp text={t('Ends')} timestamp={_.max(_.map(alert.silencedBy, 'endsAt'))} />;
  }
  if (alert && alert.activeAt) {
    return <StateTimestamp text={t('Since')} timestamp={alert.activeAt} />;
  }
  return null;
};

export const StateTimestamp = ({ text, timestamp }) => (
  <div style={{ color: t_global_text_color_subtle.var }}>
    {text}&nbsp;
    <Timestamp timestamp={timestamp} className="pf-v6-u-display-inline" />
  </div>
);

export const SeverityBadge: FC<{ severity: string; count?: number }> = memo(
  ({ severity, count }) => {
    const { t } = useTranslation(process.env.I18N_NAMESPACE);

    if (_.isNil(severity)) return null;

    const labelText = count ? count : getSeverityKey(severity, t);
    switch (severity) {
      case AlertSeverity.Critical:
        return <Label status="danger">{labelText}</Label>;
      case AlertSeverity.Warning:
        return <Label status="warning">{labelText}</Label>;
      case AlertSeverity.Info:
        return <Label status="info">{labelText}</Label>;
      case AlertSeverity.None:
        return (
          <Label variant="outline">
            <SeverityUndefinedIcon color={t_global_icon_color_severity_undefined_default.var} />
            &nbsp;
            {labelText}
          </Label>
        );
      default:
        return <Label status="custom">{labelText}</Label>;
    }
  },
);

export const PopoverField: FC<{ bodyContent: ReactNode; label: string }> = ({
  bodyContent,
  label,
}) => (
  <Popover headerContent={label} bodyContent={bodyContent}>
    <Button icon={label} variant="plain" />
  </Popover>
);

export const Graph: FC<GraphProps> = ({
  filterLabels = undefined,
  formatSeriesTitle,
  namespace,
  query,
  ruleDuration,
}) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const { perspective } = usePerspective();

  // 3 times the rule's duration, but not less than 30 minutes
  const timespan = Math.max(3 * ruleDuration, 30 * 60) * 1000;

  const GraphLink = () =>
    query && perspective !== 'acm' ? (
      <Link aria-label={t('Inspect')} to={getQueryBrowserUrl({ perspective, query, namespace })}>
        {t('Inspect')}
      </Link>
    ) : null;

  return (
    <QueryBrowser
      defaultTimespan={timespan}
      filterLabels={filterLabels}
      formatSeriesTitle={formatSeriesTitle}
      GraphLink={GraphLink}
      pollInterval={Math.round(timespan / 120)}
      queries={[query]}
      useTenancy={namespace !== ALL_NAMESPACES_KEY}
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

export const SeverityHelp: FC = () => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  return (
    <DescriptionList isCompact>
      <DescriptionListGroup>
        <DescriptionListTerm>
          <SeverityBadge severity={AlertSeverity.Critical} />
        </DescriptionListTerm>
        <DescriptionListDescription>
          {t(
            'The condition that triggered the alert could have a critical impact. The alert requires immediate attention when fired and is typically paged to an individual or to a critical response team.',
          )}
        </DescriptionListDescription>
      </DescriptionListGroup>
      <DescriptionListGroup>
        <DescriptionListTerm>
          <SeverityBadge severity={AlertSeverity.Warning} />
        </DescriptionListTerm>
        <DescriptionListDescription>
          {t(
            'The alert provides a warning notification about something that might require attention in order to prevent a problem from occurring. Warnings are typically routed to a ticketing system for non-immediate review.',
          )}
        </DescriptionListDescription>
      </DescriptionListGroup>
      <DescriptionListGroup>
        <DescriptionListTerm>
          <SeverityBadge severity={AlertSeverity.Info} />
        </DescriptionListTerm>
        <DescriptionListDescription>
          {t('The alert is provided for informational purposes only.')}
        </DescriptionListDescription>
      </DescriptionListGroup>
      <DescriptionListGroup>
        <DescriptionListTerm>
          <SeverityBadge severity={AlertSeverity.None} />
        </DescriptionListTerm>
        <DescriptionListDescription>
          {t('The alert has no defined severity.')}
        </DescriptionListDescription>
      </DescriptionListGroup>
      <DescriptionListGroup>
        <DescriptionListTerm>
          <SeverityBadge severity="Custom" />
        </DescriptionListTerm>
        <DescriptionListDescription>
          {t('You can also create custom severity definitions for user workload alerts.')}
        </DescriptionListDescription>
      </DescriptionListGroup>
    </DescriptionList>
  );
};

export const SourceHelp: FC = () => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  return (
    <DescriptionList isCompact>
      <DescriptionListGroup>
        <DescriptionListTerm>
          <strong>{t('Platform: ')}</strong>
        </DescriptionListTerm>
        <DescriptionListDescription>
          {t(
            'Platform-level alerts relate only to OpenShift namespaces. OpenShift namespaces provide core OpenShift functionality.',
          )}
        </DescriptionListDescription>
      </DescriptionListGroup>
      <DescriptionListGroup>
        <DescriptionListTerm>
          <strong>{t('User: ')}</strong>
        </DescriptionListTerm>
        <DescriptionListDescription>
          {t(
            'User workload alerts relate to user-defined namespaces. These alerts are user-created and are customizable. User workload monitoring can be enabled post-installation to provide observability into your own services.',
          )}
        </DescriptionListDescription>
      </DescriptionListGroup>
    </DescriptionList>
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

export const SeverityCounts: FC<{ alerts: Alert[] }> = ({ alerts }) => {
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
        <Tooltip
          key={s}
          content={`${counts[s]} ${s ? s[0].toUpperCase() + s.slice(1) : 'Unknown'} Alerts`}
        >
          <SeverityBadge severity={s} count={counts[s]} />
        </Tooltip>
      ))}
    </>
  );
};
export type OnToggle = (value: boolean, e: MouseEvent) => void;

export const severityRowFilter = (t): RowFilter => ({
  filter: (filter, alert: Alert) =>
    filter.selected?.includes(alert.labels?.severity) || _.isEmpty(filter.selected),
  filterGroupName: t('Severity'),
  items: [
    { id: AlertSeverity.Critical, title: t('Critical') },
    { id: AlertSeverity.Warning, title: t('Warning') },
    { id: AlertSeverity.Info, title: t('Info') },
    { id: AlertSeverity.None, title: t('None') },
  ],
  reducer: ({ labels }: Alert | Rule) => labels?.severity,
  type: 'alert-severity',
});

export const NamespaceGroupVersionKind = {
  group: 'core',
  kind: NamespaceModel.kind,
  version: null,
};

// This function looks to take a alerts and rules and then apply a set of silences to them
// This function mutates the arrays in place and then returns them
export const applySilences = ({
  alerts,
  silences,
  rules,
}: {
  silences: Array<Silence>;
  alerts: Array<Alert>;
  rules: Array<Rule>;
}): { silences: Array<Silence>; alerts: Array<Alert>; rules: Array<Rule> } => {
  // We only need to check alerts that are either firing or silenced for if they are still silenced
  const firingAlerts = alerts.filter(isAlertFiring);
  applySilencesToAlerts({ firingAlerts, silences });

  // Only check rules that are firing, silenced or pending to see if they are still silenced
  const firingRules = rules.filter(isRuleFiring);
  applySilencesToRules({ firingRules, silences });

  // Add each alert that is being effected by a silence to the firingAlerts list on the silence
  const appliedSilences = silences.map((silence) => {
    silence.firingAlerts = firingAlerts.filter((firingAlert) =>
      isAlertSilenced(firingAlert, silence),
    );
    return silence;
  });
  return { alerts, silences: appliedSilences, rules };
};

// This fucntion mutates the firingAlerts parameter in place to set silence fields on each alert
const applySilencesToAlerts = ({
  firingAlerts,
  silences,
}: {
  silences: Array<Silence>;
  firingAlerts: Array<Alert>;
}) => {
  // For each firing alert, store a list of the Silences that are silencing it
  // and set its state to show it is silenced
  firingAlerts.forEach((firingAlert) => {
    firingAlert.silencedBy = silences.filter(
      (silence) =>
        silence.status?.state === SilenceStates.Active && isAlertSilenced(firingAlert, silence),
    );

    if (firingAlert.silencedBy.length) {
      firingAlert.state = AlertStates.Silenced;
      // Also set the state of Alerts in `rule.alerts`

      firingAlert.rule.alerts.forEach((ruleAlert) => {
        if (firingAlert.silencedBy?.some((silence) => isAlertSilenced(ruleAlert, silence))) {
          ruleAlert.state = AlertStates.Silenced;
        }
      });

      if (
        firingAlert.rule.alerts.length !== 0 &&
        firingAlert.rule.alerts.every((alert) => alert.state === AlertStates.Silenced)
      ) {
        firingAlert.rule.state = RuleStates.Silenced;

        firingAlert.rule.silencedBy = silences.filter(
          (silence) =>
            silence.status?.state === SilenceStates.Active &&
            firingAlert.rule.alerts.some((alert) => isAlertSilenced(alert, silence)),
        );
      }
    }
  });

  return firingAlerts;
};

// This fucntion mutates the firingRules parameter in place to set silence fields on each rule
const applySilencesToRules = ({
  firingRules,
  silences,
}: {
  silences: Array<Silence>;
  firingRules: Array<Rule>;
}) => {
  // For each firing alert, store a list of the Silences that are silencing it
  // and set its state to show it is silenced
  firingRules.forEach((firingRule) => {
    firingRule.silencedBy = silences.filter(
      (silence) =>
        silence.status?.state === SilenceStates.Active && isRuleSilenced(firingRule, silence),
    );

    if (firingRule.silencedBy.length) {
      firingRule.state = RuleStates.Silenced;

      firingRule.alerts.forEach((ruleAlert) => {
        if (firingRule.silencedBy?.some((silence) => isAlertSilenced(ruleAlert, silence))) {
          ruleAlert.state = AlertStates.Silenced;
        }
      });

      if (
        firingRule.alerts.length !== 0 &&
        firingRule.alerts.every((alert) => alert.state === AlertStates.Silenced)
      ) {
        firingRule.state = RuleStates.Silenced;

        firingRule.silencedBy = silences.filter(
          (silence) =>
            silence.status?.state === SilenceStates.Active &&
            firingRule.alerts.some((alert) => isAlertSilenced(alert, silence)),
        );
      }
    }
  });

  return firingRules;
};

const isAlertFiring = (alert: PrometheusAlert) =>
  alert?.state === AlertStates.Firing || alert?.state === AlertStates.Silenced;

const isRuleFiring = (rule: PrometheusRule) =>
  rule?.state === RuleStates.Firing ||
  rule?.state === RuleStates.Silenced ||
  rule?.state === RuleStates.Pending;

// Determine if an Alert is silenced by a Silence (if all of the Silence's matchers match one of the
// Alert's labels)
const isAlertSilenced = (alert: PrometheusAlert, silence: Silence): boolean => {
  return (
    isAlertFiring(alert) &&
    silence.matchers.every((matcher) => {
      const alertValue = alert.labels[matcher.name] ?? '';
      const isMatch = matcher.isRegex
        ? new RegExp(`^${matcher.value}$`).test(alertValue)
        : alertValue === matcher.value;
      return matcher.isEqual === false && alertValue ? !isMatch : isMatch;
    })
  );
};

// Determine if an Rule is silenced by a Silence (if all alerts for a rule are silenced)
export const isRuleSilenced = (rule: PrometheusRule, silence: Silence): boolean => {
  return isRuleFiring(rule) && rule.alerts.every((alert) => isAlertSilenced(alert, silence));
};
