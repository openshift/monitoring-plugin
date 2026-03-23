/*
Regression test for mixed severity interval boundary times (Section 2.3.3).

Test 1 (OU-1205): Verifies tooltip End times at severity interval boundaries
are rounded to 5-minute precision. Without rounding, consecutive interval end
times can land on non-5-minute values (e.g., "10:58" instead of "11:00").

Test 2 (OU-1221, XFAIL): Verifies Start times shown in incident tooltips match
alert tooltips and alerts table, and that consecutive segment boundaries align
with no 5-minute gap between End of one segment and Start of the next.
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

describe('Regression: Mixed Severity Interval Boundary Times', { tags: ['@incidents', '@xfail', '@flaky'] }, () => {

  before(() => {
    cy.beforeBlockCOO(MCP, MP, { dashboards: false, troubleshootingPanel: false });
  });

  beforeEach(() => {
    cy.mockIncidentFixture('incident-scenarios/21-multi-severity-boundary-times.yaml');
  });

  const extractTime = (tooltipText: string, field: 'Start' | 'End'): string => {
    const afterField = tooltipText.split(field)[1] || '';
    const match = afterField.match(/(\d{1,2}:\d{2}(\s*[AP]M)?)/);
    return match ? match[1].trim() : '';
  };

  it('1. Tooltip End times at severity boundaries show 5-minute rounded values', () => {
    const verifyEndTimeRounded = (label: string) => {
      incidentsPage.elements.tooltip()
        .invoke('text')
        .then((text) => {
          cy.log(`${label} tooltip: "${text}"`);

          if (text.match(/End.*---/)) {
            cy.log(`${label}: Firing, End shows --- (skipped)`);
            return;
          }

          const endPart = text.split('End')[1];
          expect(endPart, `${label}: should contain End time`).to.exist;

          const timeMatch = endPart.match(/(\d{1,2}):(\d{2})/);
          expect(timeMatch, `${label}: End time should be parseable`).to.not.be.null;

          const minutes = parseInt(timeMatch[2], 10);
          const remainder = minutes % 5;
          expect(remainder, `${label}: End minutes (${minutes}) should be divisible by 5, remainder=${remainder}`).to.equal(0);
          cy.log(`${label}: End ${timeMatch[1]}:${timeMatch[2]} - minutes divisible by 5`);
        });
    };

    cy.log('1.1 Verify multi-severity incident loaded');
    incidentsPage.clearAllFilters();
    incidentsPage.setDays('1 day');
    incidentsPage.elements.incidentsChartContainer().should('be.visible');
    incidentsPage.elements.incidentsChartBarsGroups().should('have.length', 1);

    cy.log('1.2 Verify bar has multiple severity segments');
    incidentsPage.getIncidentBarVisibleSegments(0).then((segments) => {
      expect(segments.length, 'Multi-severity bar should have at least 2 visible segments')
        .to.be.greaterThan(1);
      cy.log(`Found ${segments.length} visible severity segments`);
    });

    cy.log('1.3 Check first segment end time (Info -> Warning boundary)');
    incidentsPage.hoverOverIncidentBarSegment(0, 0);
    verifyEndTimeRounded('First segment');

    cy.log('1.4 Check second segment end time (Warning -> Critical boundary)');
    incidentsPage.hoverOverIncidentBarSegment(0, 1);
    verifyEndTimeRounded('Second segment');

    cy.log('1.5 Check third segment end time (Critical end)');
    incidentsPage.hoverOverIncidentBarSegment(0, 2);
    verifyEndTimeRounded('Third segment');

    cy.log('Verified: All tooltip End times at severity boundaries are at 5-minute precision (OU-1205)');
  });

  it('2. Start times match between incident tooltip, alert tooltip, and table; consecutive boundaries align',
    () => {
    cy.log('2.1 Setup: verify multi-severity incident loaded');
    incidentsPage.clearAllFilters();
    incidentsPage.setDays('1 day');
    incidentsPage.elements.incidentsChartContainer().should('be.visible');
    incidentsPage.elements.incidentsChartBarsGroups().should('have.length', 1);


    cy.log('2.2 Consecutive interval boundaries: End of segment 1 should equal Start of segment 2');
    incidentsPage.hoverOverIncidentBarSegment(0, 0);
    incidentsPage.elements.tooltip().invoke('text').then((firstText) => {
      const firstEnd = extractTime(firstText, 'End');
      cy.log(`First segment End: ${firstEnd}`);
      expect(firstEnd, 'First segment End should be parseable').to.not.be.empty;

      incidentsPage.hoverOverIncidentBarSegment(0, 1);
      incidentsPage.elements.tooltip().invoke('text').then((secondText) => {
        const secondStart = extractTime(secondText, 'Start');
        cy.log(`Second segment Start: ${secondStart}`);
        expect(secondStart, 'Second segment Start should be parseable').to.not.be.empty;
        expect(secondStart,
          `No 5-min gap: second Start (${secondStart}) should equal first End (${firstEnd})`
        ).to.equal(firstEnd);
      });
    });


    cy.log('2.3 Incident tooltip Start vs alert tooltip Start vs alerts table Start');
    incidentsPage.hoverOverIncidentBarSegment(0, 0);
    incidentsPage.elements.tooltip().invoke('text').then((incidentText) => {
      const incidentStart = extractTime(incidentText, 'Start');
      cy.log(`Incident tooltip Start: ${incidentStart}`);
      expect(incidentStart, 'Incident Start should be parseable').to.not.be.empty;

      cy.log('2.4 Select incident and get alert tooltip Start');
      incidentsPage.selectIncidentById('monitoring-multi-severity-boundary-001');
      incidentsPage.elements.alertsChartCard().should('be.visible');

      incidentsPage.hoverOverAlertBar(0);
      incidentsPage.elements.alertsChartTooltip().invoke('text').then((alertText) => {
        const alertStart = extractTime(alertText, 'Start');
        cy.log(`Alert tooltip Start: ${alertStart}`);
        expect(incidentStart,
          `Incident Start (${incidentStart}) should match alert Start (${alertStart})`
        ).to.equal(alertStart);
      });

      cy.log('2.5 Compare incident tooltip Start with alerts table Start');
      incidentsPage.getSelectedIncidentAlerts().then((alerts) => {
        expect(alerts.length, 'Should have at least 1 alert row').to.be.greaterThan(0);
        alerts[0].getStartCell().invoke('text').then((cellText) => {
          const tableMatch = cellText.trim().match(/(\d{1,2}:\d{2}(\s*[AP]M)?)/);
          expect(tableMatch, 'Table Start time should be parseable').to.not.be.null;
          const tableStart = tableMatch[1].trim();
          cy.log(`Alerts table Start: ${tableStart}`);
          expect(incidentStart,
            `Incident Start (${incidentStart}) should match table Start (${tableStart})`
          ).to.equal(tableStart);
        });
      });
    });


    cy.log('Expected failure: Incident tooltip Start times are 5 minutes off (OU-1221)');
  });
});
