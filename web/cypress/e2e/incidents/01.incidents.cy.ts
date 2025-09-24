/*
The test verifies the basic functionality of the Incidents page and serves
as a verification that the Incidents View is working as expected.

Currently, it depends on an alert being present in the cluster.
In the future, mocking requests / injecting alerts should be considered.
Natural creation of the alert is done in the 00.coo_incidents_e2e.cy.ts test, 
but takes significant time.
*/

import { commonPages } from '../../views/common';
import { incidentsPage } from '../../views/incidents-page';

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

const ALERTNAME = 'Watchdog';
const NAMESPACE = 'openshift-monitoring';
const SEVERITY = 'Critical';
const ALERT_DESC = 'This is an alert meant to ensure that the entire alerting pipeline is functional. This alert is always firing, therefore it should always be firing in Alertmanager and always fire against a receiver. There are integrations with various notification mechanisms that send a notification when this alert is not firing. For example the "DeadMansSnitch" integration in PagerDuty.'
const ALERT_SUMMARY = 'An alert that should always be firing to certify that Alertmanager is working properly.'
describe('BVT: Incidents - UI', () => {
  before(() => {
    cy.beforeBlockCOO(MCP, MP);
  });


  beforeEach(() => {
    cy.log('Navigate to Observe → Incidents');
    incidentsPage.goTo();
    // Temporary workaround for testing against locally built instances.
    cy.transformMetrics();
  });

  it('1. Admin perspective - Incidents page - Toolbar and charts toggle functionality', () => {
    cy.log('1.1 Verify toolbar and toggle charts button');
    incidentsPage.elements.toolbar().should('be.visible');
    incidentsPage.elements.toggleChartsButton().should('be.visible');
    incidentsPage.elements.toggleChartsButton().click();
    
    cy.log('1.2 Verify charts are hidden after toggle');
    incidentsPage.elements.incidentsChartTitle().should('not.exist');
    incidentsPage.elements.alertsChartTitle().should('not.exist');
    incidentsPage.elements.toggleChartsButton().click();
  });

  it('2. Admin perspective - Incidents page - Days filter functionality', () => {
    cy.log('2.1 Set days filter to 3 days');
    incidentsPage.setDays('3 days');
    
    cy.log('2.2 Verify filter selection is updated');
    incidentsPage.elements.daysSelectToggle().should('contain.text', '3 days');
  });

  it('3. Admin perspective - Incidents page - Critical filter functionality', () => {
    cy.log('3.1 Clear filters and toggle Critical filter');
    incidentsPage.clearAllFilters();
    incidentsPage.toggleFilter('Critical');
    // Visibility verification of the filter chip is too complex. The functionality will be 
    // better verified in the filtering specific test.
    cy.log('3.2 Verify filter can be removed');
    incidentsPage.removeFilter('Severity', 'Critical');
  });

  it('4. Admin perspective - Incidents page - Charts and alerts empty state', () => {
    cy.mockIncidents([]);
    
    cy.log('4.1 Verify chart titles are visible');
    incidentsPage.elements.incidentsChartTitle().should('be.visible');
    incidentsPage.elements.alertsChartTitle().should('be.visible');
    
    cy.log('4.2 Verify alerts chart shows empty state');
    incidentsPage.elements.alertsChartEmptyState().should('exist');
  });

  it('5. Admin perspective - Incidents page - Traverse Incident Table', () => {
    cy.log('5.1 Traverse incident table');
    incidentsPage.clearAllFilters();

    cy.log('5.2 Verify traversing incident table works when the alert is not present');
    cy.mockIncidentFixture('incident-scenarios/1-single-incident-firing-critical-and-warning-alerts.yaml');
    incidentsPage.findIncidentWithAlert('TargetAlert').should('be.false');

    incidentsPage.clearAllFilters
    cy.log('5.3 Verify traversing incident table works when the alert is present');
    cy.mockIncidentFixture('incident-scenarios/6-multi-incident-target-alert-scenario.yaml');
    incidentsPage.findIncidentWithAlert('TargetAlert').should('be.true');    
  });
});