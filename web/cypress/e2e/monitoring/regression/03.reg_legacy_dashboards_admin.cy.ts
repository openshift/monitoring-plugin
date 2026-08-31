import { CustomerPerspectiveName } from '@/shared/constants/perspective';
import { CLUSTER_MONITORING_OPERATOR } from '../../../support/operators';
import { runAllRegressionLegacyDashboardsTests } from '../../../support/monitoring/03.reg_legacy_dashboards.cy';
import { runAllRegressionLegacyDashboardsTestsNamespace } from '../../../support/monitoring/06.reg_legacy_dashboards_namespace.cy';
import { commonPages } from '../../../views/common';
import { nav } from '../../../views/nav';

// Test suite for Administrator perspective
describe(
  'Regression: Monitoring - Legacy Dashboards (Administrator)',
  { tags: ['@legacy-dashboards'] },
  () => {
    before(() => {
      cy.beforeBlock(CLUSTER_MONITORING_OPERATOR);
    });

    beforeEach(() => {
      // When running only this file, beforeBlock changes the namespace to openshift-monitoring so
      // we need to change it back to All Projects before landing to Dashboards page in order to
      // have API Performance dashboard loaded by default
      nav.sidenav.clickNavLink(['Observe', 'Metrics']);
      commonPages.titleShouldHaveText('Metrics');
      cy.changeNamespace('All Projects');
      nav.sidenav.clickNavLink(['Observe', 'Dashboards']);
      commonPages.titleShouldHaveText('Dashboards');
      cy.changeNamespace('All Projects');
    });

    // Run tests in Administrator perspective
    runAllRegressionLegacyDashboardsTests(CustomerPerspectiveName.CorePlatform);
  },
);

// Test suite for Administrator perspective
describe(
  'Regression: Monitoring - Legacy Dashboards Namespaced (Administrator)',
  { tags: ['@legacy-dashboards'] },
  () => {
    before(() => {
      cy.beforeBlock(CLUSTER_MONITORING_OPERATOR);
    });

    beforeEach(() => {
      nav.sidenav.clickNavLink(['Observe', 'Dashboards']);
      commonPages.titleShouldHaveText('Dashboards');
      cy.changeNamespace(CLUSTER_MONITORING_OPERATOR.namespace);
    });

    // Run tests in Administrator perspective
    runAllRegressionLegacyDashboardsTestsNamespace(CustomerPerspectiveName.CorePlatform);
  },
);
