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
    cy.afterBlockCOO(MCP, MP); // Following cypher best practices, the cleanup is done before the test block
    cy.beforeBlockCOO(MCP, MP);
  });

  after(() => {
    cy.afterBlockCOO(MCP, MP); // For compatibility with other tests
  });


  beforeEach(() => {
    cy.log('Navigate to Observe → Incidents');
    incidentsPage.goTo();
    commonPages.titleShouldHaveText('Incidents');
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
    
    cy.log('2.2 Verify filter and URL update');
    incidentsPage.elements.daysSelect().should('contain.text', '3 days');
    cy.url().should('match', /[?&]days=3\+days/);
  });

  it('3. Admin perspective - Incidents page - Critical filter functionality', () => {
    cy.log('3.1 Clear filters and toggle Critical filter');
    incidentsPage.clearAllFilters();
    incidentsPage.toggleFilter('Critical');
    
    cy.log('3.2 Verify URL is updated with incident filters');
    cy.url().should('match', /incidentFilters=.*Critical/);
  });

  it('4. Admin perspective - Incidents page - Charts and alerts empty state', () => {
    cy.mockIncidents([]);
    
    cy.log('4.1 Verify chart titles are visible');
    incidentsPage.elements.incidentsChartTitle().should('be.visible');
    incidentsPage.elements.alertsChartTitle().should('be.visible');
    
    cy.log('4.2 Verify alerts chart shows empty state');
    incidentsPage.elements.alertsChartEmptyState().should('exist');
  });

  it('5. Admin perspective - Incidents page - Incident selection and alert details', () => {
    cy.mockIncidentFixture('incident-scenarios/1-single-incident-firing-critical-and-warning-alerts.yaml');

    cy.log('5.1 Select incident and verify alert details');
    incidentsPage.clearAllFilters();
    incidentsPage.selectIncidentByBarIndex(0);
    cy.url().should('match', /[?&]groupId=/);
    incidentsPage.elements.alertsChartSvg().find('path').should('exist');

    cy.log('5.2 Verify alerts table and expand first row');
    incidentsPage.elements.alertsTable().should('exist');
    incidentsPage.expandRow(0);
  });
});