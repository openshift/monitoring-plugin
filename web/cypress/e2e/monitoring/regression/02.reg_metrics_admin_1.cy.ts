import { runAllRegressionMetricsTests1 } from '../../../support/monitoring/02.reg_metrics_1.cy';
import { commonPages } from '../../../views/common';
import { nav } from '../../../views/nav';

const MP = {
  namespace: 'openshift-monitoring',
  operatorName: 'Cluster Monitoring Operator',
};

// Test suite for Administrator perspective
describe('Regression: Monitoring - Metrics (Administrator)', { tags: ['@monitoring', '@metrics'] }, () => {

  before(() => {
    cy.beforeBlock(MP);
  });

  beforeEach(() => {
    nav.sidenav.clickNavLink(['Observe', 'Metrics']);
    commonPages.titleShouldHaveText('Metrics');
  });

  // Run tests in Administrator perspective
  runAllRegressionMetricsTests1({
    name: 'Administrator',
  });

});

