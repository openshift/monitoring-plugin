import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
  getAlertsUrl,
  getNewSilenceAlertUrl,
  getLegacyObserveState,
  getRuleUrl,
  usePerspective,
} from '../hooks/usePerspective';
import { Alerts } from '../types';
import { useSelector } from 'react-redux';
import * as _ from 'lodash-es';
import { getAllQueryArguments } from '../console/utils/router';
import { AlertResource, alertState, RuleResource } from '../utils';
import {
  Alert,
  AlertStates,
  ActionServiceProvider,
  PrometheusLabels,
  Rule,
  useResolvedExtensions,
  ResourceLink,
  Silence,
  TableColumn,
  VirtualizedTable,
  useActiveNamespace,
  AlertingRuleChartExtension,
  isAlertingRuleChart,
} from '@openshift-console/dynamic-plugin-sdk';
import { Link, RouteComponentProps, withRouter } from 'react-router-dom';
import { ExternalLink, LinkifyExternal } from '../console/utils/link';

import {
  Breadcrumb,
  BreadcrumbItem,
  Button,
  DescriptionList,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
  DescriptionListTermHelpText,
  DescriptionListTermHelpTextButton,
  Divider,
  Flex,
  FlexItem,
  PageBreadcrumb,
  PageGroup,
  PageSection,
  PageSectionVariants,
  Popover,
  Split,
  SplitItem,
  Title,
  Toolbar,
  ToolbarContent,
  ToolbarGroup,
  ToolbarItem,
} from '@patternfly/react-core';
import {
  alertSource,
  AlertState,
  AlertStateDescription,
  AlertStateIcon,
  getSourceKey,
  Graph,
  isActionWithCallback,
  isActionWithHref,
  MonitoringResourceIcon,
  Severity,
  SeverityBadge,
  SeverityHelp,
  SourceHelp,
} from './AlertUtils';
import { ToggleGraph } from '../metrics';
import {
  ContainerModel,
  DaemonSetModel,
  DeploymentModel,
  JobModel,
  NamespaceModel,
  NodeModel,
  PodModel,
  StatefulSetModel,
} from '../console/models';
import { Labels } from '../labels';
import { SilenceTableRow, tableSilenceClasses } from './SilencesUtils';
import { MonitoringState } from '../../reducers/observe';
import { StatusBox } from '../console/console-shared/src/components/status/StatusBox';
import withFallback from '../console/console-shared/error/fallbacks/withFallback';

