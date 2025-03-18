import * as _ from 'lodash-es';
import * as React from 'react';
import { useSelector } from 'react-redux';

import { Alert, Timestamp, useActiveNamespace } from '@openshift-console/dynamic-plugin-sdk';
import {
  Breadcrumb,
  BreadcrumbItem,
  DescriptionList,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
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
import { Table, TableVariant, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';

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
                  {/* Leave to keep compatibility with console looks */}
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
        <PageSection variant={PageSectionVariants.light}>
          <Title headingLevel="h2">{t('Silence details')}</Title>
          <div className="row">
            <div className="col-sm-6">
              <DescriptionList>
                {silence?.name && (
                  <DescriptionListGroup>
                    <DescriptionListTerm>{t('Name')}</DescriptionListTerm>
                    <DescriptionListDescription>{silence?.name}</DescriptionListDescription>
                  </DescriptionListGroup>
                )}
                <DescriptionListGroup>
                  <DescriptionListTerm>{t('Matchers')}</DescriptionListTerm>
                  <DescriptionListDescription data-test="label-list">
                    {_.isEmpty(silence?.matchers) ? (
                      <div className="text-muted">{t('No matchers')}</div>
                    ) : (
                      <SilenceMatchersList silence={silence} />
                    )}
                  </DescriptionListDescription>
                </DescriptionListGroup>
                <DescriptionListGroup>
                  <DescriptionListTerm>{t('State')}</DescriptionListTerm>
                  <DescriptionListDescription>
                    <SilenceState silence={silence} />
                  </DescriptionListDescription>
                </DescriptionListGroup>
                <DescriptionListGroup>
                  <DescriptionListTerm>{t('Last updated at')}</DescriptionListTerm>
                  <DescriptionListDescription>
                    <Timestamp timestamp={silence?.updatedAt} />
                  </DescriptionListDescription>
                </DescriptionListGroup>
              </DescriptionList>
            </div>
            <div className="col-sm-6">
              <DescriptionList>
                <DescriptionListGroup>
                  <DescriptionListTerm>{t('Starts at')}</DescriptionListTerm>
                  <DescriptionListDescription>
                    <Timestamp timestamp={silence?.startsAt} />
                  </DescriptionListDescription>
                </DescriptionListGroup>
                <DescriptionListGroup>
                  <DescriptionListTerm>{t('Ends at')}</DescriptionListTerm>
                  <DescriptionListDescription>
                    <Timestamp timestamp={silence?.endsAt} />
                  </DescriptionListDescription>
                </DescriptionListGroup>
                <DescriptionListGroup>
                  <DescriptionListTerm>{t('Created by')}</DescriptionListTerm>
                  <DescriptionListDescription>
                    {silence?.createdBy || '-'}
                  </DescriptionListDescription>
                </DescriptionListGroup>
                <DescriptionListGroup>
                  <DescriptionListTerm>{t('Comment')}</DescriptionListTerm>
                  <DescriptionListDescription>{silence?.comment || '-'}</DescriptionListDescription>
                </DescriptionListGroup>
                <DescriptionListGroup>
                  <DescriptionListTerm>{t('Firing alerts')}</DescriptionListTerm>
                  <DescriptionListDescription>
                    {alertsLoaded ? (
                      <SeverityCounts alerts={silence?.firingAlerts} />
                    ) : (
                      <LoadingInline />
                    )}
                  </DescriptionListDescription>
                </DescriptionListGroup>
              </DescriptionList>
            </div>
          </div>
        </PageSection>
        <Divider />
        <PageSection variant={PageSectionVariants.light}>
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
        </PageSection>
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
    <Table variant={TableVariant.compact}>
      <Thead>
        <Tr>
          <Th width={80}>{t('Name')}</Th>
          <Th width={20}>{t('Severity')}</Th>
        </Tr>
      </Thead>
      <Tbody>
        {_.sortBy<Alert>(alerts, alertDescription).map((a, i) => (
          <Tr key={i}>
            <Td>
              <Link
                className="pf-v5-u-text-break-word"
                data-test="firing-alerts"
                to={getAlertUrl(perspective, a, a.rule.id, namespace)}
              >
                {a.labels.alertname}
              </Link>
              <div className="monitoring-description">{alertDescription(a)}</div>
            </Td>
            <Td>
              <Severity severity={a.labels.severity} />
            </Td>
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
          </Tr>
        ))}
      </Tbody>
    </Table>
  );
};
const SilencedAlertsList = withRouter(SilencedAlertsList_);

export default SilencesDetailsPage;

type SilencedAlertsListProps = RouteComponentProps & { alerts: Alert[] };
