import {
  AlertingRuleChartExtension,
  DocumentTitle,
  isAlertingRuleChart,
  ResourceIcon,
  useResolvedExtensions,
} from '@openshift-console/dynamic-plugin-sdk';
import {
  Breadcrumb,
  BreadcrumbItem,
  CodeBlock,
  CodeBlockCode,
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
  Title,
  Toolbar,
  ToolbarContent,
  ToolbarGroup,
  ToolbarItem,
} from '@patternfly/react-core';
import * as _ from 'lodash-es';
import type { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';

import { ActiveAlerts, PrometheusTemplate } from '@/features/alerts/components/ActiveAlerts';
import { Graph, SeverityHelp, SourceHelp } from '@/features/alerts/components/AlertUtils';
import { Labels } from '@/shared/components/Labels';
import { SeverityBadge } from '@/shared/components/SeverityBadge';
import { ToggleGraph } from '@/shared/components/ToggleGraph';
import withFallback from '@/shared/console/console-shared/error/fallbacks/WithFallback';
import { StatusBox } from '@/shared/console/console-shared/src/components/status/StatusBox';
import { formatPrometheusDuration } from '@/shared/console/console-shared/src/datetime/prometheus';
import { ExternalLink } from '@/shared/console/utils/Link';
import { DataTestIDs } from '@/shared/constants/data-test';
import { MonitoringProvider } from '@/shared/contexts/MonitoringContext';
import { useAlerts } from '@/shared/hooks/useAlerts';
import { useMonitoringNamespace } from '@/shared/hooks/useMonitoringNamespace';
import {
  getAlertRulesUrl,
  getQueryBrowserUrl,
  usePerspective,
} from '@/shared/hooks/usePerspective';
import { alertingRuleSource, getSourceKey } from '@/shared/utils/alerts/alert-source';
import { startCase } from '@/shared/utils/strings';
import { RuleResource } from '@/shared/utils/utils';

const AlertRulesDetailsPage_: FC = () => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const params = useParams<{ id: string }>();
  const { namespace } = useMonitoringNamespace();

  const { rules, rulesAlertLoading } = useAlerts();

  const { perspective } = usePerspective();

  const rule = _.find(rules, { id: params.id });

  const sourceId = rule?.sourceId;

  // Load alert metrics chart from plugin
  const [resolvedAlertsChartExtensions] =
    useResolvedExtensions<AlertingRuleChartExtension>(isAlertingRuleChart);
  const alertChartExtensions = resolvedAlertsChartExtensions
    .filter((extension) => extension.properties.sourceId === sourceId)
    .map((extension) => extension.properties.chart);

  const AlertChart = alertChartExtensions[0];

  const formatSeriesTitle = (alertLabels) => {
    const nameLabel = alertLabels.__name__ ?? '';
    const otherLabels = _.omit(alertLabels, '__name__');
    return `${nameLabel}{${_.map(otherLabels, (v, k) => `${k}="${v}"`).join(',')}}`;
  };

  const runbookURL = rule?.annotations?.runbook_url;

  return (
    <>
      <DocumentTitle>
        {t('{{name}} details', { name: rule?.name || RuleResource.label })}
      </DocumentTitle>
      <StatusBox
        data={rule}
        label={RuleResource.label}
        loaded={rulesAlertLoading?.loaded}
        loadError={rulesAlertLoading?.loadError}
      >
        <PageGroup>
          <PageBreadcrumb hasBodyWrapper={false}>
            <Breadcrumb>
              <BreadcrumbItem>
                <Link
                  to={getAlertRulesUrl(perspective, namespace)}
                  data-test={DataTestIDs.Breadcrumb}
                >
                  {t('Alerting rules')}
                </Link>
              </BreadcrumbItem>
              <BreadcrumbItem isActive>{t('Alerting rule details')}</BreadcrumbItem>
            </Breadcrumb>
          </PageBreadcrumb>
          <PageSection hasBodyWrapper={false}>
            <Flex>
              <FlexItem
                alignSelf={{ default: 'alignSelfCenter' }}
                spacer={{ default: 'spacerNone' }}
                data-test={DataTestIDs.AlertingRuleResourceIcon}
              >
                <ResourceIcon kind={RuleResource.kind} />
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
          </PageSection>
          <Divider />
          <PageSection hasBodyWrapper={false}>
            <div>
              <Title headingLevel="h2">{t('Alerting rule details')}</Title>
            </div>
          </PageSection>
          <PageSection hasBodyWrapper={false}>
            <Grid sm={12} md={6} hasGutter>
              <GridItem>
                <DescriptionList>
                  <DescriptionListGroup>
                    <DescriptionListTerm>{t('Name')}</DescriptionListTerm>
                    <DescriptionListDescription>{rule?.name}</DescriptionListDescription>
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
                      <SeverityBadge severity={rule?.labels?.severity} />
                    </DescriptionListDescription>
                  </DescriptionListGroup>
                  {rule?.annotations?.description && (
                    <DescriptionListGroup>
                      <DescriptionListTerm>{t('Description')}</DescriptionListTerm>
                      <DescriptionListDescription>
                        <PrometheusTemplate text={rule.annotations.description} />
                      </DescriptionListDescription>
                    </DescriptionListGroup>
                  )}
                  {rule?.annotations?.summary && (
                    <DescriptionListGroup>
                      <DescriptionListTerm>{t('Summary')}</DescriptionListTerm>
                      <DescriptionListDescription>
                        <PrometheusTemplate text={rule.annotations.summary} />
                      </DescriptionListDescription>
                    </DescriptionListGroup>
                  )}
                  {rule?.annotations?.message && (
                    <DescriptionListGroup>
                      <DescriptionListTerm>{t('Message')}</DescriptionListTerm>
                      <DescriptionListDescription>
                        <PrometheusTemplate text={rule.annotations.message} />
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
                      {rule && getSourceKey(startCase(alertingRuleSource(rule)), t)}
                    </DescriptionListDescription>
                  </DescriptionListGroup>
                  {_.isInteger(rule?.duration) && (
                    <DescriptionListGroup>
                      <DescriptionListTerm>{t('For')}</DescriptionListTerm>
                      <DescriptionListDescription>
                        {rule.duration === 0 ? '-' : formatPrometheusDuration(rule.duration * 1000)}
                      </DescriptionListDescription>
                    </DescriptionListGroup>
                  )}
                  <DescriptionListGroup>
                    <DescriptionListTerm>{t('Expression')}</DescriptionListTerm>
                    <DescriptionListDescription data-test={DataTestIDs.Expression}>
                      {/* display a link only if its a metrics based alert */}
                      {(!sourceId || sourceId === 'prometheus') && perspective !== 'acm' ? (
                        <Link
                          to={getQueryBrowserUrl({
                            perspective: perspective,
                            query: rule?.query,
                            namespace,
                          })}
                        >
                          <CodeBlock>
                            <CodeBlockCode>{rule?.query}</CodeBlockCode>
                          </CodeBlock>
                        </Link>
                      ) : (
                        <CodeBlock>
                          <CodeBlockCode>{rule?.query}</CodeBlockCode>
                        </CodeBlock>
                      )}
                    </DescriptionListDescription>
                  </DescriptionListGroup>
                </DescriptionList>
              </GridItem>
              <GridItem span={12}>
                <DescriptionList>
                  <DescriptionListGroup>
                    <DescriptionListTerm>{t('Labels')}</DescriptionListTerm>
                    <DescriptionListDescription>
                      <Labels labels={rule?.labels} />
                    </DescriptionListDescription>
                  </DescriptionListGroup>
                </DescriptionList>
              </GridItem>
            </Grid>
          </PageSection>
          <Divider />
          <PageSection hasBodyWrapper={false}>
            <Toolbar>
              <ToolbarContent>
                <ToolbarItem variant="label">
                  <Title headingLevel="h2">{t('Active alerts')}</Title>
                </ToolbarItem>
                <ToolbarGroup align={{ default: 'alignEnd' }}>
                  <ToolbarItem>
                    <ToggleGraph />
                  </ToolbarItem>
                </ToolbarGroup>
              </ToolbarContent>
            </Toolbar>
            {!sourceId || sourceId === 'prometheus' ? (
              <Graph
                formatSeriesTitle={formatSeriesTitle}
                query={rule?.query}
                ruleDuration={rule?.duration}
                showLegend
              />
            ) : AlertChart ? (
              <AlertChart rule={rule} />
            ) : null}
            {_.isEmpty(rule?.alerts) ? (
              <div>{t('None found')}</div>
            ) : (
              <ActiveAlerts alerts={rule.alerts} ruleID={rule?.id} />
            )}
          </PageSection>
        </PageGroup>
      </StatusBox>
    </>
  );
};
const AlertRulesDetailsPageWithFallback = withFallback(AlertRulesDetailsPage_);

export const MpCmoAlertRulesDetailsPage = () => {
  return (
    <MonitoringProvider monitoringContext={{ plugin: 'monitoring-plugin', prometheus: 'cmo' }}>
      <AlertRulesDetailsPageWithFallback />
    </MonitoringProvider>
  );
};

export const McpAcmAlertRulesDetailsPage = () => {
  return (
    <MonitoringProvider
      monitoringContext={{ plugin: 'monitoring-console-plugin', prometheus: 'acm' }}
    >
      <AlertRulesDetailsPageWithFallback />
    </MonitoringProvider>
  );
};
