import * as _ from 'lodash-es';
import * as React from 'react';
import { useSelector } from 'react-redux';

import { Alert, Timestamp, useActiveNamespace } from '@openshift-console/dynamic-plugin-sdk';
import {
  Breadcrumb,
  BreadcrumbItem,
  Divider,
  DropdownItem,
  PageBreadcrumb,
  PageGroup,
  PageSection,
  PageSectionVariants,
  Split,
  SplitItem,
  Title,
} from '@patternfly/react-core';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';
import { RouteComponentProps, withRouter } from 'react-router';
import { Link } from 'react-router-dom';
import { MonitoringState } from 'src/reducers/observe';
import {
  getAlertUrl,
  getLegacyObserveState,
  getRuleUrl,
  getSilencesUrl,
  usePerspective,
} from '../hooks/usePerspective';
import KebabDropdown from '../kebab-dropdown';
import { Silences } from '../types';
import { alertDescription, SilenceResource } from '../utils';
import { MonitoringResourceIcon, Severity, SeverityCounts } from './AlertUtils';
import { SilenceDropdown, SilenceMatchersList, SilenceState } from './SilencesUtils';
import { StatusBox } from '../console/console-shared/src/components/status/StatusBox';
import { LoadingInline } from '../console/console-shared/src/components/loading/LoadingInline';
import withFallback from '../console/console-shared/error/fallbacks/withFallback';

const SilencesDetailsPage_: React.FC<RouteComponentProps<{ id: string }>> = ({ match }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  const [namespace] = useActiveNamespace();
  const { alertsKey, perspective, silencesKey } = usePerspective();

  const alertsLoaded = useSelector(
    (state: MonitoringState) => getLegacyObserveState(perspective, state)?.get(alertsKey)?.loaded,
  );

  const silences: Silences = useSelector((state: MonitoringState) =>
    getLegacyObserveState(perspective, state)?.get(silencesKey),
  );
  const silence = _.find(silences?.data, { id: _.get(match, 'params.id') });

  return (
    <>
      <Helmet>
        <title>{t('{{name}} details', { name: silence?.name || SilenceResource.label })}</title>
      </Helmet>
      <StatusBox
        data={silence}
        label={SilenceResource.label}
        loaded={silences?.loaded}
        loadError={silences?.loadError}
      >
        <PageGroup>
          <PageBreadcrumb>
            <Breadcrumb className="monitoring-breadcrumbs">
              <BreadcrumbItem>
                <Link
                  className="pf-v5-c-breadcrumb__link"
                  to={getSilencesUrl(perspective, namespace)}
                >
                  {t('Silences')}
                </Link>
              </BreadcrumbItem>
              <BreadcrumbItem isActive>{t('Silence details')}</BreadcrumbItem>
            </Breadcrumb>
          </PageBreadcrumb>
          <PageSection variant={PageSectionVariants.light}>
            <Split>
              <SplitItem>
                <Title headingLevel="h1">
                  <MonitoringResourceIcon
                    className="co-m-resource-icon--lg"
                    resource={SilenceResource}
                  />
                  {silence?.name}
                </Title>
              </SplitItem>
              <SplitItem isFilled />
              <SplitItem>
                {silence && <SilenceDropdown silence={silence} toggleText="Actions" />}
              </SplitItem>
            </Split>
          </PageSection>
        </PageGroup>
        <Divider />
        <div className="co-m-pane__body">
          <Title headingLevel="h2">{t('Silence details')}</Title>
          <div className="co-m-pane__body-group">
            <div className="row">
              <div className="col-sm-6">
                <dl className="co-m-pane__details">
                  {silence?.name && (
                    <>
                      <dt>{t('Name')}</dt>
                      <dd>{silence?.name}</dd>
                    </>
                  )}
                  <dt>{t('Matchers')}</dt>
                  <dd data-test="label-list">
                    {_.isEmpty(silence?.matchers) ? (
                      <div className="text-muted">{t('No matchers')}</div>
                    ) : (
                      <SilenceMatchersList silence={silence} />
                    )}
                  </dd>
                  <dt>{t('State')}</dt>
                  <dd>
                    <SilenceState silence={silence} />
                  </dd>
                  <dt>{t('Last updated at')}</dt>
                  <dd>
                    <Timestamp timestamp={silence?.updatedAt} />
                  </dd>
                </dl>
              </div>
              <div className="col-sm-6">
                <dl className="co-m-pane__details">
                  <dt>{t('Starts at')}</dt>
                  <dd>
                    <Timestamp timestamp={silence?.startsAt} />
                  </dd>
                  <dt>{t('Ends at')}</dt>
                  <dd>
                    <Timestamp timestamp={silence?.endsAt} />
                  </dd>
                  <dt>{t('Created by')}</dt>
                  <dd>{silence?.createdBy || '-'}</dd>
                  <dt>{t('Comment')}</dt>
                  <dd>{silence?.comment || '-'}</dd>
                  <dt>{t('Firing alerts')}</dt>
                  <dd>
                    {alertsLoaded ? (
                      <SeverityCounts alerts={silence?.firingAlerts} />
                    ) : (
                      <LoadingInline />
                    )}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
        <div className="co-m-pane__body">
          <div className="co-m-pane__body-group">
            <Title headingLevel="h2">{t('Firing alerts')}</Title>
            <div className="row">
              <div className="col-xs-12">
                {alertsLoaded ? (
                  <SilencedAlertsList alerts={silence?.firingAlerts} />
                ) : (
                  <LoadingInline />
                )}
              </div>
            </div>
          </div>
        </div>
      </StatusBox>
    </>
  );
};
const SilencesDetailsPage = withFallback(SilencesDetailsPage_);

const SilencedAlertsList_: React.FC<SilencedAlertsListProps> = ({ alerts, history }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const { perspective } = usePerspective();
  const [namespace] = useActiveNamespace();

  return _.isEmpty(alerts) ? (
    <div className="pf-v5-u-text-align-center">{t('None found')}</div>
  ) : (
    <div className="co-m-table-grid co-m-table-grid--bordered">
      <div className="row co-m-table-grid__head">
        <div className="col-xs-9">{t('Name')}</div>
        <div className="col-xs-3">{t('Severity')}</div>
      </div>
      <div className="co-m-table-grid__body">
        {_.sortBy<Alert>(alerts, alertDescription).map((a, i) => (
          <div className="row co-resource-list__item" key={i}>
            <div className="col-xs-9">
              <Link
                className="co-resource-item"
                data-test="firing-alerts"
                to={getAlertUrl(perspective, a, a.rule.id, namespace)}
              >
                {a.labels.alertname}
              </Link>
              <div className="monitoring-description">{alertDescription(a)}</div>
            </div>
            <div className="col-xs-3">
              <Severity severity={a.labels.severity} />
            </div>
            <div className="dropdown-kebab-pf">
              <KebabDropdown
                dropdownItems={[
                  <DropdownItem
                    key="view-rule"
                    onClick={() => history.push(getRuleUrl(perspective, a.rule, namespace))}
                  >
                    {t('View alerting rule')}
                  </DropdownItem>,
                ]}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
const SilencedAlertsList = withRouter(SilencedAlertsList_);

export default SilencesDetailsPage;

type SilencedAlertsListProps = RouteComponentProps & { alerts: Alert[] };