const AlertsDetailsPage_: React.FC<AlertsDetailsPageProps> = ({ history, match }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  const { alertsKey, silencesKey, perspective } = usePerspective();

  const [namespace] = useActiveNamespace();

  const hideGraphs = useSelector(
    (state: MonitoringState) => !!getLegacyObserveState(perspective, state)?.get('hideGraphs'),
  );

  const alerts: Alerts = useSelector((state: MonitoringState) =>
    getLegacyObserveState(perspective, state)?.get(alertsKey),
  );

  const silencesLoaded = useSelector(
    (state: MonitoringState) => getLegacyObserveState(perspective, state)?.get(silencesKey)?.loaded,
  );

  const ruleAlerts = _.filter(alerts?.data, (a) => a.rule.id === match?.params?.ruleID);
  const rule = ruleAlerts?.[0]?.rule;

  // Search for an alert that matches all of the labels in the URL parameters. We expect there to be
  // only one such alert that matches, so don't display any alert if multiple matches were found.
  const queryParams = getAllQueryArguments();
  const foundAlerts = _.filter(ruleAlerts, (a) => _.isMatch(a.labels, queryParams));
  const alert = foundAlerts.length === 1 ? foundAlerts[0] : undefined;

  const state = alertState(alert);

  const labelsMemoKey = JSON.stringify(alert?.labels);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const labels: PrometheusLabels = React.useMemo(() => alert?.labels, [labelsMemoKey]);

  // eslint-disable-next-line camelcase
  const runbookURL = alert?.annotations?.runbook_url;

  const sourceId = rule?.sourceId;

  // Load alert metrics chart from plugin
  const [alertsChartExtensions] =
    useResolvedExtensions<AlertingRuleChartExtension>(isAlertingRuleChart);
  const alertsChart = alertsChartExtensions
    .filter((extension) => extension.properties.sourceId === sourceId)
    .map((extension) => extension.properties.chart);

  const AlertsChart = alertsChart?.[0];

  return (
    <>
      <StatusBox
        data={alert}
        label={AlertResource.label}
        loaded={alerts?.loaded}
        loadError={alerts?.loadError}
      >
        <PageGroup>
          <PageBreadcrumb>
            <Breadcrumb className="monitoring-breadcrumbs">
              <BreadcrumbItem>
                <Link
                  className="pf-v5-c-breadcrumb__link"
                  to={getAlertsUrl(perspective, namespace)}
                >
                  {t('Alerts')}
                </Link>
              </BreadcrumbItem>
              <BreadcrumbItem isActive>{t('Alert details')}</BreadcrumbItem>
            </Breadcrumb>
          </PageBreadcrumb>
          <PageSection variant={PageSectionVariants.light}>
            <Split>
              <SplitItem>
                <Title headingLevel="h1">
                  {/* Leave to keep compatibility with console looks */}
                  <MonitoringResourceIcon
                    className="co-m-resource-icon--lg"
                    resource={AlertResource}
                  />
                  {labels?.alertname}
                  <SeverityBadge severity={labels?.severity} />
                </Title>
              </SplitItem>
              <SplitItem isFilled />
              {state !== AlertStates.Silenced && (
                <SplitItem>
                  <Button
                    onClick={() =>
                      history.push(getNewSilenceAlertUrl(perspective, alert, namespace))
                    }
                    variant="primary"
                  >
                    {t('Silence alert')}
                  </Button>
                </SplitItem>
              )}
            </Split>
            <HeaderAlertMessage alert={alert} rule={rule} />
          </PageSection>
        </PageGroup>
        <Divider />
        <PageGroup>
          <PageSection variant={PageSectionVariants.light}>
            <Toolbar className="monitoring-alert-detail-toolbar">
              <ToolbarContent>
                <ToolbarItem variant="label">
                  <Title headingLevel="h2">{t('Alert details')}</Title>
                </ToolbarItem>
                <ToolbarGroup align={{ default: 'alignRight' }}>
                  <ActionServiceProvider context={{ 'alert-detail-toolbar-actions': { alert } }}>
                    {({ actions, loaded }) =>
                      loaded
                        ? actions.map((action) => {
                            if (isActionWithHref(action)) {
                              return (
                                <ToolbarItem
                                  key={action.id}
                                  spacer={{ default: 'spacerNone' }}
                                  className="pf-v5-u-px-md"
                                >
                                  <Link to={action.cta.href}>{action.label}</Link>
                                </ToolbarItem>
                              );
                            } else if (isActionWithCallback(action)) {
                              return (
                                <ToolbarItem key={action.id} spacer={{ default: 'spacerNone' }}>
                                  <Button variant="link" onClick={action.cta}>
                                    {action.label}
                                  </Button>
                                </ToolbarItem>
                              );
                            }

                            return null;
                          })
                        : null
                    }
                  </ActionServiceProvider>
                  <ToolbarItem>
                    <ToggleGraph />
                  </ToolbarItem>
                </ToolbarGroup>
              </ToolbarContent>
            </Toolbar>
            <div className="row">
              <div className="col-sm-12">
                {!sourceId || sourceId === 'prometheus' ? (
                  <Graph
                    filterLabels={labels}
                    namespace={namespace}
                    query={rule?.query}
                    ruleDuration={rule?.duration}
                  />
                ) : AlertsChart && !hideGraphs ? (
                  <AlertsChart rule={rule} />
                ) : null}
              </div>
            </div>
            <div className="row">
              <div className="col-sm-6">
                <DescriptionList>
                  <DescriptionListGroup>
                    <DescriptionListTerm>{t('Name')}</DescriptionListTerm>
                    <DescriptionListDescription>{labels?.alertname}</DescriptionListDescription>
                  </DescriptionListGroup>
                  <DescriptionListGroup>
                    <DescriptionListTermHelpText>
                      <Popover
                        headerContent={<div>{t('Severity')}</div>}
                        bodyContent={<SeverityHelp />}
                      >
                        <DescriptionListTermHelpTextButton>
                          {' '}
                          {t('Severity')}
                        </DescriptionListTermHelpTextButton>
                      </Popover>
                    </DescriptionListTermHelpText>
                    <DescriptionListDescription>
                      <Severity severity={labels?.severity} />
                    </DescriptionListDescription>
                  </DescriptionListGroup>
                  {alert?.annotations?.description && (
                    <DescriptionListGroup>
                      <DescriptionListTerm>{t('Description')}</DescriptionListTerm>
                      <DescriptionListDescription>
                        <AlertMessage
                          alertText={alert.annotations.description}
                          labels={labels}
                          template={rule?.annotations?.description}
                        />
                      </DescriptionListDescription>
                    </DescriptionListGroup>
                  )}
                  {alert?.annotations?.summary && (
                    <DescriptionListGroup>
                      <DescriptionListTerm>{t('Summary')}</DescriptionListTerm>
                      <DescriptionListDescription>
                        {alert.annotations.summary}
                      </DescriptionListDescription>
                    </DescriptionListGroup>
                  )}
                  {alert?.annotations?.message && (
                    <DescriptionListGroup>
                      <DescriptionListTerm>{t('Message')}</DescriptionListTerm>
                      <DescriptionListDescription>
                        <AlertMessage
                          alertText={alert.annotations.message}
                          labels={labels}
                          template={rule?.annotations?.message}
                        />
                      </DescriptionListDescription>
                    </DescriptionListGroup>
                  )}
                  {runbookURL && (
                    <DescriptionListGroup>
                      <DescriptionListTerm>{t('Runbook')}</DescriptionListTerm>
                      <DescriptionListDescription>
                        <ExternalLink href={runbookURL} text={runbookURL} />
                      </DescriptionListDescription>
                    </DescriptionListGroup>
                  )}
                </DescriptionList>
              </div>
              <div className="col-sm-6">
                <DescriptionList>
                  <DescriptionListGroup>
                    <DescriptionListTermHelpText>
                      <Popover
                        headerContent={<div>{t('Source')}</div>}
                        bodyContent={<SourceHelp />}
                      >
                        <DescriptionListTermHelpTextButton>
                          {' '}
                          {t('Source')}
                        </DescriptionListTermHelpTextButton>
                      </Popover>
                    </DescriptionListTermHelpText>
                    <DescriptionListDescription>
                      {alert && getSourceKey(_.startCase(alertSource(alert)), t)}
                    </DescriptionListDescription>
                  </DescriptionListGroup>
                  <DescriptionListGroup>
                    <DescriptionListTermHelpText>
                      <Popover
                        headerContent={<div>{t('State')}</div>}
                        bodyContent={<AlertStateHelp />}
                      >
                        <DescriptionListTermHelpTextButton>
                          {' '}
                          {t('State')}
                        </DescriptionListTermHelpTextButton>
                      </Popover>
                    </DescriptionListTermHelpText>
                    <DescriptionListDescription>
                      <AlertState state={state} />
                      <AlertStateDescription alert={alert} />
                    </DescriptionListDescription>
                  </DescriptionListGroup>
                </DescriptionList>
              </div>
            </div>
          </PageSection>
          <PageSection variant={PageSectionVariants.light}>
            <div className="row">
              <div className="col-xs-12">
                <DescriptionList>
                  <DescriptionListGroup>
                    <DescriptionListTerm>{t('Labels')}</DescriptionListTerm>
                    <DescriptionListDescription>
                      <Labels kind="alert" labels={labels} />
                    </DescriptionListDescription>
                  </DescriptionListGroup>
                </DescriptionList>
              </div>
            </div>
          </PageSection>
          <PageSection variant={PageSectionVariants.light}>
            <div className="row">
              <div className="col-xs-12">
                <DescriptionList>
                  <DescriptionListGroup>
                    <DescriptionListTerm>{t('Alerting rule')}</DescriptionListTerm>
                    <DescriptionListDescription>
                      <Flex
                        spaceItems={{ default: 'spaceItemsNone' }}
                        flexWrap={{ default: 'nowrap' }}
                      >
                        <FlexItem>
                          <MonitoringResourceIcon resource={RuleResource} />
                        </FlexItem>
                        <FlexItem>
                          <Link
                            to={getRuleUrl(perspective, rule, namespace)}
                            data-test="alert-rules-detail-resource-link"
                          >
                            {_.get(rule, 'name')}
                          </Link>
                        </FlexItem>
                      </Flex>
                    </DescriptionListDescription>
                  </DescriptionListGroup>
                </DescriptionList>
              </div>
            </div>
          </PageSection>
        </PageGroup>
        {silencesLoaded && !_.isEmpty(alert?.silencedBy) && (
          <>
            <Divider />
            <PageSection variant={PageSectionVariants.light}>
              <Title headingLevel="h2">{t('Silenced by')}</Title>
              <div className="row">
                <div className="col-xs-12">
                  <SilencedByList silences={alert?.silencedBy} />
                </div>
              </div>
            </PageSection>
          </>
        )}
      </StatusBox>
    </>
  );
};
const AlertsDetailsPage = withFallback(withRouter(AlertsDetailsPage_));

