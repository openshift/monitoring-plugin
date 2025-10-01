import * as _ from 'lodash-es';
import type { FC } from 'react';

import { Alert, ResourceIcon, Timestamp } from '@openshift-console/dynamic-plugin-sdk';
import {
  Breadcrumb,
  BreadcrumbItem,
  DescriptionList,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
  Divider,
  DropdownItem,
  Flex,
  FlexItem,
  Grid,
  GridItem,
  PageBreadcrumb,
  PageGroup,
  PageSection,
  Split,
  SplitItem,
  Title,
} from '@patternfly/react-core';
import { useTranslation } from 'react-i18next';
import { getAlertUrl, getRuleUrl, getSilencesUrl, usePerspective } from '../hooks/usePerspective';
import KebabDropdown from '../kebab-dropdown';
import { alertDescription, SilenceResource } from '../utils';
import { SeverityBadge, SeverityCounts } from './AlertUtils';
import { SilenceDropdown, SilenceMatchersList, SilenceState } from './SilencesUtils';
import { StatusBox } from '../console/console-shared/src/components/status/StatusBox';
import { LoadingInline } from '../console/console-shared/src/components/loading/LoadingInline';
import withFallback from '../console/console-shared/error/fallbacks/withFallback';
import { Table, TableVariant, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import { useNavigate, useParams, Link } from 'react-router-dom-v5-compat';
import { MonitoringProvider } from '../../contexts/MonitoringContext';
import { DataTestIDs } from '../data-test';
import { useAlerts } from '../../hooks/useAlerts';

const SilencesDetailsPage_: FC = () => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  const params = useParams<{ id: string }>();

  const id = params.id;

  const { silences, rulesAlertLoading } = useAlerts();

  const { perspective } = usePerspective();

  const silence = _.find(silences?.data, { id });

  return (
    <>
      <DocumentTitle>
        {t('{{name}} details', { name: silence?.name || SilenceResource.label })}
      </DocumentTitle>
      <StatusBox
        data={silence}
        label={SilenceResource.label}
        loaded={silences?.loaded}
        loadError={silences?.loadError}
      >
        <PageGroup>
          <PageBreadcrumb hasBodyWrapper={false}>
            <Breadcrumb>
              <BreadcrumbItem>
                <Link to={getSilencesUrl(perspective)} data-test={DataTestIDs.Breadcrumb}>
                  {t('Silences')}
                </Link>
              </BreadcrumbItem>
              <BreadcrumbItem isActive>{t('Silence details')}</BreadcrumbItem>
            </Breadcrumb>
          </PageBreadcrumb>
          <PageSection hasBodyWrapper={false}>
            <Split>
              <SplitItem>
                <Flex>
                  <FlexItem
                    alignSelf={{ default: 'alignSelfCenter' }}
                    spacer={{ default: 'spacerNone' }}
                    data-test={DataTestIDs.SilenceResourceIcon}
                  >
                    <ResourceIcon kind={SilenceResource.kind} />
                  </FlexItem>
                  <FlexItem>
                    <Title headingLevel="h1">{silence?.name}</Title>
                  </FlexItem>
                </Flex>
              </SplitItem>
              <SplitItem isFilled />
              <SplitItem>
                {silence && <SilenceDropdown silence={silence} toggleText="Actions" />}
              </SplitItem>
            </Split>
          </PageSection>
          <Divider />
          <PageSection hasBodyWrapper={false}>
            <Title headingLevel="h2">{t('Silence details')}</Title>
            <Grid sm={12} md={6}>
              <GridItem>
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
                        <div>{t('No matchers')}</div>
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
              </GridItem>
              <GridItem>
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
                    <DescriptionListDescription>
                      {silence?.comment || '-'}
                    </DescriptionListDescription>
                  </DescriptionListGroup>
                  <DescriptionListGroup>
                    <DescriptionListTerm>{t('Firing alerts')}</DescriptionListTerm>
                    <DescriptionListDescription>
                      {rulesAlertLoading?.loaded ? (
                        <SeverityCounts alerts={silence?.firingAlerts} />
                      ) : (
                        <LoadingInline />
                      )}
                    </DescriptionListDescription>
                  </DescriptionListGroup>
                </DescriptionList>
              </GridItem>
            </Grid>
          </PageSection>
          <Divider />
          <PageSection hasBodyWrapper={false}>
            <Title headingLevel="h2">{t('Firing alerts')}</Title>
            {rulesAlertLoading?.loaded ? (
              <SilencedAlertsList alerts={silence?.firingAlerts} />
            ) : (
              <LoadingInline />
            )}
          </PageSection>
        </PageGroup>
      </StatusBox>
    </>
  );
};
const SilencesDetailsPageWithFallback = withFallback(SilencesDetailsPage_);

export const MpCmoSilencesDetailsPage = () => {
  return (
    <MonitoringProvider monitoringContext={{ plugin: 'monitoring-plugin', prometheus: 'cmo' }}>
      <SilencesDetailsPageWithFallback />
    </MonitoringProvider>
  );
};

export const McpAcmSilencesDetailsPage = () => {
  return (
    <MonitoringProvider
      monitoringContext={{ plugin: 'monitoring-console-plugin', prometheus: 'acm' }}
    >
      <SilencesDetailsPageWithFallback />
    </MonitoringProvider>
  );
};

const SilencedAlertsList: FC<SilencedAlertsListProps> = ({ alerts }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const navigate = useNavigate();
  const { perspective } = usePerspective();

  return _.isEmpty(alerts) ? (
    <div>{t('No Alerts found')}</div>
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
                data-test={DataTestIDs.AlertResourceLink}
                to={getAlertUrl(perspective, a, a.rule.id)}
              >
                {a.labels.alertname}
              </Link>
              <div>{alertDescription(a)}</div>
            </Td>
            <Td>
              <SeverityBadge severity={a.labels.severity} />
            </Td>
            <div>
              <KebabDropdown
                dropdownItems={[
                  <DropdownItem
                    key="view-rule"
                    onClick={() => navigate(getRuleUrl(perspective, a.rule))}
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

type SilencedAlertsListProps = { alerts: Alert[] };
