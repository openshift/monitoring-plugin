import { DataTestIDs } from '@/shared/constants/data-test';

import { commonPages } from './common';
import { nav } from './nav';

// Keep in sync with OverviewPage
const OVERVIEW_INFO_ALERT_DISMISSED = 'monitoring/overview/info-alert-dismissed';
export const OVERVIEW_PAGE_TITLE = 'Observability services';

export type OverviewSummaryCardId = 'capabilities-ready' | 'component-health';

/** Capabilities rendered in the "Capabilities" section. */
export type OverviewCapabilityId =
  | 'monitoring'
  | 'logging'
  | 'distributed-tracing'
  | 'dashboards'
  | 'network-observability';

/** Capabilities rendered in the "Advanced analytics" section. */
export type OverviewAdvancedCapabilityId = 'signal-correlation' | 'incident-detection';

export type OverviewAnyCapabilityId = OverviewCapabilityId | OverviewAdvancedCapabilityId;

export const CAPABILITY_IDS: OverviewCapabilityId[] = [
  'monitoring',
  'logging',
  'distributed-tracing',
  'dashboards',
  'network-observability',
];

export const ADVANCED_CAPABILITY_IDS: OverviewAdvancedCapabilityId[] = [
  'signal-correlation',
  'incident-detection',
];

export const CAPABILITY_CARD_PREFIX = DataTestIDs.OverviewPage.CapabilityCard;

/** The status label shown in the header of every capability card. */
const CAPABILITY_STATUS_LABELS = ['Ready', 'Partial setup', 'Available'];

