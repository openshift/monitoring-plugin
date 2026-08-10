import { commonPages } from '../../views/common';
import { mcpOverviewPage, McpOverviewSummaryCardId } from '../../views/mcp-overview-page';

export interface PerspectiveConfig {
  name: string;
  beforeEach?: () => void;
}

const ALL_CARDS: McpOverviewSummaryCardId[] = [
  'dashboards',
  'alerting-rules',
  'firing-alerts',
  'targets',
  'metrics',
];

export function runAllMcpOverviewTests(perspective: PerspectiveConfig) {
  testMcpOverview(perspective);
}

export function testMcpOverview(perspective: PerspectiveConfig) {
  it(`${perspective.name} perspective - Observability services page`, () => {
    cy.log('1.1 Navigate to Observability services and verify page chrome');
    mcpOverviewPage.clearInfoAlertDismissed();
    mcpOverviewPage.goTo();
    mcpOverviewPage.shouldBeLoaded();
    cy.contains(
      'Manage and monitor your metrics, logs, and traces from a single, unified hub.',
    ).should('be.visible');

    cy.log('1.2 Verify info alert is visible and dismissible with localStorage persistence');
    mcpOverviewPage.elements.infoAlert().should('be.visible');
    mcpOverviewPage.elements.infoAlert().should('contain.text', 'Cluster-wide observability scope');
    mcpOverviewPage.dismissInfoAlert();
    cy.window()
      .its('localStorage')
      .invoke('getItem', 'monitoring/mcp-overview/info-alert-dismissed')
      .should('eq', 'true');

    cy.log('1.3 Reload and verify dismissed alert stays hidden');
    mcpOverviewPage.goTo();
    mcpOverviewPage.elements.infoAlert().should('not.exist');
    mcpOverviewPage.elements.summarySection().should('be.visible');

    cy.log('1.4 Verify all summary cards finish loading');
    ALL_CARDS.forEach((cardId) => {
      mcpOverviewPage.assertSummaryCardReady(cardId);
    });
    mcpOverviewPage.elements.summaryCard('alerting-rules').should('contain.text', 'Alerting rules');
    mcpOverviewPage.elements.summaryCard('firing-alerts').should('contain.text', 'Firing alerts');
    mcpOverviewPage.elements.summaryCard('targets').should('contain.text', 'Targets');
    mcpOverviewPage.elements.summaryCard('metrics').should('contain.text', 'Metrics');
    mcpOverviewPage.elements.summaryCard('dashboards').should('contain.text', 'Perses Dashboards');

    cy.log('1.5 Click Firing alerts count and verify Alerting page');
    mcpOverviewPage.goTo();
    mcpOverviewPage.clickSummaryCardCount('firing-alerts');
    commonPages.titleShouldHaveText('Alerting');

    cy.log('1.6 Click Alerting rules count and verify Alerting page');
    mcpOverviewPage.goTo();
    mcpOverviewPage.clickSummaryCardCount('alerting-rules');
    commonPages.titleShouldHaveText('Alerting');

    cy.log('1.7 Click Targets count and verify Metrics targets page');
    mcpOverviewPage.goTo();
    mcpOverviewPage.clickSummaryCardCount('targets');
    commonPages.titleShouldHaveText('Metrics targets');

    cy.log('1.8 Click Metrics count and verify Metrics page');
    mcpOverviewPage.goTo();
    mcpOverviewPage.clickSummaryCardCount('metrics');
    commonPages.titleShouldHaveText('Metrics');

    cy.log(
      '1.9 Click Perses Dashboards count when available (may be error-only without COO/Perses)',
    );
    mcpOverviewPage.goTo();
    mcpOverviewPage.clickSummaryCardCountIfAvailable('dashboards').then((navigated) => {
      if (navigated) {
        cy.url().should('include', '/monitoring/v2/dashboards');
      }
    });

    cy.log('Verified: Observability services page load, alert dismiss, and card navigation');
  });
}
