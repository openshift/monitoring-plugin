/*
Regression test for mixed severity interval boundary times (Section 2.3.3).

Test 1 (OU-1205): Verifies tooltip End times at severity interval boundaries
are rounded to 5-minute precision. Without rounding, consecutive interval end
times can land on non-5-minute values (e.g., "10:58" instead of "11:00").

Test 2 (OU-1221): Incident chart segment boundaries — start and end dates.
Collects all segment tooltip dates and asserts:
  - Each segment has a distinct start date
  - Consecutive boundary alignment: End[N] == Start[N+1]

Test 3: Alert bar tooltip dates — start and end dates.
Collects all alert tooltip dates and asserts:
  - Each alert has a distinct start date
  - All start and end values are non-empty

Test 4 (OU-1221): Cross-validation — incident chart segment Start dates match alert bar Start dates.
Test 5 (OU-1205): Cross-validation — incident chart segment End dates match alert bar End dates.
Test 6 (OU-1205): Cross-validation — alert bar tooltip Start and End dates match alerts table.

Verifies: OU-1205, OU-1221
*/

/* eslint-disable @typescript-eslint/no-unused-expressions */
import { incidentsPage, SegmentDates, AlertDates } from '../../../views/incidents-page';

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

const ESCALATING_ID = 'ESCALATING-14d-monitoring-severity';

