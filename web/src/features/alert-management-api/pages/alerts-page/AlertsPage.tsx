import { AlertSeverity, AlertStates } from '@openshift-console/dynamic-plugin-sdk';
import {
  ActionList,
  ActionListItem,
  Alert,
  Button,
  DescriptionList,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
  Divider,
  Flex,
  FlexItem,
  PageSection,
  Panel,
  PanelHeader,
  PanelMain,
  PanelMainBody,
  SearchInput,
  Title,
} from '@patternfly/react-core';
import { ClockIcon, FilterIcon } from '@patternfly/react-icons';
import { CSSProperties, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AlertSeverityButton } from '@/features/alert-management-api/components/AlertSeverityButton';
import { PageWithFilters } from '@/features/alert-management-api/components/PageWithFilters';
import { useAlertManagementData } from '@/features/alert-management-api/hooks/useAlertManagementData';
import { AlertsResults } from '@/features/alert-management-api/pages/alerts-page/AlertsResults';
import { AlertsFilterDrawer } from '@/features/alert-management-api/pages/alerts-page/components/AlertsFilterDrawer';
import { SelectedFilters } from '@/features/alert-management-api/pages/alerts-page/components/SelectedFilters';
import { useAlertManagementFilters } from '@/features/alert-management-api/pages/alerts-page/hooks/useAlertFilters';
import { selectedAlertFilterLabels } from '@/features/alert-management-api/pages/alerts-page/utils/filter-labels';
import type { AlertFilters } from '@/features/alert-management-api/types/types';
import { compareSeverities } from '@/features/alert-management-api/utils/sort-alerts';
import { TimeRangeSelect } from '@/shared/components/TimeRangeSelect';
import { AccessDenied } from '@/shared/console/console-shared/src/components/empty-state/AccessDenied';
import { LoadingBox } from '@/shared/console/console-shared/src/components/loading/LoadingBox';
import { DataTestIDs } from '@/shared/constants/data-test';
import { getSeverityColors } from '@/shared/utils/alerts/formatting';

export function AlertManagementAlertsPage() {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);
  const { data, rulesQuery, silencesQuery } = useAlertManagementData();
  const { filters, setFilters } = useAlertManagementFilters();
  const [isFilterDrawerOpen, setFilterDrawerOpen] = useState(false);

  const alerts = data?.alerts;
  const counts = (alerts ?? []).reduce(
    (result, alert) => {
      result.states[alert.state] = (result.states[alert.state] ?? 0) + 1;
      const severity = alert.labels.severity ?? AlertSeverity.None;
      result.severities[severity] = (result.severities[severity] ?? 0) + 1;
      return result;
    },
    { states: {} as Record<string, number>, severities: {} as Record<string, number> },
  );

  const isLoading = rulesQuery.isLoading && !rulesQuery.data;
  const error = rulesQuery.error;

  if (isLoading) {
    return <LoadingBox />;
  }

  if (rulesQuery.isError) {
    return <AccessDenied message={error instanceof Error ? error.message : ''} />;
  }

  return (
    <PageSection hasBodyWrapper={false} isFilled>
      {silencesQuery.isError && (
        <Alert isInline variant="warning" title={t('Silences could not be loaded')} />
      )}
      <PageWithFilters
        filtersId={DataTestIDs.AlertManagementAPI.FiltersPanel}
        filters={
          isFilterDrawerOpen && (
            <AlertsFilterDrawer
              alerts={alerts ?? []}
              filters={filters}
              onChange={setFilters}
              onClose={() => setFilterDrawerOpen(false)}
            />
          )
        }
      >
        <Panel variant="bordered">
          <PanelHeader>
            <Flex justifyContent={{ default: 'justifyContentSpaceBetween' }}>
              <Title headingLevel="h2" size="lg">
                {t('Alerts')}
              </Title>
              <Flex alignItems={{ default: 'alignItemsCenter' }}>
                <AlertStateCounts states={counts.states} />
                <Divider orientation={{ default: 'vertical' }} />
                <AlertSeverityActions
                  severities={counts.severities}
                  filters={filters}
                  onChange={setFilters}
                />
              </Flex>
            </Flex>
          </PanelHeader>
          <Divider />
          <PanelMain>
            <PanelMainBody style={{ paddingBlock: 'var(--pf-t--global--spacer--sm)' }}>
              <Flex alignItems={{ default: 'alignItemsCenter' }}>
                <FlexItem>
                  <Button
                    variant="control"
                    icon={<FilterIcon />}
                    aria-expanded={isFilterDrawerOpen}
                    aria-controls={DataTestIDs.AlertManagementAPI.FiltersPanel}
                    aria-label={t('Open alert filters')}
                    onClick={() => setFilterDrawerOpen((open) => !open)}
                  >
                    {t('Filters')}
                  </Button>
                </FlexItem>
                <FlexItem grow={{ default: 'grow' }}>
                  <SearchInput
                    id={DataTestIDs.AlertManagementAPI.SearchInput}
                    aria-label={t('Search alert name')}
                    value={filters.name}
                    placeholder={t('Search alert name')}
                    onChange={(_event, name) => setFilters({ ...filters, name })}
                    onClear={() => setFilters({ ...filters, name: '' })}
                  />
                </FlexItem>
                <FlexItem align={{ default: 'alignRight' }}>
                  <TimeRangeSelect
                    id={DataTestIDs.AlertManagementAPI.FiringTimeSelect}
                    includeAnyTime
                    toggleWidth="180px"
                    toggleProps={{ icon: <ClockIcon /> }}
                  />
                </FlexItem>
              </Flex>
              <SelectedFilters
                filters={filters}
                labels={selectedAlertFilterLabels}
                getLabelColor={(key, value) =>
                  getSeverityColors(key === 'severity' ? value : undefined).labelColor
                }
                formatLabelText={(key, value) =>
                  ['scope', 'severity', 'state'].includes(key)
                    ? t(`${value[0].toUpperCase()}${value.slice(1)}`)
                    : value
                }
                onChange={setFilters}
              />
            </PanelMainBody>
          </PanelMain>
          <Divider />
          <AlertsResults alerts={alerts ?? []} filters={filters} />
        </Panel>
      </PageWithFilters>
    </PageSection>
  );
}

