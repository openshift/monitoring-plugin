import { CustomerPerspectiveName } from '@/shared/constants/perspective';
import { testMetricsRegression2 } from '../../support/monitoring/02.reg_metrics_2.cy';
import { testMetricsRegression1 } from '../../support/monitoring/02.reg_metrics_1.cy';
import { testMetricsRegressionNamespace1 } from '../../support/monitoring/05.reg_metrics_namespace_1.cy';
import { commonPages } from '../../views/common';
import { nav } from '../../views/nav';
import { testMetricsRegressionNamespace2 } from '../../support/monitoring/05.reg_metrics_namespace_2.cy';
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
  testMetricsRegression1(CustomerPerspectiveName.CorePlatform);
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
    testMetricsRegressionNamespace1(CustomerPerspectiveName.CorePlatform);
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
  testMetricsRegression2(CustomerPerspectiveName.CorePlatform);
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
    testMetricsRegressionNamespace2(CustomerPerspectiveName.CorePlatform);
  },
);