const HeaderAlertMessage: React.FC<{ alert: Alert; rule: Rule }> = ({ alert, rule }) => {
  const annotation = alert.annotations.description ? 'description' : 'message';
  return (
    <AlertMessage
      alertText={alert.annotations[annotation]}
      labels={alert.labels}
      template={rule.annotations[annotation]}
    />
  );
};

const AlertMessage: React.FC<AlertMessageProps> = ({ alertText, labels, template }) => {
  if (_.isEmpty(alertText)) {
    return null;
  }

  let messageParts: React.ReactNode[] = [alertText];

  // Go through each recognized resource type and replace any resource names that exist in alertText
  // with a link to the resource's details page
  _.each(alertMessageResources, (model, label) => {
    const labelValue = labels[label];

    if (labelValue && !(model.namespaced && _.isEmpty(labels.namespace))) {
      const tagCount = matchCount(template, `\\{\\{ *\\$labels\\.${label} *\\}\\}`);
      const resourceNameCount = matchCount(alertText, _.escapeRegExp(labelValue));

      // Don't do the replacement unless the counts match. This avoids overwriting the wrong string
      // if labelValue happens to appear elsewhere in alertText
      if (tagCount > 0 && tagCount === resourceNameCount) {
        const link = (
          <ResourceLink
            className="monitoring__resource-item--monitoring-alert"
            inline
            key={model.kind}
            kind={model.kind}
            name={labelValue}
            namespace={model.namespaced ? labels.namespace : undefined}
          />
        );
        messageParts = _.flatMap(messageParts, (part) => {
          if (_.isString(part) && part.indexOf(labelValue) !== -1) {
            // `part` contains at least one instance of the resource name, so replace each instance
            // with the link to the resource. Since the link is a component, we can't simply do a
            // string substitution. Instead, create an array that contains each of the string parts
            // and the resource links in the correct order.
            const splitParts = part.split(labelValue);
            return _.flatMap(splitParts, (p) => [p, link]).slice(0, -1);
          }
          return [part];
        });
      }
    }
  });

  return (
    <p>
      <LinkifyExternal>{messageParts}</LinkifyExternal>
    </p>
  );
};

