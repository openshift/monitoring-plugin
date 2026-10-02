import { K8sResourceKind, WatchK8sResult } from '@openshift-console/dynamic-plugin-sdk';
import { MemoryRouter } from 'react-router';

import OverviewPageContent from '@/features/overview/components/pages/OverviewPageContent';
import * as useObservabilityCapabilitiesModule from '@/features/overview/hooks/useObservabilityCapabilities';
import { DataTestIDs } from '@/shared/constants/data-test';

import { buildEmptyObservabilityCapabilitiesResult, statusIcon } from './fixtures';

const summaryCard = (cardId: string) =>
  cy.get(`[data-test="${DataTestIDs.OverviewPage.SummaryCard}-${cardId}"]`);

const capabilityCard = (id: string) =>
  cy.get(`[data-test="${DataTestIDs.OverviewPage.CapabilityCard}-${id}"]`);

const defaultCsvResults: WatchK8sResult<K8sResourceKind[]> = [[], true, null];

const stubObservabilityCapabilities = (
  overrides: Partial<ReturnType<typeof buildEmptyObservabilityCapabilitiesResult>> = {},
) => {
  cy.stub(useObservabilityCapabilitiesModule, 'useObservabilityCapabilities').returns({
    ...buildEmptyObservabilityCapabilitiesResult(),
    ...overrides,
  });
};

const mountOverviewPageContent = (
  props: { csvResults?: WatchK8sResult<K8sResourceKind[]> } = {},
) => {
  cy.mount(
    <MemoryRouter>
      <OverviewPageContent csvResults={props.csvResults ?? defaultCsvResults} />
    </MemoryRouter>,
  );
};

describe('OverviewPageContent', () => {
  beforeEach(() => {
    stubObservabilityCapabilities();
  });

  it('renders the stack summary and capability sections once CSV watches resolve', () => {
    mountOverviewPageContent();
    cy.get(`[data-test="${DataTestIDs.OverviewPage.SummarySection}"]`).should('be.visible');
    cy.contains('h2', 'Stack summary').should('be.visible');
    cy.get(`[data-test="${DataTestIDs.OverviewPage.CapabilitiesSection}"]`).should('be.visible');
    cy.contains('h2', 'Capabilities').should('be.visible');
    cy.get(`[data-test="${DataTestIDs.OverviewPage.AdvancedSection}"]`).should('be.visible');
    cy.contains('h2', 'Advanced analytics').should('be.visible');
    summaryCard('capabilities-ready').should('be.visible');
    summaryCard('component-health').should('be.visible');
  });

  it('shows loading indicators while capability watches are still pending', () => {
    mountOverviewPageContent({ csvResults: [[], false, null] });

    cy.get('[aria-label="Loading stack summary data"]').should('be.visible');
    cy.get(`[data-test="${DataTestIDs.OverviewPage.InstalledLoading}"]`).should('be.visible');
    cy.get(`[data-test="${DataTestIDs.OverviewPage.RecommendedLoading}"]`).should('be.visible');
    summaryCard('capabilities-ready').should('not.exist');
    capabilityCard('logging').should('not.exist');
  });

  it('renders a danger alert when the CSV watch fails', () => {
    mountOverviewPageContent({ csvResults: [[], true, 'Forbidden'] });

    cy.contains('Unable to determine services installation status').should('be.visible');
    cy.contains('Forbidden').should('be.visible');
  });

  it('reports degraded component health when nothing is installed', () => {
    mountOverviewPageContent();
    summaryCard('component-health')
      .should('contain.text', '0')
      .and('contain.text', 'Degraded')
      .and('not.contain.text', 'Healthy');
    summaryCard('component-health').find(statusIcon('danger')).should('exist');
  });

  it('withholds Install links for operators whose prerequisite is missing', () => {
    mountOverviewPageContent();

    capabilityCard('logging').within(() => {
      cy.contains('Cluster Observability Operator')
        .closest('li')
        .contains('a', 'Install')
        .should('exist');
      cy.contains('Loki Operator').closest('li').find('a').should('not.exist');
      cy.contains('CLO Operator').closest('li').find('a').should('not.exist');
    });
  });
});
