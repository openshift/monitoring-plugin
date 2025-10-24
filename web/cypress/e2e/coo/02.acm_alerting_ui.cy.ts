// 02.acm_alerting_ui.cy.ts
// E2E test for validating ACM Alerting UI integration with Cluster Observability Operator (COO)
import { commonPages } from '../../views/common';
import { nav } from '../../views/nav';

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
  ];
  if (ignoreList.some((txt) => err.message.includes(txt))) {
    console.warn('⚠️ Ignored frontend exception:', err.message);
    return false;
  }
});

describe('ACM Alerting UI', () => {
  before(() => {
    cy.beforeBlockCOO(MCP, MP);
    cy.log('=== [Setup] Installing ACM operator and MultiCluster Observability ===');
    // install acm through shell script
    cy.exec('bash ./cypress/fixtures/coo/acm-install.sh', {
      env: { KUBECONFIG: Cypress.env('KUBECONFIG_PATH'), },
      failOnNonZeroExit: false,
      timeout: 1200000, // long time script
    });
    // update UIPlugin with the acm related content, (OCP enabled since installed from operatorHub)
    cy.exec(`oc apply -f ./cypress/fixtures/coo/acm-uiplugin.yaml --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`);
    // add thanos-ruler-custom-rules
    cy.exec(`oc apply -f ./cypress/fixtures/coo/acm-alerrule-test.yaml --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`);
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
    cy.get('body').then(($body) => {
      const modalCloseBtn = $body.find('button[data-ouia-component-id="clustersOnboardingModal-ModalBoxCloseButton"]');
      if (modalCloseBtn.length > 0) {
        cy.wrap(modalCloseBtn)
          .should('be.visible')
          .should('not.be.disabled')
          .click({ force: true });
        cy.log('✅ Closed onboarding modal');
      } else {
        cy.log('ℹ️ No onboarding modal found');
      }
    });

    // click “local-cluster” when visible
    cy.contains('a', 'local-cluster', { timeout: 90000 })
      .should('be.visible')
      .should('not.be.disabled')
      .click({ force: true });

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

    cy.log('✅ Verified all expected alerts are visible on the Alerting page');
    cy.log('✅ ACM Alerting UI test completed successfully');
  });

  after(() => {
    cy.log('=== [Teardown] Uninstalling ACM operator and cleaning up ===');
    cy.exec('bash ./cypress/fixtures/coo/acm-uninstall.sh', {
      env: { KUBECONFIG: Cypress.env('KUBECONFIG_PATH') },
      failOnNonZeroExit: false,
      timeout: 600000,
    });
  });
});