function AlertStateCounts({ states }: { states: Record<string, number> }) {
  const { t } = useTranslation(process.env.I18N_NAMESPACE);

  return (
    <DescriptionList
      isHorizontal
      isFluid
      isCompact
      isAutoColumnWidths
      columnModifier={{ default: '2Col' }}
      style={
        {
          // Keep counts content-sized (not expanding right) and
          // labels non-bold in the compact header summary.
          '--pf-v6-c-description-list--m-horizontal__description--width': 'max-content',
          '--pf-v6-c-description-list__term--FontWeight':
            'var(--pf-t--global--font--weight--body--default)',
        } as CSSProperties
      }
    >
      <DescriptionListGroup style={{ columnGap: 'var(--pf-t--global--spacer--sm)' }}>
        <DescriptionListTerm>{t('Firing alerts')}</DescriptionListTerm>
        <DescriptionListDescription>
          <strong>{states[AlertStates.Firing] ?? 0}</strong>
        </DescriptionListDescription>
      </DescriptionListGroup>
      <DescriptionListGroup style={{ columnGap: 'var(--pf-t--global--spacer--sm)' }}>
        <DescriptionListTerm>{t('Pending alerts')}</DescriptionListTerm>
        <DescriptionListDescription>
          <strong>{states[AlertStates.Pending] ?? 0}</strong>
        </DescriptionListDescription>
      </DescriptionListGroup>
    </DescriptionList>
  );
}

function AlertSeverityActions({
  severities,
  filters,
  onChange,
}: {
  severities: Record<string, number>;
  filters: AlertFilters;
  onChange: (filters: AlertFilters) => void;
}) {
  return (
    <ActionList isIconList>
      {Object.entries(severities)
        .sort(([first], [second]) => compareSeverities(first, second))
        .map(([severity, count]) => {
          return (
            <ActionListItem key={severity}>
              <AlertSeverityButton
                severity={severity}
                count={count}
                onClick={() => onChange({ ...filters, severity: [severity] })}
              />
            </ActionListItem>
          );
        })}
    </ActionList>
  );
}
