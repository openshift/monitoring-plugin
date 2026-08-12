import {
  runAllRegressionMetricsTests1,
  runAllRegressionMetricsTests2,
} from '../../support/metrics/metrics_regressions.cy';
import {
  runAllRegressionMetricsTestsNamespace1,
  runAllRegressionMetricsTestsNamespace2,
} from '../../support/metrics/metrics_regressions_namespaced.cy';
import { commonPages } from '../../views/shared/common';
import { nav } from '../../views/shared/nav';
import { CLUSTER_MONITORING_OPERATOR } from '../../support/shared/operators';

// Test suite for Administrator perspective
describe('Regression: Monitoring - Metrics (Administrator)', { tags: ['@metrics'] }, () => {
  before(() => {
    cy.beforeBlock(CLUSTER_MONITORING_OPERATOR);
  });

  beforeEach(() => {
    nav.sidenav.clickNavLink(['Observe', 'Metrics']);
    commonPages.titleShouldHaveText('Metrics');
    cy.changeNamespace('All Projects');
  });

  // Run tests in Administrator perspective
  runAllRegressionMetricsTests1({
    name: 'Administrator',
  });
});

// Test suite for Administrator perspective
describe(
  'Regression: Monitoring - Metrics Namespaced (Administrator)',
  { tags: ['@metrics'] },
  () => {
    before(() => {
      cy.beforeBlock(CLUSTER_MONITORING_OPERATOR);
    });

    beforeEach(() => {
      nav.sidenav.clickNavLink(['Observe', 'Metrics']);
      commonPages.titleShouldHaveText('Metrics');
      cy.changeNamespace(CLUSTER_MONITORING_OPERATOR.namespace);
    });

    // Run tests in Administrator perspective
    runAllRegressionMetricsTestsNamespace1({
      name: 'Administrator',
    });
  },
);

// Test suite for Administrator perspective
describe('Regression: Monitoring - Metrics (Administrator)', { tags: ['@metrics'] }, () => {
  before(() => {
    cy.beforeBlock(CLUSTER_MONITORING_OPERATOR);
  });

  beforeEach(() => {
    nav.sidenav.clickNavLink(['Observe', 'Metrics']);
    commonPages.titleShouldHaveText('Metrics');
    cy.changeNamespace('All Projects');
  });

  // Run tests in Administrator perspective
  runAllRegressionMetricsTests2({
    name: 'Administrator',
  });
});

// Test suite for Administrator perspective
describe(
  'Regression: Monitoring - Metrics Namespaced (Administrator)',
  { tags: ['@metrics'] },
  () => {
    before(() => {
      cy.beforeBlock(CLUSTER_MONITORING_OPERATOR);
    });

    beforeEach(() => {
      nav.sidenav.clickNavLink(['Observe', 'Metrics']);
      commonPages.titleShouldHaveText('Metrics');
      cy.changeNamespace(CLUSTER_MONITORING_OPERATOR.namespace);
    });

    // Run tests in Administrator perspective
    runAllRegressionMetricsTestsNamespace2({
      name: 'Administrator',
    });
  },
);
