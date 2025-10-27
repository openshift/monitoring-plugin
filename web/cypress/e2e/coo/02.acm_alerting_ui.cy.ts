// 02.acm_alerting_ui.cy.ts
// E2E test for validating ACM Alerting UI integration with Cluster Observability Operator (COO)
const MCP = {
  namespace: 'openshift-cluster-observability-operator',
  packageName: 'cluster-observability-operator',
  operatorName: 'Cluster Observability Operator',
  config: {
    kind: 'UIPlugin',
    name: 'monitoring',
  },
};
const MP = {
  namespace: 'openshift-monitoring',
  operatorName: 'Cluster Monitoring Operator',
};
const expectedAlerts = ['Watchdog', 'Watchdog-spoke', 'ClusterCPUHealth-jb'];

// ignore error message
Cypress.on('uncaught:exception', (err) => {
  const ignoreList = [
    'Unauthorized',
    "Cannot read properties of null (reading 'default')",
    'ResizeObserver loop limit exceeded',
    'Bad Gateway',
    '(intermediate value) is not a function',
  ];
  if (ignoreList.some((txt) => err.message.includes(txt))) {
    console.warn('Ignored frontend exception:', err.message);
    return false;
  }
});

describe('ACM Alerting UI', () => {
  before(() => {
    cy.beforeBlockACM(MCP, MP);
  });

  it('Navigate to Fleet Management > local-cluster > Observe > Alerting', () => {
    // wait for console page loading completed
    cy.get('body', { timeout: 60000 }).should('contain.text', 'Administrator');
    // click Fleet Management
    cy.get('[data-test-id="perspective-switcher-toggle"]', { timeout: 20000 })
      .should('be.visible')
      .click();
    // select “Fleet Management”
    cy.get('[data-test-id="perspective-switcher-menu-option"]')
      .contains('Fleet Management')
      .should('be.visible')
      .click();
    // close pop-up window
    cy.closeOnboardingModalIfPresent();
    // click “local-cluster” when visible
    cy.log('Waiting for local-cluster link to appear...');
    cy.contains('local-cluster', { timeout: 120000 })
      .should('exist')
      .should('be.visible')
      .then(($el) => {
        cy.wrap($el).click({ force: true });
      });
    // click side menu -> Observe -> Alerting
    cy.contains('Observe', { timeout: 20000 }).should('be.visible').click();
    cy.contains('Alerting', { timeout: 20000 }).should('be.visible').click();
    // Wait for alert tab content to become visible
    cy.get('section#alerts-tab-content', { timeout: 60000 })
      .should('be.visible');
    // confirm Alerting page loading completed then check three alert exist
    cy.get('body', { timeout: 60000 }).should('contain.text', 'Alerting');
    expectedAlerts.forEach((alert) => {
      cy.contains('a[data-test-id="alert-resource-link"]', alert, { timeout: 60000 })
        .should('be.visible');
    });
    cy.log('Verified all expected alerts are visible on the Alerting page');
    cy.log('ACM Alerting UI test completed successfully');
  });
});
