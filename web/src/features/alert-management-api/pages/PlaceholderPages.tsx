import { PageSection, Title } from '@patternfly/react-core';

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
