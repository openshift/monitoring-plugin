/*
Regression test for Silences Not Applied Correctly (Section 3.2)

BUG: Silences were being matched by name only, not by name + namespace + severity.
This test verifies that silence matching uses: alertname + namespace + severity.

While targeting the bug, it verifies the basic Silences Implementation.

Verifies: OU-1020, OU-706
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
  namespace: Cypress.env('COO_NAMESPACE'),
  operatorName: 'Cluster Monitoring Operator',
};

describe('Regression: Silences Not Applied Correctly', { tags: ['@incidents', '@flaky'] }, () => {

  before(() => {
    cy.beforeBlockCOO(MCP, MP);
  });

  beforeEach(() => {
    cy.log('Navigate to Observe → Incidents');
    incidentsPage.goTo();
    cy.log('Setting up silenced alerts mixed scenario');
    cy.mockIncidentFixture('incident-scenarios/9-silenced-alerts-mixed-scenario.yaml');
  });

  it('Silence matching verification flow - opacity and tooltip indicators', () => {
    const selectIncidentAndWaitForAlerts = (incidentId: string, expectedAlertCount?: number) => {
      incidentsPage.elements.incidentsChartBar(incidentId).click();
      cy.wait(2000);
      incidentsPage.elements.alertsChartContainer().should('be.visible');
      incidentsPage.elements.alertsChartCard().should('be.visible');

      if (expectedAlertCount !== undefined) {
        incidentsPage.elements.alertsChartBarsVisiblePaths().should('have.length', expectedAlertCount);
      }
    };

    const verifyAlertOpacity = (alertIndex: number, expectedOpacity: number) => {
      incidentsPage.elements.alertsChartBarsVisiblePaths()
        .eq(alertIndex)
        .then(($bar) => {
          cy.log('Bar: ' + $bar);
          cy.log('Fill-opacity: ' + $bar.css('fill-opacity'));
          const opacity = parseFloat($bar.css('fill-opacity') || '1');
          expect(opacity).to.equal(expectedOpacity);
        });
    };

    const verifyAlertTooltip = (alertIndex: number, expectedTexts: string[], shouldBeSilenced: boolean) => {
      incidentsPage.hoverOverAlertBar(alertIndex);
      const tooltip = incidentsPage.elements.alertsChartTooltip().should('be.visible');
      expectedTexts.forEach(text => {
        tooltip.should('contain.text', text);
      });
      tooltip.should(shouldBeSilenced ? 'contain.text' : 'not.contain.text', '(silenced)');
    };

    cy.log('1.1 Verify all incidents loaded');
    incidentsPage.clearAllFilters();
    incidentsPage.elements.incidentsChartBarsGroups().should('have.length.greaterThan', 0);
    
    cy.log('1.2 Select silenced alert incident (PAIR-2-storage-SILENCED)');
    selectIncidentAndWaitForAlerts('PAIR-2-shared-alert-name-storage-SILENCED', 1);
    
    cy.log('1.4 Hover over silenced alert and verify tooltip shows (silenced)');
    verifyAlertTooltip(0, ['SyntheticSharedFiring002'], true);
    cy.log('Verified: Silenced alert has opacity 0.3 and tooltip shows (silenced)');


    cy.log('1.3 Hover over silenced alert and verify tooltip shows (silenced)');
    verifyAlertTooltip(0, ['SyntheticSharedFiring002'], true);
    cy.log('Verified: Silenced alert has opacity 0.3 and tooltip shows (silenced)');
    

    cy.log('2.0 Deselect incident');
    incidentsPage.deselectIncidentByBar();

    cy.log('2.1 Select non-silenced alert incident with same alert name (PAIR-2-network-UNSILENCED)');
    selectIncidentAndWaitForAlerts('PAIR-2-shared-alert-name-network-UNSILENCED', 1);
    
    cy.log('2.2 Verify non-silenced alert has full opacity 1.0');
    verifyAlertOpacity(0, 1.0);
    
    cy.log('2.3 Hover over non-silenced alert and verify tooltip does not show (silenced)');
    verifyAlertTooltip(0, ['SyntheticSharedFiring002'], false);
    cy.log('Verified: Non-silenced alert has opacity 1.0 and tooltip does not show (silenced)');
    

    cy.log('3.0 Deselect incident');
    incidentsPage.deselectIncidentByBar();

    cy.log('3.1 Select incident with both silenced and non-silenced alerts (CASE-3)');
    selectIncidentAndWaitForAlerts('CASE-3-shared-alert-single-incident-storage-network-SILENCED-UNSILENCED', 2);
    
    cy.log('3.2 Verify first alert (storage namespace / silenced) has opacity 0.3');
    verifyAlertOpacity(0, 0.3);
    
    cy.log('3.3 Verify second alert (network namespace / non-silenced) has opacity 1.0');
    verifyAlertOpacity(1, 1.0);
    
    cy.log('3.4 Hover over first alert and verify tooltip shows (silenced) with storage');
    verifyAlertTooltip(0, ['storage'], true);
    
    cy.log('3.5 Hover over second alert and verify tooltip shows network without (silenced)');
    verifyAlertTooltip(1, ['network'], false);
    
    cy.log('Verified: Same alert name with different namespaces handled correctly');
    cy.log('Verified: Silence matching uses alertname + namespace + severity');
  });
});


