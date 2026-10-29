import {
  ADVANCED_CAPABILITY_IDS,
  CAPABILITY_CARD_PREFIX,
  CAPABILITY_IDS,
  overview,
  OVERVIEW_PAGE_TITLE,
} from '../../views/overview';

export interface PerspectiveConfig {
  name: string;
  beforeEach?: () => void;
}

const CAPABILITY_TITLES: Record<string, string> = {
  monitoring: 'Monitoring',
  logging: 'Logging',
  'distributed-tracing': 'Distributed tracing',
  dashboards: 'Dashboards',
  'network-observability': 'Network observability',
  'signal-correlation': 'Signal correlation',
  'incident-detection': 'Incident detection',
};

export function runAllOverviewTests(perspective: PerspectiveConfig) {
  testOverviewPageChrome(perspective);
  testOverviewInfoAlert(perspective);
  testOverviewStackSummary(perspective);
  testOverviewCapabilityCatalog(perspective);
}

export function testOverviewPageChrome(perspective: PerspectiveConfig) {
  it(`${perspective.name} perspective - Observability services page chrome`, () => {
    cy.log('1.1 Navigate to Observability services and verify the page header');
    overview.goTo();
    overview.shouldBeLoaded();
    cy.contains(
      'Manage observability capabilities and access cluster tools for metrics, logs, and traces.',
    ).should('be.visible');

    cy.log('1.2 Verify all three sections are present');
    overview.elements.summarySection().should('be.visible');
    overview.elements.capabilitiesSection().should('be.visible');
    overview.elements.advancedSection().should('be.visible');
    cy.contains('h2', 'Stack summary').should('be.visible');
    cy.contains('h2', 'Capabilities').should('be.visible');
    cy.contains('h2', 'Advanced analytics').should('be.visible');

    cy.log(`Verified: ${OVERVIEW_PAGE_TITLE} page loads with summary, capabilities, and advanced`);
  });
}

export function testOverviewInfoAlert(perspective: PerspectiveConfig) {
  it(`${perspective.name} perspective - Observability services info alert`, () => {
    cy.log('2.1 Verify the cluster-wide scope alert is shown on a first visit');
    overview.clearInfoAlertDismissed();
    overview.goTo();
    overview.elements
      .infoAlert()
      .should('be.visible')
      .and('contain.text', 'Cluster-wide scope')
      .and(
        'contain.text',
        'Status labels show configuration readiness across the cluster, not live telemetry severity.',
      );

    cy.log('2.2 Dismiss the alert and verify the choice is persisted to localStorage');
    overview.dismissInfoAlert();
    cy.window()
      .its('localStorage')
      .invoke('getItem', 'monitoring/overview/info-alert-dismissed')
      .should('eq', 'true');

    cy.log('2.3 Navigate back and verify the dismissed alert stays hidden');
    overview.goTo();
    overview.shouldBeLoaded();
    overview.elements.infoAlert().should('not.exist');

    cy.log('2.4 Clear the flag and verify the alert returns');
    overview.clearInfoAlertDismissed();
    overview.goTo();
    overview.elements.infoAlert().should('be.visible');

    cy.log('Verified: info alert visibility, dismissal, and localStorage persistence');
  });
}

export function testOverviewStackSummary(perspective: PerspectiveConfig) {
  it(`${perspective.name} perspective - Observability services stack summary`, () => {
    cy.log('3.1 Navigate and wait for the resource watches to resolve');
    overview.goTo();
    overview.shouldBeLoaded();

    cy.log('3.2 Verify the capabilities ready card counts against the full catalog');
    overview.assertCapabilitiesReadyCard();

    cy.log('3.3 Verify the component health card reports a count and a health state');
    overview.assertComponentHealthCard();

    cy.log('Verified: stack summary cards render counts for the whole capability catalog');
  });
}

export function testOverviewCapabilityCatalog(perspective: PerspectiveConfig) {
  it(`${perspective.name} perspective - Observability services capability catalog`, () => {
    cy.log('4.1 Navigate and wait for the resource watches to resolve');
    overview.goTo();
    overview.shouldBeLoaded();

    cy.log('4.2 Verify every capability renders exactly once, in the expected section');
    CAPABILITY_IDS.forEach((capabilityId) => {
      overview.elements.capabilityCard(capabilityId).should('have.length', 1);
      overview.assertCapabilityCard(capabilityId, CAPABILITY_TITLES[capabilityId]);
    });
    ADVANCED_CAPABILITY_IDS.forEach((capabilityId) => {
      overview.elements.capabilityCard(capabilityId).should('have.length', 1);
      overview.assertCapabilityCard(capabilityId, CAPABILITY_TITLES[capabilityId]);
    });
    overview.elements.capabilitiesSectionCards().should('have.length', CAPABILITY_IDS.length);
    overview.elements.advancedSectionCards().should('have.length', ADVANCED_CAPABILITY_IDS.length);

    cy.log('4.3 Verify a Ready capability offers no remediation links');
    overview.elements.capabilityCards().each(($card) => {
      const capabilityId = ($card.attr('data-test') || '').replace(
        `${CAPABILITY_CARD_PREFIX}-`,
        '',
      );
      if ($card.find('.pf-v6-c-label').text().trim() === 'Ready') {
        overview.assertNoActionLinks(
          capabilityId as Parameters<typeof overview.assertNoActionLinks>[0],
        );
      }
    });

    cy.log('4.4 Follow an Install link into the OperatorHub catalog when one is offered');
    overview.clickFirstInstallLink().then((navigated) => {
      if (navigated) {
        cy.url().should('include', '/catalog');
      }
    });

    cy.log('4.5 Follow an Enable link to the monitoring UIPlugin YAML when one is offered');
    overview.goTo();
    overview.shouldBeLoaded();
    overview.clickMonitoringFeatureEnableLink().then((navigated) => {
      if (navigated) {
        cy.url().should('match', /UIPlugin\/monitoring\/yaml$/);
      }
    });

    cy.log('Verified: capability catalog sections, status labels, and remediation links');
  });
}
