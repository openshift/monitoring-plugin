
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

const ALERTNAME = 'Watchdog';
const NAMESPACE = 'openshift-monitoring';
const SEVERITY = 'Critical';
const ALERT_DESC = 'This is an alert meant to ensure that the entire alerting pipeline is functional. This alert is always firing, therefore it should always be firing in Alertmanager and always fire against a receiver. There are integrations with various notification mechanisms that send a notification when this alert is not firing. For example the "DeadMansSnitch" integration in PagerDuty.'
const ALERT_SUMMARY = 'An alert that should always be firing to certify that Alertmanager is working properly.'
describe('Incidents', () => {
  before(() => {
    cy.beforeBlockCOO(MCP, MP);
    // TODO: Inject alerts into the database so the behavior is deterministic
  });

  after(() => {
    cy.afterBlockCOO(MCP, MP);
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
    cy.pause();
    incidentsPage.selectIncidentByBarIndex(0);
    cy.pause();
    cy.url().should('match', /[?&]groupId=/);
    cy.pause();
    incidentsPage.elements.alertsChartSvg().find('path').should('exist');
    cy.pause();
  });

  it('shows alerts table and allows expanding a row', () => {
    cy.pause();
    incidentsPage.elements.alertsTable().should('exist');
    incidentsPage.expandRow(0);
    cy.pause();
  });
});