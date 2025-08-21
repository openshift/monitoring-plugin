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
describe('Incidents', () => {
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

  it('renders toolbar and toggle charts button', () => {
    incidentsPage.elements.toolbar().should('be.visible');
    incidentsPage.elements.toggleChartsButton().should('be.visible');
  });

  it('sets days filter to 3 days and updates the URL', () => {
    incidentsPage.setDays('3 days');
    incidentsPage.elements.daysSelect().should('contain.text', '3 days');
    cy.url().should('match', /[?&]days=3\+days/);
  });

  it('toggles Critical filter and updates the URL', () => {
    incidentsPage.clearAllFilters();
    incidentsPage.toggleFilter('Critical');
    cy.url().should('match', /incidentFilters=.*Critical/);
  });

  it('shows charts and alerts empty state initially', () => {
    incidentsPage.elements.incidentsChartTitle().should('be.visible');
    incidentsPage.elements.alertsChartTitle().should('be.visible');
    incidentsPage.elements.alertsChartEmptyState().should('exist');
  });

  it('selecting an incident via chart shows alerts and adds groupId to URL', () => {
    incidentsPage.clearAllFilters();
    incidentsPage.selectIncidentByBarIndex(0);
    cy.url().should('match', /[?&]groupId=/);
    incidentsPage.elements.alertsChartSvg().find('path').should('exist');
  });

  it('shows alerts table and allows expanding a row', () => {
    incidentsPage.elements.alertsTable().should('exist');
    incidentsPage.expandRow(0);
  });
});