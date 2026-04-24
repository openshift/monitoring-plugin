/*
Regression tests for UI issues that manifest under stress conditions (high alert/incident counts).

Section 5.1: Alerts chart padding with 100+ alerts (OU-1123)
  - Height calculation should not produce excessive padding pushing bars below the visible area.
  - A smaller gap with ~500+ alerts is accepted as a known limitation.

Note: Stress fixtures use a short timeline (1h) to avoid a known Math.max/min call stack
overflow when many alerts share a group_id with long timelines. The padding behavior under
test is independent of timeline length. See WIP.stress-test-1000-alerts.cy.ts to reproduce
the overflow with the original 5d timeline.
*/

import { incidentsPage } from '../../../views/incidents-page';

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

const MAX_GAP_STANDARD = 250;
const MAX_GAP_RELAXED = 500;

describe('Regression: Stress Testing UI', { tags: ['@incidents'] }, () => {
  before(() => {
    cy.beforeBlockCOO(MCP, MP, { dashboards: false, troubleshootingPanel: false });
    incidentsPage.warmUpForPlugin();
  });

  it('5.1 No excessive padding between chart top and alert bars for 100, 200, and 500 alerts', () => {
    const verifyAlertBarPadding = (
      fixtureFile: string,
      incidentId: string,
      maxGap: number,
      label: string,
    ) => {
      cy.mockIncidentFixture(`incident-scenarios/${fixtureFile}`);
      incidentsPage.clearAllFilters();
      incidentsPage.setDays('1 day');

      incidentsPage.elements.incidentsChartBarsGroups().should('have.length', 1);
      incidentsPage.selectIncidentById(incidentId);

      incidentsPage.elements.alertsChartCard().should('be.visible');
      incidentsPage.elements.alertsChartBarsVisiblePaths().should('have.length.greaterThan', 0);

      incidentsPage.elements.alertsChartContainer().first().scrollIntoView();
      incidentsPage.elements
        .alertsChartContainer()
        .first()
        .then(($container) => {
          const containerTop = $container[0].getBoundingClientRect().top;
          incidentsPage.getAlertBarRect(0).then((barRect) => {
            const gap = barRect.top - containerTop;
            cy.log(`${label}: Gap between container top and first alert bar = ${gap}px`);
            expect(gap, `${label}: first alert bar should start near chart top`).to.be.lessThan(
              maxGap,
            );
            expect(gap, `${label}: gap should be non-negative`).to.be.at.least(0);
          });
        });
    };

    cy.log('5.1.1 Verify no excessive padding with 100 alerts');
    verifyAlertBarPadding(
      '15-stress-test-100-alerts.yaml',
      'cluster-wide-failure-100-alerts',
      MAX_GAP_STANDARD,
      '100 alerts',
    );

    cy.log('5.1.2 Verify no excessive padding with 200 alerts');
    verifyAlertBarPadding(
      '16-stress-test-200-alerts.yaml',
      'cluster-wide-failure-200-alerts',
      MAX_GAP_STANDARD,
      '200 alerts',
    );

    cy.log('5.1.3 Verify accepted limitation with 500 alerts (relaxed threshold)');
    verifyAlertBarPadding(
      '17-stress-test-500-alerts.yaml',
      'cluster-wide-failure-500-alerts',
      MAX_GAP_RELAXED,
      '500 alerts',
    );

    cy.log('Verified: Alert bars have no excessive padding for 100, 200, and 500 alerts');
  });
});
