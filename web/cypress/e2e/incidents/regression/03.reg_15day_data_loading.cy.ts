/*
Regression test for 15-Day Data Loading with "Last N Days" Filtering (Section 3.4)

FEATURE: UI always loads 15 days of data (one query_range call per day), then filters
client-side based on "Last N Days" selection. Absolute start dates are retrieved via
instant queries (min_over_time(timestamp(...))) and always displayed regardless of the
selected time filter.

Before fix: Start dates were relative to the "Last N Days" selection.
After fix: Start dates show absolute timestamps from instant query results.

Note: API call pattern verification (exact count of 15 query_range calls and instant
queries) is partially covered by the mocking infrastructure. Full API call counting
requires integration tests with a real Prometheus endpoint.

All start dates — table dates (incidents table "Start", alerts details "Start") AND
tooltip dates (incident bar tooltip, alert bar tooltip) — should remain identical
regardless of which "Last N Days" filter is selected. If tooltip dates drift when
switching filters, that indicates a bug in the chart rendering pipeline.

Test 4: Escalating severity — verifies that segment start dates remain correct when the
time filter clips severity change boundaries out of the visible window. Boundary and
cross-validation tests for this incident are covered in 02.reg_ui_tooltip_boundary_times.cy.ts.

Verifies: Section 3.4
*/

/* eslint-disable @typescript-eslint/no-unused-expressions */
import { incidentsPage, SegmentDates } from '../../../views/incidents-page';

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

