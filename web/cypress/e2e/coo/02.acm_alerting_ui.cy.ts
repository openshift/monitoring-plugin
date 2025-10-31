// 02.acm_alerting_ui.cy.ts
// E2E test for validating ACM Alerting UI integration with Cluster Observability Operator (COO)
import '../../support/commands/auth-commands';
import { nav } from '../../views/nav';
import { acmAlertingPage } from '../../views/acm-alerting-page';

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

describe('ACM Alerting UI', () => {
  before(() => {
    cy.beforeBlockACM(MCP, MP);
  });

  it('Navigate to Fleet Management > local-cluster > Observe > Alerting', () => {
    // wait for console page loading completed
    cy.visit('/');
    cy.get('body', { timeout: 60000 }).should('contain.text', 'Administrator');
    // switch to Fleet Management page
    cy.switchPerspective('Fleet Management');
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
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    // Wait for alert tab content to become visible
    cy.get('section#alerts-tab-content', { timeout: 60000 })
      .should('be.visible');
    // confirm Alerting page loading completed
    acmAlertingPage.shouldBeLoaded();
    // check three test alerts exist
    expectedAlerts.forEach((alert) => {
      cy.contains('a[data-test-id="alert-resource-link"]', alert, { timeout: 60000 })
        .should('be.visible');
    });
    cy.log('Verified all expected alerts are visible on the Alerting page');
    cy.log('ACM Alerting UI test completed successfully');
  });
});
