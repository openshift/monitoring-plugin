/*
Performance benchmark tests for the Incidents page UI rendering.

Measures wall-clock time for key rendering operations under escalating data loads.
Cypress command overhead adds a constant baseline (~3-5s per navigation cycle), so
these thresholds are NOT absolute performance targets. They serve as regression
indicators: if a code change causes timings to exceed thresholds that previously
passed, it signals a potential performance degradation worth investigating.

Tune THRESHOLDS based on your CI environment's baseline. Run the suite 3-5 times
on a clean build to establish stable baselines, then set thresholds at ~2x the
median observed time.

Verifies: OBSINTA-1006
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

// Wall-clock thresholds in ms. Includes Cypress overhead (navigation, intercept
// wait, command scheduling). Set conservatively for initial calibration — tighten
// after observing stable baselines in your environment.
const THRESHOLDS = {
  INCIDENTS_CHART_100_ALERTS: 4_000,
  INCIDENTS_CHART_200_ALERTS: 3_000,
  INCIDENTS_CHART_500_ALERTS: 6_000,
  INCIDENTS_CHART_1000_ALERTS: 60_000,

  ALERTS_CHART_100_ALERTS: 3_000,
  ALERTS_CHART_200_ALERTS: 8_000,
  ALERTS_CHART_500_ALERTS: 20_000,
  ALERTS_CHART_1000_ALERTS: 60_000,

  INCIDENTS_CHART_20_INCIDENTS: 7_000,
  INCIDENTS_CHART_MIXED_12: 5_000,
};

interface BenchmarkResult {
  label: string;
  elapsedMs: number;
  thresholdMs: number;
}

const benchmarkResults: BenchmarkResult[] = [];

const markStart = (label: string) => {
  cy.window({ log: false }).then((win) => {
    win.performance.clearMarks(label);
    win.performance.clearMeasures(`measure:${label}`);
    win.performance.mark(label);
  });
};

const recordBenchmark = (label: string, thresholdMs: number) => {
  cy.window({ log: false }).then((win) => {
    const entry = win.performance.measure(`measure:${label}`, label);
    const elapsedMs = Math.round(entry.duration);
    benchmarkResults.push({ label, elapsedMs, thresholdMs });
    const status = elapsedMs <= thresholdMs ? 'PASS' : 'FAIL';
    const msg = `BENCHMARK [${status}] ${label}: ${elapsedMs}ms (threshold: ${thresholdMs}ms)`;
    cy.log(msg);
    cy.task('log', msg);
    expect(elapsedMs, `${label} should complete within ${thresholdMs}ms`).to.be.at.most(
      thresholdMs,
    );
  });
};

describe(
  'Regression: Performance Benchmark',
  { tags: ['@demo', '@incidents', '@performance', '@regression'], numTestsKeptInMemory: 0 },
  () => {
    before(() => {
      cy.beforeBlockCOO(MCP, MP, { dashboards: false, troubleshootingPanel: false });
    });

    afterEach(function () {
      if (benchmarkResults.length > 0) {
        cy.log('--- Benchmark results for this test ---');
        cy.task('log', '--- Benchmark results for this test ---');
        benchmarkResults.forEach((r) => {
          const status = r.elapsedMs <= r.thresholdMs ? 'PASS' : 'FAIL';
          const line = `  [${status}] ${r.label}: ${r.elapsedMs}ms / ${r.thresholdMs}ms`;
          cy.log(line);
          cy.task('log', line);
        });
        benchmarkResults.length = 0;
      }
    });

    it('6.1 Benchmark: Incidents chart render time with escalating alert counts', () => {
      const benchmarkIncidentsChart = (
        fixture: string,
        expectedBars: number,
        thresholdMs: number,
        label: string,
        days: '1 day' | '3 days' | '7 days' | '15 days' = '1 day',
      ) => {
        cy.mockIncidentFixture(`incident-scenarios/${fixture}`);

        markStart(label);

        incidentsPage.clearAllFilters();
        incidentsPage.setDays(days);
        incidentsPage.elements.incidentsChartBarsGroups().should('have.length', expectedBars);

        recordBenchmark(label, thresholdMs);
      };

      cy.log('6.1.1 Incidents chart with 100 alerts (single incident)');
      benchmarkIncidentsChart(
        '15-stress-test-100-alerts.yaml',
        1,
        THRESHOLDS.INCIDENTS_CHART_100_ALERTS,
        'Incidents chart - 100 alerts',
      );

      cy.log('6.1.2 Incidents chart with 200 alerts (single incident)');
      benchmarkIncidentsChart(
        '16-stress-test-200-alerts.yaml',
        1,
        THRESHOLDS.INCIDENTS_CHART_200_ALERTS,
        'Incidents chart - 200 alerts',
      );

      cy.log('6.1.3 Incidents chart with 500 alerts (single incident)');
      benchmarkIncidentsChart(
        '17-stress-test-500-alerts.yaml',
        1,
        THRESHOLDS.INCIDENTS_CHART_500_ALERTS,
        'Incidents chart - 500 alerts',
      );
    });

    it('6.2 Benchmark: Alerts detail chart render time after incident selection', () => {
      cy.wait(10000);

      const benchmarkAlertsChart = (
        fixture: string,
        incidentId: string,
        thresholdMs: number,
        label: string,
        days: '1 day' | '3 days' | '7 days' | '15 days' = '1 day',
      ) => {
        cy.mockIncidentFixture(`incident-scenarios/${fixture}`);
        incidentsPage.clearAllFilters();
        incidentsPage.setDays(days);
        incidentsPage.elements.incidentsChartBarsGroups().should('have.length', 1);

        incidentsPage.selectIncidentById(incidentId);

        markStart(label);

        incidentsPage.elements.alertsChartCard().should('be.visible');
        incidentsPage.elements.alertsChartBarsVisiblePaths().should('have.length.greaterThan', 0);

        recordBenchmark(label, thresholdMs);
      };

      cy.log('6.2.1 Alerts chart after selecting incident with 100 alerts');
      benchmarkAlertsChart(
        '15-stress-test-100-alerts.yaml',
        'cluster-wide-failure-100-alerts',
        THRESHOLDS.ALERTS_CHART_100_ALERTS,
        'Alerts chart - 100 alerts',
      );

      cy.log('6.2.2 Alerts chart after selecting incident with 200 alerts');
      benchmarkAlertsChart(
        '16-stress-test-200-alerts.yaml',
        'cluster-wide-failure-200-alerts',
        THRESHOLDS.ALERTS_CHART_200_ALERTS,
        'Alerts chart - 200 alerts',
      );

      cy.log('6.2.3 Alerts chart after selecting incident with 500 alerts');
      benchmarkAlertsChart(
        '17-stress-test-500-alerts.yaml',
        'cluster-wide-failure-500-alerts',
        THRESHOLDS.ALERTS_CHART_500_ALERTS,
        'Alerts chart - 500 alerts',
      );
    });

    it('6.3 Benchmark: Multi-incident chart render time (20 uniform incidents)', () => {
      cy.wait(10000);

      cy.mockIncidentFixture('incident-scenarios/22-benchmark-20-incidents.yaml');

      markStart('Incidents chart - 20 uniform incidents');

      incidentsPage.clearAllFilters();
      incidentsPage.setDays('1 day');
      incidentsPage.elements.incidentsChartBarsGroups().should('have.length', 20);

      recordBenchmark(
        'Incidents chart - 20 uniform incidents',
        THRESHOLDS.INCIDENTS_CHART_20_INCIDENTS,
      );
    });

    it('6.4 Benchmark: Mixed-size incidents chart render time (12 heterogeneous incidents)', () => {
      cy.wait(10000);

      cy.mockIncidentFixture('incident-scenarios/23-benchmark-mixed-size-incidents.yaml');

      markStart('Incidents chart - 12 mixed-size incidents (67 alerts)');

      incidentsPage.clearAllFilters();
      incidentsPage.setDays('1 day');
      incidentsPage.elements.incidentsChartBarsGroups().should('have.length', 12);

      recordBenchmark(
        'Incidents chart - 12 mixed-size incidents (67 alerts)',
        THRESHOLDS.INCIDENTS_CHART_MIXED_12,
      );
    });
  },
);