describe('Regression: Mixed Severity Interval Boundary Times', { tags: ['@incidents'] }, () => {
  before(() => {
    cy.beforeBlockCOO(MCP, MP, { dashboards: false, troubleshootingPanel: false });
  });

  beforeEach(() => {
    cy.log('Loading escalating severity fixture');
    cy.mockIncidentFixture('incident-scenarios/19-15-day-data-loading.yaml');
  });

  const setupEscalatingIncident = () => {
    incidentsPage.clearAllFilters();
    incidentsPage.setDays('15 days');
    incidentsPage.elements.incidentsChartContainer().should('be.visible');
    incidentsPage.elements.incidentsChartBarsGroups().should('have.length', 4);
  };

  const collectSegmentTooltip = (segmentIndex: number) =>
    incidentsPage.collectSegmentTooltip(ESCALATING_ID, segmentIndex);

  const collectAlertTooltip = (barIndex: number) => incidentsPage.collectAlertTooltip(barIndex);

  it('1. Tooltip End times at severity boundaries show 5-minute rounded values', () => {
    const verifyEndTimeRounded = (label: string) => {
      incidentsPage.elements
        .tooltip()
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
          expect(
            remainder,
            `${label}: End minutes (${minutes}) should be divisible by 5, remainder=${remainder}`,
          ).to.equal(0);
          cy.log(`${label}: End ${timeMatch[1]}:${timeMatch[2]} - minutes divisible by 5`);
        });
    };

    cy.log('1.1 Verify multi-severity incident loaded');
    setupEscalatingIncident();

    cy.log('1.2 Verify escalating bar has multiple severity segments');
    incidentsPage.getIncidentBarVisibleSegmentCount(ESCALATING_ID).then((count) => {
      expect(count, 'Should have at least 2 visible segments').to.be.greaterThan(1);
      cy.log(`Found ${count} visible severity segments`);
    });

    cy.log('1.3 Check first segment end time (Info -> Warning boundary)');
    incidentsPage.hoverOverIncidentBarById(ESCALATING_ID, 0);
    verifyEndTimeRounded('First segment');

    cy.log('1.4 Check second segment end time (Warning -> Critical boundary)');
    incidentsPage.hoverOverIncidentBarById(ESCALATING_ID, 1);
    verifyEndTimeRounded('Second segment');

    cy.log('1.5 Check third segment end time (Critical end)');
    incidentsPage.hoverOverIncidentBarById(ESCALATING_ID, 2);
    verifyEndTimeRounded('Third segment');

    cy.log(
      'Verified: All tooltip End times at severity boundaries are at 5-minute precision (OU-1205)',
    );
  });

  it('2. Incident chart segment boundaries - start and end dates align across severity transitions', () => {
    let infoSegment: SegmentDates;
    let warningSegment: SegmentDates;
    let criticalSegment: SegmentDates;

    cy.log('2.1 Setup: verify escalating incident loaded with 3 segments');
    setupEscalatingIncident();
    incidentsPage.getIncidentBarVisibleSegmentCount(ESCALATING_ID).then((count) => {
      expect(count).to.equal(3, 'Should have 3 visible severity segments');
    });

    cy.log('2.2 Collect incident segment tooltips (info, warning, critical)');
    collectSegmentTooltip(0).then((d) => {
      infoSegment = d;
      expect(d.severity).to.equal('Info');
      expect(d.start).to.not.be.empty;
      expect(d.end).to.not.be.empty;
      cy.log(`Info segment: Start=${d.start}, End=${d.end}`);
    });
    collectSegmentTooltip(1).then((d) => {
      warningSegment = d;
      expect(d.severity).to.equal('Warning');
      expect(d.start).to.not.be.empty;
      expect(d.end).to.not.be.empty;
      cy.log(`Warning segment: Start=${d.start}, End=${d.end}`);
    });
    collectSegmentTooltip(2).then((d) => {
      criticalSegment = d;
      expect(d.severity).to.equal('Critical');
      expect(d.start).to.not.be.empty;
      cy.log(`Critical segment: Start=${d.start}, End=${d.end}`);
    });

    cy.log('2.3 Assert boundary alignment and distinct start dates');
    cy.then(() => {
      cy.log('2.3.1 Each segment has a distinct start date');
      expect(infoSegment.start).to.not.equal(
        warningSegment.start,
        'Info start should differ from Warning start',
      );
      expect(warningSegment.start).to.not.equal(
        criticalSegment.start,
        'Warning start should differ from Critical start',
      );

      cy.log('2.3.2 Consecutive boundary alignment: End[N] == Start[N+1] (OU-1221)');
      expect(infoSegment.end).to.equal(
        warningSegment.start,
        `Info End (${infoSegment.end}) should equal Warning Start (${warningSegment.start})`,
      );
      expect(warningSegment.end).to.equal(
        criticalSegment.start,
        `Warning End (${warningSegment.end}) should equal ` +
          `Critical Start (${criticalSegment.start})`,
      );

      cy.log('Verified: Segment boundaries align and each segment has a distinct start date');
    });
  });

  it('3. Alert bar tooltips - start and end dates are populated and distinct across severity levels', () => {
    let alertInfo: AlertDates;
    let alertWarning: AlertDates;
    let alertCritical: AlertDates;

    cy.log('3.1 Setup: load incident, select escalating incident to reveal alert chart');
    setupEscalatingIncident();
    incidentsPage.selectIncidentById(ESCALATING_ID);
    incidentsPage.elements.alertsChartContainer().should('be.visible');

    cy.log('3.2 Collect alert bar tooltips (info, warning, critical)');
    collectAlertTooltip(0).then((d) => {
      alertInfo = d;
      expect(d.start).to.not.be.empty;
      expect(d.end).to.not.be.empty;
      cy.log(`Alert 0 (info): start=${d.start}, end=${d.end}`);
    });
    collectAlertTooltip(1).then((d) => {
      alertWarning = d;
      expect(d.start).to.not.be.empty;
      expect(d.end).to.not.be.empty;
      cy.log(`Alert 1 (warning): start=${d.start}, end=${d.end}`);
    });
    collectAlertTooltip(2).then((d) => {
      alertCritical = d;
      expect(d.start).to.not.be.empty;
      cy.log(`Alert 2 (critical): start=${d.start}, end=${d.end}`);
    });

    cy.log('3.3 Assert alert start dates are distinct across severity levels');
    cy.then(() => {
      expect(alertInfo.start).to.not.equal(
        alertWarning.start,
        'Info alert start should differ from Warning alert start',
      );
      expect(alertWarning.start).to.not.equal(
        alertCritical.start,
        'Warning alert start should differ from Critical alert start',
      );

      cy.log('Verified: Alert tooltip start and end dates populated and distinct');
    });
  });

  it('4. Cross-validation: incident chart segment Start dates match alert bar Start dates', () => {
    let infoSegment: SegmentDates;
    let warningSegment: SegmentDates;
    let criticalSegment: SegmentDates;
    let alertInfo: AlertDates;
    let alertWarning: AlertDates;
    let alertCritical: AlertDates;

    cy.log('4.1 Setup and collect incident segment tooltip Start dates');
    setupEscalatingIncident();
    collectSegmentTooltip(0).then((d) => {
      infoSegment = d;
      cy.log(`Info segment: Start=${d.start}`);
    });
    collectSegmentTooltip(1).then((d) => {
      warningSegment = d;
      cy.log(`Warning segment: Start=${d.start}`);
    });
    collectSegmentTooltip(2).then((d) => {
      criticalSegment = d;
      cy.log(`Critical segment: Start=${d.start}`);
    });

    cy.log('4.2 Select incident and collect alert bar tooltip Start dates');
    incidentsPage.selectIncidentById(ESCALATING_ID);
    incidentsPage.elements.alertsChartContainer().should('be.visible');
    collectAlertTooltip(0).then((d) => {
      alertInfo = d;
      cy.log(`Alert 0 (info): start=${d.start}`);
    });
    collectAlertTooltip(1).then((d) => {
      alertWarning = d;
      cy.log(`Alert 1 (warning): start=${d.start}`);
    });
    collectAlertTooltip(2).then((d) => {
      alertCritical = d;
      cy.log(`Alert 2 (critical): start=${d.start}`);
    });

    cy.log('4.3 Assert incident tooltip Start matches alert tooltip Start per segment');
    cy.then(() => {
      expect(infoSegment.start).to.equal(
        alertInfo.start,
        `Incident info Start (${infoSegment.start}) should match ` +
          `alert info Start (${alertInfo.start})`,
      );
      expect(warningSegment.start).to.equal(
        alertWarning.start,
        `Incident warning Start (${warningSegment.start}) ` +
          `should match alert warning Start (${alertWarning.start})`,
      );
      expect(criticalSegment.start).to.equal(
        alertCritical.start,
        `Incident critical Start (${criticalSegment.start}) ` +
          `should match alert critical Start (${alertCritical.start})`,
      );
      cy.log('Verified: Incident chart segment Start dates match alert bar Start dates');
    });

    cy.log(
      'Expected failure: OU-1221 (start time 5-min offset between incident and alert tooltips)',
    );
  });

  it('5. Cross-validation: last incident chart segment End date matches last alert bar End date', () => {
    // Info and warning alert bars overlap into the next severity period, so the incident
    // chart trims their segment End to the severity change boundary — these won't match
    // the raw alert End. Only the last (critical) segment has no trimming applied.
    let criticalSegment: SegmentDates;
    let alertCritical: AlertDates;

    cy.log('5.1 Setup and collect incident segment tooltip End dates');
    setupEscalatingIncident();
    collectSegmentTooltip(0).then((d) => {
      cy.log(
        `Info segment: End=${d.end} (trimmed to severity boundary, not expected to match alert)`,
      );
    });
    collectSegmentTooltip(1).then((d) => {
      cy.log(
        `Warning segment: End=${d.end} (trimmed to severity boundary, not expected to match alert)`,
      );
    });
    collectSegmentTooltip(2).then((d) => {
      criticalSegment = d;
      cy.log(`Critical segment: End=${d.end}`);
    });

    cy.log('5.2 Select incident and collect alert bar tooltip End date for last alert');
    incidentsPage.selectIncidentById(ESCALATING_ID);
    incidentsPage.elements.alertsChartContainer().should('be.visible');
    collectAlertTooltip(0).then((d) => {
      cy.log(`Alert 0 (info): end=${d.end} (raw alert end, extends past info segment boundary)`);
    });
    collectAlertTooltip(1).then((d) => {
      cy.log(
        `Alert 1 (warning): end=${d.end} (raw alert end, extends past warning segment boundary)`,
      );
    });
    collectAlertTooltip(2).then((d) => {
      alertCritical = d;
      cy.log(`Alert 2 (critical): end=${d.end}`);
    });

    cy.log(
      '5.3 Assert last incident segment End matches last alert End (no trimming on final segment)',
    );
    cy.then(() => {
      expect(criticalSegment.end).to.equal(
        alertCritical.end,
        `Incident critical End (${criticalSegment.end}) should ` +
          `match alert critical End (${alertCritical.end})`,
      );
      cy.log('Verified: Last incident chart segment End matches last alert bar End');
    });

    cy.log(
      'Expected failure: OU-1205 (end time padding mismatch between incident and alert tooltips)',
    );
  });

  it('6. Cross-validation: alert bar tooltip Start and End dates match alerts table', () => {
    let alertInfo: AlertDates;
    let alertWarning: AlertDates;
    let alertCritical: AlertDates;
    let tableInfoStart: string;
    let tableInfoEnd: string;
    let tableWarningStart: string;
    let tableWarningEnd: string;
    let tableCriticalStart: string;
    let tableCriticalEnd: string;

    cy.log('6.1 Setup, select incident and collect alert bar tooltip dates');
    setupEscalatingIncident();
    incidentsPage.selectIncidentById(ESCALATING_ID);
    incidentsPage.elements.alertsChartContainer().should('be.visible');
    collectAlertTooltip(0).then((d) => {
      alertInfo = d;
      cy.log(`Alert 0 (info): start=${d.start}, end=${d.end}`);
    });
    collectAlertTooltip(1).then((d) => {
      alertWarning = d;
      cy.log(`Alert 1 (warning): start=${d.start}, end=${d.end}`);
    });
    collectAlertTooltip(2).then((d) => {
      alertCritical = d;
      cy.log(`Alert 2 (critical): start=${d.start}, end=${d.end}`);
    });

    cy.log(
      '6.2 Collect alerts table Start and End dates (table sorted ascending by start: 0=info, 1=warning, 2=critical)',
    );
    incidentsPage.getSelectedIncidentAlerts().then((alerts) => {
      expect(alerts.length).to.equal(3, 'Should have 3 alert rows');
      alerts[0]
        .getStartCell()
        .invoke('text')
        .then((t) => {
          tableInfoStart = t.trim();
          cy.log(`Table info start: ${tableInfoStart}`);
        });
      alerts[0]
        .getEndCell()
        .invoke('text')
        .then((t) => {
          tableInfoEnd = t.trim();
          cy.log(`Table info end: ${tableInfoEnd}`);
        });
      alerts[1]
        .getStartCell()
        .invoke('text')
        .then((t) => {
          tableWarningStart = t.trim();
          cy.log(`Table warning start: ${tableWarningStart}`);
        });
      alerts[1]
        .getEndCell()
        .invoke('text')
        .then((t) => {
          tableWarningEnd = t.trim();
          cy.log(`Table warning end: ${tableWarningEnd}`);
        });
      alerts[2]
        .getStartCell()
        .invoke('text')
        .then((t) => {
          tableCriticalStart = t.trim();
          cy.log(`Table critical start: ${tableCriticalStart}`);
        });
      alerts[2]
        .getEndCell()
        .invoke('text')
        .then((t) => {
          tableCriticalEnd = t.trim();
          cy.log(`Table critical end: ${tableCriticalEnd}`);
        });
    });

    cy.log('6.3 Assert alert tooltip Start and End match alerts table Start and End');
    cy.then(() => {
      expect(tableInfoStart).to.include(
        alertInfo.start,
        `Table info Start (${tableInfoStart}) should include ` +
          `alert tooltip Start (${alertInfo.start})`,
      );
      expect(tableInfoEnd).to.include(
        alertInfo.end,
        `Table info End (${tableInfoEnd}) should include alert tooltip End (${alertInfo.end})`,
      );
      expect(tableWarningStart).to.include(
        alertWarning.start,
        `Table warning Start (${tableWarningStart}) should ` +
          `include alert tooltip Start (${alertWarning.start})`,
      );
      expect(tableWarningEnd).to.include(
        alertWarning.end,
        `Table warning End (${tableWarningEnd}) should include ` +
          `alert tooltip End (${alertWarning.end})`,
      );
      expect(tableCriticalStart).to.include(
        alertCritical.start,
        `Table critical Start (${tableCriticalStart}) should ` +
          `include alert tooltip Start (${alertCritical.start})`,
      );
      expect(tableCriticalEnd).to.include(
        alertCritical.end,
        `Table critical End (${tableCriticalEnd}) should ` +
          `include alert tooltip End (${alertCritical.end})`,
      );
      cy.log('Verified: Alert tooltip Start and End dates match alerts table');
    });

    cy.log('Expected failure: OU-1205 (end time padding mismatch between alert tooltip and table)');
  });
});
