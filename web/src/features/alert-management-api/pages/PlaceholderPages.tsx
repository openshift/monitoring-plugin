import { PageSection, Title } from '@patternfly/react-core';

import { AlertManagementProvider } from '@/features/alert-management-api/pages/AlertManagementRouter';

function PlaceholderPage({ name }: { name: string }) {
  return (
    <PageSection>
      <Title headingLevel="h2">{name}</Title>
    </PageSection>
  );
}

export function AlertRulesManagementPage() {
  return <PlaceholderPage name="Alert rules" />;
}

export function SilencesManagementPage() {
  return <PlaceholderPage name="Silences" />;
}

export function IncidentsManagementPage() {
  return (
    <AlertManagementProvider
      monitoringContext={{ plugin: 'monitoring-console-plugin', prometheus: 'cmo' }}
    >
      <PlaceholderPage name="Incidents" />
    </AlertManagementProvider>
  );
}
