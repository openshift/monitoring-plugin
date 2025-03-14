import {
  AlertingRuleChartExtension,
  AlertStates,
  isAlertingRuleChart,
  PrometheusAlert,
  Rule,
  Timestamp,
  useResolvedExtensions,
} from '@openshift-console/dynamic-plugin-sdk';
import {
  Breadcrumb,
  BreadcrumbItem,
  CodeBlock,
  CodeBlockCode,
  Divider,
  DropdownItem,
  PageBreadcrumb,
  PageGroup,
  PageSection,
  PageSectionVariants,
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
  MonitoringResourceIcon,
  PopoverField,
  Severity,
  SeverityBadge,
  SeverityHelp,
  SourceHelp,
} from '../alerting/AlertUtils';
import { MonitoringState } from '../../reducers/observe';
import { StatusBox } from '../console/console-shared/src/components/status/StatusBox';
import { formatPrometheusDuration } from '../console/console-shared/src/datetime/prometheus';
import withFallback from '../console/console-shared/error/fallbacks/withFallback';

// Renders Prometheus template text and highlights any {{ ... }} tags that it contains
const PrometheusTemplate = ({ text }) => (
  <>
    {text?.split(/(\{\{[^{}]*\}\})/)?.map((part: string, i: number) =>
      part.match(/^\{\{[^{}]*\}\}$/) ? (
        <code className="co-code prometheus-template-tag" key={i}>
          {part}
        </code>
      ) : (
        part
      ),
    )}
  </>
);

type ActiveAlertsProps = RouteComponentProps & {
  alerts: PrometheusAlert[];
  namespace: string;
  ruleID: string;
};

