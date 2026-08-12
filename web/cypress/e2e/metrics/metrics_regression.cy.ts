import { runAllRegressionMetricsTests2 } from '../../support/monitoring/02.reg_metrics_2.cy';
import { runAllRegressionMetricsTests1 } from '../../support/monitoring/02.reg_metrics_1.cy';
import { runAllRegressionMetricsTestsNamespace1 } from '../../support/monitoring/05.reg_metrics_namespace_1.cy';
import { commonPages } from '../../views/common';
import { nav } from '../../views/nav';
import { runAllRegressionMetricsTestsNamespace2 } from '../../support/monitoring/05.reg_metrics_namespace_2.cy';
import { CLUSTER_MONITORING_OPERATOR } from '../../support/operators';

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
