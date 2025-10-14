import {
  ActionServiceProvider,
  Alert,
  AlertingRuleChartExtension,
  AlertStates,
  isAlertingRuleChart,
  PrometheusLabels,
  ResourceIcon,
  ResourceLink,
  Rule,
  useResolvedExtensions,
} from '@openshift-console/dynamic-plugin-sdk';
import * as _ from 'lodash-es';
import type { FC, ReactNode } from 'react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { Link, useNavigate, useParams } from 'react-router-dom-v5-compat';
import { ExternalLink, LinkifyExternal } from '../console/utils/link';
import { getAllQueryArguments } from '../console/utils/router';
import {
  getAlertsUrl,
  getObserveState,
  getNewSilenceAlertUrl,
  getRuleUrl,
  usePerspective,
} from '../hooks/usePerspective';
import { AlertResource, alertState, RuleResource } from '../utils';
import { MonitoringProvider } from '../../contexts/MonitoringContext';

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
  Grid,
  GridItem,
  PageBreadcrumb,
  PageGroup,
  PageSection,
  Popover,
  Split,
  SplitItem,
  Title,
  Toolbar,
  ToolbarContent,
  ToolbarGroup,
  ToolbarItem,
} from '@patternfly/react-core';
import { Helmet } from 'react-helmet';
import { MonitoringState } from '../../store/store';
import withFallback from '../console/console-shared/error/fallbacks/withFallback';
import { StatusBox } from '../console/console-shared/src/components/status/StatusBox';
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
import { ToggleGraph } from '../MetricsPage';
import { SilencedByList } from './AlertDetail/SilencedByTable';
import {
  alertSource,
  AlertState,
  AlertStateDescription,
  AlertStateIcon,
  getSourceKey,
  Graph,
  isActionWithCallback,
  isActionWithHref,
  SeverityBadge,
  SeverityHelp,
  SourceHelp,
} from './AlertUtils';

import { DataTestIDs } from '../data-test';
import { useAlerts } from '../../hooks/useAlerts';
import { useMonitoring } from '../../hooks/useMonitoring';
import { useQueryNamespace } from '../hooks/useQueryNamespace';

