/*
The test verifies the whole lifecycle of the Incident feature, without any external dependencies.
The run time can be 15 - 20 minutes. (Waiting untill the incident detection captures the new alert)
*/
import { commonPages } from '../../views/common';
import { incidentsPage } from '../../views/incidents-page';

// Set constants for the operators that need to be installed for tests.
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

describe('BVT: Incidents - e2e', () => {
  let currentAlertName: string;

  before(() => {
    cy.afterBlockCOO(MCP, MP); // Following cypher best practices, the cleanup is done before the test block
    cy.beforeBlockCOO(MCP, MP);
    
    cy.cleanupIncidentPrometheusRules(); 

    // Create the alert and capture the random name
    cy.createKubePodCrashLoopingAlert().then((alertName) => {
      currentAlertName = alertName;
      cy.log(`Test will look for alert: ${currentAlertName}`);
    });
  });

  after(() => {
    cy.afterBlockCOO(MCP, MP); // For compatibility with other tests
  });

  it('1. Admin perspective - Incidents page - Incident with custom alert lifecycle', () => {
    cy.log('1.1 Navigate to Incidents page and clear filters');
    incidentsPage.goTo();
    commonPages.titleShouldHaveText('Incidents');
    incidentsPage.clearAllFilters();
    
    const intervalMs = 60_000;
    const maxMinutes = 30; 

    cy.log('1.2 Wait for incident with custom alert to appear');
    cy.waitUntilWithCustomTimeout(
      () => incidentsPage.findIncidentWithAlert(currentAlertName),
      { 
        interval: intervalMs, 
        timeout: maxMinutes * intervalMs,
        timeoutMessage: `Custom timeout: Incident with alert "${currentAlertName}" did not appear within ${maxMinutes} minutes.`
      }
    );

    cy.log('1.3 Verify custom alert appears in alerts table');
    incidentsPage
      .elements
      .alertsTable()
      .contains(currentAlertName)
      .should('exist');
  });
});