const ActiveAlerts_: React.FC<ActiveAlertsProps> = ({ alerts, history, namespace, ruleID }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const { perspective } = usePerspective();

  return (
    <div className="co-m-table-grid co-m-table-grid--bordered">
      <div className="row co-m-table-grid__head">
        <div className="col-xs-6">{t('Description')}</div>
        <div className="col-sm-2 hidden-xs">{t('Active since')}</div>
        <div className="col-sm-2 col-xs-3">{t('State')}</div>
        <div className="col-sm-2 col-xs-3">{t('Value')}</div>
      </div>
      <div className="co-m-table-grid__body">
        {_.sortBy<PrometheusAlert>(alerts, alertDescription).map((a, i) => (
          <div className="row co-resource-list__item" key={i}>
            <div className="col-xs-6">
              <Link
                className="co-resource-item"
                data-test="active-alerts"
                to={getAlertUrl(perspective, a, ruleID, namespace)}
              >
                {alertDescription(a)}
              </Link>
            </div>
            <div className="col-sm-2 hidden-xs">
              <Timestamp timestamp={a.activeAt} />
            </div>
            <div className="col-sm-2 col-xs-3">
              <AlertState state={a.state} />
            </div>
            <div className="col-sm-2 col-xs-3 co-truncate">{a.value}</div>
            {a.state !== AlertStates.Silenced && (
              <div className="dropdown-kebab-pf">
                <KebabDropdown
                  dropdownItems={[
                    <DropdownItem
                      component="button"
                      key="silence"
                      onClick={() => history.push(getNewSilenceAlertUrl(perspective, a))}
                    >
                      {t('Silence alert')}
                    </DropdownItem>,
                  ]}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
const ActiveAlerts = withRouter(ActiveAlerts_);

type AlertRulesDetailsPageProps = RouteComponentProps<{ id: string; ns?: string }>;

const AlertRulesDetailsPage_: React.FC<AlertRulesDetailsPageProps> = ({ match }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  const { rulesKey, alertsKey, perspective } = usePerspective();
  const namespace = match.params?.ns;

  const rules: Rule[] = useSelector((state: MonitoringState) =>
    getLegacyObserveState(perspective, state)?.get(rulesKey),
  );
  const rule = _.find(rules, { id: _.get(match, 'params.id') });

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
          <PageBreadcrumb>
            <Breadcrumb className="monitoring-breadcrumbs">
              {perspective === 'dev' && (
                <BreadcrumbItem>
                  <Link
                    className="pf-v5-c-breadcrumb__link"
                    to={getAlertsUrl(perspective, namespace)}
                  >
                    {t('Alerts')}
                  </Link>
                </BreadcrumbItem>
              )}
              {perspective !== 'dev' && (
                <BreadcrumbItem>
                  <Link className="pf-v5-c-breadcrumb__link" to={getAlertRulesUrl(perspective)}>
                    {t('Alerting rules')}
                  </Link>
                </BreadcrumbItem>
              )}
              <BreadcrumbItem isActive>{t('Alerting rule details')}</BreadcrumbItem>
            </Breadcrumb>
          </PageBreadcrumb>
          <PageSection variant={PageSectionVariants.light}>
            <Title headingLevel="h1">
              <div data-test="resource-title" className="co-resource-item">
                <MonitoringResourceIcon
                  className="co-m-resource-icon--lg"
                  resource={RuleResource}
                />
                {rule?.name}
                <SeverityBadge severity={rule?.labels?.severity} />
              </div>
            </Title>
          </PageSection>
        </PageGroup>
        <Divider />
        <PageSection variant={PageSectionVariants.light}>
          <div className="monitoring-heading">
            <Title headingLevel="h2">{t('Alerting rule details')}</Title>
          </div>
          <div className="co-m-pane__body-group">
            <div className="row">
              <div className="col-sm-6">
                <dl className="co-m-pane__details">
                  <dt>{t('Name')}</dt>
                  <dd>{rule?.name}</dd>
                  <dt>
                    <PopoverField bodyContent={<SeverityHelp />} label={t('Severity')} />
                  </dt>
                  <dd>
                    <Severity severity={rule?.labels?.severity} />
                  </dd>
                  {rule?.annotations?.description && (
                    <>
                      <dt>{t('Description')}</dt>
                      <dd>
                        <PrometheusTemplate text={rule.annotations.description} />
                      </dd>
                    </>
                  )}
                  {rule?.annotations?.summary && (
                    <>
                      <dt>{t('Summary')}</dt>
                      <dd>{rule.annotations.summary}</dd>
                    </>
                  )}
                  {rule?.annotations?.message && (
                    <>
                      <dt>{t('Message')}</dt>
                      <dd>
                        <PrometheusTemplate text={rule.annotations.message} />
                      </dd>
                    </>
                  )}
                  {runbookURL && (
                    <>
                      <dt>{t('Runbook')}</dt>
                      <dd>
                        <ExternalLink href={runbookURL} text={runbookURL} />
                      </dd>
                    </>
                  )}
                </dl>
              </div>
              <div className="col-sm-6">
                <dl className="co-m-pane__details">
                  <dt>
                    <PopoverField bodyContent={<SourceHelp />} label={t('Source')} />
                  </dt>
                  <dd>{rule && getSourceKey(_.startCase(alertingRuleSource(rule)), t)}</dd>
                  {_.isInteger(rule?.duration) && (
                    <>
                      <dt>{t('For')}</dt>
                      <dd>
                        {rule.duration === 0 ? '-' : formatPrometheusDuration(rule.duration * 1000)}
                      </dd>
                    </>
                  )}
                  <dt>{t('Expression')}</dt>
                  <dd>
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
                  </dd>
                </dl>
              </div>
            </div>
          </div>
          <div className="co-m-pane__body-group">
            <div className="row">
              <div className="col-xs-12">
                <dl className="co-m-pane__details">
                  <dt>{t('Labels')}</dt>
                  <dd>
                    <Labels kind="alertrule" labels={rule?.labels} />
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </PageSection>
        <div className="co-m-pane__body">
          <div className="co-m-pane__body-group">
            <Toolbar className="monitoring-alert-detail-toolbar">
              <ToolbarContent>
                <ToolbarItem variant="label">
                  <Title headingLevel="h2">{t('Active alerts')}</Title>
                </ToolbarItem>
                <ToolbarGroup align={{ default: 'alignRight' }}>
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
                    formatSeriesTitle={formatSeriesTitle}
                    namespace={namespace}
                    query={rule?.query}
                    ruleDuration={rule?.duration}
                    showLegend
                  />
                ) : AlertChart ? (
                  <AlertChart rule={rule} />
                ) : null}
              </div>
            </div>
            <div className="row">
              <div className="col-xs-12">
                {_.isEmpty(rule?.alerts) ? (
                  <div className="pf-v5-u-text-align-center">{t('None found')}</div>
                ) : (
                  <ActiveAlerts alerts={rule.alerts} ruleID={rule?.id} namespace={namespace} />
                )}
              </div>
            </div>
          </div>
        </div>
      </StatusBox>
    </>
  );
};
const AlertRulesDetailsPage = withFallback(AlertRulesDetailsPage_);

export default AlertRulesDetailsPage;
