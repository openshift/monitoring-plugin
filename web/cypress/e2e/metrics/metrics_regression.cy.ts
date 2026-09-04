import { CustomerPerspectiveName } from '@/shared/constants/perspective';
import {
  testMetricsRegression1,
  testMetricsRegression2,
} from '../../support/metrics/metrics_regressions.cy';
import {
  testMetricsRegressionNamespace1,
  testMetricsRegressionNamespace2,
} from '../../support/metrics/metrics_regressions_namespaced.cy';
import { commonPages } from '../../views/shared/common';
import { nav } from '../../views/shared/nav';
import { CLUSTER_MONITORING_OPERATOR } from '../../support/shared/operators';

// Test suite for Administrator perspective
describe('Regression: Monitoring - Metrics (Administrator)', { tags: ['@metrics'] }, () => {
  before(() => {
    cy.ensureMonitoringPlugin(CLUSTER_MONITORING_OPERATOR);
  });

  beforeEach(() => {
    nav.sidenav.clickNavLink(['Observe', 'Metrics']);
    commonPages.titleShouldHaveText('Metrics');
    cy.changeNamespace('All Projects');
  });

  // Run tests in Administrator perspective
  testMetricsRegression1(CustomerPerspectiveName.CorePlatform);
});

// Test suite for Administrator perspective
describe(
  'Regression: Monitoring - Metrics Namespaced (Administrator)',
  { tags: ['@metrics'] },
  () => {
    before(() => {
      cy.ensureMonitoringPlugin(CLUSTER_MONITORING_OPERATOR);
    });

    beforeEach(() => {
      nav.sidenav.clickNavLink(['Observe', 'Metrics']);
      commonPages.titleShouldHaveText('Metrics');
      cy.changeNamespace(CLUSTER_MONITORING_OPERATOR.namespace);
    });

    // Run tests in Administrator perspective
    testMetricsRegressionNamespace1(CustomerPerspectiveName.CorePlatform);
  },
);

// Test suite for Administrator perspective
describe('Regression: Monitoring - Metrics (Administrator)', { tags: ['@metrics'] }, () => {
  before(() => {
    cy.ensureMonitoringPlugin(CLUSTER_MONITORING_OPERATOR);
  });

  beforeEach(() => {
    nav.sidenav.clickNavLink(['Observe', 'Metrics']);
    commonPages.titleShouldHaveText('Metrics');
    cy.changeNamespace('All Projects');
  });

  // Run tests in Administrator perspective
  testMetricsRegression2(CustomerPerspectiveName.CorePlatform);
});

// Test suite for Administrator perspective
describe(
  'Regression: Monitoring - Metrics Namespaced (Administrator)',
  { tags: ['@metrics'] },
  () => {
    before(() => {
      cy.ensureMonitoringPlugin(CLUSTER_MONITORING_OPERATOR);
    });

    beforeEach(() => {
      nav.sidenav.clickNavLink(['Observe', 'Metrics']);
      commonPages.titleShouldHaveText('Metrics');
      cy.changeNamespace(CLUSTER_MONITORING_OPERATOR.namespace);
    });

    // Run tests in Administrator perspective
    testMetricsRegressionNamespace2(CustomerPerspectiveName.CorePlatform);
  },
);