export const overview = {
  elements: {
    infoAlert: () => cy.byTestID(DataTestIDs.OverviewPage.InfoAlert),
    infoAlertClose: () => cy.byTestID(DataTestIDs.OverviewPage.InfoAlertClose),
    summarySection: () => cy.byTestID(DataTestIDs.OverviewPage.SummarySection),
    summaryCard: (cardId: OverviewSummaryCardId) =>
      cy.byTestID(`${DataTestIDs.OverviewPage.SummaryCard}-${cardId}`),
    capabilitiesSection: () => cy.byTestID(DataTestIDs.OverviewPage.CapabilitiesSection),
    advancedSection: () => cy.byTestID(DataTestIDs.OverviewPage.AdvancedSection),
    capabilityCard: (capabilityId: OverviewAnyCapabilityId) =>
      cy.byTestID(`${CAPABILITY_CARD_PREFIX}-${capabilityId}`),
    capabilityCards: () => cy.get(`[data-test^="${CAPABILITY_CARD_PREFIX}-"]`),
    capabilitiesSectionCards: () =>
      overview.elements.capabilitiesSection().find(`[data-test^="${CAPABILITY_CARD_PREFIX}-"]`),
    advancedSectionCards: () =>
      overview.elements.advancedSection().find(`[data-test^="${CAPABILITY_CARD_PREFIX}-"]`),
  },

  goTo: () => {
    cy.log('overview.goTo');
    nav.sidenav.clickNavLink(['Observe', OVERVIEW_PAGE_TITLE]);
    commonPages.titleShouldHaveText(OVERVIEW_PAGE_TITLE);
  },

  clearInfoAlertDismissed: () => {
    cy.log('overview.clearInfoAlertDismissed');
    cy.window().then((win) => {
      win.localStorage.removeItem(OVERVIEW_INFO_ALERT_DISMISSED);
    });
  },

  /**
   * Waits for every section to finish watching cluster resources. The summary cards
   * only mount once the watches resolve, so their presence is the readiness signal.
   */
  shouldBeLoaded: () => {
    cy.log('overview.shouldBeLoaded');
    commonPages.titleShouldHaveText(OVERVIEW_PAGE_TITLE);
    overview.elements.summarySection().should('be.visible');
    cy.contains('h2', 'Stack summary').should('be.visible');
    cy.waitUntil(
      () =>
        Cypress.$(`[data-test="${DataTestIDs.OverviewPage.InstalledLoading}"]`).length === 0 &&
        Cypress.$(`[data-test="${DataTestIDs.OverviewPage.RecommendedLoading}"]`).length === 0 &&
        Cypress.$(`[data-test="${DataTestIDs.OverviewPage.SummaryCard}-capabilities-ready"]`)
          .length > 0,
      {
        timeout: 60000,
        interval: 500,
        errorMsg: 'Observability services page should finish loading within 60 seconds',
      },
    );
  },

  dismissInfoAlert: () => {
    cy.log('overview.dismissInfoAlert');
    overview.elements.infoAlert().should('be.visible');
    overview.elements.infoAlertClose().should('be.visible').click();
    overview.elements.infoAlert().should('not.exist');
  },

  /** Asserts "<ready>/<total>" against the number of capability cards actually rendered. */
  assertCapabilitiesReadyCard: () => {
    cy.log('overview.assertCapabilitiesReadyCard');
    const total = CAPABILITY_IDS.length + ADVANCED_CAPABILITY_IDS.length;
    const readyCountsPattern = Array.from({ length: total + 1 }, (_, ready) => ready)
      .sort((a, b) => b - a)
      .join('|');
    overview.elements
      .summaryCard('capabilities-ready')
      .should('be.visible')
      .and('contain.text', 'Capabilities ready')
      .and('contain.text', 'Ready')
      .invoke('text')
      .should('match', new RegExp(`(?<!\\d)(?:${readyCountsPattern})/${total}(?!\\d)`));
  },

  assertComponentHealthCard: () => {
    cy.log('overview.assertComponentHealthCard');
    overview.elements
      .summaryCard('component-health')
      .should('be.visible')
      .and('contain.text', 'Component health')
      .invoke('text')
      .should('match', /\d+/)
      .and('match', /Degraded|Healthy/);
  },

  /**
   * Every card carries exactly one status label and a working "Learn more" link.
   * Status depends on what is installed on the cluster, so only the shape is asserted.
   */
  assertCapabilityCard: (capabilityId: OverviewAnyCapabilityId, title: string) => {
    cy.log(`overview.assertCapabilityCard - ${capabilityId}`);
    overview.elements
      .capabilityCard(capabilityId)
      .should('be.visible')
      .and('contain.text', title)
      .within(() => {
        cy.get('.pf-v6-c-label')
          .should('have.length', 1)
          .invoke('text')
          .then((labelText) => {
            expect(CAPABILITY_STATUS_LABELS, `status label of '${capabilityId}'`).to.include(
              labelText.trim(),
            );
          });
        cy.contains('a', 'Learn more').should('have.attr', 'href').and('include', 'http');
      });
  },

  /** A fully configured capability offers no remediation links. */
  assertNoActionLinks: (capabilityId: OverviewAnyCapabilityId) => {
    cy.log(`overview.assertNoActionLinks - ${capabilityId}`);
    overview.elements.capabilityCard(capabilityId).within(() => {
      ['Install', 'Configure', 'Enable'].forEach((action) => {
        cy.contains('a', action).should('not.exist');
      });
    });
  },

  /** Clicks the first "Install" link on the page, if the cluster state produced one. */
  clickFirstInstallLink: (): Cypress.Chainable<boolean> =>
    cy.get('body').then(($body) => {
      const installLinks = $body
        .find('a')
        .filter((_, el) => (el.textContent || '').trim() === 'Install');
      if (!installLinks.length) {
        cy.log('Skipping install navigation - every required operator is installed');
        return cy.wrap(false);
      }
      return cy
        .wrap(installLinks.first())
        .click()
        .then(() => true);
    }),

  clickMonitoringFeatureEnableLink: (): Cypress.Chainable<boolean> =>
    cy.get('body').then(($body) => {
      const enableLinks = $body.find('a').filter((_, el) => {
        const text = (el.textContent || '').trim();
        const href = el.getAttribute('href') || '';
        return text === 'Enable' && href.endsWith('/UIPlugin/monitoring/yaml');
      });
      if (!enableLinks.length) {
        cy.log('Skipping enable navigation - every required feature is enabled');
        return cy.wrap(false);
      }
      return cy
        .wrap(enableLinks.first())
        .click()
        .then(() => true);
    }),
};
