import {
  Action,
  Alert,
  AlertSeverity,
  PrometheusLabels,
  RowFilter,
  Rule,
} from '@openshift-console/dynamic-plugin-sdk';
import {
  Button,
  DescriptionList,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
  Alert as PFAlert,
  Popover,
  Tooltip,
} from '@patternfly/react-core';
import * as _ from 'lodash-es';
import type { FC, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { FormatSeriesTitle, QueryBrowser } from '@/shared/components/query-browser/QueryBrowser';
import { SeverityBadge } from '@/shared/components/SeverityBadge';
import { NamespaceModel } from '@/shared/console/models';
import { useMonitoringNamespace } from '@/shared/hooks/useMonitoringNamespace';
import { getQueryBrowserUrl, usePerspective } from '@/shared/hooks/usePerspective';

export const alertCluster = (alert: Alert): string => alert.labels?.cluster ?? '';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  query,
  ruleDuration,
}) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const { perspective } = usePerspective();
  const { namespace } = useMonitoringNamespace();

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
    />
  );
};

type GraphProps = {
  filterLabels?: PrometheusLabels;
  formatSeriesTitle?: FormatSeriesTitle;
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
  filter: (filter, alert: Rule) =>
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
