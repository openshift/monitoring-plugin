/*
The test verifies the basic functionality of the Incidents page and serves
as a verification that the Incidents View is working as expected.

All tests use mocked data. Tests 1-3 use a default fixture (incident content
is irrelevant for toolbar/filter verification). Tests 4-5 switch mocks
mid-test for empty state and traversal scenarios.
*/

import { incidentsPage } from '../../views/incidents-page';

const MCP = {
  namespace: Cypress.env('COO_NAMESPACE'),
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

describe('BVT: Incidents - UI', { tags: ['@smoke', '@incidents'] }, () => {
  before(() => {
    cy.beforeBlockCOO(MCP, MP, { dashboards: false, troubleshootingPanel: false });
    incidentsPage.warmUpForPlugin();
    cy.mockIncidentFixture(
      'incident-scenarios/1-single-incident-firing-critical-and-warning-alerts.yaml',
    );
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
    incidentsPage.goTo();

    cy.log('5.1 Traverse incident table');
    cy.mockIncidents([]);
    incidentsPage.findIncidentWithAlert('TargetAlert').should('be.false');

    cy.log('5.2 Verify traversing incident table works when the alert is not present');
    cy.mockIncidentFixture(
      'incident-scenarios/1-single-incident-firing-critical-and-warning-alerts.yaml',
    );
    incidentsPage.findIncidentWithAlert('TargetAlert').should('be.false');

    cy.log('5.3 Verify traversing incident table works when the alert is present');
    cy.mockIncidentFixture('incident-scenarios/6-multi-incident-target-alert-scenario.yaml');
    incidentsPage.clearAllFilters();
    incidentsPage.findIncidentWithAlert('TargetAlert').should('be.true');
  });

  it('6. Admin perspective - Incidents page - Bar click selection walkthrough', () => {
    cy.log('6.1 Load multi-incident fixture and verify chart bars are clickable');
    cy.mockIncidentFixture(
      'incident-scenarios/1-single-incident-firing-critical-and-warning-alerts.yaml',
    );
    incidentsPage.goTo();
    incidentsPage.clearAllFilters();
    incidentsPage.setDays('7 days');
    incidentsPage.elements.incidentsChartContainer().should('be.visible');

    cy.log('6.2 Select incident bar and verify table appears with expected alerts');
    incidentsPage.selectIncidentByBarIndex(0);
    incidentsPage.elements.incidentsTable().should('be.visible');
    incidentsPage.elements.incidentsTableComponentCell(0).should('contain.text', 'monitoring');
    incidentsPage.expandRow(0);
    incidentsPage.elements.incidentsDetailsTable().should('be.visible');
    incidentsPage.elements.incidentsDetailsAlertRuleCell(0).should('be.visible');
    incidentsPage.elements
      .incidentsDetailsTable()
      .should('contain.text', 'AlertmanagerReceiversNotConfigured');
    incidentsPage.elements
      .incidentsDetailsTable()
      .should('contain.text', 'KubeDeploymentReplicasMismatch');
    incidentsPage.elements.incidentsDetailsTable().should('contain.text', 'KubePodCrashLooping');

    cy.log('6.3 Deselect incident bar and verify table disappears');
    incidentsPage.deselectIncidentByBar(0);
    incidentsPage.elements.incidentsTable().should('not.exist');

    cy.log('6.4 Select by incident ID and verify table appears with expected alerts');
    incidentsPage.selectIncidentById('monitoring-critical-001');
    incidentsPage.elements.incidentsTable().should('be.visible');
    incidentsPage.expandRow(0);
    incidentsPage.elements
      .incidentsDetailsTable()
      .should('contain.text', 'AlertmanagerReceiversNotConfigured');
    incidentsPage.elements
      .incidentsDetailsTable()
      .should('contain.text', 'KubeDeploymentReplicasMismatch');
    incidentsPage.elements.incidentsDetailsTable().should('contain.text', 'KubePodCrashLooping');

    cy.log('6.5 Deselect by incident ID and verify table disappears');
    incidentsPage.deselectIncidentById('monitoring-critical-001');
    incidentsPage.elements.incidentsTable().should('not.exist');
  });
});
