import { CLUSTER_MONITORING_OPERATOR } from '../../../support/operators';
import { testMetricsRegression2 } from '../../../support/monitoring/reg_metrics_2.cy';
import { testMetricsRegressionNamespace2 } from '../../../support/monitoring/reg_metrics_namespace_2.cy';
import { commonPages } from '../../../views/common';
import { nav } from '../../../views/nav';
import { CustomerPerspectiveName } from '@/shared/constants/perspective';

// Test suite for Administrator perspective
describe('Regression: Monitoring - Metrics (Administrator)', { tags: ['@metrics'] }, () => {
  before(() => {
    cy.ensureMonitoringPlugin();
  });

  beforeEach(() => {
    cy.restoreLogin();
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
      cy.ensureMonitoringPlugin();
    });

    beforeEach(() => {
      cy.restoreLogin();
      nav.sidenav.clickNavLink(['Observe', 'Metrics']);
      commonPages.titleShouldHaveText('Metrics');
      cy.changeNamespace(CLUSTER_MONITORING_OPERATOR.namespace);
    });

    // Run tests in Administrator perspective
    testMetricsRegressionNamespace2(CustomerPerspectiveName.CorePlatform);
  },
);
