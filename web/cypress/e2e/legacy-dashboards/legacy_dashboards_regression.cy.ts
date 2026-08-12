import { CustomerPerspectiveName } from '@/shared/constants/perspective';
import { CLUSTER_MONITORING_OPERATOR } from '../../support/shared/operators';
import { testLegacyDashboardsRegression } from '../../support/legacy-dashboards/legacy_dashboards_regressions.cy';
import { testLegacyDashboardsRegressionNamespace } from '../../support/legacy-dashboards/legacy_dashboards_regressions_namespaced.cy';
import { commonPages } from '../../views/shared/common';
import { nav } from '../../views/shared/nav';

// Test suite for Administrator perspective
describe(
  'Regression: Monitoring - Legacy Dashboards (Administrator)',
  { tags: ['@legacy-dashboards'] },
  () => {
    before(() => {
      cy.ensureMonitoringPlugin(CLUSTER_MONITORING_OPERATOR);
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
    testLegacyDashboardsRegression(CustomerPerspectiveName.CorePlatform);
  },
);

// Test suite for Administrator perspective
describe(
  'Regression: Monitoring - Legacy Dashboards Namespaced (Administrator)',
  { tags: ['@legacy-dashboards', '@metrics'] },
  () => {
    before(() => {
      cy.ensureMonitoringPlugin(CLUSTER_MONITORING_OPERATOR);
    });

    beforeEach(() => {
      nav.sidenav.clickNavLink(['Observe', 'Dashboards']);
      commonPages.titleShouldHaveText('Dashboards');
      cy.changeNamespace(CLUSTER_MONITORING_OPERATOR.namespace);
    });

    // Run tests in Administrator perspective
    testLegacyDashboardsRegressionNamespace(CustomerPerspectiveName.CorePlatform);
  },
);