const alertMessageResources: {
  [labelName: string]: { kind: string; namespaced?: boolean };
} = {
  container: ContainerModel,
  daemonset: DaemonSetModel,
  deployment: DeploymentModel,
  job: JobModel,
  namespace: NamespaceModel,
  node: NodeModel,
  pod: PodModel,
  statefulset: StatefulSetModel,
};

const matchCount = (haystack: string, regExpString: string) =>
  _.size(haystack.match(new RegExp(regExpString, 'g')));

const AlertStateHelp: React.FC = () => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  return (
    <DescriptionList isCompact>
      <DescriptionListGroup>
        <DescriptionListTerm>
          <AlertStateIcon state={AlertStates.Pending} /> <strong>{t('Pending: ')}</strong>
        </DescriptionListTerm>
        <DescriptionListDescription>
          {t(
            'The alert is active but is waiting for the duration that is specified in the alerting rule before it fires.',
          )}
        </DescriptionListDescription>
      </DescriptionListGroup>
      <DescriptionListGroup>
        <DescriptionListTerm>
          <AlertStateIcon state={AlertStates.Firing} /> <strong>{t('Firing: ')}</strong>
        </DescriptionListTerm>
        <DescriptionListDescription>
          {t(
            'The alert is firing because the alert condition is true and the optional `for` duration has passed. The alert will continue to fire as long as the condition remains true.',
          )}
        </DescriptionListDescription>
      </DescriptionListGroup>
      <DescriptionListGroup>
        <DescriptionListTerm>
          <AlertStateIcon state={AlertStates.Silenced} /> <strong>{t('Silenced: ')}</strong>
        </DescriptionListTerm>
        <DescriptionListDescription>
          {t(
            'The alert is now silenced for a defined time period. Silences temporarily mute alerts based on a set of label selectors that you define. Notifications will not be sent for alerts that match all the listed values or regular expressions.',
          )}
        </DescriptionListDescription>
      </DescriptionListGroup>
    </DescriptionList>
  );
};

const SilencedByList: React.FC<{ silences: Silence[] }> = ({ silences }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  const columns = React.useMemo<TableColumn<Silence>[]>(
    () => [
      {
        id: 'name',
        props: { className: tableSilenceClasses[1] },
        title: t('Name'),
      },
      {
        id: 'firingAlerts',
        props: { className: tableSilenceClasses[2] },
        title: t('Firing alerts'),
      },
      {
        id: 'state',
        props: { className: tableSilenceClasses[3] },
        title: t('State'),
      },
      {
        id: 'createdBy',
        props: { className: tableSilenceClasses[4] },
        title: t('Creator'),
      },
      {
        id: 'actions',
        props: { className: tableSilenceClasses[5] },
        title: '',
      },
    ],
    [t],
  );

  return (
    <VirtualizedTable<Silence>
      aria-label={t('Silenced by')}
      columns={columns}
      data={silences}
      loaded={true}
      loadError={undefined}
      Row={SilenceTableRow}
      unfilteredData={silences}
    />
  );
};

export default AlertsDetailsPage;

type AlertsDetailsPageProps = RouteComponentProps<{ ns?: string; ruleID: string }>;

type AlertMessageProps = {
  alertText: string;
  labels: PrometheusLabels;
  template: string;
};
