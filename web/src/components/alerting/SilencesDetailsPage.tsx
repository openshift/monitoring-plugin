import * as _ from 'lodash-es';
import type { FC } from 'react';
import { useSelector } from 'react-redux';

import {
  Alert,
  ResourceIcon,
  Timestamp,
  useActiveNamespace,
} from '@openshift-console/dynamic-plugin-sdk';
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
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';
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
import { SeverityBadge, SeverityCounts } from './AlertUtils';
import { SilenceDropdown, SilenceMatchersList, SilenceState } from './SilencesUtils';
import { StatusBox } from '../console/console-shared/src/components/status/StatusBox';
import { LoadingInline } from '../console/console-shared/src/components/loading/LoadingInline';
import withFallback from '../console/console-shared/error/fallbacks/withFallback';
import { Table, TableVariant, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import { useNavigate, useParams, Link } from 'react-router-dom-v5-compat';
import { useAlertsPoller } from '../hooks/useAlertsPoller';

const SilencesDetailsPage_: FC = () => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const params = useParams<{ id: string }>();

  const id = params.id;

  useAlertsPoller();

  const [namespace] = useActiveNamespace();
  const { alertsKey, perspective, silencesKey } = usePerspective();

  const alertsLoaded = useSelector(
    (state: MonitoringState) => getLegacyObserveState(perspective, state)?.get(alertsKey)?.loaded,
  );

  const silences: Silences = useSelector((state: MonitoringState) =>
    getLegacyObserveState(perspective, state)?.get(silencesKey),
  );
  const silence = _.find(silences?.data, { id });

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
          <PageBreadcrumb hasBodyWrapper={false}>
            <Breadcrumb>
              <BreadcrumbItem>
                <Link to={getSilencesUrl(perspective, namespace)}>{t('Silences')}</Link>
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
                      {alertsLoaded ? (
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
            {alertsLoaded ? (
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
const SilencesDetailsPage = withFallback(SilencesDetailsPage_);

const SilencedAlertsList: FC<SilencedAlertsListProps> = ({ alerts }) => {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const navigate = useNavigate();
  const { perspective } = usePerspective();
  const [namespace] = useActiveNamespace();

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
                data-test="firing-alerts"
                to={getAlertUrl(perspective, a, a.rule.id, namespace)}
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
                    onClick={() => navigate(getRuleUrl(perspective, a.rule, namespace))}
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

export default SilencesDetailsPage;

type SilencedAlertsListProps = { alerts: Alert[] };
