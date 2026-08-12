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

import { incidentsPage } from '../../../views/incidents/incidents-page';
import { BenchmarkCollector } from '../../../support/shared/commands/benchmark-utils';
import {
  CLUSTER_MONITORING_OPERATOR,
  CLUSTER_OBSERVABILITY_OPERATOR,
} from '../../../support/shared/operators';

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

const collector = new BenchmarkCollector('performance_benchmark.cy.ts');

describe(
  'Regression: Performance Benchmark',
  { tags: ['@cluster-health-analyzer', '@coo'], numTestsKeptInMemory: 0 },
  () => {
    before(() => {
      cy.beforeBlockCOO(CLUSTER_OBSERVABILITY_OPERATOR, CLUSTER_MONITORING_OPERATOR, {
        dashboards: false,
        troubleshootingPanel: false,
      });
    });

    afterEach(() => {
      collector.reportAfterEach();
    });

    after(() => {
      collector.writeReport();
    });

    it('6.1 Benchmark: Incidents chart render time with escalating alert counts', () => {
      const benchmarkIncidentsChart = (
        fixture: string,
        expectedBars: number,
        thresholdMs: number,
        label: string,
        days: '1 day' | '3 days' | '7 days' | '15 days' = '1 day',
      ) => {
        cy.mockIncidentFixture(`incidents/scenarios/${fixture}`);

        collector.markStart(label);

        incidentsPage.clearAllFilters();
        incidentsPage.setDays(days);
        incidentsPage.elements.incidentsChartBarsGroups().should('have.length', expectedBars);

        collector.recordBenchmark(label, thresholdMs);
      };

      cy.log('6.1.1 Incidents chart with 100 alerts (single incident)');
      benchmarkIncidentsChart(
        'stress-test-100-alerts.yaml',
        1,
        THRESHOLDS.INCIDENTS_CHART_100_ALERTS,
        'Incidents chart - 100 alerts',
      );

      cy.log('6.1.2 Incidents chart with 200 alerts (single incident)');
      benchmarkIncidentsChart(
        'stress-test-200-alerts.yaml',
        1,
        THRESHOLDS.INCIDENTS_CHART_200_ALERTS,
        'Incidents chart - 200 alerts',
      );

      cy.log('6.1.3 Incidents chart with 500 alerts (single incident)');
      benchmarkIncidentsChart(
        'stress-test-500-alerts.yaml',
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
        cy.mockIncidentFixture(`incidents/scenarios/${fixture}`);
        incidentsPage.clearAllFilters();
        incidentsPage.setDays(days);
        incidentsPage.elements.incidentsChartBarsGroups().should('have.length', 1);

        incidentsPage.selectIncidentById(incidentId);

        collector.markStart(label);

        incidentsPage.elements.alertsChartCard().should('be.visible');
        incidentsPage.elements.alertsChartBarsVisiblePaths().should('have.length.greaterThan', 0);

        collector.recordBenchmark(label, thresholdMs);
      };

      cy.log('6.2.1 Alerts chart after selecting incident with 100 alerts');
      benchmarkAlertsChart(
        'stress-test-100-alerts.yaml',
        'cluster-wide-failure-100-alerts',
        THRESHOLDS.ALERTS_CHART_100_ALERTS,
        'Alerts chart - 100 alerts',
      );

      cy.log('6.2.2 Alerts chart after selecting incident with 200 alerts');
      benchmarkAlertsChart(
        'stress-test-200-alerts.yaml',
        'cluster-wide-failure-200-alerts',
        THRESHOLDS.ALERTS_CHART_200_ALERTS,
        'Alerts chart - 200 alerts',
      );

      cy.log('6.2.3 Alerts chart after selecting incident with 500 alerts');
      benchmarkAlertsChart(
        'stress-test-500-alerts.yaml',
        'cluster-wide-failure-500-alerts',
        THRESHOLDS.ALERTS_CHART_500_ALERTS,
        'Alerts chart - 500 alerts',
      );
    });

    it('6.3 Benchmark: Multi-incident chart render time (20 uniform incidents)', () => {
      cy.wait(10000);

      cy.mockIncidentFixture('incidents/scenarios/benchmark-20-incidents.yaml');

      collector.markStart('Incidents chart - 20 uniform incidents');

      incidentsPage.clearAllFilters();
      incidentsPage.setDays('1 day');
      incidentsPage.elements.incidentsChartBarsGroups().should('have.length', 20);

      collector.recordBenchmark(
        'Incidents chart - 20 uniform incidents',
        THRESHOLDS.INCIDENTS_CHART_20_INCIDENTS,
      );
    });

    it('6.4 Benchmark: Mixed-size incidents chart render time (12 heterogeneous incidents)', () => {
      cy.wait(10000);

      cy.mockIncidentFixture('incidents/scenarios/benchmark-mixed-size-incidents.yaml');

      collector.markStart('Incidents chart - 12 mixed-size incidents (67 alerts)');

      incidentsPage.clearAllFilters();
      incidentsPage.setDays('1 day');
      incidentsPage.elements.incidentsChartBarsGroups().should('have.length', 12);

      collector.recordBenchmark(
        'Incidents chart - 12 mixed-size incidents (67 alerts)',
        THRESHOLDS.INCIDENTS_CHART_MIXED_12,
      );
    });
  },
);