const AlertsDetailsPage_: FC = () => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const params = useParams<{ ruleID: string }>();
  const navigate = useNavigate();
  const { plugin } = useMonitoring();

  const { perspective } = usePerspective();

  const { alerts, rulesAlertLoading, silences } = useAlerts();

  const { namespace } = useQueryNamespace();

  const hideGraphs = useSelector(
    (state: MonitoringState) => !!getObserveState(plugin, state).hideGraphs,
  );

  const ruleAlerts = _.filter(alerts, (a) => a.rule.id === params?.ruleID);
  const rule = ruleAlerts?.[0]?.rule;

  // Search for an alert that matches all of the labels in the URL parameters. We expect there to be
  // only one such alert that matches, so don't display any alert if multiple matches were found.
  const queryParams = getAllQueryArguments();
  const foundAlerts = _.filter(ruleAlerts, (a) => _.isMatch(a.labels, queryParams));
  const alert = foundAlerts.length === 1 ? foundAlerts[0] : undefined;

  const state = alertState(alert);

  const labelsMemoKey = JSON.stringify(alert?.labels);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const labels: PrometheusLabels = useMemo(() => alert?.labels, [labelsMemoKey]);

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

  // Keep the default name for the admin perspective while providing specific
  // entrypoints for all other perspectives as wel
  const alertActionContextName = `alert-detail-toolbar-actions${
    perspective === 'admin' ? '' : '-' + perspective
  }`;
  const alertActionContext = {};
  alertActionContext[alertActionContextName] = { alert };

  return (
    <>
      <Helmet>
        <title>{t('{{name}} details', { name: labels?.alertname || AlertResource.label })}</title>
      </Helmet>
      <StatusBox
        data={alert}
        label={AlertResource.label}
        loaded={rulesAlertLoading?.loaded}
        loadError={rulesAlertLoading?.loadError}
      >
        <PageGroup>
          <PageBreadcrumb hasBodyWrapper={false}>
            <Breadcrumb>
              <BreadcrumbItem>
                <Link to={getAlertsUrl(perspective)} data-test={DataTestIDs.Breadcrumb}>
                  {t('Alerts')}
                </Link>
              </BreadcrumbItem>
              <BreadcrumbItem isActive>{t('Alert details')}</BreadcrumbItem>
            </Breadcrumb>
          </PageBreadcrumb>
          <PageSection hasBodyWrapper={false}>
            <Split hasGutter>
              <SplitItem>
                <Flex>
                  <FlexItem
                    alignSelf={{ default: 'alignSelfCenter' }}
                    spacer={{ default: 'spacerNone' }}
                    data-test={DataTestIDs.AlertResourceIcon}
                  >
                    <ResourceIcon kind={AlertResource.kind} />
                  </FlexItem>
                  <FlexItem>
                    <Title headingLevel="h1">{rule?.name}</Title>
                  </FlexItem>
                  <FlexItem
                    alignSelf={{ default: 'alignSelfCenter' }}
                    data-test={DataTestIDs.SeverityBadgeHeader}
                  >
                    <SeverityBadge severity={rule?.labels?.severity} />
                  </FlexItem>
                </Flex>
                <HeaderAlertMessage alert={alert} rule={rule} />
              </SplitItem>
              <SplitItem isFilled />
              {state !== AlertStates.Silenced && (
                <SplitItem>
                  <Button
                    onClick={() => navigate(getNewSilenceAlertUrl(perspective, alert))}
                    variant="primary"
                    data-test={DataTestIDs.SilenceButton}
                  >
                    {t('Silence alert')}
                  </Button>
                </SplitItem>
              )}
            </Split>
          </PageSection>
          <Divider />
          <PageSection hasBodyWrapper={false}>
            <Toolbar>
              <ToolbarContent>
                <ToolbarItem variant="label">
                  <Title headingLevel="h2">{t('Alert details')}</Title>
                </ToolbarItem>
                <ToolbarGroup align={{ default: 'alignEnd' }}>
                  <ActionServiceProvider context={alertActionContext}>
                    {({ actions, loaded }) =>
                      loaded
                        ? actions.map((action) => {
                            if (isActionWithHref(action)) {
                              return (
                                <ToolbarItem key={action.id} gap={{ default: 'gapNone' }}>
                                  <Link to={action.cta.href}>{action.label}</Link>
                                </ToolbarItem>
                              );
                            } else if (isActionWithCallback(action)) {
                              return (
                                <ToolbarItem key={action.id} gap={{ default: 'gapNone' }}>
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
            <Grid sm={12} md={6} hasGutter>
              <GridItem span={12}>
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
              </GridItem>
              <GridItem>
                <DescriptionList>
                  <DescriptionListGroup>
                    <DescriptionListTerm>{t('Name')}</DescriptionListTerm>
                    <DescriptionListDescription> {labels?.alertname} </DescriptionListDescription>
                  </DescriptionListGroup>
                  <DescriptionListGroup>
                    <DescriptionListTermHelpText>
                      <Popover
                        headerContent={<div>{t('Severity')}</div>}
                        bodyContent={<SeverityHelp />}
                      >
                        <DescriptionListTermHelpTextButton>
                          {t('Severity')}
                        </DescriptionListTermHelpTextButton>
                      </Popover>
                    </DescriptionListTermHelpText>
                    <DescriptionListDescription data-test={DataTestIDs.SeverityBadge}>
                      <SeverityBadge severity={labels?.severity} />
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
              </GridItem>
              <GridItem>
                <DescriptionList>
                  <DescriptionListGroup>
                    <DescriptionListTermHelpText>
                      <Popover headerContent={t('Source')} bodyContent={<SourceHelp />}>
                        <DescriptionListTermHelpTextButton>
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
                      <Popover headerContent={t('State')} bodyContent={<AlertStateHelp />}>
                        <DescriptionListTermHelpTextButton>
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
              </GridItem>
              <GridItem span={12}>
                <DescriptionList>
                  <DescriptionListGroup>
                    <DescriptionListTerm>{t('Labels')}</DescriptionListTerm>
                    <DescriptionListDescription>
                      <Labels labels={labels} />
                    </DescriptionListDescription>
                  </DescriptionListGroup>
                </DescriptionList>
              </GridItem>
              <GridItem span={12}>
                <DescriptionList>
                  <DescriptionListGroup>
                    <DescriptionListTerm>{t('Alerting rule')}</DescriptionListTerm>
                    <DescriptionListDescription>
                      <Flex
                        spaceItems={{ default: 'spaceItemsNone' }}
                        flexWrap={{ default: 'nowrap' }}
                      >
                        <FlexItem data-test={DataTestIDs.AlertingRuleResourceIcon}>
                          <ResourceIcon kind={RuleResource.kind} />
                        </FlexItem>
                        <FlexItem>
                          <Link
                            to={getRuleUrl(perspective, rule)}
                            data-test={DataTestIDs.AlertingRuleResourceLink}
                          >
                            {_.get(rule, 'name')}
                          </Link>
                        </FlexItem>
                      </Flex>
                    </DescriptionListDescription>
                  </DescriptionListGroup>
                </DescriptionList>
              </GridItem>
            </Grid>
          </PageSection>
          {silences?.loaded && !_.isEmpty(alert?.silencedBy) && (
            <>
              <Divider />
              <PageSection hasBodyWrapper={false}>
                <Title headingLevel="h2">{t('Silenced by')}</Title>
                <SilencedByList silences={alert?.silencedBy} />
              </PageSection>
            </>
          )}
        </PageGroup>
      </StatusBox>
    </>
  );
};
const AlertsDetailsPageWithFallback = withFallback(AlertsDetailsPage_);

export const MpCmoAlertsDetailsPage = () => {
  return (
    <MonitoringProvider monitoringContext={{ plugin: 'monitoring-plugin', prometheus: 'cmo' }}>
      <AlertsDetailsPageWithFallback />
    </MonitoringProvider>
  );
};

export const McpAcmAlertsDetailsPage = () => {
  return (
    <MonitoringProvider
      monitoringContext={{ plugin: 'monitoring-console-plugin', prometheus: 'acm' }}
    >
      <AlertsDetailsPageWithFallback />
    </MonitoringProvider>
  );
};

const HeaderAlertMessage: FC<{ alert: Alert; rule: Rule }> = ({ alert, rule }) => {
  const annotation = alert.annotations.description ? 'description' : 'message';
  return (
    <AlertMessage
      alertText={alert.annotations[annotation]}
      labels={alert.labels}
      template={rule.annotations[annotation]}
    />
  );
};

const AlertMessage: FC<AlertMessageProps> = ({ alertText, labels, template }) => {
  if (_.isEmpty(alertText)) {
    return null;
  }

  let messageParts: ReactNode[] = [alertText];

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
            inline
            key={model.kind}
            kind={model.kind}
            name={labelValue}
            namespace={model.namespaced ? labels.namespace : undefined}
            className="pf-v6-u-mx-xs"
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

const AlertStateHelp: FC = () => {
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

type AlertMessageProps = {
  alertText: string;
  labels: PrometheusLabels;
  template: string;
};
