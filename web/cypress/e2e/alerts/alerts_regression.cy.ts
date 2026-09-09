import { CustomerPerspectiveName } from '@/shared/constants/perspective';
import {
  testAlertsCorePlatformHeaderRegression,
  testAlertsRegression,
} from '../../support/alerts/alerts_regressions.cy';
import { alerts } from '../../fixtures/alerts/interceptWatchdogAlert';
import { testAlertsRegressionNamespace } from '../../support/alerts/alerts_regressions_namespaced.cy';
import { commonPages } from '../../views/common';
import { nav } from '../../views/nav';
import { CLUSTER_MONITORING_OPERATOR } from '../../support/operators';

// Test suite for Core platform perspective
describe(
  'Regression: Monitoring - Alerts (Core platform)',
  { tags: ['@alerting', '@metrics'] },
  () => {
    before(() => {
      cy.ensureMonitoringPlugin(CLUSTER_MONITORING_OPERATOR);
      cy.switchPerspective('Core platform');
    });

    beforeEach(() => {
      alerts.interceptWatchdogAlert();
      nav.sidenav.clickNavLink(['Observe', 'Metrics']);
      commonPages.titleShouldHaveText('Metrics');
      cy.changeNamespace('All Projects');
      nav.sidenav.clickNavLink(['Observe', 'Alerting']);
      commonPages.titleShouldHaveText('Alerting');
      alerts.interceptWatchdogAlert();
    });

    // Run tests in Core platform perspective
    testAlertsCorePlatformHeaderRegression(CustomerPerspectiveName.CorePlatform);
    testAlertsRegression(CustomerPerspectiveName.CorePlatform);
  },
);

describe(
  'Regression: Monitoring - Alerts Namespaced (Administrator)',
  { tags: ['@alerting'] },
  () => {
    before(() => {
      cy.ensureMonitoringPlugin(CLUSTER_MONITORING_OPERATOR);
    });

    beforeEach(() => {
      alerts.interceptWatchdogAlert();
      nav.sidenav.clickNavLink(['Observe', 'Alerting']);
      commonPages.titleShouldHaveText('Alerting');
      alerts.interceptWatchdogAlert();
      cy.changeNamespace(CLUSTER_MONITORING_OPERATOR.namespace);
    });

    // Run tests in Administrator perspective
    testAlertsRegressionNamespace(CustomerPerspectiveName.CorePlatform);
  },
);
