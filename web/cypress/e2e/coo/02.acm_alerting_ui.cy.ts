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

describe('ACM Alerting UI', () => {
  before(() => {
    cy.beforeBlockCOO(MCP, MP);
    cy.log('=== [Setup] Installing ACM operator and MultiCluster Observability ===');
    // install acm through shell script
    cy.exec('bash ./cypress/fixtures/coo/acm-install.sh', {
    env: { KUBECONFIG: Cypress.env('KUBECONFIG_PATH'), },
    failOnNonZeroExit: false,
    timeout: 600000, // long time script
    });
    // update UIPlugin with the acm related content, (OCP enabled since installed from operatorHub)
    cy.exec(`oc apply -f ./cypress/fixtures/coo/acm-uiplugin.yaml --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`);
    // add thanos-ruler-custom-rules
    cy.exec(`oc apply -f ./cypress/fixtures/coo/acm-alerrule-test.yaml --kubeconfig ${Cypress.env('KUBECONFIG_PATH')}`);
  });

  it('Admin perspective - Observe Menu', () => {
    //cy.visit('/');
    nav.sidenav.clickNavLink(['Observe', 'Alerting']);
    commonPages.titleShouldHaveText('Alerting');
    
    // TO DO:
    // Fleet Management => local-cluster => Observe => Alerting
    
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