import { StackSummary } from '@/features/overview/components/summary/StackSummary';
import {
  CapabilityStatus,
  ObservabilityCapability,
  RequirementStatus,
} from '@/features/overview/types/types';
import { DataTestIDs } from '@/shared/constants/data-test';

import { buildCapability, buildConfig, buildOperator, cooCSV, statusIcon } from './fixtures';

const summaryCard = (cardId: string) =>
  cy.get(`[data-test="${DataTestIDs.OverviewPage.SummaryCard}-${cardId}"]`);

const mountSummary = (capabilities: ObservabilityCapability[], loaded = true) => {
  cy.mount(<StackSummary observabilityCapabilities={capabilities} loaded={loaded} />);
};

// One Ready capability (2 healthy requirements) and one Available capability (0 healthy).
const mixedCapabilities: ObservabilityCapability[] = [
  buildCapability(),
  buildCapability({
    id: 'logging',
    title: 'Logging',
    status: CapabilityStatus.Available,
    requiredOperators: [buildOperator({ status: RequirementStatus.Missing, csv: undefined })],
    requiredConfigs: [buildConfig({ status: RequirementStatus.Missing })],
  }),
];

describe('StackSummary', () => {
  it('renders the section heading', () => {
    mountSummary(mixedCapabilities);

    cy.get(`[data-test="${DataTestIDs.OverviewPage.SummarySection}"]`).should('be.visible');
    cy.contains('h2', 'Stack summary').should('be.visible');
  });

  it('shows a spinner and no cards until the capabilities have loaded', () => {
    mountSummary(mixedCapabilities, false);

    cy.get('[aria-label="Loading stack summary data"]').should('be.visible');
    summaryCard('capabilities-ready').should('not.exist');
    summaryCard('component-health').should('not.exist');
  });

  it('counts ready capabilities out of the total', () => {
    mountSummary(mixedCapabilities);

    summaryCard('capabilities-ready')
      .should('be.visible')
      .and('contain.text', 'Capabilities ready')
      .and('contain.text', '1/2')
      .and('contain.text', 'Ready');
  });

  it('reports 0 ready when nothing is configured', () => {
    mountSummary([mixedCapabilities[1]]);

    summaryCard('capabilities-ready').should('contain.text', '0/1');
  });

  it('counts healthy capabilities across the catalog', () => {
    mountSummary(mixedCapabilities);

    summaryCard('component-health')
      .should('be.visible')
      .and('contain.text', 'Component health')
      .and('contain.text', '1')
      .and('contain.text', 'Healthy');
    summaryCard('component-health').find(statusIcon('success')).should('exist');
  });

  it('counts each degraded operator once when shared across capabilities', () => {
    const degradedOperator = buildOperator({
      status: RequirementStatus.Degraded,
      csv: { ...cooCSV, metadata: { ...cooCSV.metadata, uid: 'shared-degraded-operator-uid' } },
    });

    mountSummary([
      buildCapability({
        id: 'monitoring',
        requiredOperators: [degradedOperator],
        requiredConfigs: [buildConfig({ status: RequirementStatus.Success })],
      }),
      buildCapability({
        id: 'logging',
        title: 'Logging',
        requiredOperators: [{ ...degradedOperator }],
        requiredConfigs: [buildConfig({ status: RequirementStatus.Success })],
      }),
    ]);

    summaryCard('component-health')
      .should('contain.text', '1')
      .and('contain.text', 'Degraded')
      .and('not.contain.text', 'Healthy');
    summaryCard('component-health').find(statusIcon('danger')).should('exist');
  });

  it('switches to a degraded count when any requirement is degraded', () => {
    mountSummary([
      buildCapability({
        status: CapabilityStatus.Partial,
        requiredOperators: [buildOperator({ status: RequirementStatus.Degraded })],
        requiredConfigs: [buildConfig({ status: RequirementStatus.Success })],
      }),
    ]);

    summaryCard('component-health')
      .should('contain.text', '1')
      .and('contain.text', 'Degraded')
      .and('not.contain.text', 'Healthy');
    summaryCard('component-health').find(statusIcon('danger')).should('exist');
  });

  it('reports degraded component health when no requirements are healthy', () => {
    mountSummary([mixedCapabilities[1]]);

    summaryCard('component-health')
      .should('contain.text', '0')
      .and('contain.text', 'Degraded')
      .and('not.contain.text', 'Healthy');
    summaryCard('component-health').find(statusIcon('danger')).should('exist');
  });

  it('renders both cards with an empty capability list', () => {
    mountSummary([]);

    summaryCard('capabilities-ready').should('contain.text', '0/0');
    summaryCard('component-health')
      .should('contain.text', '0')
      .and('contain.text', 'Degraded')
      .and('not.contain.text', 'Healthy');
    summaryCard('component-health').find(statusIcon('danger')).should('exist');
  });
});