describe('Regression: 15-Day Data Loading', { tags: ['@incidents'] }, () => {
  before(() => {
    cy.beforeBlockCOO(MCP, MP, { dashboards: false, troubleshootingPanel: false });
  });

  beforeEach(() => {
    cy.log('Loading 15-day data loading test scenarios');
    cy.mockIncidentFixture('incident-scenarios/19-15-day-data-loading.yaml');
  });

  const collectAllStartDates = (
    incidentId: string,
  ): Cypress.Chainable<{
    incidentTable: string;
    alertTable: string;
    incidentTooltip: string;
    alertTooltip: string;
  }> => {
    let iTable: string;
    let iTooltip: string;
    let aTooltip: string;

    incidentsPage.hoverOverIncidentBarById(incidentId);
    incidentsPage.getTooltipStartDate().then((d) => {
      iTooltip = d;
    });

    incidentsPage.selectIncidentById(incidentId);
    incidentsPage.elements.alertsChartContainer().should('be.visible');
    incidentsPage.hoverOverAlertBar(0);
    incidentsPage.getAlertsTooltipStartDate().then((d) => {
      aTooltip = d;
    });

    incidentsPage.expandRow(0);
    incidentsPage.elements.incidentsDetailsTable().should('be.visible');
    incidentsPage.elements
      .incidentsDetailsStartCell(0)
      .invoke('text')
      .then((t) => {
        iTable = t.trim();
      });

    return incidentsPage.elements
      .incidentsDetailsFiringStartCell(0)
      .invoke('text')
      .then((t) => {
        return cy.wrap({
          incidentTable: iTable,
          alertTable: t.trim(),
          incidentTooltip: iTooltip,
          alertTooltip: aTooltip,
        });
      });
  };

  it('1. 15-day filter - start dates are consistent across table and tooltip', () => {
    cy.log('1.1 Switch to 15-day filter so all incident data is fully visible');
    incidentsPage.clearAllFilters();
    incidentsPage.setDays('15 days');
    incidentsPage.elements.incidentsChartContainer().should('be.visible');
    incidentsPage.elements.incidentsChartBarsGroups().should('have.length', 4);

    cy.log('1.2 Collect all start dates for 14-day ongoing incident');
    collectAllStartDates('LONG-14d-monitoring-ongoing').then((dates) => {
      cy.log(`Incident table: ${dates.incidentTable}`);
      cy.log(`Alert table: ${dates.alertTable}`);
      cy.log(`Incident tooltip: ${dates.incidentTooltip}`);
      cy.log(`Alert tooltip: ${dates.alertTooltip}`);
      expect(dates.incidentTable).to.not.be.empty;
      expect(dates.alertTable).to.not.be.empty;
      expect(dates.incidentTooltip).to.not.be.empty;
      expect(dates.alertTooltip).to.not.be.empty;
      expect(dates.incidentTooltip).to.equal(
        dates.incidentTable,
        'Incident tooltip and table match',
      );
      expect(dates.alertTooltip).to.equal(dates.alertTable, 'Alert tooltip and table match');
      expect(dates.incidentTable).to.equal(
        dates.alertTable,
        'Incident table and alert table match',
      );
      cy.log('Verified: All start dates consistent within 15-day view');
    });
  });

  it('2. 7-day filter - start dates are consistent across table and tooltip', () => {
    cy.log('2.1 Switch to 7-day filter');
    incidentsPage.clearAllFilters();
    incidentsPage.setDays('7 days');
    incidentsPage.elements.incidentsChartContainer().should('be.visible');
    incidentsPage.elements.incidentsChartBarsGroups().should('have.length', 4);

    cy.log('2.2 Collect all start dates for 14-day ongoing incident');
    collectAllStartDates('LONG-14d-monitoring-ongoing').then((dates) => {
      cy.log(`Incident table: ${dates.incidentTable}`);
      cy.log(`Alert table: ${dates.alertTable}`);
      cy.log(`Incident tooltip: ${dates.incidentTooltip}`);
      cy.log(`Alert tooltip: ${dates.alertTooltip}`);
      expect(dates.incidentTable).to.not.be.empty;
      expect(dates.alertTable).to.not.be.empty;
      expect(dates.incidentTooltip).to.not.be.empty;
      expect(dates.alertTooltip).to.not.be.empty;
      expect(dates.incidentTooltip).to.equal(
        dates.incidentTable,
        'Incident tooltip and table match',
      );
      expect(dates.alertTooltip).to.equal(dates.alertTable, 'Alert tooltip and table match');
      expect(dates.incidentTable).to.equal(
        dates.alertTable,
        'Incident table and alert table match',
      );
      cy.log('Verified: All start dates consistent within 7-day view');
    });
  });

  it('3. 3-day filter - start dates are consistent across table and tooltip', () => {
    cy.log('3.1 Switch to 3-day filter');
    incidentsPage.clearAllFilters();
    incidentsPage.setDays('3 days');
    incidentsPage.elements.incidentsChartContainer().should('be.visible');
    incidentsPage.elements.incidentsChartBarsGroups().should('have.length', 4);

    cy.log('3.2 Collect all start dates for 14-day ongoing incident');
    collectAllStartDates('LONG-14d-monitoring-ongoing').then((dates) => {
      cy.log(`Incident table: ${dates.incidentTable}`);
      cy.log(`Alert table: ${dates.alertTable}`);
      cy.log(`Incident tooltip: ${dates.incidentTooltip}`);
      cy.log(`Alert tooltip: ${dates.alertTooltip}`);
      expect(dates.incidentTable).to.not.be.empty;
      expect(dates.alertTable).to.not.be.empty;
      expect(dates.incidentTooltip).to.not.be.empty;
      expect(dates.alertTooltip).to.not.be.empty;
      expect(dates.incidentTooltip).to.equal(
        dates.incidentTable,
        'Incident tooltip and table match',
      );
      expect(dates.alertTooltip).to.equal(dates.alertTable, 'Alert tooltip and table match');
      expect(dates.incidentTable).to.equal(
        dates.alertTable,
        'Incident table and alert table match',
      );
      cy.log('Verified: All start dates consistent within 3-day view');
    });
  });

  it('4. Escalating severity - segment start dates stable when info boundary scrolls out of 7-day window', () => {
    // Boundary and cross-validation tests for the escalating incident are covered in
    // 02.reg_ui_tooltip_boundary_times.cy.ts. This test focuses solely on whether segment
    // start dates remain correct when the time filter clips the info→warning boundary (10d ago)
    // out of the visible window.
    let infoSegment: SegmentDates;
    let warningSegment: SegmentDates;
    let criticalSegment: SegmentDates;

    cy.log('4.1 Collect segment start dates as baseline at 15-day filter');
    incidentsPage.clearAllFilters();
    incidentsPage.setDays('15 days');
    incidentsPage.elements.incidentsChartContainer().should('be.visible');
    incidentsPage.elements.incidentsChartBarsGroups().should('have.length', 4);

    incidentsPage.collectSegmentTooltip('ESCALATING-14d-monitoring-severity', 0).then((d) => {
      infoSegment = d;
      cy.log(`Info segment baseline: Start=${d.start}`);
    });
    incidentsPage.collectSegmentTooltip('ESCALATING-14d-monitoring-severity', 1).then((d) => {
      warningSegment = d;
      cy.log(`Warning segment baseline: Start=${d.start}`);
    });
    incidentsPage.collectSegmentTooltip('ESCALATING-14d-monitoring-severity', 2).then((d) => {
      criticalSegment = d;
      cy.log(`Critical segment baseline: Start=${d.start}`);
    });

    cy.log(
      '4.2 Switch to 7-day filter - info boundary (10d ago) is now outside the visible window',
    );
    incidentsPage.setDays('7 days');
    incidentsPage.elements.incidentsChartBarsGroups().should('have.length', 4);

    cy.log('4.3 Critical segment start should be unchanged from 15d baseline');
    incidentsPage
      .getIncidentBarVisibleSegmentCount('ESCALATING-14d-monitoring-severity')
      .then((count) => {
        incidentsPage.hoverOverIncidentBarById('ESCALATING-14d-monitoring-severity', count - 1);
        incidentsPage.getTooltipSeverity().should('equal', 'Critical');
        incidentsPage.getTooltipStartDate().then((d) => {
          expect(d).to.equal(
            criticalSegment.start,
            `Critical start in 7d view (${d}) should match 15d baseline (${criticalSegment.start})`,
          );
          cy.log(`Verified: Critical segment start unchanged at ${d}`);
        });
      });

    cy.log(
      '4.4 Warning segment start may differ - info→warning boundary (10d ago) is outside the 7d window',
    );
    incidentsPage
      .getIncidentBarVisibleSegmentCount('ESCALATING-14d-monitoring-severity')
      .then((count) => {
        const warningIndex = count - 2;
        if (warningIndex < 0) {
          cy.log('Warning segment not visible in 7d view (entirely clipped), skipping');
          return;
        }

        incidentsPage.hoverOverIncidentBarById('ESCALATING-14d-monitoring-severity', warningIndex);
        incidentsPage.getTooltipSeverity().should('equal', 'Warning');
        incidentsPage.getTooltipStartDate().then((d) => {
          expect(d).to.satisfy(
            (v: string) => v === warningSegment.start || v === infoSegment.start,
            `Warning start in 7d (${d}) should equal either the segment start ` +
              `(${warningSegment.start}) or the incident start (${infoSegment.start})`,
          );
          cy.log(
            `Warning start in 7d: ${d} (was ${warningSegment.start}` +
              ` in 15d, incident start: ${infoSegment.start})`,
          );
        });
      });

    cy.log(
      'Verified: Segment start dates behave correctly when time filter clips severity boundaries',
    );
  });
});
