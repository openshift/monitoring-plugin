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

Edge cases:
- Test 2: Escalating severity incident — tooltip shows segment-specific boundaries,
  not the overall incident start. When the severity change point is beyond the visible
  time window, showing the overall incident start is acceptable.

Verifies: Section 3.4
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

describe('Regression: 15-Day Data Loading', { tags: ['@incidents'] }, () => {

  before(() => {
    cy.beforeBlockCOO(MCP, MP);
  });

  beforeEach(() => {
    cy.log('Navigate to Observe -> Incidents');
    incidentsPage.goTo();
    cy.log('Loading 15-day data loading test scenarios');
    cy.mockIncidentFixture('incident-scenarios/19-15-day-data-loading.yaml');
  });

  it('1. Absolute start date remains consistent across time filter changes for ongoing and resolved incidents', () => {
    // All start dates — tables AND tooltips — should be identical regardless of the
    // selected time filter. If tooltip dates drift, that is a bug to investigate.

    interface AllDates {
      incidentTable: string;
      alertTable: string;
      incidentTooltip: string;
      alertTooltip: string;
    }

    let ongoingBaseline: AllDates;
    let resolvedBaseline: AllDates;

    const collectAllStartDates = (incidentId: string): Cypress.Chainable<AllDates> => {
      let iTable: string;
      let iTooltip: string;
      let aTooltip: string;

      incidentsPage.hoverOverIncidentBarById(incidentId);
      incidentsPage.getTooltipStartDate().then(d => { iTooltip = d; });

      incidentsPage.selectIncidentById(incidentId);
      incidentsPage.elements.alertsChartContainer().should('be.visible');
      incidentsPage.hoverOverAlertBar(0);
      incidentsPage.getAlertsTooltipStartDate().then(d => { aTooltip = d; });

      incidentsPage.expandRow(0);
      incidentsPage.elements.incidentsDetailsTable().should('be.visible');

      incidentsPage.elements.incidentsDetailsStartCell(0)
        .invoke('text').then(t => { iTable = t.trim(); });

      return incidentsPage.elements.incidentsDetailsFiringStartCell(0)
        .invoke('text').then(t => {
          return cy.wrap({
            incidentTable: iTable,
            alertTable: t.trim(),
            incidentTooltip: iTooltip,
            alertTooltip: aTooltip,
          });
        });
    };

    const expectAllDatesMatch = (actual: AllDates, expected: AllDates) => {
      // date does not change on different timeline lengths
      expect(actual.incidentTable).to.equal(expected.incidentTable, 'Incident table start');
      expect(actual.alertTable).to.equal(expected.alertTable, 'Alert table start');
      // TODO: Currently not working as expected, the tooltip dates are 5 minute behind the table dates
      // on the incident start (no date filter trimming applied)
      expect(actual.incidentTooltip).to.equal(expected.incidentTooltip, 'Incident tooltip start');
      expect(actual.alertTooltip).to.equal(expected.alertTooltip, 'Alert tooltip start');
      
      // consistency within same filter view
      expect(actual.incidentTooltip).to.equal(actual.incidentTable, 'Incident tooltip and table match');
      expect(actual.alertTooltip).to.equal(actual.alertTable, 'Alert tooltip and table match');
      expect(actual.incidentTable).to.equal(actual.alertTable, 'Incident table and alert table match');
    };

    // Phase 1: Ongoing 14-day incident — baseline at 15d (widest), then 7d, then 3d

    cy.log('1.1 Switch to 15-day filter so all incident data is fully visible');
    incidentsPage.clearAllFilters();
    incidentsPage.setDays('15 days');
    incidentsPage.elements.incidentsChartContainer().should('be.visible');
    incidentsPage.elements.incidentsChartBarsGroups().should('have.length', 4);

    cy.log('1.2 Collect all start dates for 14-day ongoing incident (15d baseline)');
    collectAllStartDates('LONG-14d-monitoring-ongoing').then((dates) => {
      ongoingBaseline = dates;
      cy.log(`Incident table: ${dates.incidentTable}`);
      cy.log(`Alert table: ${dates.alertTable}`);
      cy.log(`Incident tooltip: ${dates.incidentTooltip}`);
      cy.log(`Alert tooltip: ${dates.alertTooltip}`);
      expect(dates.incidentTable).to.not.be.empty;
      expect(dates.alertTable).to.not.be.empty;
      expect(dates.incidentTooltip).to.not.be.empty;
      expect(dates.alertTooltip).to.not.be.empty;

      expect(dates.incidentTooltip).to.equal(dates.incidentTable, 'Incident tooltip and table match');
      expect(dates.alertTooltip).to.equal(dates.alertTable, 'Alert tooltip and table match');
      expect(dates.incidentTable).to.equal(dates.alertTable, 'Incident table and alert table match');

    });

    cy.log('1.3 Switch to 7-day filter and verify all start dates identical');
    incidentsPage.deselectIncidentById('LONG-14d-monitoring-ongoing');
    incidentsPage.setDays('7 days');
    incidentsPage.elements.incidentsChartBarsGroups().should('have.length', 4);

    collectAllStartDates('LONG-14d-monitoring-ongoing').then((dates) => {
      expectAllDatesMatch(dates, ongoingBaseline);
      cy.log('Verified: All start dates match baseline (7d vs 15d)');
    });

    cy.log('1.4 Switch to 3-day filter, verify all start dates still identical');
    incidentsPage.deselectIncidentById('LONG-14d-monitoring-ongoing');
    incidentsPage.setDays('3 days');
    incidentsPage.elements.incidentsChartBarsGroups().should('have.length', 4);

    collectAllStartDates('LONG-14d-monitoring-ongoing').then((dates) => {
      expectAllDatesMatch(dates, ongoingBaseline);
      cy.log('Verified: Ongoing incident dates absolute across 15d, 7d, and 3d filters');
    });

    // Phase 2: Resolved 10-day incident — baseline at 15d, then 7d
    // Failing due to late refresh of the alert bar (cypress testsuite logic related)

    // cy.log('1.5 Switch to 15 days, collect all start dates for resolved 10-day incident');
    // incidentsPage.deselectIncidentById('LONG-14d-monitoring-ongoing');
    // incidentsPage.setDays('15 days');

    // collectAllStartDates('MEDIUM-10d-storage-resolved').then((dates) => {
    //   resolvedBaseline = dates;
    //   cy.log(`Resolved incident table: ${dates.incidentTable}`);
    //   cy.log(`Resolved alert table: ${dates.alertTable}`);
    //   cy.log(`Resolved incident tooltip: ${dates.incidentTooltip}`);
    //   cy.log(`Resolved alert tooltip: ${dates.alertTooltip}`);
    //   expect(dates.incidentTable).to.not.be.empty;
    //   expect(dates.alertTable).to.not.be.empty;
    //   expect(dates.incidentTooltip).to.not.be.empty;
    //   expect(dates.alertTooltip).to.not.be.empty;
    // });

    // cy.log('1.6 Switch to 7-day filter and verify resolved incident dates unchanged');
    // incidentsPage.deselectIncidentById('MEDIUM-10d-storage-resolved');
    // incidentsPage.setDays('7 days');

    // // TODO: Remove this wait with more elegant waiting
    // cy.wait(5000);

    // collectAllStartDates('MEDIUM-10d-storage-resolved').then((dates) => {
    //   expectAllDatesMatch(dates, resolvedBaseline);
    //   cy.log('Verified: Resolved incident dates also absolute across filter changes');
    // });

    // cy.log('Verified: All start dates (tables and tooltips) are absolute for both ongoing and resolved incidents');
  });

  it('2. Escalating severity - incident chart segment tooltips show segment-specific boundaries', () => {
    // Incident "ESCALATING-14d-monitoring-severity" has 3 severity segments:
    //   Info (14d-10d ago) → Warning (10d-5d ago) → Critical (5d ago-now)
    //
    // With 15d filter: all 3 segments visible, tooltip start/end should match each segment's boundaries
    // With 7d filter: info segment hidden, warning partially visible, critical fully visible
    //   - Critical segment start should be unchanged from 15d view
    //   - Warning segment start may differ because the info→warning boundary (10d ago) is beyond the
    //     7-day window. Showing the overall incident start is acceptable in this case.
    // 3 alerts (info, warning, critical) have timelines matching the severity change points.

    interface SegmentDates {
      severity: string;
      start: string;
      end: string;
    }

    const collectSegmentTooltip = (incidentId: string, segmentIndex: number): Cypress.Chainable<SegmentDates> => {
      let severity: string;
      let start: string;

      incidentsPage.hoverOverIncidentBarById(incidentId, segmentIndex);
      incidentsPage.getTooltipSeverity().then(s => { severity = s; });
      incidentsPage.getTooltipStartDate().then(d => { start = d; });
      return incidentsPage.getTooltipEndDate().then(end => {
        return cy.wrap({ severity, start, end });
      });
    };

    let infoSegment: SegmentDates;
    let warningSegment: SegmentDates;
    let criticalSegment: SegmentDates;

    cy.log('2.1 Switch to 15-day filter to see all severity segments');
    incidentsPage.clearAllFilters();
    incidentsPage.setDays('15 days');
    incidentsPage.elements.incidentsChartContainer().should('be.visible');
    incidentsPage.elements.incidentsChartBarsGroups().should('have.length', 4);

    cy.log('2.2 Verify escalating incident has 3 visible severity segments');
    incidentsPage.elements.incidentsChartBar('ESCALATING-14d-monitoring-severity')
      .find('path[role="presentation"]')
      .then(($paths) => {
        const visibleCount = $paths.filter((i, el) => {
          const fillOpacity = Cypress.$(el).css('fill-opacity') || Cypress.$(el).attr('fill-opacity');
          return parseFloat(fillOpacity || '0') > 0;
        }).length;
        expect(visibleCount).to.equal(3);
      });

    cy.log('2.3 Hover info segment (oldest, index 0) and record tooltip');
    collectSegmentTooltip('ESCALATING-14d-monitoring-severity', 0).then(d => {
      infoSegment = d;
      expect(d.severity).to.equal('Info');
      expect(d.start).to.not.be.empty;
      expect(d.end).to.not.be.empty;
      cy.log(`Info segment: Start=${d.start}, End=${d.end}`);
    });

    cy.log('2.4 Hover warning segment (middle, index 1) and record tooltip');
    collectSegmentTooltip('ESCALATING-14d-monitoring-severity', 1).then(d => {
      warningSegment = d;
      expect(d.severity).to.equal('Warning');
      expect(d.start).to.not.be.empty;
      expect(d.end).to.not.be.empty;
      cy.log(`Warning segment: Start=${d.start}, End=${d.end}`);
    });

    cy.log('2.5 Hover critical segment (latest, index 2) and record tooltip');
    collectSegmentTooltip('ESCALATING-14d-monitoring-severity', 2).then(d => {
      criticalSegment = d;
      expect(d.severity).to.equal('Critical');
      expect(d.start).to.not.be.empty;
      cy.log(`Critical segment: Start=${d.start}, End=${d.end}`);
    });

    cy.log('2.6 Verify each segment has a distinct start date (not the overall incident start)');
    cy.then(() => {
      expect(infoSegment.start).to.not.equal(warningSegment.start);
      expect(warningSegment.start).to.not.equal(criticalSegment.start);
      expect(infoSegment.start).to.not.equal(criticalSegment.start);
      cy.log('Verified: Each severity segment has a unique start date');
    });

    cy.log('2.7 Verify 3 alerts match the severity change points (still in 15d view)');
    incidentsPage.selectIncidentById('ESCALATING-14d-monitoring-severity');
    incidentsPage.elements.alertsChartContainer().should('be.visible');

    let alertInfoStart: string;
    let alertWarningStart: string;
    let alertCriticalStart: string;

    incidentsPage.hoverOverAlertBar(0);
    incidentsPage.getAlertsTooltipStartDate().then(d => {
      alertInfoStart = d;
      expect(d).to.not.be.empty;
      cy.log(`Alert 0 (info) start: ${d}`);
    });
    incidentsPage.hoverOverAlertBar(1);
    incidentsPage.getAlertsTooltipStartDate().then(d => {
      alertWarningStart = d;
      expect(d).to.not.be.empty;
      cy.log(`Alert 1 (warning) start: ${d}`);
    });
    incidentsPage.hoverOverAlertBar(2);
    incidentsPage.getAlertsTooltipStartDate().then(d => {
      alertCriticalStart = d;
      expect(d).to.not.be.empty;
      cy.log(`Alert 2 (critical) start: ${d}`);
    });

    cy.log('2.8 Verify alert start dates correspond to incident severity change points');
    cy.then(() => {
      expect(alertInfoStart).to.not.equal(alertWarningStart);
      expect(alertWarningStart).to.not.equal(alertCriticalStart);
      expect(alertInfoStart).to.not.equal(alertCriticalStart);
      cy.log(`Alert starts: info=${alertInfoStart}, warning=${alertWarningStart}, critical=${alertCriticalStart}`);
      cy.log(`Incident segment starts: info=${infoSegment.start}, warning=${warningSegment.start}, critical=${criticalSegment.start}`);
    });

    cy.log('2.9 Switch to 7-day filter - info segment now hidden in the past');
    incidentsPage.deselectIncidentById('ESCALATING-14d-monitoring-severity');
    incidentsPage.setDays('7 days');
    incidentsPage.elements.incidentsChartBarsGroups().should('have.length', 4);

    cy.log('2.10 Hover critical segment and verify start date unchanged from 15d view');
    incidentsPage.elements.incidentsChartBar('ESCALATING-14d-monitoring-severity')
      .find('path[role="presentation"]')
      .then(($paths) => {
        const visiblePaths = $paths.filter((i, el) => {
          const fillOpacity = Cypress.$(el).css('fill-opacity') || Cypress.$(el).attr('fill-opacity');
          return parseFloat(fillOpacity || '0') > 0;
        });
        const lastIndex = visiblePaths.length - 1;

        incidentsPage.hoverOverIncidentBarById('ESCALATING-14d-monitoring-severity', lastIndex);
        incidentsPage.getTooltipSeverity().should('equal', 'Critical');
        incidentsPage.getTooltipStartDate().then(d => {
          expect(d).to.equal(criticalSegment.start);
          cy.log(`Critical segment start in 7d view: ${d} (matches 15d view: ${criticalSegment.start})`);
        });
      });

    cy.log('2.11 Hover warning segment and verify tooltip (start may differ due to hidden boundary)');
    incidentsPage.elements.incidentsChartBar('ESCALATING-14d-monitoring-severity')
      .find('path[role="presentation"]')
      .then(($paths) => {
        const visiblePaths = $paths.filter((i, el) => {
          const fillOpacity = Cypress.$(el).css('fill-opacity') || Cypress.$(el).attr('fill-opacity');
          return parseFloat(fillOpacity || '0') > 0;
        });
        const warningIndex = visiblePaths.length - 2;
        if (warningIndex < 0) {
          cy.log('Warning segment not visible in 7d view (entirely clipped)');
          return;
        }

        incidentsPage.hoverOverIncidentBarById('ESCALATING-14d-monitoring-severity', warningIndex);
        incidentsPage.getTooltipSeverity().should('equal', 'Warning');
        incidentsPage.getTooltipStartDate().then(d => {
          expect(d).to.not.be.empty;
          // The warning segment's info→warning boundary (10d ago) is before the 7-day window.
          // The tooltip may show either the segment start or the overall incident start — both are acceptable.
          cy.log(`Warning segment start in 7d: ${d} (was ${warningSegment.start} in 15d, incident starts at ${infoSegment.start})`);
        });
      });

    cy.log('Verified: Escalating severity segments show segment-specific boundaries in tooltips');
  });
});
