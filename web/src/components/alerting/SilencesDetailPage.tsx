import * as React from 'react';
import { useSelector } from 'react-redux';
import * as _ from 'lodash-es';

import { useTranslation } from 'react-i18next';
import { RouteComponentProps, withRouter } from 'react-router';
import {
  getAlertUrl,
  getObserveState,
  getRuleUrl,
  getSilencesUrl,
  usePerspective,
} from '../hooks/usePerspective';
import { MonitoringState } from 'src/reducers/observe';
import { Silences } from '../types';
import { Helmet } from 'react-helmet';
import { alertDescription, SilenceResource } from '../utils';
import { LoadingInline, StatusBox } from '../console/utils/status-box';
import { Breadcrumb, BreadcrumbItem } from '@patternfly/react-core';
import { Link } from 'react-router-dom';
import { MonitoringResourceIcon, OnToggle, Severity, SeverityCounts } from './AlertUtils';
import { SectionHeading } from '../console/utils/headings';
import { SilenceDropdown, SilenceMatchersList, SilenceState } from './SilencesUtils';
import {
  Alert,
  Silence,
  Timestamp,
  useActiveNamespace,
} from '@openshift-console/dynamic-plugin-sdk';
import { withFallback } from '../console/console-shared/error/error-boundary';
import {
  DropdownItem as DropdownItemDeprecated,
  DropdownToggle as DropdownToggleDeprecated,
} from '@patternfly/react-core/deprecated';
import KebabDropdown from '../kebab-dropdown';

const SilencesDetailsPage_: React.FC<RouteComponentProps<{ id: string }>> = ({ match }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  const [namespace] = useActiveNamespace();
  const { alertsKey, perspective, silencesKey } = usePerspective();

  const alertsLoaded = useSelector(
    (state: MonitoringState) => getObserveState(perspective, state)?.get(alertsKey)?.loaded,
  );

  const silences: Silences = useSelector((state: MonitoringState) =>
    getObserveState(perspective, state)?.get(silencesKey),
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
        <div className="pf-c-page__main-breadcrumb">
          <Breadcrumb className="monitoring-breadcrumbs">
            <BreadcrumbItem>
              <Link className="pf-c-breadcrumb__link" to={getSilencesUrl(perspective, namespace)}>
                {t('Silences')}
              </Link>
            </BreadcrumbItem>
            <BreadcrumbItem isActive>{t('Silence details')}</BreadcrumbItem>
          </Breadcrumb>
        </div>
        <div className="co-m-nav-title co-m-nav-title--detail co-m-nav-title--breadcrumbs">
          <h1 className="co-m-pane__heading">
            <div data-test="resource-title" className="co-resource-item">
              <MonitoringResourceIcon
                className="co-m-resource-icon--lg"
                resource={SilenceResource}
              />
              {silence?.name}
            </div>
            <div className="co-actions" data-test-id="details-actions">
              {silence && <SilenceDropdownActions silence={silence} />}
            </div>
          </h1>
        </div>
        <div className="co-m-pane__body">
          <SectionHeading text={t('Silence details')} />
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
            <SectionHeading text={t('Firing alerts')} />
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

const SilenceDropdownActions: React.FC<{ silence: Silence }> = ({ silence }) => (
  <SilenceDropdown className="co-actions-menu" silence={silence} Toggle={ActionsToggle} />
);

const ActionsToggle: React.FC<{ onToggle: OnToggle }> = ({ onToggle, ...props }) => (
  <DropdownToggleDeprecated
    data-test="silence-actions-toggle"
    onToggle={(event, isOpen) => onToggle(isOpen, event as MouseEvent)}
    {...props}
  >
    Actions
  </DropdownToggleDeprecated>
);

const SilencedAlertsList_: React.FC<SilencedAlertsListProps> = ({ alerts, history }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const { perspective } = usePerspective();
  const [namespace] = useActiveNamespace();

  return _.isEmpty(alerts) ? (
    <div className="pf-u-text-align-center">{t('None found')}</div>
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
                  <DropdownItemDeprecated
                    key="view-rule"
                    onClick={() => history.push(getRuleUrl(perspective, a.rule, namespace))}
                  >
                    {t('View alerting rule')}
                  </DropdownItemDeprecated>,
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
