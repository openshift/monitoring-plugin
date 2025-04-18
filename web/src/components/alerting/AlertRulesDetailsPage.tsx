import {
  AlertingRuleChartExtension,
  AlertStates,
  isAlertingRuleChart,
  PrometheusAlert,
  ResourceIcon,
  Rule,
  Timestamp,
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
  DropdownItem,
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
import * as React from 'react';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { Link, RouteComponentProps, withRouter } from 'react-router-dom';

import { ExternalLink } from '../console/utils/link';

import KebabDropdown from '../kebab-dropdown';
import { Labels } from '../labels';
import { ToggleGraph } from '../metrics';
import { Alerts } from '../types';
import { alertDescription, RuleResource } from '../utils';

import {
  getAlertRulesUrl,
  getAlertsUrl,
  getAlertUrl,
  getNewSilenceAlertUrl,
  getLegacyObserveState,
  getQueryBrowserUrl,
  usePerspective,
} from '../hooks/usePerspective';
import {
  alertingRuleSource,
  AlertState,
  getSourceKey,
  Graph,
  SeverityBadge,
  SeverityHelp,
  SourceHelp,
} from '../alerting/AlertUtils';
import { MonitoringState } from '../../reducers/observe';
import { StatusBox } from '../console/console-shared/src/components/status/StatusBox';
import { formatPrometheusDuration } from '../console/console-shared/src/datetime/prometheus';
import withFallback from '../console/console-shared/error/fallbacks/withFallback';
import { Table, TableVariant, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import { useNavigate, useParams } from 'react-router-dom-v5-compat';

// Renders Prometheus template text and highlights any {{ ... }} tags that it contains
const PrometheusTemplate = ({ text }) => (
  <>
    {text
      ?.split(/(\{\{[^{}]*\}\})/)
      ?.map((part: string, i: number) =>
        part.match(/^\{\{[^{}]*\}\}$/) ? <code key={i}>{part}</code> : part,
      )}
  </>
);

type ActiveAlertsProps = RouteComponentProps & {
  alerts: PrometheusAlert[];
  namespace: string;
  ruleID: string;
};

const ActiveAlerts_: React.FC<ActiveAlertsProps> = ({ alerts, namespace, ruleID }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const { perspective } = usePerspective();
  const navigate = useNavigate();

  return (
    <Table variant={TableVariant.compact}>
      <Thead>
        <Tr>
          <Th width={60}>{t('Description')}</Th>
          <Th width={15} visibility={['hiddenOnSm', 'visibleOnMd']}>
            {t('Active since')}
          </Th>
          <Th width={10}>{t('State')}</Th>
          <Th width={15}>{t('Value')}</Th>
        </Tr>
      </Thead>
      <Tbody>
        {_.sortBy<PrometheusAlert>(alerts, alertDescription).map((a, i) => (
          <Tr key={i}>
            <Td>
              <Link data-test="active-alerts" to={getAlertUrl(perspective, a, ruleID, namespace)}>
                {alertDescription(a)}
              </Link>
            </Td>
            <Td>
              <Timestamp timestamp={a.activeAt} />
            </Td>
            <Td>
              <AlertState state={a.state} />
            </Td>
            <Td modifier="truncate">{a.value}</Td>
            {a.state !== AlertStates.Silenced && (
              <KebabDropdown
                dropdownItems={[
                  <DropdownItem
                    component="button"
                    key="silence"
                    onClick={() => navigate(getNewSilenceAlertUrl(perspective, a))}
                  >
                    {t('Silence alert')}
                  </DropdownItem>,
                ]}
              />
            )}
          </Tr>
        ))}
      </Tbody>
    </Table>
  );
};
const ActiveAlerts = withRouter(ActiveAlerts_);

const AlertRulesDetailsPage_: React.FC = () => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  const { rulesKey, alertsKey, perspective } = usePerspective();

  const params = useParams();
  const namespace = params?.ns; // namespace only defined in dev perspective

  const rules: Rule[] = useSelector((state: MonitoringState) =>
    getLegacyObserveState(perspective, state)?.get(rulesKey),
  );
  const rule = _.find(rules, { id: params?.id });

  const { loaded, loadError }: Alerts = useSelector(
    (state: MonitoringState) => getLegacyObserveState(perspective, state)?.get(alertsKey) || {},
  );

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

  // eslint-disable-next-line camelcase
  const runbookURL = rule?.annotations?.runbook_url;

  return (
    <>
      <Helmet>
        <title>{t('{{name}} details', { name: rule?.name || RuleResource.label })}</title>
      </Helmet>
      <StatusBox data={rule} label={RuleResource.label} loaded={loaded} loadError={loadError}>
        <PageGroup>
          <PageBreadcrumb hasBodyWrapper={false}>
            <Breadcrumb>
              {perspective === 'dev' && (
                <BreadcrumbItem>
                  <Link to={getAlertsUrl(perspective, namespace)}>{t('Alerts')}</Link>
                </BreadcrumbItem>
              )}
              {perspective !== 'dev' && (
                <BreadcrumbItem>
                  <Link to={getAlertRulesUrl(perspective)}>{t('Alerting rules')}</Link>
                </BreadcrumbItem>
              )}
              <BreadcrumbItem isActive>{t('Alerting rule details')}</BreadcrumbItem>
            </Breadcrumb>
          </PageBreadcrumb>
          <PageSection hasBodyWrapper={false}>
            <Flex>
              <FlexItem
                alignSelf={{ default: 'alignSelfCenter' }}
                spacer={{ default: 'spacerNone' }}
              >
                <ResourceIcon kind={RuleResource.kind} />
              </FlexItem>
              <FlexItem>
                <Title headingLevel="h1">{rule?.name}</Title>
              </FlexItem>
              <FlexItem alignSelf={{ default: 'alignSelfCenter' }}>
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
                        {rule.annotations.summary}
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
                      {rule && getSourceKey(_.startCase(alertingRuleSource(rule)), t)}
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
                    <DescriptionListDescription>
                      {/* display a link only if its a metrics based alert */}
                      {(!sourceId || sourceId === 'prometheus') && perspective !== 'acm' ? (
                        <Link to={getQueryBrowserUrl(perspective, rule?.query, namespace)}>
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
                namespace={namespace}
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
              <ActiveAlerts alerts={rule.alerts} ruleID={rule?.id} namespace={namespace} />
            )}
          </PageSection>
        </PageGroup>
      </StatusBox>
    </>
  );
};
const AlertRulesDetailsPage = withFallback(AlertRulesDetailsPage_);

export default AlertRulesDetailsPage;
