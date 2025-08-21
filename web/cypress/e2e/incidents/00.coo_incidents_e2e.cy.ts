/*
The test verifies the whole lifecycle of the Incident feature, without any external dependencies.
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

describe('Incidents', () => {
  before(() => {
    cy.afterBlockCOO(MCP, MP); // Following cypher best practices, the cleanup is done before the test block
    cy.beforeBlockCOO(MCP, MP);
    cy.createKubePodCrashLoopingAlert();
  });

  after(() => {
    cy.afterBlockCOO(MCP, MP); // For compatibility with other tests
  });

  it('Admin Perspective - Incidents tab renders and responds to interactions', () => {
    cy.log('1.1 Navigate to Alerting → Incidents');
    incidentsPage.goTo();
    commonPages.titleShouldHaveText('Incidents');
  });

  it('Incident with KubePodCrashLooping alert is present in the alerts table', () => {
    incidentsPage.goTo();
    commonPages.titleShouldHaveText('Incidents');
    incidentsPage.clearAllFilters();
    
    const intervalMs = 60_000;
    const maxMinutes = 20; 

    cy.waitUntil(() => incidentsPage.findIncidentWithAlert('KubePodCrashLooping'), { 
      interval: intervalMs, 
      timeout: maxMinutes * intervalMs 
    });

    incidentsPage
      .elements
      .alertsTable()
      .contains('KubePodCrashLooping')
      .should('exist');
  });
});