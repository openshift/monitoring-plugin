import { DataTestIDs } from '@/shared/constants/data-test';

import { commonPages } from './common';
import { nav } from './nav';

// Keep in sync with McpOverviewPage localStorage key
const MCP_OVERVIEW_INFO_ALERT_DISMISSED = 'monitoring/mcp-overview/info-alert-dismissed';

export type McpOverviewSummaryCardId =
  | 'dashboards'
  | 'alerting-rules'
  | 'firing-alerts'
  | 'targets'
  | 'metrics';

export const mcpOverviewPage = {
  elements: {
    infoAlert: () => cy.byTestID(DataTestIDs.McpOverviewPage.InfoAlert),
    summarySection: () => cy.byTestID(DataTestIDs.McpOverviewPage.SummarySection),
    summaryCard: (cardId: McpOverviewSummaryCardId) =>
      cy.byTestID(`${DataTestIDs.McpOverviewPage.SummaryCard}-${cardId}`),
    summaryCardCount: (cardId: McpOverviewSummaryCardId) =>
      cy.byTestID(`${DataTestIDs.McpOverviewPage.SummaryCardCount}-${cardId}`),
    summaryCardError: (cardId: McpOverviewSummaryCardId) =>
      cy.byTestID(`${DataTestIDs.McpOverviewPage.SummaryCardError}-${cardId}`),
    summaryCardLoading: (cardId: McpOverviewSummaryCardId) =>
      cy.byTestID(`${DataTestIDs.McpOverviewPage.SummaryCardLoading}-${cardId}`),
  },

  goTo: () => {
    cy.log('mcpOverviewPage.goTo');
    nav.sidenav.clickNavLink(['Observe', 'Observability services']);
    commonPages.titleShouldHaveText('Observability services');
  },

  clearInfoAlertDismissed: () => {
    cy.log('mcpOverviewPage.clearInfoAlertDismissed');
    cy.window().then((win) => {
      win.localStorage.removeItem(MCP_OVERVIEW_INFO_ALERT_DISMISSED);
    });
  },

  shouldBeLoaded: () => {
    cy.log('mcpOverviewPage.shouldBeLoaded');
    commonPages.titleShouldHaveText('Observability services');
    mcpOverviewPage.elements.summarySection().should('be.visible');
    cy.contains('Observability stack summary').should('be.visible');
  },

  dismissInfoAlert: () => {
    cy.log('mcpOverviewPage.dismissInfoAlert');
    mcpOverviewPage.elements.infoAlert().should('be.visible');
    cy.byTestID(DataTestIDs.McpOverviewPage.InfoAlertClose).should('be.visible').click();
    mcpOverviewPage.elements.infoAlert().should('not.exist');
  },

  waitForSummaryCardLoaded: (cardId: McpOverviewSummaryCardId) => {
    cy.log(`mcpOverviewPage.waitForSummaryCardLoaded - ${cardId}`);
    mcpOverviewPage.elements.summaryCard(cardId).should('be.visible');
    cy.waitUntil(
      () =>
        Cypress.$(`[data-test="${DataTestIDs.McpOverviewPage.SummaryCardLoading}-${cardId}"]`)
          .length === 0,
      {
        timeout: 60000,
        interval: 500,
        errorMsg: `Summary card "${cardId}" should finish loading within 60 seconds`,
      },
    );
  },

  /**
   * Asserts the card finished loading. Accepts either a count button or an error state
   * (Perses dashboards may error on CMO-only clusters without COO).
   */
  assertSummaryCardReady: (cardId: McpOverviewSummaryCardId) => {
    cy.log(`mcpOverviewPage.assertSummaryCardReady - ${cardId}`);
    mcpOverviewPage.waitForSummaryCardLoaded(cardId);
    mcpOverviewPage.elements.summaryCard(cardId).within(() => {
      cy.get('h3').should('be.visible');
      cy.root().then(($card) => {
        const hasCount = $card.find(
          `[data-test="${DataTestIDs.McpOverviewPage.SummaryCardCount}-${cardId}"]`,
        );
        const hasError = $card.find(
          `[data-test="${DataTestIDs.McpOverviewPage.SummaryCardError}-${cardId}"]`,
        );
        expect(
          hasCount.length + hasError.length,
          `card '${cardId}' should show count or error`,
        ).to.be.greaterThan(0);
      });
    });
  },

  clickSummaryCardCount: (cardId: McpOverviewSummaryCardId) => {
    cy.log(`mcpOverviewPage.clickSummaryCardCount - ${cardId}`);
    mcpOverviewPage.waitForSummaryCardLoaded(cardId);
    mcpOverviewPage.elements.summaryCardCount(cardId).should('be.visible').click();
  },

  /**
   * Clicks the card count when available; skips navigation when the card is in error state.
   * Returns whether navigation was attempted.
   */
  clickSummaryCardCountIfAvailable: (
    cardId: McpOverviewSummaryCardId,
  ): Cypress.Chainable<boolean> => {
    cy.log(`mcpOverviewPage.clickSummaryCardCountIfAvailable - ${cardId}`);
    mcpOverviewPage.waitForSummaryCardLoaded(cardId);
    return mcpOverviewPage.elements.summaryCard(cardId).then(($card) => {
      if (
        Cypress.$($card).find(
          `[data-test="${DataTestIDs.McpOverviewPage.SummaryCardCount}-${cardId}"]`,
        ).length > 0
      ) {
        return mcpOverviewPage.elements
          .summaryCardCount(cardId)
          .should('be.visible')
          .click()
          .then(() => true);
      }
      cy.log(`Skipping navigation for "${cardId}" - card is in error state`);
      return cy.wrap(false);
    });
  },
};
