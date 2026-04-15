/*
Performance walkthrough: measures rendering cost of interactive operations
(filter toggling, time range switching, table row expansion) under load.

Unlike 01.performance_benchmark which measures initial chart render time,
this test measures incremental re-render cost during a realistic user session.

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

const THRESHOLDS = {
  FILTER_APPLY: 3_000,
  FILTER_CLEAR: 800,
  TIME_RANGE_SWITCH: 4_000,
  TABLE_EXPAND_100: 4_000,
  TABLE_EXPAND_500: 20_000,
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
    const status = elapsedMs < thresholdMs ? 'PASS' : 'FAIL';
    const msg = `BENCHMARK [${status}] ${label}: ${elapsedMs}ms (threshold: ${thresholdMs}ms)`;
    cy.log(msg);
    cy.task('log', msg);
    expect(elapsedMs, `${label} should complete within ${thresholdMs}ms`).to.be.lessThan(
      thresholdMs,
    );
  });
};

describe(
  'Performance: Interactive Walkthrough',
  { tags: ['@demo', '@incidents', '@performance'], numTestsKeptInMemory: 0 },
  () => {
    before(() => {
      cy.beforeBlockCOO(MCP, MP, { dashboards: false, troubleshootingPanel: false });
    });

    afterEach(function () {
      if (benchmarkResults.length > 0) {
        cy.log('--- Benchmark results for this test ---');
        cy.task('log', '--- Benchmark results for this test ---');
        benchmarkResults.forEach((r) => {
          const status = r.elapsedMs < r.thresholdMs ? 'PASS' : 'FAIL';
          const line = `  [${status}] ${r.label}: ${r.elapsedMs}ms / ${r.thresholdMs}ms`;
          cy.log(line);
          cy.task('log', line);
        });
        benchmarkResults.length = 0;
      }
    });

    it('7.1 Walkthrough: Filter interaction and time range switching with 20 incidents', () => {
      cy.mockIncidentFixture('incident-scenarios/22-benchmark-20-incidents.yaml');
      incidentsPage.clearAllFilters();
      incidentsPage.setDays('1 day');
      incidentsPage.elements.incidentsChartBarsGroups().should('have.length', 20);

      // --- Phase 1: Filter interaction ---

      cy.log('7.1.1 Apply Critical severity filter');
      markStart('Filter apply - Critical');

      incidentsPage.toggleFilter('Critical');
      incidentsPage.elements.incidentsChartContainer().should('be.visible');
      incidentsPage.elements.incidentsChartBarsGroups().should('exist');

      recordBenchmark('Filter apply - Critical', THRESHOLDS.FILTER_APPLY);

      cy.log('7.1.2 Clear all filters (restore 20 incidents)');
      markStart('Filter clear - all');

      incidentsPage.clearAllFilters();
      incidentsPage.elements.incidentsChartBarsGroups().should('have.length', 20);

      recordBenchmark('Filter clear - all', THRESHOLDS.FILTER_CLEAR);

      cy.log('7.1.3 Apply Warning severity filter');
      markStart('Filter apply - Warning');

      incidentsPage.toggleFilter('Warning');
      incidentsPage.elements.incidentsChartContainer().should('be.visible');
      incidentsPage.elements.incidentsChartBarsGroups().should('exist');

      recordBenchmark('Filter apply - Warning', THRESHOLDS.FILTER_APPLY);

      cy.log('7.1.4 Clear all filters again');
      markStart('Filter clear - all (2nd)');

      incidentsPage.clearAllFilters();
      incidentsPage.elements.incidentsChartBarsGroups().should('have.length', 20);

      recordBenchmark('Filter clear - all (2nd)', THRESHOLDS.FILTER_CLEAR);

      // --- Phase 2: Time range switching ---

      cy.log('7.1.5 Switch time range from 1 day to 3 days');
      markStart('Time range switch - 1d to 3d');

      incidentsPage.setDays('3 days');
      incidentsPage.elements.incidentsChartContainer().should('be.visible');
      incidentsPage.elements.incidentsChartBarsGroups().should('exist');

      recordBenchmark('Time range switch - 1d to 3d', THRESHOLDS.TIME_RANGE_SWITCH);

      cy.log('7.1.6 Switch time range from 3 days to 7 days');
      markStart('Time range switch - 3d to 7d');

      incidentsPage.setDays('7 days');
      incidentsPage.elements.incidentsChartContainer().should('be.visible');
      incidentsPage.elements.incidentsChartBarsGroups().should('exist');

      recordBenchmark('Time range switch - 3d to 7d', THRESHOLDS.TIME_RANGE_SWITCH);

      cy.log('7.1.7 Switch time range from 7 days to 15 days');
      markStart('Time range switch - 7d to 15d');

      incidentsPage.setDays('15 days');
      incidentsPage.elements.incidentsChartContainer().should('be.visible');
      incidentsPage.elements.incidentsChartBarsGroups().should('exist');

      recordBenchmark('Time range switch - 7d to 15d', THRESHOLDS.TIME_RANGE_SWITCH);

      cy.log('7.1.8 Switch time range back to 1 day');
      markStart('Time range switch - 15d to 1d');

      incidentsPage.setDays('1 day');
      incidentsPage.elements.incidentsChartContainer().should('be.visible');
      incidentsPage.elements.incidentsChartBarsGroups().should('have.length', 20);

      recordBenchmark('Time range switch - 15d to 1d', THRESHOLDS.TIME_RANGE_SWITCH);
    });

    it('7.2 Walkthrough: Table row expansion with 100 and 500 alerts', () => {
      cy.wait(10000);

      // --- Phase 3a: Table expansion with 100 alerts ---

      cy.log('7.2.1 Load 100-alert fixture and select incident');
      cy.mockIncidentFixture('incident-scenarios/15-stress-test-100-alerts.yaml');
      incidentsPage.clearAllFilters();
      incidentsPage.setDays('1 day');
      incidentsPage.selectIncidentById('cluster-wide-failure-100-alerts');
      incidentsPage.elements.incidentsTable().should('be.visible');

      cy.log('7.2.2 Expand first component row (100 alerts)');
      markStart('Table expand - 100 alerts');

      incidentsPage.expandRow(0);
      incidentsPage.elements.incidentsDetailsTableRows().should('have.length.greaterThan', 0);

      recordBenchmark('Table expand - 100 alerts', THRESHOLDS.TABLE_EXPAND_100);

      // --- Phase 3b: Table expansion with 500 alerts ---

      cy.log('7.2.3 Load 500-alert fixture and select incident');
      cy.mockIncidentFixture('incident-scenarios/17-stress-test-500-alerts.yaml');
      incidentsPage.clearAllFilters();
      incidentsPage.setDays('1 day');
      incidentsPage.selectIncidentById('cluster-wide-failure-500-alerts');
      incidentsPage.elements.incidentsTable().should('be.visible');

      cy.log('7.2.4 Expand first component row (500 alerts)');
      markStart('Table expand - 500 alerts');

      incidentsPage.expandRow(0);
      incidentsPage.elements.incidentsDetailsTableRows().should('have.length.greaterThan', 0);

      recordBenchmark('Table expand - 500 alerts', THRESHOLDS.TABLE_EXPAND_500);
    });
  },
);
